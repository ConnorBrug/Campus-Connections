// src/lib/firebase-admin.ts
import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

let adminApp: App;

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // ✅ Use environment variable for production or local JSON string
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("✅ Firebase Admin initialized with service account JSON");
    } else {
      // ✅ Try application default credentials (e.g., gcloud or emulator)
      console.warn(
        "⚠️ FIREBASE_SERVICE_ACCOUNT_JSON not found — using application default credentials."
      );
      adminApp = initializeApp({
        credential: undefined, // will use GOOGLE_APPLICATION_CREDENTIALS or emulator
      });
    }
  } catch (error) {
    console.error("🔥 Firebase Admin initialization failed:", error);
    throw new Error(
      "Failed to initialize Firebase Admin SDK — check credentials or environment variables."
    );
  }
} else {
  adminApp = getApp();
}

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);
