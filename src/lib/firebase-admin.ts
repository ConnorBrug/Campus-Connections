// src/lib/firebase-admin.ts
import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

let adminApp: App;

if (getApps().length === 0) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // This is a fallback for local development or environments
    // where the full JSON isn't set. It might not work for all services.
    console.warn("FIREBASE_SERVICE_ACCOUNT_JSON not set. Using default application credentials. This may not work for all services.");
    adminApp = initializeApp();
  }
} else {
  adminApp = getApp();
}

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);
