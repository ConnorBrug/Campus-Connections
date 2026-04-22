#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Seed synthetic trip requests into Firestore for testing the matching engine.
 *
 * Auth: uses the same FIREBASE_SERVICE_ACCOUNT_JSON env var as the rest of the
 * Admin scripts. Set it in .env.local (this script auto-loads .env*).
 *
 * Usage:
 *   node scripts/seed-test-trips.mjs                # 8 BC trips ~5h from now
 *   node scripts/seed-test-trips.mjs --count 20
 *   node scripts/seed-test-trips.mjs --uni Vanderbilt --hours 12
 *   node scripts/seed-test-trips.mjs --airport JFK --hours 6
 *   node scripts/seed-test-trips.mjs --preset same-flight-pair --hours 6
 *   node scripts/seed-test-trips.mjs --list-presets
 *   node scripts/seed-test-trips.mjs --clean       # delete all synthetic trips + users
 *
 * Synthetic users are written to /users/synthetic-{N} so they don't collide
 * with real OAuth uids. Synthetic trips have a `synthetic: true` field and
 * `userId` matching that pattern, making them easy to clean up.
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRESETS, materializePreset } from '../src/lib/dev/presets.mjs';

// ---------- env loading ----------
function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const k = m[1];
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadDotEnv();

// ---------- args ----------
function parseArgs(argv) {
  const out = { count: 8, uni: 'Boston College', hours: 5, airport: 'BOS', clean: false, preset: null, list: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--clean') out.clean = true;
    else if (a === '--count') out.count = parseInt(argv[++i], 10);
    else if (a === '--uni') out.uni = argv[++i];
    else if (a === '--hours') out.hours = parseFloat(argv[++i]);
    else if (a === '--airport') out.airport = argv[++i];
    else if (a === '--preset') out.preset = argv[++i];
    else if (a === '--list-presets') out.list = true;
    else if (a === '--help' || a === '-h') {
      console.log('See file header for usage.');
      console.log('  --preset <name>       seed a named scenario (see --list-presets)');
      console.log('  --list-presets        show available presets and exit');
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  return out;
}
const args = parseArgs(process.argv);

// ---------- admin init ----------
function initAdmin() {
  if (admin.apps.length) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const sa = JSON.parse(json);
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      return;
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but not valid JSON.');
      throw e;
    }
  }
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    return;
  }
  console.error(
    'Missing Firebase Admin credentials.\n' +
    'Set FIREBASE_SERVICE_ACCOUNT_JSON=\'{"type":"service_account",...}\' in .env.local,\n' +
    'or set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
  );
  process.exit(1);
}
initAdmin();
const db = admin.firestore();

// ---------- clean ----------
async function cleanSynthetic() {
  const snap = await db.collection('tripRequests').where('synthetic', '==', true).get();
  if (snap.empty) {
    console.log('No synthetic trips found.');
  } else {
    let deleted = 0;
    let batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      deleted++;
      if (deleted % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
    console.log(`Deleted ${deleted} synthetic trips.`);
  }

  const userSnap = await db.collection('users').where('synthetic', '==', true).get();
  if (!userSnap.empty) {
    let b = db.batch();
    let n = 0;
    for (const d of userSnap.docs) { b.delete(d.ref); n++; if (n % 400 === 0) { await b.commit(); b = db.batch(); } }
    await b.commit();
    console.log(`Deleted ${n} synthetic users.`);
  }
}

// ---------- random seed ----------
const FIRST_NAMES = ['Alex','Sam','Jordan','Taylor','Morgan','Casey','Riley','Quinn','Avery','Blake','Cameron','Drew','Emerson','Finley','Hayden','Jamie'];
const LAST_NAMES  = ['Lee','Patel','Garcia','Smith','Nguyen','Cohen','Martinez','OBrien','Park','Singh','Khan','Rossi','Tan','Adams','Brown','Davis'];
const BC_CAMPUS   = ['2k', 'Newton', 'CoRo/Upper', 'Lower'];
const GENDERS     = ['Male', 'Female', 'Other', 'Prefer not to say'];
const PREFS       = ['Male', 'Female', 'No preference'];
const FLIGHT_CODES = ['DL1234','UA456','AA789','B6101','WN202','AS303'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

async function seed() {
  const baseMs = Date.now() + args.hours * 3600_000;
  const created = [];

  for (let i = 0; i < args.count; i++) {
    const userId = `synthetic-${Date.now()}-${i}`;
    const first = rand(FIRST_NAMES);
    const last  = rand(LAST_NAMES);
    const gender = rand(GENDERS);

    const offsetMin = randInt(-90, 90);
    const flightDt = new Date(baseMs + offsetMin * 60_000);
    const campusArea = args.uni === 'Boston College' ? rand(BC_CAMPUS) : null;

    await db.collection('users').doc(userId).set({
      id: userId,
      synthetic: true,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.test`,
      university: args.uni,
      gender,
      graduationYear: randInt(2026, 2029),
      emailVerified: true,
      isBanned: false,
      ...(campusArea ? { campusArea } : {}),
    });

    const tripRef = db.collection('tripRequests').doc();
    const trip = {
      id: tripRef.id,
      synthetic: true,
      userId,
      userName: `${first} ${last}`,
      userEmail: `${first.toLowerCase()}.${last.toLowerCase()}@example.test`,
      userPhotoUrl: null,
      university: args.uni,
      campusArea,
      departingAirport: args.airport,
      flightCode: rand(FLIGHT_CODES),
      flightDateTime: flightDt.toISOString(),
      flightDate: flightDt.toISOString().slice(0, 10),
      flightTime: flightDt.toTimeString().slice(0, 5),
      numberOfCarryons: randInt(0, 1),
      numberOfCheckedBags: randInt(0, 2),
      userPreferences: rand(PREFS),
      userGender: gender,
      status: 'pending',
      matchId: null,
      matchedUserId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await tripRef.set(trip);
    created.push({ id: tripRef.id, name: trip.userName, when: trip.flightDateTime });
  }

  console.log(`Seeded ${created.length} pending trip requests for ${args.uni} from ${args.airport}:`);
  for (const t of created) console.log(`  ${t.id}  ${t.name.padEnd(20)}  ${t.when}`);
  console.log('\nTo run matching now:');
  console.log(`  firebase functions:call manualPairing --data '{"from":${Math.max(0, Math.floor(args.hours - 2))},"to":${Math.ceil(args.hours + 2)}}'`);
  console.log('Or use the dev admin page at /dev/matching (NODE_ENV=development).');
}

// ---------- preset seed ----------
async function seedPreset(key) {
  if (!(key in PRESETS)) {
    console.error(`Unknown preset "${key}". Run with --list-presets.`);
    process.exit(1);
  }
  const baseTime = new Date(Date.now() + args.hours * 3600_000);
  const runId = Date.now().toString(36);
  const { users, trips } = materializePreset(key, baseTime, runId);

  for (const u of users) {
    await db.collection('users').doc(u.id).set(u);
  }
  const created = [];
  for (const t of trips) {
    const ref = db.collection('tripRequests').doc();
    await ref.set({ ...t, id: ref.id, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    created.push({ id: ref.id, name: t.userName, when: t.flightDateTime });
  }

  console.log(`Seeded preset "${key}" (${PRESETS[key].label}):`);
  for (const t of created) console.log(`  ${t.id}  ${t.name.padEnd(20)}  ${t.when}`);
  console.log('\nTo pair: open /dev/matching and click "Run manualPairing".');
}

function listPresets() {
  console.log('Available presets:');
  for (const [key, def] of Object.entries(PRESETS)) {
    console.log(`  ${key.padEnd(24)}  ${def.label}`);
  }
}

(async () => {
  try {
    if (args.list) { listPresets(); process.exit(0); }
    if (args.clean) await cleanSynthetic();
    else if (args.preset) await seedPreset(args.preset);
    else await seed();
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  }
  process.exit(0);
})();
