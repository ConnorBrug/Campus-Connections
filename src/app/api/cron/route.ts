// app/api/cron/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { differenceInHours, isPast, parseISO, addHours, differenceInMinutes } from "date-fns";
import type { TripRequest, Match } from "@/lib/types";
import { sendNotificationEmail } from "@/lib/email";

export const runtime = "nodejs";
const CRON_SECRET = process.env.CRON_SECRET!;

function pickBestMatch(current: TripRequest, candidates: TripRequest[]): TripRequest | null {
  const eligible = candidates.filter((m) => {
    if (m.departingAirport !== current.departingAirport) return false;
    const timeDiff = Math.abs(differenceInHours(parseISO(current.flightDateTime), parseISO(m.flightDateTime)));
    if (timeDiff > 1) return false;
    const combinedChecked = current.numberOfCheckedBags + m.numberOfCheckedBags;
    const combinedCarry = current.numberOfCarryons + m.numberOfCarryons;
    if (combinedChecked > 3 || combinedCarry > 2) return false;
    if (current.university === "Boston College" && m.university === "Boston College" && current.campusArea !== m.campusArea) {
      return false;
    }
    return true;
  });

  if (!eligible.length) return null;

  const prefers = eligible.filter((m) => {
    const a = current.userPreferences === "No preference" || current.userPreferences === m.userGender;
    const b = m.userPreferences === "No preference" || m.userPreferences === current.userGender;
    return a && b;
  });

  const pool = prefers.length ? prefers : eligible;
  pool.sort(
    (a, b) =>
      Math.abs(differenceInMinutes(parseISO(current.flightDateTime), parseISO(a.flightDateTime))) -
      Math.abs(differenceInMinutes(parseISO(current.flightDateTime), parseISO(b.flightDateTime)))
  );
  return pool[0];
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn("Cron job call with invalid secret.");
    return new Response("Unauthorized", { status: 401 });
  }

  let matchesFound = 0;
  let notificationsSent = 0;
  let tripsCleaned = 0;

  try {
    // 1) Pending trips in the future
    const pendingSnap = await adminDb.collection("tripRequests").where("status", "==", "pending").get();
    const allPending: TripRequest[] = [];
    pendingSnap.forEach((d) => {
      const t = d.data() as TripRequest;
      if (!isPast(parseISO(t.flightDateTime))) allPending.push(t);
    });

    const pool = [...allPending];
    const pendingIds = new Set(allPending.map((t) => t.id));
    const matchedIds = new Set<string>();
    const batch = adminDb.batch();

    while (pool.length > 1) {
      const current = pool.shift()!;
      const candidates = pool.filter((t) => t.university === current.university);
      if (!candidates.length) continue;

      const best = pickBestMatch(current, candidates);
      if (!best) continue;

      // remove chosen from pool
      const idx = pool.findIndex((t) => t.id === best.id);
      if (idx > -1) pool.splice(idx, 1);

      matchesFound++;
      matchedIds.add(current.id);
      matchedIds.add(best.id);

      const matchRef = adminDb.collection("matches").doc();
      const newMatch: Match = {
        id: matchRef.id,
        participantIds: [current.userId, best.userId],
        tripRequestIds: [current.id, best.id],
        createdAt: FieldValue.serverTimestamp(),
        status: "active",
        participants: {
          [current.userId]: {
            userName: current.userName,
            userPhotoUrl: current.userPhotoUrl,
            university: current.university,
            flightCode: current.flightCode,
            flightDateTime: current.flightDateTime,
            bagCount: current.numberOfCarryons + current.numberOfCheckedBags,
          },
          [best.userId]: {
            userName: best.userName,
            userPhotoUrl: best.userPhotoUrl,
            university: best.university,
            flightCode: best.flightCode,
            flightDateTime: best.flightDateTime,
            bagCount: best.numberOfCarryons + best.numberOfCheckedBags,
          },
        },
      };

      batch.set(matchRef, newMatch);
      batch.update(adminDb.collection("tripRequests").doc(current.id), { status: "matched", matchId: matchRef.id });
      batch.update(adminDb.collection("tripRequests").doc(best.id), { status: "matched", matchId: matchRef.id });
    }

    if (matchesFound > 0) await batch.commit();

    // 2) No-match warnings (within 5 hours)
    const now = new Date();
    for (const trip of allPending) {
      const stillPending = pendingIds.has(trip.id) && !matchedIds.has(trip.id);
      if (!stillPending) continue;

      const flightTime = parseISO(trip.flightDateTime);
      if (differenceInHours(flightTime, now) <= 5 && !trip.noMatchWarningSent) {
        await sendNotificationEmail({
          to: (trip as any).userEmail || "change-me@example.com", // ensure real email is stored
          subject: "Update on your trip request",
          body:
            "We are still looking for a match for your upcoming trip. As it is getting close to your flight time, we recommend you start looking into alternative transportation.",
          link: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
        });
        notificationsSent++;
        await adminDb.collection("tripRequests").doc(trip.id).update({ noMatchWarningSent: true });
      }
    }

    // 3) Cleanup completed or old trips
    const cleanupBatch = adminDb.batch();
    const oldTripsQuery = adminDb.collection("tripRequests")
      .where("flightDateTime", "<", now.toISOString());
    const oldTripsSnap = await oldTripsQuery.get();

    oldTripsSnap.forEach((d) => {
      const t = d.data() as TripRequest;
       if (isPast(addHours(parseISO(t.flightDateTime), 48))) {
            cleanupBatch.delete(d.ref);
            tripsCleaned++;
        }
    });

    if (tripsCleaned > 0) await cleanupBatch.commit();

    return NextResponse.json({
      success: true,
      message: "Cron job executed successfully.",
      details: { matchesFound, notificationsSent, tripsCleaned },
    });
  } catch (error: any) {
    console.error("Cron job failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
