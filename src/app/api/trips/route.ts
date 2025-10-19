import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const COOKIE_NAME = '__session';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    console.log('[trips] has cookie:', !!cookieStore.get('__session'));
    const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true).catch(() => null);
    if (!decoded?.uid) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const uid = decoded.uid;
    const body = await req.json();
    const {
      flightCode,
      flightDateTime,          // ISO string
      departingAirport,
      numberOfCarryons,
      numberOfCheckedBags,
      preferredMatchGender,
      campusArea = null,
    } = body ?? {};

    const date = new Date(flightDateTime);
    if (
      !flightCode || !flightDateTime || !departingAirport ||
      numberOfCarryons == null || numberOfCheckedBags == null || !preferredMatchGender
    ) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    if (isNaN(date.getTime())) {
      return NextResponse.json({ message: 'Invalid flightDateTime' }, { status: 400 });
    }

    // Load canonical user profile on the server
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ message: 'User profile not found' }, { status: 400 });
    }
    const user = userSnap.data() as any;

    const tripRef = adminDb.collection('tripRequests').doc();
    const newTrip = {
      id: tripRef.id,
      userId: uid,
      userName: user.name ?? 'User',
      userEmail: user.email ?? decoded.email, // Add user's email
      userPhotoUrl: user.photoUrl ?? null,
      university: user.university ?? '',
      campusArea: campusArea || user.campusArea || null,
      flightCode: String(flightCode || '').toUpperCase(),
      flightDateTime: date.toISOString(),
      flightDate: date.toISOString().slice(0, 10),
      flightTime: date.toISOString().slice(11, 16),
      departingAirport,
      numberOfCarryons: Number(numberOfCarryons),
      numberOfCheckedBags: Number(numberOfCheckedBags),
      status: 'pending' as const,
      createdAt: Timestamp.now(),
      matchId: null,
      matchedUserId: null,
      userPreferences: preferredMatchGender,
      userGender: user.gender ?? 'Prefer not to say',
      noMatchWarningSent: false,
      cancellationAlert: false,
    };

    await tripRef.set(newTrip);
    return NextResponse.json({ success: true, tripId: tripRef.id });
  } catch (e) {
    console.error('Create trip failed:', e);
    return NextResponse.json({ message: 'Failed to create trip.' }, { status: 500 });
  }
}
