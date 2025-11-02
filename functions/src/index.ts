// functions/src/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { runPairingForWindow } from './matching';

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Noon job:
 *   - “Riders will be notified of their match at noon the day before”
 *   - Pair flights departing ~18–30 hours from now (tweak if you like).
 */
export const pairMatchNoon = functions.pubsub
  .schedule('0 12 * * *') // 12:00 every day
  .timeZone('America/New_York')   // change if your default tz differs
  .onRun(async () => {
    // 18—30h ahead often lands “tomorrow” boardings for most use cases
    const res = await runPairingForWindow(18, 30);
    functions.logger.info('[pairMatchNoon] result', res);
  });

/**
 * Hourly “catch-up”:
 *   - After noon, keep trying hourly for any new/late requests for next-day flights.
 *   - Window: 3–18 hours ahead (tightening as we approach departure).
 */
export const pairMatchHourly = functions.pubsub
  .schedule('0 * * * *') // every hour at :00
  .timeZone('America/New_York')
  .onRun(async () => {
    const res = await runPairingForWindow(3, 18);
    functions.logger.info('[pairMatchHourly] result', res);
  });

/**
 * Optional: manual trigger to test from the console
 *   functions:call manualPairing --data '{"from":3,"to":24}'
 */
export const manualPairing = functions.https.onCall(async (data) => {
  const from = typeof data?.from === 'number' ? data.from : 3;
  const to   = typeof data?.to   === 'number' ? data.to   : 24;
  const res = await runPairingForWindow(from, to);
  return res;
});
