
'use server';

// This file is simplified for the final version. It will be restored after secrets are set.
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON as string
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // The databaseURL is required only if you are using the Realtime Database.
      // databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`
    });
     console.log("Firebase Admin SDK initialized successfully.");
  } catch (e: any) {
    if (e.code === 'ENOENT' || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        console.log("Firebase Admin SDK not initialized. This is expected for the initial deployment. Please add environment variables after this build succeeds.");
    } else {
        console.error('Firebase Admin SDK initialization error:', e.stack);
    }
  }
}


const adminDb = admin.firestore();
const adminAuth = admin.auth();
const adminStorage = admin.storage();

export { admin, adminDb, adminAuth, adminStorage };
