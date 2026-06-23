import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { isRateLimited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET() {
  // Rate-limit by IP: this endpoint does a Firestore read on every hit, so
  // without a cap it's an easy amplification / quota-burn vector.
  const hdrs = await headers();
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(`health:${ip}`, 30, 60_000)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const started = Date.now();
  try {
    await adminDb.collection('settings').doc('matching').get();
    return NextResponse.json({
      ok: true,
      service: 'connections-web',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: 'connections-web',
        checkedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
