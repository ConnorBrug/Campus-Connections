import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { isRateLimited } from '@/lib/rate-limit';

const COOKIE_NAME = '__session';

export async function POST(
  req: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  const tripId = typeof id === 'string' ? id : undefined;

  if (!tripId) {
    return NextResponse.json({ message: 'Missing trip id' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(`delay:${ip}`, 5, 60_000)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action;
  if (action !== 'stay' && action !== 'repool') {
    return NextResponse.json(
      { message: 'action must be "stay" or "repool"' },
      { status: 400 },
    );
  }

  try {
    const c = await cookies();
    const sessionCookie = c.get(COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { uid } = await adminAuth.verifySessionCookie(sessionCookie, true);

    const tripRef = adminDb.collection('tripRequests').doc(tripId);
    const snap = await tripRef.get();
    if (!snap.exists) {
      return NextResponse.json({ message: 'Trip not found' }, { status: 404 });
    }

    const trip = snap.data() as {
      userId: string;
      status: string;
      matchId?: string | null;
    };
    if (trip.userId !== uid) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    if (action === 'stay') {
      await tripRef.update({ flightDelayed: true });
      return NextResponse.json({
        success: true,
        message: 'Flight delay recorded. Your match is unchanged.',
      });
    }

    // action === 'repool': same logic as cancel for matched trips
    if (trip.status === 'matched' && trip.matchId) {
      const batch = adminDb.batch();
      batch.update(tripRef, { status: 'cancelled', matchId: null, flightDelayed: true });

      const partnerQs = await adminDb
        .collection('tripRequests')
        .where('matchId', '==', trip.matchId)
        .get();

      partnerQs.forEach((doc) => {
        if (doc.id !== tripId) {
          batch.update(doc.ref, {
            status: 'pending',
            matchId: null,
            cancellationAlert: true,
          });
        }
      });

      await batch.commit();
      return NextResponse.json({
        success: true,
        message: 'You have been removed from the match. Your partner was returned to pending.',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Trip is not currently matched. No action needed.',
    });
  } catch (err) {
    console.error('POST /api/trips/[id]/delay error:', err);
    return NextResponse.json({ message: 'Failed to process delay.' }, { status: 500 });
  }
}
