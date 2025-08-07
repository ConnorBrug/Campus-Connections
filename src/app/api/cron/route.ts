
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { differenceInHours, isPast, parseISO, addHours, subHours, format } from 'date-fns';
import type { TripRequest } from '@/lib/types';
import { findBestMatch } from '@/lib/auth'; // Using the existing client-side logic as it's portable
import { sendNotificationEmail } from '@/lib/email';


const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn("Cron job call with invalid secret.");
    return new Response('Unauthorized', { status: 401 });
  }

  let matchesFound = 0;
  let notificationsSent = 0;
  let tripsCleaned = 0;
  
  try {
    // --- 1. Find and process matches ---
    const pendingTripsQuery = query(collection(adminDb, 'tripRequests'), where('status', '==', 'pending'));
    const pendingTripsSnapshot = await getDocs(pendingTripsQuery);

    const allPendingTrips: TripRequest[] = [];
    pendingTripsSnapshot.forEach(doc => {
      const trip = doc.data() as TripRequest;
      // Filter out trips that are already in the past
      if (!isPast(parseISO(trip.flightDateTime))) {
        allPendingTrips.push(trip);
      }
    });

    const tripsToMatch = [...allPendingTrips];
    const batch = writeBatch(adminDb);
    
    while(tripsToMatch.length > 0) {
        const currentTrip = tripsToMatch.shift();
        if(!currentTrip) continue;

        const potentialCandidates = tripsToMatch.filter(t => t.university === currentTrip.university);
        if(potentialCandidates.length === 0) continue;
        
        // This part needs admin access to work correctly on server.
        // For now, we assume flaggedUserIds are on the trip request object if needed, or fetched separately.
        const { bestMatch } = findBestMatch(currentTrip, potentialCandidates, []);

        if(bestMatch) {
            matchesFound++;
            
            // Update both trip documents in the batch
            const currentTripRef = doc(adminDb, 'tripRequests', currentTrip.id);
            const matchedTripRef = doc(adminDb, 'tripRequests', bestMatch.id);

            batch.update(currentTripRef, { status: 'matched', matchedUserId: bestMatch.userId, matchId: bestMatch.id });
            batch.update(matchedTripRef, { status: 'matched', matchedUserId: currentTrip.userId, matchId: currentTrip.id });

            // Remove the matched trip from future consideration in this run
            const index = tripsToMatch.findIndex(t => t.id === bestMatch.id);
            if(index > -1) tripsToMatch.splice(index, 1);

            // Send notifications (add to a list to send after batch commit)
            // This is a simplified notification, a real app would have more details
             await sendNotificationEmail({
              to: currentTrip.userName, // In a real app, this would be the user's email
              subject: "You have a new match!",
              body: `You've been matched with ${bestMatch.userName} for your trip. Please check the app to coordinate.`,
              link: `${process.env.NEXT_PUBLIC_BASE_URL}/match-found/${currentTrip.id}`
            });
             await sendNotificationEmail({
              to: bestMatch.userName,
              subject: "You have a new match!",
              body: `You've been matched with ${currentTrip.userName} for your trip. Please check the app to coordinate.`,
              link: `${process.env.NEXT_PUBLIC_BASE_URL}/match-found/${bestMatch.id}`
            });
        }
    }
    
    if (matchesFound > 0) {
        await batch.commit();
    }


    // --- 2. Send "no match" warnings ---
    const warningBatch = writeBatch(adminDb);
    const now = new Date();
    allPendingTrips.forEach(async (trip) => {
        const flightTime = parseISO(trip.flightDateTime);
        // If flight is within 5 hours and no warning has been sent
        if(differenceInHours(flightTime, now) <= 5 && !trip.noMatchWarningSent) {
             await sendNotificationEmail({
                to: trip.userName,
                subject: "Update on your trip request",
                body: "We are still looking for a match for your upcoming trip. As it is getting close to your flight time, we recommend you start looking into alternative transportation.",
                link: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`
            });
            notificationsSent++;
            const tripRef = doc(adminDb, 'tripRequests', trip.id);
            warningBatch.update(tripRef, { noMatchWarningSent: true });
        }
    });
    if (notificationsSent > 0) {
        await warningBatch.commit();
    }


    // --- 3. Clean up old, completed trips ---
    const cleanupBatch = writeBatch(adminDb);
    const completedTripsQuery = query(collection(adminDb, 'tripRequests'), where('status', '==', 'completed'));
    const completedTripsSnapshot = await getDocs(completedTripsQuery);

    completedTripsSnapshot.forEach(doc => {
        const trip = doc.data() as TripRequest;
        // If trip was more than 48 hours ago
        if (isPast(addHours(parseISO(trip.flightDateTime), 48))) {
            cleanupBatch.delete(doc.ref);
            tripsCleaned++;
        }
    });
    if (tripsCleaned > 0) {
        await cleanupBatch.commit();
    }


    return NextResponse.json({ 
        success: true, 
        message: 'Cron job executed successfully.',
        details: {
            matchesFound,
            notificationsSent,
            tripsCleaned
        }
    });

  } catch(error: any) {
    console.error("Cron job failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
