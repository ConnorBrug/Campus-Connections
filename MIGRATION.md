# Migration guide: Firebase Studio + App Hosting → Local dev + Vercel

This repo has been updated to run locally (instead of inside Firebase Studio)
and to deploy the Next.js web app on **Vercel** (instead of Firebase App
Hosting). Everything else — Firestore, Auth, Storage, Functions — stays on
Firebase exactly as before.

Follow this guide end-to-end in order. Sections are short; each one is a
single thing you click through.

---

## 0. What changed in the repo

These are the code changes already committed (you do not need to do
anything here — this is just for reference):

- Deleted `.idx/dev.nix` (Firebase Studio's Nix config).
- Deleted `apphosting.yaml` (Firebase App Hosting config).
- Deleted `.modified` (Firebase Studio marker file).
- Added `vercel.json` + `.vercelignore`.
- `next.config.ts` — removed the Firebase Studio `allowedDevOrigins`, added
  `*.firebasestorage.app` to the `images.remotePatterns` so profile photos
  from the newer Storage bucket format render via `next/image`.
- `cors.json` — removed Firebase Studio URLs; added `www.campus-connections.com`
  and `localhost:9002`.
- `scripts/check-production.mjs` — dropped the App Hosting preflight check.
- `package.json` — removed `deploy:app`, added `deploy:cors`, renamed
  `deploy:all` → `deploy:firebase`.
- `functions/src/email.ts` — replaced deprecated `functions.config()` with
  standard `process.env` (uses Firebase Secrets / `functions/.env`).
- `src/lib/auth.ts` — `uploadProfilePhoto` now client-side-compresses to
  ≤1 MB JPEG before upload and sanitizes filenames; `sendPasswordReset`
  now passes a `continueUrl` so "Back to app" lands on your domain.
- `.env.example` rewritten with every required variable.

---

## 1. Install & run locally

```bash
cd Campus-Connections
npm install
npm install --prefix functions
cp .env.example .env.local
# edit .env.local — fill in Firebase values from
# Firebase Console > Project settings > General > Your apps > Web app > Config
npm run dev
```

Open http://localhost:3000. Email sign-up and everything else should work
against the live Firebase backend.

If you want to run the matching Functions locally against the emulator:

```bash
npm --prefix functions run build
firebase emulators:start --only functions,firestore
```

---

## 2. Push the cleaned-up code to GitHub

If your repo is already on GitHub:

```bash
git add -A
git commit -m "Migrate off Firebase Studio + App Hosting → local dev + Vercel"
git push
```

---

## 3. Deploy the web app to Vercel

1. Go to https://vercel.com/new and sign in with GitHub.
2. **Import** the Campus-Connections repo.
3. On the "Configure project" screen, click **Environment Variables** and
   paste in these keys (values from your Firebase Console + the service
   account JSON you already have):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | from Firebase |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `connections-hw9ha.firebaseapp.com` (or your custom `auth.campus-connections.com` after step 6) |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `connections-hw9ha` |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `connections-hw9ha.firebasestorage.app` |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `689188733774` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | from Firebase |
   | `NEXT_PUBLIC_BASE_URL` | `https://campus-connections.com` |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | paste the whole service-account JSON on one line |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | your SMTP provider |
   | `NEXT_PUBLIC_EMAIL_WHITELIST` | optional — comma-separated test emails |

   Apply each to **Production, Preview, and Development**.

4. Click **Deploy**. Wait ~2 min. You should get a default URL like
   `campus-connections-xxx.vercel.app`.

---

## 4. Point campus-connections.com at Vercel

1. In Vercel → Project → **Settings → Domains** → add `campus-connections.com`
   and `www.campus-connections.com`.
2. Vercel will show you the DNS records to add at your registrar:
   - `A` record `@` → `76.76.21.21`
   - `CNAME` `www` → `cname.vercel-dns.com`
   (or the exact values Vercel shows you — follow Vercel's UI.)
3. **Before** propagation is complete, remove the old DNS records that point
   at Firebase App Hosting (also at your registrar).
4. Wait 5-60 min for DNS. Vercel will auto-issue a TLS cert.

Once `campus-connections.com` resolves to Vercel, **redeploy** in Vercel so
the new domain is picked up for edge caching.

---

## 5. Fix profile photo uploads (apply CORS to the Storage bucket)

The repo's `cors.json` is the policy; you have to actually push it to
Google Cloud Storage. One-time setup:

```bash
# from the repo root
gcloud auth login
gcloud config set project connections-hw9ha
gcloud storage buckets update gs://connections-hw9ha.firebasestorage.app \
  --cors-file=cors.json
```

Or with the older tool: `gsutil cors set cors.json gs://connections-hw9ha.firebasestorage.app`.

Verify with:

```bash
gcloud storage buckets describe gs://connections-hw9ha.firebasestorage.app --format="default(cors)"
```

You should see `campus-connections.com` in the allowed origins.

---

## 6. Fix the "hw9a" URL in verification emails

The default link you see in Firebase auth emails is
`https://connections-hw9ha.firebaseapp.com/__/auth/action?...`. There are
two things to do — the first is required, the second is cosmetic.

### 6a. Authorize campus-connections.com (required)

Firebase Console → **Authentication → Settings → Authorized domains** →
**Add domain**:

- `campus-connections.com`
- `www.campus-connections.com`
- your Vercel preview domain (e.g. `campus-connections-xxx.vercel.app`) if
  you want previews to be able to sign users in.

Without this, the `continueUrl` in the verification/reset email is silently
dropped and the user gets stuck on Firebase's default page.

### 6b. Use a custom auth domain (optional — hides the "hw9a" URL)

This changes the link in the email from `connections-hw9ha.firebaseapp.com`
to e.g. `auth.campus-connections.com`.

1. Firebase Console → **Hosting → Add custom domain** → enter
   `auth.campus-connections.com`.
2. Add the TXT + A records Firebase asks you for at your DNS registrar.
3. Wait for Firebase to say "Connected".
4. Firebase Console → **Authentication → Settings → Custom domain** → set it
   to `auth.campus-connections.com`.
5. Change your Vercel env var:
   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=auth.campus-connections.com`
6. Redeploy on Vercel.

### 6c. (Optional, even more polish) Customize the email templates

Firebase Console → **Authentication → Templates** → pencil icon on
"Email address verification" → **customize action URL** → set
`https://campus-connections.com/verify`. Do the same for
"Password reset" pointed at `https://campus-connections.com/forgot-password`
if you build out a reset handler page later. (For now the default Firebase
reset page works fine and the continueUrl already points home.)

---

## 7. Actually deploy the matching engine (Cloud Functions)

**This is probably why matching "hasn't been working"** — Firebase Studio
ran your Next.js dev server, not your scheduled functions. Scheduled
Functions need to be deployed at least once and require the **Blaze (pay-as-
you-go)** plan.

1. Firebase Console → **Usage and billing** → upgrade project to **Blaze**.
   (You get a generous free tier; for your volume expect $0-1/month.)
2. Set SMTP as Firebase secrets (the Functions use these for match emails):

   ```bash
   firebase use connections-hw9ha
   firebase functions:secrets:set SMTP_HOST
   firebase functions:secrets:set SMTP_USER
   firebase functions:secrets:set SMTP_PASS
   firebase functions:secrets:set SMTP_PORT  # optional
   firebase functions:secrets:set APP_URL    # optional, defaults to campus-connections.com
   firebase functions:secrets:set EMAIL_FROM # optional
   ```

   Tip: if your SMTP provider is Resend / Gmail / SendGrid, use app-specific
   SMTP creds — don't use your normal Gmail password.

3. Build & deploy:

   ```bash
   npm run deploy:firebase
   ```

   That runs: preflight → firestore & storage rules → functions. The first
   deploy of the scheduled jobs creates the Cloud Scheduler entries.

4. Verify in **Firebase Console → Functions** that these are listed:
   - `pairMatchNoon` (scheduled)
   - `pairMatchHourly` (scheduled)
   - `manualPairing` (callable, for manual testing)
   - `onTripCreated` (Firestore trigger)

5. Smoke-test matching with two compatible pending trips:
   - Create trips from two test accounts at both BC, same `campusArea`,
     same airport, within 1h of each other.
   - In Cloud Shell or locally:
     ```bash
     firebase functions:call manualPairing --data '{"from":0,"to":48}' \
       --project connections-hw9ha
     ```
     …or just wait for the next hour's `pairMatchHourly` run.
   - You should see both trips flip to `status: 'matched'`, a `matches/{id}`
     document created, and a chat document created with a system message.

---

## 8. Create the settings document (manual marketplace on/off switch)

In Firestore, create document `settings/matching` with fields:

```
manualBoardEnabled: true
highDemandPeriod:   false
```

When `highDemandPeriod=true`, the manual marketplace is disabled and
everything goes through the matching engine.

You can also set these from the command line:

```bash
npm run set:matching:low-demand    # manual board ON, auto matching ON
npm run set:matching:high-demand   # manual board OFF, auto matching only
```

---

## 9. Post-migration smoke tests

1. `curl https://campus-connections.com/api/health` → `{ "ok": true, ... }`.
2. Sign up with a `@bc.edu` email → verification email arrives → clicking it
   lands on `campus-connections.com/verify` and completes.
3. Edit profile photo → new photo should render within a second.
4. Create two pending trips that should match → call `manualPairing` or
   wait for the cron → both trips flip to `matched`, chat appears.
5. Try to upload a profile photo > 5 MB → should be compressed to <1 MB
   and succeed.
6. Flag a user from 3 different accounts → they become banned.

---

## 10. Scalability notes (for expanding past BC)

Adding a new university is currently more work than it should be. When
you're ready, refactor these four spots to be data-driven:

1. `src/lib/auth.ts` → `emailToUniversity()` has hardcoded `@bc.edu` /
   `@vanderbilt.edu` checks. Move the domain → university mapping into
   `src/lib/universities.ts` (already exists).
2. `src/app/(auth)/signup/SignupClient.tsx` — the Zod email refinement has
   the same hardcoded domains. Reuse the mapping.
3. `functions/src/index.ts` — the scheduled-job TZ is hardcoded to
   `America/New_York`. When a West-Coast or Central-TZ university joins,
   either run separate scheduled functions per TZ, or change to UTC and
   use per-university effective-local-time offsets.
4. Storage rules + Firestore rules both use path-level user-ID matches
   that already scale fine — no changes needed.

---

## 11. Cost expectations

- **Vercel**: free tier is plenty until you consistently do >100 GB-months
  of bandwidth. Next.js ISR caches most page loads so this is generous.
- **Firebase (Blaze)** for a BC-only launch:
  - Firestore: free tier covers ~50k reads/day. Each trip submission is
    a handful of writes; you'll be well under it.
  - Functions: `pairMatchNoon` + `pairMatchHourly` = ~25 invocations/day.
    Each run is fast. Expect <$1/month.
  - Storage: profile photos compressed to 1 MB × 1000 users = 1 GB.
    Free tier is 5 GB.
- **SMTP**: Resend free tier is 100 emails/day, 3k/month. Plenty for beta.

---

## 12. Things you can safely delete / archive

After the Vercel migration is live and verified:

- `firebase.json` — keep; it's still used for `deploy:rules` and
  `deploy:functions`.
- `.firebaserc` — keep; selects the project for Firebase CLI.
- `cors.json` — keep; you re-apply it anytime you change origins.
- `docs/` — project docs; keep.
- `scripts/` — keep, especially `set-matching-settings.mjs`.

Nothing else in the repo is Firebase-Studio-specific anymore.

---

## 13. Authentication: OAuth-only (Google + Microsoft)

The signup form has been simplified to **OAuth only**. There is no password
field on the signup page anymore. New users sign in with Google or Microsoft;
both providers verify the user's school email and we infer the university
from the email domain (`@bc.edu` → Boston College, `@vanderbilt.edu` →
Vanderbilt, etc. — see `src/lib/universities.ts`).

The legacy email/password flow still **works** for accounts that were created
that way before the migration; the password input on the login page is kept
for them. New accounts can no longer be created with a password.

### Why this is safe

- Both OAuth providers refuse to issue a token unless the school's IdP says
  the email is verified. So we never need our own verification email loop.
- Non-school accounts are rejected client-side in `loginWithOAuth()` (in
  `src/lib/auth.ts`). The user is signed back out and shown an error.
- The whitelist (set via `NEXT_PUBLIC_EMAIL_WHITELIST`, comma-separated) lets
  you, the owner, sign in with `connorbrugger@gmail.com`. Add more emails by
  appending to that env var.

### 13a. Enable Microsoft OAuth in Firebase

Microsoft requires a one-time setup in Azure AD before Firebase can use it.

1. Go to https://portal.azure.com → **Microsoft Entra ID** → **App
   registrations** → **New registration**.
   - Name: `Campus Connections`
   - Supported account types: **Accounts in any organizational directory
     (multi-tenant)**. (This is what restricts to school accounts.)
   - Redirect URI: **Web** →
     `https://<YOUR_FIREBASE_PROJECT>.firebaseapp.com/__/auth/handler`
     (or your custom auth domain from §6b, e.g.
     `https://auth.campus-connections.com/__/auth/handler`).
2. After the app is created, copy:
   - **Application (client) ID**
3. Go to **Certificates & secrets** → **New client secret** → copy the
   **Value** (you only see it once).
4. In **API permissions** make sure `User.Read`, `email`, `openid`, `profile`
   are added (the defaults are fine).
5. In **Firebase Console** → **Authentication** → **Sign-in method** →
   **Microsoft** → enable, and paste the Client ID + Client Secret from
   step 2/3.

That's it. The code in `loginWithMicrosoft()` already passes
`tenant: 'organizations'` which excludes personal `@outlook.com` /
`@live.com` accounts — you don't need to configure that on Microsoft's side.

### 13b. Local dev: allow `@gmail.com` as a fake university

`src/lib/universities.ts` has a `NODE_ENV === 'development'` branch that
treats `@gmail.com` emails as belonging to `CollegeU`. This makes it easy to
sign in with your personal Google account during local development without
needing a school account on hand. It is dead code in production builds.

---

## 14. Optional phone number + SMS notifications

Onboarding (`/onboarding`) now has an **optional** phone number field plus an
SMS opt-in checkbox. The phone field is fully optional — users can leave it
blank and continue. The opt-in checkbox is disabled until a valid phone is
entered. At save time the value is normalized to E.164 (`+15555550123`) and
written to `users/<uid>.phoneNumber` and `users/<uid>.smsNotificationsEnabled`.

Nothing currently *sends* SMS — the data is just being captured. To wire it
up later, the easiest path is Twilio:

1. Create a Twilio account, buy a US long-code or short-code number.
2. Add to your Firebase Functions environment:

   ```
   firebase functions:secrets:set TWILIO_ACCOUNT_SID
   firebase functions:secrets:set TWILIO_AUTH_TOKEN
   firebase functions:secrets:set TWILIO_FROM_NUMBER
   ```
3. In `functions/src/email.ts` (or a new `sms.ts`), add a helper:

   ```ts
   import twilio from 'twilio';
   const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
   export async function sendSms(to: string, body: string) {
     await client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER!, body });
   }
   ```
4. In `sendMatchNotification()` (or wherever a match is finalized), check
   `user.smsNotificationsEnabled && user.phoneNumber` and call `sendSms()`.

Twilio at this volume is essentially free: ~$0.0079 per SMS in the US, so
1,000 match SMSes/month ≈ $8 plus the ~$1/mo number rental.

---

## 15. Testing the matching engine

Two new tools were added to make matching testable end-to-end without
needing real flights or real users.

### 15a. Seed synthetic trips

```bash
# Default: 8 BC trips ~5h from now departing BOS
npm run seed:trips

# Or with overrides:
node scripts/seed-test-trips.mjs --uni Vanderbilt --hours 12 --airport BNA --count 12

# Clean up everything seeded:
npm run seed:trips:clean
```

The script writes `synthetic: true` on every doc it creates so cleanup is
unambiguous. It uses the same `FIREBASE_SERVICE_ACCOUNT_JSON` env var as the
rest of the admin tooling.

### 15b. Dev matching dashboard

Visit `/dev/matching` while running `npm run dev`. The page is gated by
`NODE_ENV === 'development'` and returns "Not available" in production. From
there you can:

- See the live `pending` pool grouped by university + airport.
- Pick a time window (hours from now) and click **Run manualPairing** — this
  invokes the deployed `manualPairing` callable function and shows the
  result.
- Watch the `matches` collection live (newest first).
- Bulk-delete every `synthetic: true` trip + user with one button.

If `manualPairing` errors with "function not found", run
`npm run deploy:functions` to push the Cloud Functions to Firebase first
(your project must be on the Blaze plan).

### 15c. Unit tests

The matcher's pure logic is covered in `functions/src/matching.test.ts`. To
run it:

```bash
npm --prefix functions test
```

This runs vitest against the matcher without touching Firestore — fast
feedback for tweaks to `computePairs` / `computeFallbacks` /
`findBestMatchForTrip`.

