
'use server';

import * as admin from 'firebase-admin';

// This file handles the initialization of the Firebase Admin SDK for server-side operations.
// It ensures that the app only attempts to initialize with admin privileges if the necessary
// service account credentials are provided in the environment variables.

const hasInitialized = admin.apps.length > 0;

if (!hasInitialized) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log("Firebase Admin SDK initialized successfully.");
        } catch (e) {
            console.error("Firebase Admin SDK initialization failed:", e);
        }
    } else {
        console.warn("Firebase Admin SDK not initialized. Server-side features requiring admin privileges will not work. Make sure FIREBASE_SERVICE_ACCOUNT_JSON is set.");
    }
}

// Re-check for initialization before exporting services.
const isReady = admin.apps.length > 0;

const adminDb = isReady ? admin.firestore() : null;
const adminAuth = isReady ? admin.auth() : null;
const adminStorage = isReady ? admin.storage() : null;

// Export the initialized services or null if initialization failed.
export { admin, adminDb, adminAuth, adminStorage };
