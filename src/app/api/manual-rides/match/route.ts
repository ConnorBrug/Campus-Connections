import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { isRateLimited } from '@/lib/rate-limit';
import type { Match, TripRequest } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

const COOKIE_NAME = '__session';
const BAG_RULES = [
  { checked: 2, carry: 2 },
  { checked: 3, carry: 1 },
];

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
  const hoursUntil = (new Date(trip.flightDateTime).getTime() - Date.now()) / 3600_000;
  if (hoursUntil < 3 || hoursUntil > 30) return false;
  if (hoursUntil > 18 && currentEtHour() < 13) return false;
  return true;
}

async function isManualBoardEnabledNow(): Promise<boolean> {
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

function chatExpiryFromTrips(trips: TripRequest[]) {
  const latest = trips.reduce((mx, t) => Math.max(mx, new Date(t.flightDateTime).getTime()), 0);
  return Timestamp.fromDate(new Date(latest + 4 * 3600_000));
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(`manual-match:${ip}`, 10, 60_000)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => null);
    const candidateTripId = typeof body?.candidateTripId === 'string' ? body.candidateTripId : '';
    if (!candidateTripId) {
      return NextResponse.json({ message: 'candidateTripId is required' }, { status: 400 });
    }

    const jar = await cookies();
    const sessionCookie = jar.get(COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true).catch(() => null);
    if (!decoded?.uid) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

    const manualBoardEnabled = await isManualBoardEnabledNow();
    if (!manualBoardEnabled) {
      return NextResponse.json(
        {
          message:
            'Manual ride posts are currently off during high-demand periods (for example, major break travel).',
        },
        { status: 400 },
      );
    }

    const myTripSnap = await adminDb
      .collection('tripRequests')
      .where('userId', '==', decoded.uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (myTripSnap.empty) {
      return NextResponse.json({ message: 'No pending trip found for your account.' }, { status: 400 });
    }

    const myTripRef = myTripSnap.docs[0].ref;
    const myTrip = { id: myTripSnap.docs[0].id, ...myTripSnap.docs[0].data() } as TripRequest;
    if (!isManualBoardOpenForTrip(myTrip)) {
      return NextResponse.json(
        { message: 'Manual matching is only available after 1:00 PM ET for next-day flights.' },
        { status: 400 },
      );
    }

    const result = await adminDb.runTransaction(async (tx) => {
      const freshMyTripSnap = await tx.get(myTripRef);
      if (!freshMyTripSnap.exists) throw new Error('Your trip no longer exists.');
      const freshMyTrip = { id: freshMyTripSnap.id, ...freshMyTripSnap.data() } as TripRequest;
      if (freshMyTrip.status !== 'pending') throw new Error('Your trip is no longer pending.');

      const candidateRef = adminDb.collection('tripRequests').doc(candidateTripId);
      const candidateSnap = await tx.get(candidateRef);
      if (!candidateSnap.exists) throw new Error('Selected rider is no longer available.');
      const candidateTrip = { id: candidateSnap.id, ...candidateSnap.data() } as TripRequest;

      if (candidateTrip.userId === freshMyTrip.userId) throw new Error('You cannot match with yourself.');
      if (candidateTrip.status !== 'pending') throw new Error('Selected rider is no longer pending.');
      if (!sameCampusRule(freshMyTrip, candidateTrip)) throw new Error('Selected rider is no longer compatible.');
      if (!withinTwoHours(freshMyTrip, candidateTrip)) throw new Error('Selected rider is outside the 2-hour window.');
      if (!fitsPair(freshMyTrip, candidateTrip)) throw new Error('Selected rider exceeds bag limits.');

      const matchRef = adminDb.collection('matches').doc();
      const preferenceMet = genderPreferenceMet(freshMyTrip, candidateTrip);
      const matchTier: Match['matchTier'] = preferenceMet ? 'standard' : 'relaxed-gender';

      const match: Match = {
        id: matchRef.id,
        participantIds: [freshMyTrip.userId, candidateTrip.userId],
        participants: {
          [freshMyTrip.userId]: {
            userId: freshMyTrip.userId,
            userName: freshMyTrip.userName ?? 'User',
            userPhotoUrl: freshMyTrip.userPhotoUrl ?? null,
            university: freshMyTrip.university,
            flightCode: freshMyTrip.flightCode,
            flightDateTime: freshMyTrip.flightDateTime,
          },
          [candidateTrip.userId]: {
            userId: candidateTrip.userId,
            userName: candidateTrip.userName ?? 'User',
            userPhotoUrl: candidateTrip.userPhotoUrl ?? null,
            university: candidateTrip.university,
            flightCode: candidateTrip.flightCode,
            flightDateTime: candidateTrip.flightDateTime,
          },
        },
        requestIds: [freshMyTrip.id, candidateTrip.id],
        university: freshMyTrip.university,
        campusArea: freshMyTrip.campusArea ?? null,
        departingAirport: freshMyTrip.departingAirport,
        flightCode: freshMyTrip.flightCode === candidateTrip.flightCode ? freshMyTrip.flightCode : undefined,
        assignedAtISO: new Date().toISOString(),
        status: 'matched',
        reason: preferenceMet
          ? 'Manual rider-selected match'
          : 'Manual rider-selected match (gender preference relaxed)',
        matchTier,
      };
      tx.set(matchRef, match);

      tx.update(myTripRef, {
        status: 'matched',
        matchId: matchRef.id,
        matchedUserId: candidateTrip.userId,
        cancellationAlert: false,
        fallbackTier: matchTier,
      });
      tx.update(candidateRef, {
        status: 'matched',
        matchId: matchRef.id,
        matchedUserId: freshMyTrip.userId,
        cancellationAlert: false,
        fallbackTier: matchTier,
      });

      const chatId = [freshMyTrip.userId, candidateTrip.userId].sort().join('_');
      const chatRef = adminDb.collection('chats').doc(chatId);
      tx.set(
        chatRef,
        {
          userIds: [freshMyTrip.userId, candidateTrip.userId],
          lastMessage: 'Chat initiated.',
          expiresAt: chatExpiryFromTrips([freshMyTrip, candidateTrip]),
          typing: null,
        },
        { merge: true },
      );

      const msgRef = chatRef.collection('messages').doc();
      tx.set(msgRef, {
        text:
          'This match was selected manually from ride posts. Coordinate quickly and confirm pickup details.',
        senderId: 'system',
        timestamp: Timestamp.now(),
      });

      return { matchId: matchRef.id, tripId: freshMyTrip.id };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create manual match.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
