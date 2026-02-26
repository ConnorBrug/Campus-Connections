# Release Checklist (Step-by-Step)

## 0) Open Terminal in Project
Run:

```bash
cd /home/user/studio
```

## 1) Create Production Env File
Copy template:

```bash
cp .env.production.example .env.production
```

Fill every required value in `.env.production`.

Required:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- Firebase Admin creds:
  - either `FIREBASE_SERVICE_ACCOUNT_JSON`
  - or all three: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

## 2) Export Env Vars for Current Shell

```bash
set -a
source .env.production
set +a
```

## 3) Login + Select Firebase Project

```bash
firebase login
firebase use <your-project-id>
```

## 4) Run Preflight Checks

```bash
npm run check:prod
```

Must show:
- Typecheck passed
- Functions tests passed
- Production preflight passed

## 5) Set Matching Mode

### If normal/low-demand period:
```bash
npm run set:matching:low-demand
```

### If high-demand/break period:
```bash
npm run set:matching:high-demand
```

## 6) Deploy Everything

```bash
npm run deploy:all
```

## 7) Verify Health Endpoint

```bash
curl -s https://<your-domain>/api/health
```

Expected:
- `"ok": true`

## 8) Manual Smoke Test (Required)
1. Sign up a new account.
2. Verify email.
3. Continue into app without re-login.
4. Submit a trip.
5. Submit second compatible trip from another account.
6. Confirm match + chat created.
7. Confirm delay/cancel flows work.
8. Confirm manual posts page behavior matches selected mode:
   - low-demand: available
   - high-demand: blocked

## 9) Emergency Rollback
If app behavior is bad:
1. Set high-demand mode (disables manual board immediately):
```bash
npm run set:matching:high-demand
```
2. Redeploy previous known-good app/functions version.
