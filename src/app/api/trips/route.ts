import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserProfile } from '@/lib/types';
import { isRateLimited } from '@/lib/rate-limit';
import { sanitizeStrict } from '@/lib/sanitize';
import { assertSameOrigin } from '@/lib/csrf';

const COOKIE_NAME = '__session';

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(`trips:${ip}`, 5, 60_000)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  try {
    const cookieStore = await cookies();
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

    // Sanitize user-controllable strings before they land in Firestore.
    // sanitizeStrict drops control/zero-width/RTL tricks and non-name-shaped
    // characters, collapses whitespace, and caps length.
    const cleanFlightCode = sanitizeStrict(flightCode, 10).toUpperCase();
    const cleanAirport = sanitizeStrict(departingAirport, 10).toUpperCase();
    const cleanCampusArea = campusArea == null ? null : sanitizeStrict(campusArea, 40) || null;
    const allowedGenders = new Set(['Male', 'Female', 'No preference']);
    if (!allowedGenders.has(preferredMatchGender)) {
      return NextResponse.json({ message: 'Invalid preferredMatchGender' }, { status: 400 });
    }
    if (!cleanFlightCode || !cleanAirport) {
      return NextResponse.json({ message: 'Invalid flight code or airport' }, { status: 400 });
    }
    const carryons = Number(numberOfCarryons);
    const checked = Number(numberOfCheckedBags);
    if (!Number.isFinite(carryons) || !Number.isFinite(checked) ||
        carryons < 0 || checked < 0 || carryons > 5 || checked > 5) {
      return NextResponse.json({ message: 'Invalid bag counts' }, { status: 400 });
    }

    // Load canonical user profile on the server
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ message: 'User profile not found' }, { status: 400 });
    }
    const user = userSnap.data() as UserProfile;

    if (user.isBanned) {
      return NextResponse.json({ message: 'Your account is suspended from creating new trips.' }, { status: 403 });
    }
    const tripRef = adminDb.collection('tripRequests').doc();
    const newTrip = {
      id: tripRef.id,
      userId: uid,
      userName: user.name ?? 'User',
      userEmail: user.email ?? decoded.email,
      userPhotoUrl: user.photoUrl ?? null,
      university: user.university ?? '',
      campusArea: cleanCampusArea || user.campusArea || null,
      flightCode: cleanFlightCode,
      flightDateTime: date.toISOString(),
      flightDate: date.toISOString().slice(0, 10),
      flightTime: date.toISOString().slice(11, 16),
      departingAirport: cleanAirport,
      numberOfCarryons: carryons,
      numberOfCheckedBags: checked,
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
  } catch (err) {
    console.error('POST /api/trips error:', err);
    return NextResponse.json({ message: 'Failed to create trip.' }, { status: 500 });
  }
}
