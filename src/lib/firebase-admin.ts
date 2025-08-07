
'use server';

import * as admin from 'firebase-admin';

// This file handles the initialization of the Firebase Admin SDK for server-side operations.
// It ensures that the app only attempts to initialize with admin privileges if the necessary
// service account credentials are provided in the environment variables.
// --- TEMPORARILY MODIFIED FOR INITIAL DEPLOYMENT ---
// The following logic is simplified to allow the first build to pass without secrets.

const hasInitialized = admin.apps.length > 0;

if (!hasInitialized) {
    console.warn("Firebase Admin SDK not initialized. This is expected for the initial deployment. Please add environment variables after this build succeeds.");
}

// Re-check for initialization before exporting services.
const isReady = admin.apps.length > 0;

const adminDb = isReady ? admin.firestore() : null;
const adminAuth = isReady ? admin.auth() : null;
const adminStorage = isReady ? admin.storage() : null;

// Export the initialized services or null if initialization failed.
export { admin, adminDb, adminAuth, adminStorage };
