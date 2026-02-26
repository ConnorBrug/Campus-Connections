#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredEnv = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
];

const requiredAdminAuth = [
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

const optionalButRecommended = [
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_EMAIL_WHITELIST',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

const missing = [];
for (const key of requiredEnv) {
  if (!process.env[key]) missing.push(key);
}

const hasServiceJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
const hasSplitAdminCreds = requiredAdminAuth.slice(1).every((k) => Boolean(process.env[k]));
if (!hasServiceJson && !hasSplitAdminCreds) {
  missing.push('FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)');
}

const appHostingPath = path.join(root, 'apphosting.yaml');
if (!fs.existsSync(appHostingPath)) {
  console.error('Missing apphosting.yaml.');
  process.exit(1);
}

const appHosting = fs.readFileSync(appHostingPath, 'utf8');
for (const key of requiredEnv) {
  if (!appHosting.includes(`variable: ${key}`)) {
    console.error(`apphosting.yaml is missing env binding for ${key}.`);
    process.exit(1);
  }
}

if (missing.length > 0) {
  console.error('Production env check failed. Missing required environment variables:');
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

const warnings = optionalButRecommended.filter((k) => !process.env[k]);
if (warnings.length > 0) {
  console.warn('Recommended env variables not set (non-blocking):');
  for (const key of warnings) console.warn(`- ${key}`);
}

console.log('Production preflight check passed.');
