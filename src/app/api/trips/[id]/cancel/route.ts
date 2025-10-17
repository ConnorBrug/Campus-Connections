import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const COOKIE_NAME = '__session';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id?: string }> } // <- params is a Promise in Next 15
) {
  const { id } = await context.params;          // <- await it
  const tripId = typeof id === 'string' ? id : undefined;

  if (!tripId) {
    return NextResponse.json({ message: 'Missing trip id' }, { status: 400 });
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

    const trip = snap.data() as any;
    if (trip.userId !== uid) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    if (trip.status === 'pending') {
      await tripRef.delete();
      return NextResponse.json({ success: true, message: 'Trip cancelled.' });
    }

    if (trip.status === 'matched' && trip.matchId) {
      const batch = adminDb.batch();
      batch.update(tripRef, { status: 'cancelled', matchId: null });

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
        message: 'Trip cancelled. Your partner was returned to pending.',
      });
    }

    return NextResponse.json({ success: true, message: 'Trip already not active.' });
  } catch (e) {
    console.error('[cancel] error:', e);
    return NextResponse.json({ message: 'Failed to cancel trip.' }, { status: 500 });
  }
}
