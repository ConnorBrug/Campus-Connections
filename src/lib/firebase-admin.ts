import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let adminApp: App;

if (!getApps().length) {
  try {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (json) {
      const svc = JSON.parse(json);
      if (!svc.project_id || !svc.client_email || !svc.private_key) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing project_id/client_email/private_key");
      }
      adminApp = initializeApp({ credential: cert(svc) });
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId) throw new Error("Missing or invalid env: FIREBASE_PROJECT_ID");
      if (!clientEmail) throw new Error("Missing or invalid env: FIREBASE_CLIENT_EMAIL");
      if (!privateKey) throw new Error("Missing or invalid env: FIREBASE_PRIVATE_KEY");

      privateKey = privateKey.replace(/\\n/g, "\n");

      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
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
