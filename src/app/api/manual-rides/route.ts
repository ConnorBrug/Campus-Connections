import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { isRateLimited } from '@/lib/rate-limit';
import type { TripRequest } from '@/lib/types';

const COOKIE_NAME = '__session';
const BAG_RULES = [
  { checked: 2, carry: 2 },
  { checked: 3, carry: 1 },
];

function hoursUntilFlight(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3600_000;
}

function currentEtHour(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(new Date())
  );
}

function isManualBoardOpenForTrip(trip: TripRequest): boolean {
  const hoursUntil = hoursUntilFlight(trip.flightDateTime);
  if (hoursUntil < 3 || hoursUntil > 30) return false;
  if (hoursUntil > 18 && currentEtHour() < 13) return false;
  return true;
}

async function isManualBoardEnabledNow(): Promise<boolean> {
  // Admin-controlled toggle:
  // settings/matching:
  // - manualBoardEnabled: boolean
  // - highDemandPeriod: boolean
  const snap = await adminDb.collection('settings').doc('matching').get();
  const data = (snap.data() ?? {}) as { manualBoardEnabled?: boolean; highDemandPeriod?: boolean };
  return data.manualBoardEnabled === true && data.highDemandPeriod !== true;
}

function sameCampusRule(a: TripRequest, b: TripRequest): boolean {
  if (a.university !== b.university) return false;
  if (a.departingAirport !== b.departingAirport) return false;
  if (a.campusArea && b.campusArea && a.campusArea !== b.campusArea) return false;
  return true;
}

function withinTwoHours(a: TripRequest, b: TripRequest): boolean {
  return Math.abs(new Date(a.flightDateTime).getTime() - new Date(b.flightDateTime).getTime()) <= 2 * 3600_000;
}

function candidateScore(a: TripRequest, b: TripRequest): number {
  const sameFlight = a.flightCode === b.flightCode ? 1 : 0;
  const bagSpread = Math.abs(
    (a.numberOfCarryons + a.numberOfCheckedBags) - (b.numberOfCarryons + b.numberOfCheckedBags)
  );
  const timeGapMin = Math.abs(new Date(a.flightDateTime).getTime() - new Date(b.flightDateTime).getTime()) / 60_000;
  return sameFlight * 10_000 + bagSpread * 100 - Math.floor(timeGapMin);
}

function fitsPair(a: TripRequest, b: TripRequest): boolean {
  const checked = (a.numberOfCheckedBags || 0) + (b.numberOfCheckedBags || 0);
  const carry = (a.numberOfCarryons || 0) + (b.numberOfCarryons || 0);
  return BAG_RULES.some((r) => checked <= r.checked && carry <= r.carry);
}

function genderPreferenceMet(a: TripRequest, b: TripRequest): boolean {
  const aOk = a.userPreferences === 'No preference' || a.userPreferences === b.userGender;
  const bOk = b.userPreferences === 'No preference' || b.userPreferences === a.userGender;
  return aOk && bOk;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(`manual-rides:${ip}`, 20, 60_000)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  try {
    const jar = await cookies();
    const sessionCookie = jar.get(COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true).catch(() => null);
    if (!decoded?.uid) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

    const manualBoardEnabled = await isManualBoardEnabledNow();
    if (!manualBoardEnabled) {
      return NextResponse.json({
        available: false,
        reason:
          'Manual ride posts are currently off during high-demand periods (for example, major break travel).',
        candidates: [],
      });
    }

    const myTripSnap = await adminDb
      .collection('tripRequests')
      .where('userId', '==', decoded.uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (myTripSnap.empty) {
      return NextResponse.json({ available: false, reason: 'You need an active pending trip first.', candidates: [] });
    }

    const myTrip = { id: myTripSnap.docs[0].id, ...myTripSnap.docs[0].data() } as TripRequest;
    if (!isManualBoardOpenForTrip(myTrip)) {
      return NextResponse.json({
        available: false,
        reason: 'Manual ride posts open closer to departure (after 1:00 PM ET for next-day flights).',
        candidates: [],
      });
    }

    const poolSnap = await adminDb
      .collection('tripRequests')
      .where('status', '==', 'pending')
      .where('university', '==', myTrip.university)
      .where('departingAirport', '==', myTrip.departingAirport)
      .get();

    const candidates = poolSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as TripRequest))
      .filter((c) => c.userId !== myTrip.userId)
      .filter((c) => sameCampusRule(myTrip, c))
      .filter((c) => withinTwoHours(myTrip, c))
      .filter((c) => fitsPair(myTrip, c))
      .sort((a, b) => candidateScore(myTrip, b) - candidateScore(myTrip, a))
      .slice(0, 30)
      .map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: c.userName ?? 'Rider',
        userPhotoUrl: c.userPhotoUrl ?? null,
        university: c.university,
        campusArea: c.campusArea ?? null,
        departingAirport: c.departingAirport,
        flightCode: c.flightCode,
        flightDateTime: c.flightDateTime,
        numberOfCarryons: c.numberOfCarryons,
        numberOfCheckedBags: c.numberOfCheckedBags,
        genderPreferenceMet: genderPreferenceMet(myTrip, c),
      }));

    return NextResponse.json({
      available: true,
      myTripId: myTrip.id,
      candidates,
    });
  } catch {
    return NextResponse.json({ message: 'Failed to load manual ride posts.' }, { status: 500 });
  }
}
