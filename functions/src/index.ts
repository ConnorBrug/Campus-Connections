// functions/src/index.ts
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { runPairingForWindow, findBestMatchForTrip } from './matching';
import { sendMatchNotification, sendTripRequestConfirmation } from './email';
import { sendMatchSms } from './sms';
import type { TripRequest, Match } from './types';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const chatExpiryFromTrips = (trips: TripRequest[]) => {
  const latest = trips.reduce((mx, t) => Math.max(mx, new Date(t.flightDateTime).getTime()), 0);
  return admin.firestore.Timestamp.fromDate(new Date(latest + 4 * 3600_000));
};

/**
 * Noon job:
 *   - "Riders will be notified of their match at noon the day before"
 *   - Pair flights departing ~18-30 hours from now (tweak if you like).
 */
export const pairMatchNoon = functions.pubsub
  .schedule('0 12 * * *') // 12:00 every day
  .timeZone('America/New_York')   // change if your default tz differs
  .onRun(async () => {
    // 18-30h ahead often lands "tomorrow" boardings for most use cases
    const res = await runPairingForWindow(18, 30);
    functions.logger.info('[pairMatchNoon] result', res);
  });

/**
 * Hourly "catch-up":
 *   - After noon, keep trying hourly for any new/late requests for next-day flights.
 *   - Window: 3-18 hours ahead (tightening as we approach departure).
 */
export const pairMatchHourly = functions.pubsub
  .schedule('0 * * * *') // every hour at :00
  .timeZone('America/New_York')
  .onRun(async () => {
    const res = await runPairingForWindow(3, 18);
    functions.logger.info('[pairMatchHourly] result', res);
  });

/**
 * Optional: manual trigger to test from the console.
 *   functions:call manualPairing --data '{"from":3,"to":24}'
 *
 * Requires the caller's Firebase Auth token to include an `admin: true`
 * custom claim. Without the check, any signed-in user could trigger the
 * matcher against arbitrary time windows.
 */
export const manualPairing = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign-in required');
  }
  if (context.auth.token?.admin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }
  const from = typeof data?.from === 'number' ? data.from : 3;
  const to   = typeof data?.to   === 'number' ? data.to   : 24;
  // Defensive bounds: never accept windows outside [0, 168h / 1 week].
  const safeFrom = Math.max(0, Math.min(168, from));
  const safeTo   = Math.max(safeFrom, Math.min(168, to));
  const res = await runPairingForWindow(safeFrom, safeTo);
  return res;
});

/**
 * Late-submission instant matching.
 * Fires when a new trip request is created. If the flight is 3-18h away,
 * attempts to find an immediate match from the pending pool.
 */
export const onTripCreated = functions.firestore
  .document('tripRequests/{tripId}')
  .onCreate(async (snap) => {
    const trip = { id: snap.id, ...snap.data() } as TripRequest;

    // Best-effort confirmation when request enters the pool.
    sendTripRequestConfirmation(trip).catch(() => {});

    const now = Date.now();
    const flightMs = new Date(trip.flightDateTime).getTime();
    const hoursUntil = (flightMs - now) / 3600_000;

    // Only fire for flights 3-18h away (catch-up window)
    if (hoursUntil < 3 || hoursUntil > 18) return;

    // Load pending trips in the same time window
    const minISO = new Date(now + 3 * 3600_000).toISOString();
    const maxISO = new Date(now + 18 * 3600_000).toISOString();
    const pendingSnap = await db.collection('tripRequests')
      .where('status', '==', 'pending')
      .where('flightDateTime', '>=', minISO)
      .where('flightDateTime', '<', maxISO)
      .get();

    const pool = pendingSnap.docs
      .map(d => ({ id: d.id, ...d.data() }) as TripRequest)
      .filter(t => t.id !== trip.id);

    if (!pool.length) return;

    const bestMatch = findBestMatchForTrip(trip, pool);
    if (!bestMatch) return;

    // Use a transaction to prevent race condition with hourly cron
    await db.runTransaction(async (tx) => {
      const tripRef = db.collection('tripRequests').doc(trip.id);
      const partnerRef = db.collection('tripRequests').doc(bestMatch.id);

      const [tripSnap, partnerSnap] = await Promise.all([
        tx.get(tripRef),
        tx.get(partnerRef),
      ]);

      // Check both are still pending
      if (tripSnap.data()?.status !== 'pending' || partnerSnap.data()?.status !== 'pending') {
        return;
      }

      const matchRef = db.collection('matches').doc();
      const match: Match = {
        id: matchRef.id,
        participantIds: [trip.userId, bestMatch.userId],
        participants: {
          [trip.userId]: {
            userId: trip.userId,
            userName: trip.userName ?? 'User',
            userPhotoUrl: trip.userPhotoUrl ?? null,
            university: trip.university,
            flightCode: trip.flightCode,
            flightDateTime: trip.flightDateTime,
          },
          [bestMatch.userId]: {
            userId: bestMatch.userId,
            userName: bestMatch.userName ?? 'User',
            userPhotoUrl: bestMatch.userPhotoUrl ?? null,
            university: bestMatch.university,
            flightCode: bestMatch.flightCode,
            flightDateTime: bestMatch.flightDateTime,
          },
        },
        requestIds: [trip.id, bestMatch.id],
        university: trip.university,
        campusArea: trip.campusArea ?? null,
        departingAirport: trip.departingAirport,
        flightCode: trip.flightCode === bestMatch.flightCode ? trip.flightCode : undefined,
        assignedAtISO: new Date().toISOString(),
        status: 'matched',
        reason: 'Late-submission instant match',
        matchTier: 'standard',
      };

      tx.set(matchRef, match);
      tx.update(tripRef, {
        status: 'matched',
        matchId: matchRef.id,
        matchedUserId: bestMatch.userId,
        cancellationAlert: false,
      });
      tx.update(partnerRef, {
        status: 'matched',
        matchId: matchRef.id,
        matchedUserId: trip.userId,
        cancellationAlert: false,
      });
    });

    // Auto-create chat document + system message for instant match
    const chatId = [trip.userId, bestMatch.userId].sort().join('_');
    const chatRef = db.collection('chats').doc(chatId);

    const riders = [trip, bestMatch];
    const lines = riders.map(r => {
      const dt = new Date(r.flightDateTime);
      const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `- ${r.userName ?? 'Rider'}: Flight ${r.flightCode} at ${timeStr}.`;
    });
    const systemMsg = [
      'This is an automated message to start your coordination.',
      '',
      ...lines,
      '',
      'Note: This was a late-submission match. Coordinate quickly!',
      '',
      'Recommendation: Plan to arrive at the airport at least 1 hour before the earlier flight\'s boarding time.',
    ].join('\n');

    await chatRef.set({
      userIds: [trip.userId, bestMatch.userId],
      lastMessage: 'Chat initiated.',
      expiresAt: chatExpiryFromTrips([trip, bestMatch]),
      typing: null,
    }, { merge: true });

    await chatRef.collection('messages').add({
      text: systemMsg,
      senderId: 'system',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email + SMS notifications (best-effort, outside transaction).
    // All four are fire-and-forget; a failure in any one must not break the
    // match write or cause the trigger to retry.
    sendMatchNotification(trip, bestMatch).catch(() => {});
    sendMatchNotification(bestMatch, trip).catch(() => {});
    sendMatchSms(trip, bestMatch).catch(() => {});
    sendMatchSms(bestMatch, trip).catch(() => {});

    functions.logger.info('[onTripCreated] Instant match created', {
      tripId: trip.id,
      partnerId: bestMatch.id,
    });
  });
