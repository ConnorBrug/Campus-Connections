// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// This file is disabled because environment variables are not available on the current plan.
// Server-side admin features will not work until the app is upgraded and configured with a service account.

const hasInitialized = admin.apps.length > 0;

if (!hasInitialized) {
  // We are in a free-tier environment without env vars.
  // We can't initialize the admin app, but we don't want to crash the server.
  console.warn("Firebase Admin SDK not initialized. Server-side features requiring admin privileges will not work.");
}

const adminDb = hasInitialized ? admin.firestore() : null;
const adminAuth = hasInitialized ? admin.auth() : null;
const adminStorage = hasInitialized ? admin.storage() : null;

// Export nulls to prevent crashes in files that import these.
export { admin, adminDb, adminAuth, adminStorage };
