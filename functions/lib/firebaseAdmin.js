import * as admin from 'firebase-admin';
// Avoid double-init across hot reload/emulator
export const app = admin.apps.length ? admin.app() : admin.initializeApp();
export const db = admin.firestore();
export const auth = admin.auth();
//# sourceMappingURL=firebaseAdmin.js.map