import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

/*
 * Lazy init for the Firebase Admin SDK.
 *
 * Why: the previous eager version ran at module-load time. Two problems:
 *   1. Any build-time graph that imported this module (e.g. during
 *      `next build` analysis of `generateMetadata`, Server Component
 *      prerenders, etc.) would trigger `initializeApp`, which throws
 *      if creds env vars aren't present - breaking CI builds that
 *      don't have secrets wired in.
 *   2. On serverless cold starts, every instance paid the init cost
 *      even for routes that never touch Admin.
 *
 * Fix: wrap each Admin client in a Proxy that initializes on first
 * property access. The init itself is still a one-shot (firebase-admin
 * guards against double-init via `getApps().length`), so repeated
 * access is free. Exports keep their original shapes (`Auth`,
 * `Firestore`, `Storage`), so call sites don't change.
 */

let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;

  if (getApps().length) {
    _app = getApp();
    return _app;
  }

  try {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (json) {
      const svc = JSON.parse(json);
      if (!svc.project_id || !svc.client_email || !svc.private_key) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_JSON missing project_id/client_email/private_key"
        );
      }
      _app = initializeApp({ credential: cert(svc) });
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId) throw new Error("Missing or invalid env: FIREBASE_PROJECT_ID");
      if (!clientEmail) throw new Error("Missing or invalid env: FIREBASE_CLIENT_EMAIL");
      if (!privateKey) throw new Error("Missing or invalid env: FIREBASE_PRIVATE_KEY");

      privateKey = privateKey.replace(/\\n/g, "\n");

      _app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    }
    return _app;
  } catch (e) {
    console.error("Firebase Admin initialization failed:", e);
    throw new Error(
      "Failed to initialize Firebase Admin SDK - check credentials/environment."
    );
  }
}

// One-shot resolvers per client. Once resolved, subsequent gets return
// the cached instance directly.
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: Storage | null = null;

function resolveAuth(): Auth {
  if (!_auth) _auth = getAuth(getAdminApp());
  return _auth;
}
function resolveDb(): Firestore {
  if (!_db) _db = getFirestore(getAdminApp());
  return _db;
}
function resolveStorage(): Storage {
  if (!_storage) _storage = getStorage(getAdminApp());
  return _storage;
}

// Proxies defer init until the first property access. We use `any` for
// the target because the Proxy forwards everything to the resolved
// client; consumers see the real shape via the cast on export.
function makeLazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop, receiver) {
      const target = resolve() as unknown as Record<PropertyKey, unknown>;
      const value = Reflect.get(target, prop, receiver);
      // Bind methods so `this` points at the real SDK object, not the proxy.
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(_t, prop) {
      return prop in (resolve() as object);
    },
    ownKeys() {
      return Reflect.ownKeys(resolve() as object);
    },
    getOwnPropertyDescriptor(_t, prop) {
      return Object.getOwnPropertyDescriptor(resolve() as object, prop);
    },
  });
}

export const adminAuth: Auth = makeLazy(resolveAuth);
export const adminDb: Firestore = makeLazy(resolveDb);
export const adminStorage: Storage = makeLazy(resolveStorage);

// Kept for backwards compatibility; callers that want the raw App
// (e.g. for messaging, remote config) can still reach for it.
export const adminApp = new Proxy({} as App, {
  get(_t, prop, receiver) {
    const target = getAdminApp() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
