// lib/firebase-admin.ts
import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function assertString(name: string, v: unknown) {
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`Missing or invalid env: ${name}`);
  }
}

let adminApp: App;

if (!getApps().length) {
  try {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (json) {
      // Preferred path: single JSON blob
      const svc = JSON.parse(json);
      assertString("FIREBASE_SERVICE_ACCOUNT_JSON.project_id", svc.project_id);
      assertString("FIREBASE_SERVICE_ACCOUNT_JSON.client_email", svc.client_email);
      assertString("FIREBASE_SERVICE_ACCOUNT_JSON.private_key", svc.private_key);
      adminApp = initializeApp({ credential: cert(svc) });
    } else {
      // Fallback: individual vars
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      assertString("FIREBASE_PROJECT_ID", projectId);
      assertString("FIREBASE_CLIENT_EMAIL", clientEmail);
      assertString("FIREBASE_PRIVATE_KEY", privateKey);

      // Support \n-escaped keys from .env
      privateKey = privateKey!.replace(/\\n/g, "\n");

      adminApp = initializeApp({
        credential: cert({
          projectId: projectId!,
          clientEmail: clientEmail!,
          privateKey: privateKey!,
        }),
      });
    }
  } catch (e) {
    console.error("🔥 Firebase Admin initialization failed:", e);
    throw new Error("Failed to initialize Firebase Admin SDK — check credentials/environment.");
  }
} else {
  adminApp = getApp();
}

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export { adminApp };
