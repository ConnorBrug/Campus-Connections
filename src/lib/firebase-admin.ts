// src/lib/firebase-admin.ts
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";


let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON as string);
} catch (error) {
    console.error("Error parsing Firebase service account JSON. Make sure FIREBASE_SERVICE_ACCOUNT_JSON is set correctly.", error);
    // In a production environment, you might want to throw an error or handle this differently.
    // For now, we'll let the app attempt to start, but services will fail.
}


const app = serviceAccount && getApps().length === 0
  ? initializeApp({ credential: cert(serviceAccount) })
  : getApp();


export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export const adminStorage = getStorage(app);
