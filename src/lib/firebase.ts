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
function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

const firebaseConfig: FirebaseOptions = {
  projectId:         req('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  appId:             req('NEXT_PUBLIC_FIREBASE_APP_ID'),
  storageBucket:     req('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  apiKey:            req('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain:        req('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  messagingSenderId: req('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
