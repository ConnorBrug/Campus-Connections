# Connections (Production Guide)

## Overview
Connections is a Next.js + Firebase app for student airport ride matching.

This repository contains:
- Web app (`src/`)
- Firebase Functions matching engine (`functions/src/`)
- Firestore security rules (`firestore.rules`)

## Requirements
- Node.js 20
- Firebase CLI authenticated to your project
- Firebase project with Firestore + Functions enabled

## Required Environment Variables

### Web/App Hosting
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`

### Admin SDK (server routes)
Use either:
- `FIREBASE_SERVICE_ACCOUNT_JSON`

Or all of:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Recommended
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_EMAIL_WHITELIST`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

## Firestore Settings Document
Create document:
- `settings/matching`

Fields:
- `manualBoardEnabled: boolean`
- `highDemandPeriod: boolean`

Behavior:
- Manual marketplace only works when `manualBoardEnabled=true` and `highDemandPeriod=false`.

## Production Preflight
Run before deployment:

```bash
npm run check:prod
```

This runs:
1. Typecheck
2. Functions tests
3. Environment/config preflight (`scripts/check-production.mjs`)

## Deployment

Deploy everything:

```bash
npm run deploy:all
```

Or deploy in parts:

```bash
npm run deploy:rules
npm run deploy:functions
npm run deploy:app
```

## Post-Deploy Smoke Tests
1. Health endpoint:
```bash
curl -s https://<your-domain>/api/health
```
Expected: `{ "ok": true, ... }`

2. Auth/session:
- Sign up, verify email, continue into app
- Confirm no extra login required after verification flow

3. Matching:
- Submit two compatible pending trips
- Verify automatic matching + chat creation

4. Manual marketplace:
- Set `highDemandPeriod=true`: manual endpoints should be unavailable
- Set `highDemandPeriod=false` + `manualBoardEnabled=true`: manual posts/matching should work

5. Safety:
- Flag same user from 3 unique accounts
- Confirm user becomes banned and cannot create trips

## Notes
- Chat write access is blocked after chat expiry via Firestore rules.
- Matching engine runs via scheduled functions (`pairMatchNoon`, `pairMatchHourly`) and instant matching on trip creation for late submissions.
