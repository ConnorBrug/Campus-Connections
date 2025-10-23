
// functions/src/index.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { sendNotificationEmail } from '../../src/lib/email'; 
import type { EmailPayload } from '../../src/lib/email'; 

admin.initializeApp();
const db = admin.firestore();

// ------- Types (aligned to your lib/types.ts) -------
type TripStatus = "pending" | "matched" | "cancelled" | "completed";

type TripRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhotoUrl?: string;
  flightCode: string;
  flightDate: string;        // yyyy-MM-dd (not used by matcher except for debugging)
  flightTime: string;        // HH:mm (not used by matcher except for debugging)
  flightDateTime: string;    // ISO (primary)
  departingAirport: string;  // e.g. BOS, BNA
  numberOfCarryons: number;
  numberOfCheckedBags: number;
  university: string;        // 'Boston College' | 'Vanderbilt' | ...
  campusArea?: string;
  status: TripStatus;
  createdAt?: Timestamp | FieldValue;
  matchId?: string | null;
  matchedUserId?: string | null;
  userPreferences: "Male" | "Female" | "No preference";
  userGender: "Male" | "Female" | "Other" | "Prefer not to say";
  noMatchWarningSent: boolean;
  cancellationAlert: boolean;
  userHasBeenFlagged?: boolean;
};

type MatchDoc = {
  id: string;
  participantIds: [string, string];
  tripRequestIds: [string, string];
  createdAt: FieldValue | Timestamp;
  status: "active" | "completed" | "cancelled";
  participants: {
    [userId: string]: {
      userName: string;
      userPhotoUrl?: string;
      university: string;
      flightCode: string;
      flightDateTime: string;
      bagCount: number;
    };
  };
};

// ---- Config ----
const TZ = process.env.TZ || 'America/New_York'; // set your project timezone if needed

// ---- Time helpers ----
const toMs = (iso: string) => new Date(iso).getTime();
const minutesDiff = (aISO: string, bISO: string) =>
  Math.round(Math.abs(toMs(aISO) - toMs(bISO)) / 60000);
const hoursDiff = (aISO: string, bISO: string) => Math.floor(minutesDiff(aISO, bISO) / 60);
const within1Hour = (aISO: string, bISO: string) => minutesDiff(aISO, bISO) <= 60;

// ---- Rules helpers ----
// Bag rules: allow if (≤2 checked & ≤2 carry) OR (≤3 checked & ≤1 carry)
function bagsFit(sumChecked: number, sumCarry: number): boolean {
  return (sumChecked <= 2 && sumCarry <= 2) || (sumChecked <= 3 && sumCarry <= 1);
}

// University + BC campus constraint
function sameCampusIfBC(a: TripRequest, b: TripRequest): boolean {
  if (a.university !== b.university) return false;
  if (a.university === 'Boston College') {
    return (a.campusArea || '') === (b.campusArea || '');
  }
  return true;
}

function genderCompatible(a: TripRequest, b: TripRequest): boolean {
  const ap = a.userPreferences || 'No preference';
  const bp = b.userPreferences || 'No preference';
  const ag = a.userGender || 'Prefer not to say';
  const bg = b.userGender || 'Prefer not to say';
  const aOk = ap === 'No preference' || ap === bg;
  const bOk = bp === 'No preference' || bp === ag;
  return aOk && bOk;
}

function candidateOK(a: TripRequest, b: TripRequest): boolean {
  if (a.departingAirport !== b.departingAirport) return false;
  if (!sameCampusIfBC(a, b)) return false;
  if (!within1Hour(a.flightDateTime, b.flightDateTime)) return false;

  const sumChecked = a.numberOfCheckedBags + b.numberOfCheckedBags;
  const sumCarry = a.numberOfCarryons + b.numberOfCarryons;
  if (!bagsFit(sumChecked, sumCarry)) return false;

  return true;
}

// Lower score = better
function pairScore(a: TripRequest, b: TripRequest): number {
  let score = 0;
  if (a.flightCode && b.flightCode && a.flightCode === b.flightCode) score -= 1000; // prefer same flight code
  if (genderCompatible(a, b)) score -= 100;                                         // prefer gender pref satisfied
  score += minutesDiff(a.flightDateTime, b.flightDateTime);                          // smaller delta is better
  return score;
}

// ---- IO helpers ----
async function fetchPendingTrips(windowHours = 36): Promise<TripRequest[]> {
  const now = new Date();
  const upperISO = new Date(now.getTime() + windowHours * 60 * 60 * 1000).toISOString();

  // status == 'pending' AND now <= flightDateTime <= +36h
  const snap = await db
    .collection('tripRequests')
    .where('status', '==', 'pending')
    .where('flightDateTime', '>=', now.toISOString())
    .where('flightDateTime', '<=', upperISO)
    .get();

  const out: TripRequest[] = [];
  snap.forEach(d => out.push({ ...(d.data() as TripRequest), id: d.id }));
  return out;
}

function bucketKey(t: TripRequest): string {
  const campus = t.university === 'Boston College' ? (t.campusArea || '') : '_';
  return `${t.university}|${campus}|${t.departingAirport}`;
}

async function createPairIfStillPending(a: TripRequest, b: TripRequest, db: Firestore): Promise<string | null> {
  return await db.runTransaction(async (tx) => {
    const aRef = db.collection('tripRequests').doc(a.id);
    const bRef = db.collection('tripRequests').doc(b.id);
    const [aSnap, bSnap] = await tx.getAll(aRef, bRef);
    const A = aSnap.data() as TripRequest | undefined;
    const B = bSnap.data() as TripRequest | undefined;
    if (!A || !B) return null;
    if (A.status !== 'pending' || B.status !== 'pending') return null;
    if (!candidateOK(A, B)) return null;

    const matchRef = db.collection('matches').doc();
    const matchDoc: MatchDoc = {
      id: matchRef.id,
      createdAt: FieldValue.serverTimestamp(),
      status: 'active',
      participantIds: [A.userId, B.userId],
      tripRequestIds: [A.id, B.id],
      participants: {
        [A.userId]: {
          userName: A.userName,
          userPhotoUrl: A.userPhotoUrl,
          university: A.university,
          flightCode: A.flightCode,
          flightDateTime: A.flightDateTime,
          bagCount: A.numberOfCarryons + A.numberOfCheckedBags,
        },
        [B.userId]: {
          userName: B.userName,
          userPhotoUrl: B.userPhotoUrl,
          university: B.university,
          flightCode: B.flightCode,
          flightDateTime: B.flightDateTime,
          bagCount: B.numberOfCarryons + B.numberOfCheckedBags,
        },
      },
    };

    tx.set(matchRef, matchDoc);
    tx.update(aRef, { status: 'matched', matchId: matchRef.id });
    tx.update(bRef, { status: 'matched', matchId: matchRef.id });

    // Send emails to both users
    const emailBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const emailTasks = [
      sendNotificationEmail({
        to: A.userEmail,
        subject: "You've got a match on Connections!",
        body: `You have been matched with ${B.userName} for your upcoming trip. Click below to view the details and start chatting.`,
        link: `${emailBaseUrl}/match-found/${A.id}`,
      }),
      sendNotificationEmail({
        to: B.userEmail,
        subject: "You've got a match on Connections!",
        body: `You have been matched with ${A.userName} for your upcoming trip. Click below to view the details and start chatting.`,
        link: `${emailBaseUrl}/match-found/${B.id}`,
      }),
    ];
    await Promise.all(emailTasks).catch(e => logger.error("Failed to send match notification emails", { error: String(e), matchId: matchRef.id }));


    return matchRef.id;
  });
}

async function warnNoMatchIfWithin5h(pending: TripRequest[]): Promise<number> {
  let sent = 0;
  const nowISO = new Date().toISOString();
  for (const t of pending) {
    // already warned? skip
    if (t.noMatchWarningSent) continue;
    // hours until flight
    const until = hoursDiff(t.flightDateTime, nowISO);
    if (until <= 5 && t.userEmail) {
      try {
        await sendNotificationEmail({
            to: t.userEmail,
            subject: 'Update on your Connections trip request',
            body: 'We are still looking for a match for your upcoming trip. Since your flight is coming up soon, consider alternative transportation as a backup.',
            link: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`
        });
        await db.collection('tripRequests').doc(t.id).update({ noMatchWarningSent: true });
        sent++;
      } catch (e) {
        logger.warn('Failed to send warning', { tripId: t.id, error: String(e) });
      }
    }
  }
  return sent;
}

async function cleanupOldTrips(): Promise<number> {
  const cutoffISO = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // older than +48h after flight
  const snap = await db.collection('tripRequests').where('flightDateTime', '<=', cutoffISO).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  let n = 0;
  snap.forEach(doc => {
    batch.delete(doc.ref);
    n++;
  });
  await batch.commit();
  return n;
}

// ---- Matching pass ----
async function runMatchingPass(): Promise<{ pairs: number; warnings: number; cleaned: number }> {
  const pending = await fetchPendingTrips(36);

  // bucket by university+campus+airport
  const buckets = new Map<string, TripRequest[]>();
  for (const t of pending) {
    const k = bucketKey(t);
    const arr = buckets.get(k) || [];
    arr.push(t);
    buckets.set(k, arr);
  }

  let pairs = 0;

  for (const [, trips] of buckets) {
    // build adjacency
    const adj = new Map<string, { mateId: string; score: number }[]>();
    for (let i = 0; i < trips.length; i++) {
      for (let j = i + 1; j < trips.length; j++) {
        const a = trips[i], b = trips[j];
        if (!candidateOK(a, b)) continue;
        const score = pairScore(a, b);
        (adj.get(a.id) || adj.set(a.id, []).get(a.id)!).push({ mateId: b.id, score });
        (adj.get(b.id) || adj.set(b.id, []).get(b.id)!).push({ mateId: a.id, score });
      }
    }

    // sort each list by best score
    for (const [id, list] of adj) {
      list.sort((x, y) => x.score - y.score);
      adj.set(id, list);
    }

    // greedy: fewest options first
    const order = [...adj.keys()].sort((a, b) => (adj.get(a)!.length - adj.get(b)!.length));
    const used = new Set<string>();

    for (const id of order) {
      if (used.has(id)) continue;
      const options = adj.get(id) || [];
      const pick = options.find(o => !used.has(o.mateId));
      if (!pick) continue;

      const A = trips.find(t => t.id === id)!;
      const B = trips.find(t => t.id === pick.mateId)!;
      const matchedId = await createPairIfStillPending(A, B, db);
      if (matchedId) {
        used.add(A.id);
        used.add(B.id);
        pairs++;
      }
    }

    // NOTE: triples/quads for light bags can be added later.
  }

  const warnings = await warnNoMatchIfWithin5h(pending);
  const cleaned = await cleanupOldTrips();
  return { pairs, warnings, cleaned };
}

// ---- Schedules ----

// Daily primary pass at 12:00 (noon)
export const matchTripsDailyNoon = onSchedule(
  { schedule: '0 12 * * *', timeZone: TZ, region: 'us-east1', memory: '256MiB', maxInstances: 1 },
  async () => {
    logger.info('matchTripsDailyNoon: start');
    const res = await runMatchingPass();
    logger.info('matchTripsDailyNoon: done', res);
  }
);

// Hourly from 12 → 23 for late submissions
export const matchTripsHourlyAfternoons = onSchedule(
  { schedule: '0 12-23 * * *', timeZone: TZ, region: 'us-east1', memory: '256MiB', maxInstances: 1 },
  async () => {
    logger.info('matchTripsHourlyAfternoons: start');
    const res = await runMatchingPass();
    logger.info('matchTripsHourlyAfternoons: done', res);
  }
);
