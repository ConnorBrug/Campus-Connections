
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { TripRequest, UserProfile } from '@/lib/types';
import { findBestMatch, initiateChat, getFlaggedUsersForUser } from '@/lib/auth'; // We can keep using some client-safe auth helpers
import { addHours, isPast, parseISO } from 'date-fns';
import { sendNotificationEmail } from '@/lib/email';

// In a production environment, this should be a secret stored in environment variables.
const CRON_SECRET = process.env.CRON_SECRET || "your-development-secret";

// --- TEMPORARILY DISABLED FOR INITIAL DEPLOYMENT ---
// The body of the cron job functions are commented out to ensure the first build succeeds.
// They will be restored after the environment variables are set.

async function processMatching() {
    if (!adminDb) return 0;
    return 0; // Temporarily do nothing
}

async function processNoMatchNotifications() {
    if (!adminDb) return 0;
    return 0; // Temporarily do nothing
}

async function cleanupPastTrips() {
    if (!adminDb) return 0;
    return 0; // Temporarily do nothing
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
        message: 'Cron job skipped: Firebase Admin SDK not initialized (environment variables not set). This is expected for the initial build.',
        details: {
            matchesFound: 0,
            notificationsSent: 0,
            tripsCleaned: 0
        }
    });
  }

  return NextResponse.json({ 
    success: true, 
    message: 'Cron job executed successfully (temporarily disabled).',
    details: {
        matchesFound: 0,
        notificationsSent: 0,
        tripsCleaned: 0
    }
  });
}
