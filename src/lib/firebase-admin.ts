
'use server';

import admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;

function initializeAdminApp() {
  if (admin.apps.length > 0) {
    if (!adminApp) {
        adminApp = admin.app();
    }
    return adminApp;
  }

  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON as string
    );
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully.");
    return adminApp;
  } catch (e: any) {
    if (e.code === 'ENOENT' || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      console.log("Firebase Admin SDK not initialized. Service account credentials not found.");
    } else {
      console.error('Firebase Admin SDK initialization error:', e.stack);
    }
    return null;
  }
}

function getAdminDb() {
  const app = initializeAdminApp();
  if (!app) {
    throw new Error("Firebase Admin SDK not initialized. Cannot access Firestore.");
  }
  return admin.firestore();
}

function getAdminAuth() {
    const app = initializeAdminApp();
    if (!app) {
        throw new Error("Firebase Admin SDK not initialized. Cannot access Auth.");
    }
    return admin.auth();
}

function getAdminStorage() {
    const app = initializeAdminApp();
    if (!app) {
        throw new Error("Firebase Admin SDK not initialized. Cannot access Storage.");
    }
    return admin.storage();
}

export { admin, getAdminDb, getAdminAuth, getAdminStorage };
