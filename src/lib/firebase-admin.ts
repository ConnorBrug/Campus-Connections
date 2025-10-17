// lib/firebase-admin.ts
import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

let adminApp: App;

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      adminApp = initializeApp({ credential: cert(svc) });
    } else {
      // Fallback to discrete env vars
      const projectId = process.env.FIREBASE_PROJECT_ID!;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")!;
      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    }
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
    throw new Error("Failed to initialize Firebase Admin SDK — check credentials/environment.");
  }
} else {
  adminApp = getApp();
}

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);
export { adminApp };
