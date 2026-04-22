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
