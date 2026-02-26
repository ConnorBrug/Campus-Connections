import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET() {
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
