
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { TripRequest, UserProfile } from '@/lib/types';
import { findBestMatch, initiateChat, getFlaggedUsersForUser } from '@/lib/auth'; // We can keep using some client-safe auth helpers
import { addHours, isPast, parseISO } from 'date-fns';
import { sendNotificationEmail } from '@/lib/email';

// In a production environment, this should be a secret stored in environment variables.
const CRON_SECRET = process.env.CRON_SECRET || "your-development-secret";

async function processMatching() {
    if (!adminDb) return 0; // Do nothing if admin is not initialized

    const pendingTripsQuery = adminDb.collection('tripRequests').where('status', '==', 'pending');
    const snapshot = await pendingTripsQuery.get();
    
    if (snapshot.empty) {
        return 0; // No trips to process
    }

    const allPendingTrips: TripRequest[] = snapshot.docs.map(doc => doc.data() as TripRequest);
    let matchesFound = 0;

    for (const trip of allPendingTrips) {
        // Re-check status in case it was matched in a previous iteration of the loop
        const currentTripDoc = await adminDb.collection('tripRequests').doc(trip.id).get();
        if (currentTripDoc.data()?.status !== 'pending') {
            continue;
        }

        const potentialMatchPool = allPendingTrips.filter(p => 
            p.id !== trip.id && 
            p.university === trip.university &&
            p.status === 'pending'
        );

        if (potentialMatchPool.length === 0) {
            continue;
        }

        const userDoc = await adminDb.collection('users').doc(trip.userId).get();
        const userProfile = userDoc.data() as UserProfile;
        const flaggedUsers = userProfile?.flaggedUserIds || [];

        const { bestMatch } = findBestMatch(trip, potentialMatchPool, flaggedUsers);
        
        if (bestMatch) {
            const batch = adminDb.batch();

            const trip1Ref = adminDb.collection('tripRequests').doc(trip.id);
            const trip2Ref = adminDb.collection('tripRequests').doc(bestMatch.id);

            batch.update(trip1Ref, { status: 'matched', matchedUserId: bestMatch.userId, matchId: bestMatch.id, cancellationAlert: false });
            batch.update(trip2Ref, { status: 'matched', matchedUserId: trip.userId, matchId: trip.id, cancellationAlert: false });
            
            await batch.commit();

            // Initiate chat after match is committed
            await initiateChat(trip, bestMatch);

            // Send notifications
            const user1Profile = userProfile;
            const user2ProfileDoc = await adminDb.collection('users').doc(bestMatch.userId).get();
            const user2Profile = user2ProfileDoc.data() as UserProfile;

            if (user1Profile) {
                await sendNotificationEmail({
                    to: user1Profile.email,
                    subject: "You've been matched!",
                    body: `You've been matched with ${bestMatch.userName} for your upcoming trip. Log in to the app to start chatting!`,
                    link: `${process.env.NEXT_PUBLIC_BASE_URL}/match-found/${trip.id}`
                });
            }
             if (user2Profile) {
                await sendNotificationEmail({
                    to: user2Profile.email,
                    subject: "You've been matched!",
                    body: `You've been matched with ${trip.userName} for your upcoming trip. Log in to the app to start chatting!`,
                    link: `${process.env.NEXT_PUBLIC_BASE_URL}/match-found/${bestMatch.id}`
                });
            }

            matchesFound++;
            // Remove matched trips from the pool for subsequent iterations
            allPendingTrips.splice(allPendingTrips.findIndex(t => t.id === trip.id), 1);
            allPendingTrips.splice(allPendingTrips.findIndex(t => t.id === bestMatch.id), 1);
        }
    }
    return matchesFound;
}

async function processNoMatchNotifications() {
    if (!adminDb) return 0; // Do nothing if admin is not initialized

    const fiveHoursFromNow = addHours(new Date(), 5);
    const pendingTripsQuery = adminDb.collection('tripRequests')
        .where('status', '==', 'pending')
        .where('noMatchWarningSent', '==', false);

    const snapshot = await pendingTripsQuery.get();
    let notificationsSent = 0;

    const batch = adminDb.batch();

    for (const doc of snapshot.docs) {
        const trip = doc.data() as TripRequest;
        const flightDateTime = parseISO(trip.flightDateTime);

        if (isPast(flightDateTime)) continue;

        if (flightDateTime < fiveHoursFromNow) {
            const userDoc = await adminDb.collection('users').doc(trip.userId).get();
            if (userDoc.exists) {
                const user = userDoc.data() as UserProfile;
                 await sendNotificationEmail({
                    to: user.email,
                    subject: "Action Recommended: No Match Found Yet",
                    body: `We have not yet found a match for your trip departing in about 5 hours. We recommend you start looking into alternative transportation. We will continue searching.`,
                    link: `${process.env.NEXT_PUBLIC_BASE_URL}/planned-trips`
                });
                batch.update(doc.ref, { noMatchWarningSent: true });
                notificationsSent++;
            }
        }
    }
    
    await batch.commit();
    return notificationsSent;
}

async function cleanupPastTrips() {
    if (!adminDb) return 0; // Do nothing if admin is not initialized

    const twoDaysAgo = addHours(new Date(), -48);
    const oldTripsQuery = adminDb.collection('tripRequests')
        .where('status', '==', 'completed');
        
    const snapshot = await oldTripsQuery.get();
    let tripsCleaned = 0;
    const batch = adminDb.batch();

    for (const doc of snapshot.docs) {
        const trip = doc.data() as TripRequest;
        const flightDateTime = parseISO(trip.flightDateTime);
        if (flightDateTime < twoDaysAgo) {
            batch.delete(doc.ref);
            tripsCleaned++;
        }
    }
    
    await batch.commit();
    return tripsCleaned;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Because the free plan does not support the environment variables needed for the Admin SDK,
  // the server-side cron functionality is disabled.
  if (!adminDb) {
    return NextResponse.json({ 
        success: true, 
        message: 'Cron job skipped: Firebase Admin SDK not initialized (environment variables not set).',
        details: {
            matchesFound: 0,
            notificationsSent: 0,
            tripsCleaned: 0
        }
    });
  }

  try {
    const [matchesFound, notificationsSent, tripsCleaned] = await Promise.all([
        processMatching(),
        processNoMatchNotifications(),
        cleanupPastTrips()
    ]);

    return NextResponse.json({ 
        success: true, 
        message: 'Cron job executed successfully.',
        details: {
            matchesFound,
            notificationsSent,
            tripsCleaned
        }
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json({ success: false, message: 'Cron job failed.', error: (error as Error).message }, { status: 500 });
  }
}
