#!/usr/bin/env node
/* eslint-disable no-console */
import admin from 'firebase-admin';

function getBoolArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const raw = arg.slice(prefix.length).trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`Invalid value for --${name}. Use true or false.`);
}

function initAdmin() {
  if (admin.apps.length) return;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const svc = JSON.parse(json);
    admin.initializeApp({ credential: admin.credential.cert(svc) });
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.',
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

async function main() {
  initAdmin();
  const manualBoardEnabled = getBoolArg('manualBoardEnabled', false);
  const highDemandPeriod = getBoolArg('highDemandPeriod', false);

  const db = admin.firestore();
  await db.collection('settings').doc('matching').set(
    {
      manualBoardEnabled,
      highDemandPeriod,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log('Updated settings/matching');
  console.log(`manualBoardEnabled=${manualBoardEnabled}`);
  console.log(`highDemandPeriod=${highDemandPeriod}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
