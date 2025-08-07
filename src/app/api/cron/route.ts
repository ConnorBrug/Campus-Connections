
import { NextResponse } from 'next/server';

// In a production environment, this should be a secret stored in environment variables.
const CRON_SECRET = process.env.CRON_SECRET || "your-development-secret";

// --- TEMPORARILY DISABLED FOR INITIAL DEPLOYMENT ---
// The body of the cron job functions are commented out to ensure the first build succeeds.
// They will be restored after the environment variables are set.

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Return a simple success message. The actual logic is disabled.
  return NextResponse.json({ 
    success: true, 
    message: 'Cron job skipped: Temporarily disabled for initial deployment.',
    details: {
        matchesFound: 0,
        notificationsSent: 0,
        tripsCleaned: 0
    }
  });
}
