// src/lib/server-queries.ts
"use server";

import { adminDb } from "@/lib/firebase-admin";
import type { TripRequest, UserProfile } from "./types";
import { addHours, isPast, parseISO } from "date-fns";

/** Server-safe read of a user profile using Admin SDK */
export async function getUserProfileServer(userId: string): Promise<UserProfile | null> {
  const snap = await adminDb.collection("users").doc(userId).get();
  return snap.exists ? (snap.data() as UserProfile) : null;
}

/** Server-safe read of user's active trip using Admin SDK */
export async function getActiveTripForUserServer(userId: string): Promise<TripRequest | null> {
  const qs = await adminDb
    .collection("tripRequests")
    .where("userId", "==", userId)
    .where("status", "in", ["pending", "matched"])
    .limit(1)
    .get();

  if (qs.empty) return null;

  const trip = qs.docs[0].data() as TripRequest;
  try {
    if (trip.flightDateTime && isPast(addHours(parseISO(trip.flightDateTime), 4))) return null;
  } catch {
    // ignore bad date format and return the trip
  }
  return trip;
}
