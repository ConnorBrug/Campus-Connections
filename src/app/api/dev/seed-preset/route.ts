/**
 * Dev-only preset seeder.
 *
 * POST /api/dev/seed-preset { preset: string, hoursFromNow?: number }
 * Gated by NODE_ENV === 'development'.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { PRESETS, materializePreset } from '@/lib/dev/presets.mjs';

export async function POST(req: Request) {
  // Only available in local development (see clean/route.ts for rationale).
  if (process.env.NODE_ENV !== 'development') {
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

    const { users, trips } = materializePreset(
      presetKey as keyof typeof PRESETS,
      baseTime,
      runId,
    );

    // Idempotency: wipe any prior synthetic tripRequests + matches for these uids.
    const synthUserIds = users.map((u) => u.id);
    if (synthUserIds.length > 0) {
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
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const list = Object.entries(PRESETS).map(([key, def]) => ({
    key,
    label: (def as { label: string }).label,
  }));
  return NextResponse.json({ presets: list });
}
