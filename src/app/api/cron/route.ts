
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { differenceInHours, isPast, parseISO, addHours } from 'date-fns';
import type { TripRequest, Match } from '@/lib/types';
import { findBestMatch, initiateChat } from '@/lib/auth';
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
    
    while(tripsToMatch.length > 1) {
        const currentTrip = tripsToMatch.shift();
        if(!currentTrip) continue;

        const potentialCandidates = tripsToMatch.filter(t => t.university === currentTrip.university);
        if(potentialCandidates.length === 0) continue;
        
        // This logic needs to be secure on the server, fetching flagged users is not implemented here for simplicity
        const { bestMatch } = findBestMatch(currentTrip, potentialCandidates, []);

        if(bestMatch) {
            matchesFound++;
            
            // A. Create a new Match document with denormalized data
            const matchRef = doc(collection(adminDb, 'matches'));
            const newMatch: Match = {
                id: matchRef.id,
                participantIds: [currentTrip.userId, bestMatch.userId],
                tripRequestIds: [currentTrip.id, bestMatch.id],
                createdAt: serverTimestamp(),
                status: "active",
                participants: {
                    [currentTrip.userId]: {
                        userName: currentTrip.userName,
                        userPhotoUrl: currentTrip.userPhotoUrl,
                        university: currentTrip.university,
                        flightCode: currentTrip.flightCode,
                        flightDateTime: currentTrip.flightDateTime,
                        bagCount: currentTrip.numberOfCarryons + currentTrip.numberOfCheckedBags,
                    },
                    [bestMatch.userId]: {
                        userName: bestMatch.userName,
                        userPhotoUrl: bestMatch.userPhotoUrl,
                        university: bestMatch.university,
                        flightCode: bestMatch.flightCode,
                        flightDateTime: bestMatch.flightDateTime,
                        bagCount: bestMatch.numberOfCarryons + bestMatch.numberOfCheckedBags,
                    }
                }
            };
            batch.set(matchRef, newMatch);

            // B. Update both trip documents to link to the new Match document
            const currentTripRef = doc(adminDb, 'tripRequests', currentTrip.id);
            const matchedTripRef = doc(adminDb, 'tripRequests', bestMatch.id);
            batch.update(currentTripRef, { status: 'matched', matchId: matchRef.id });
            batch.update(matchedTripRef, { status: 'matched', matchId: matchRef.id });

            // C. Remove the matched trip from future consideration in this run
            const index = tripsToMatch.findIndex(t => t.id === bestMatch.id);
            if(index > -1) tripsToMatch.splice(index, 1);

            // D. Initiate the chat
            await initiateChat(matchRef.id, newMatch.participants);

            // E. Send notifications
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
        // Only process trips that are still pending after the matching loop
        const isStillPending = !tripsToMatch.some(t => t.id === trip.id);
        if (!isStillPending) return;

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
