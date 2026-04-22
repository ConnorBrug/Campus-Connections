/**
 * Dev-only preset seeder.
 *
 * POST /api/dev/seed-preset { preset: string, hoursFromNow?: number }
 *   -> writes the synthetic users + tripRequests described by that preset to
 *     Firestore. Returns the list of created trip ids.
 *
 * Gated by NODE_ENV !== 'production' (same as /api/dev/matching/clean).
 * Preset definitions live in src/lib/dev/presets.mjs so the CLI seed script
 * and this route share the same scenarios.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { PRESETS, materializePreset } from '@/lib/dev/presets.mjs';

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      preset?: string;
      hoursFromNow?: number;
    };
    const presetKey = body.preset;
    if (!presetKey || !(presetKey in PRESETS)) {
      return NextResponse.json(
        { error: `Unknown preset. Available: ${Object.keys(PRESETS).join(', ')}` },
        { status: 400 },
      );
    }

    const hours = typeof body.hoursFromNow === 'number' ? body.hoursFromNow : 5;
    const baseTime = new Date(Date.now() + hours * 3600_000);
    const runId = Date.now().toString(36);

    // `presetKey in PRESETS` narrows to `string` at runtime but TS doesn't
    // collapse it to the literal-union the .mjs module exports. Cast is
    // safe: the `in` guard above already rejects unknown keys.
    const { users, trips } = materializePreset(
      presetKey as keyof typeof PRESETS,
      baseTime,
      runId,
    );

    // Idempotency: user ids are deterministic per (preset, index) so re-seeding
    // the same preset would otherwise leave stale trip requests and match docs
    // with stale flight times. Wipe any prior synthetic tripRequests + matches
    // for these uids before re-writing. We leave chat messages alone; the
    // matching runner writes a deterministic __system_init message and will
    // overwrite it on the next pairing run, while real user messages are
    // preserved for cross-browser test continuity.
    const synthUserIds = users.map((u) => u.id);
    if (synthUserIds.length > 0) {
      // Firestore `in` and `array-contains-any` clauses cap at 10 elements;
      // every current preset has <= 10 riders, but slice defensively so a
      // larger preset doesn't throw at query build time.
      const idSlice = synthUserIds.slice(0, 10);

      const staleTrips = await adminDb
        .collection('tripRequests')
        .where('userId', 'in', idSlice)
        .get();
      const staleMatches = await adminDb
        .collection('matches')
        .where('participantIds', 'array-contains-any', idSlice)
        .get();

      if (!staleTrips.empty || !staleMatches.empty) {
        let batch = adminDb.batch();
        let i = 0;
        const queueDelete = (ref: FirebaseFirestore.DocumentReference) => {
          batch.delete(ref);
          i += 1;
        };
        staleTrips.docs.forEach((d) => queueDelete(d.ref));
        staleMatches.docs.forEach((d) => queueDelete(d.ref));
        // Commit in 400-doc chunks to stay under the 500-op batch limit.
        if (i >= 400) {
          await batch.commit();
          batch = adminDb.batch();
          i = 0;
        }
        if (i > 0) await batch.commit();
      }
    }

    // Write users first so any UI that joins on userId renders immediately.
    {
      let batch = adminDb.batch();
      let i = 0;
      for (const u of users) {
        batch.set(adminDb.collection('users').doc(u.id), u);
        if (++i % 400 === 0) {
          await batch.commit();
          batch = adminDb.batch();
        }
      }
      await batch.commit();
    }

    const tripIds: string[] = [];
    {
      let batch = adminDb.batch();
      let i = 0;
      for (const t of trips) {
        const ref = adminDb.collection('tripRequests').doc();
        batch.set(ref, { ...t, id: ref.id, createdAt: FieldValue.serverTimestamp() });
        tripIds.push(ref.id);
        if (++i % 400 === 0) {
          await batch.commit();
          batch = adminDb.batch();
        }
      }
      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      preset: presetKey,
      hoursFromNow: hours,
      baseTime: baseTime.toISOString(),
      userIds: users.map((u) => u.id),
      tripIds,
    });
  } catch (err) {
    console.error('POST /api/dev/seed-preset error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Seeding failed' },
      { status: 500 },
    );
  }
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const list = Object.entries(PRESETS).map(([key, def]) => ({
    key,
    label: (def as { label: string }).label,
  }));
  return NextResponse.json({ presets: list });
}
