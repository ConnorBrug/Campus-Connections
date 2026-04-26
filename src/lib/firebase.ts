// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// NB: Firebase Web "apiKey" and related NEXT_PUBLIC_* values are public
// identifiers - they are baked into the client bundle by design. We still
// require them via env instead of hardcoding because:
//   1. hardcoding makes it look like a secret and causes reviewer churn,
//   2. it prevents config drift between staging / production,
//   3. a missing value should fail the build loudly, not silently fall
//      back to a different project.
//
// IMPORTANT: Next.js inlines NEXT_PUBLIC_* vars via static string replacement
// at build time. Each reference MUST be a literal (e.g. process.env.NEXT_PUBLIC_FOO).
// Dynamic access like process.env[name] will NOT be replaced and will be
// undefined in the client bundle.
function req(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const firebaseConfig: FirebaseOptions = {
  projectId:         req(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  appId:             req(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, 'NEXT_PUBLIC_FIREBASE_APP_ID'),
  storageBucket:     req(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  apiKey:            req(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, 'NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain:        req(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  messagingSenderId: req(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
