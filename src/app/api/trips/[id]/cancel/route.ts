import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { isRateLimited } from '@/lib/rate-limit';

const COOKIE_NAME = '__session';

export async function POST(
  req: Request,
  context: { params: Promise<{ id?: string }> } // <- params is a Promise in Next 15
) {
  const { id } = await context.params;          // <- await it
  const tripId = typeof id === 'string' ? id : undefined;

  if (!tripId) {
    return NextResponse.json({ message: 'Missing trip id' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(`cancel:${ip}`, 5, 60_000)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  // Parse optional reason from body
  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = typeof body?.reason === 'string' ? body.reason : undefined;
  } catch {
    // No body or invalid JSON — reason is optional for pending trips
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

    const trip = snap.data() as { userId: string; status: string; matchId?: string | null };
    if (trip.userId !== uid) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    if (trip.status === 'pending') {
      await tripRef.delete();
      return NextResponse.json({ success: true, message: 'Trip canceled.' });
    }

    if (trip.status === 'matched' && trip.matchId) {
      // Require a reason when leaving a match
      if (!reason?.trim()) {
        return NextResponse.json(
          { message: 'A reason is required when leaving a match.' },
          { status: 400 },
        );
      }

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

      // Store cancellation reason for moderation
      const cancelRef = adminDb.collection('cancellations').doc();
      batch.set(cancelRef, {
        tripId,
        userId: uid,
        matchId: trip.matchId,
        reason: reason.trim(),
        timestamp: new Date().toISOString(),
      });

      await batch.commit();
      return NextResponse.json({
        success: true,
        message: 'Trip canceled. Your partner was returned to pending.',
      });
    }

    return NextResponse.json({ success: true, message: 'Trip already not active.' });
  } catch (err) {
    console.error('POST /api/trips/[id]/cancel error:', err);
    return NextResponse.json({ message: 'Failed to cancel trip.' }, { status: 500 });
  }
}
