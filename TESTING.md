# Testing Campus Connections

This is the easy way to test the app end-to-end without needing real flights,
real users, or waiting for the scheduled matcher to run.

## TL;DR

1. `npm run dev`
2. Sign in (any account works locally; see "Quick sign-in" below)
3. Open **http://localhost:3000/dev/test**
4. Click **"Run scenario"** on any card
5. Use the **"Sign in as →"** shortcuts to walk through the UI as each seeded rider

That's the whole loop. Every scenario seeds synthetic users + trips, invokes
`manualPairing`, and hands you impersonation links for the resulting riders.

---

## /dev/test — the one-click test page

Location: `src/app/(protected)/dev/test/page.tsx`
URL: `/dev/test` (gated by `NODE_ENV !== 'production'` — not reachable on prod)

Each card is a complete scenario. Click once, and the page:

1. Calls `/api/dev/seed-preset?key=<scenarioKey>` to insert users + trips
2. Calls `/api/dev/matching/run` — a Next.js route that ports the Cloud
   Function pairing logic to the Admin SDK, so matching works locally with no
   functions deploy/emulator required.
3. Also fires `manualPairing` (deployed Cloud Function) best-effort, so real
   staging/prod deploys keep getting exercised. Its failure is logged but
   non-fatal.
4. Surfaces the resulting match IDs + "Sign in as" buttons for each seeded rider

The cards correspond to the presets in `src/lib/dev/presets.mjs`:

| Scenario | What it exercises |
|---|---|
| `same-flight-pair` | Baseline 2-rider match |
| `group-of-4-light` | 4-rider group match |
| `mixed-pair-plus-xl` | Standard pair + XL-suggested third |
| `xl-heavy-trio` | All-heavy trio → XL suggestion |
| `gender-incompatible` | No match due to gender prefs |
| `two-hour-gap` | Flight time-window pairing |
| `relaxed-campus` | Cross-campus-area tolerance |
| `no-match-warning` | `noMatchWarningSent` banner path |

> Need more knobs? `/dev/matching` is the low-level console (pairing window,
> matches feed, raw preset controls). `/dev/test` is the friendly front door.

## Quick sign-in

To impersonate any seeded rider, click **"Sign in as"** on the scenario card.
That hits `/api/dev/impersonate?uid=<id>` which mints a custom token and signs
you in as that user. No password needed.

To get back to your real account, just log out from the Header (top-right)
and sign in normally.

---

## Manual smoke test (10 min)

When you want to verify the full flow by hand rather than via `/dev/test`:

### 1. Auth
- [ ] Sign up with a brand-new email — should land on `/verify-email`
- [ ] Email comes through (check spam); click link → auto-signs you in and
      forwards to `/onboarding?next=/main`
- [ ] Log out, log back in — password visibility toggle + caps-lock warning work
- [ ] Forgot-password flow sends the reset email

### 2. Onboarding
- [ ] Required fields are clearly marked; submit is disabled until they pass
- [ ] On submit, lands on `/main` and shows your profile

### 3. Dashboard
- [ ] `/dashboard` with no active trip shows the centered single-column form
- [ ] Flight date + time default to "now + 3h, rounded up to next 15 min"
- [ ] Submitting creates the trip; the right-hand status card appears
- [ ] With an active trip, the form is replaced by a short notice (no greyed
      form fields)
- [ ] Cancel Trip opens a confirmation dialog; confirming clears the trip
- [ ] Switching tabs away and back silently refetches the trip

### 4. Matching (use `/dev/test`)
- [ ] Run `same-flight-pair`, sign in as rider A
- [ ] `/main` shows "Chat with your match" CTA
- [ ] Chat opens; sending a message delivers in real-time to rider B
- [ ] Offline or firestore-rejected send shows a toast (try turning off wifi)
- [ ] Back button returns to the previous page (not always `/planned-trips`)

### 5. Header
- [ ] Current nav item is visually highlighted (ring + tinted background)
- [ ] Mobile nav shows "Log out" not "Exit"
- [ ] Logout shows a spinner while in flight

### 6. Profile
- [ ] No "linked to Google" flash on page load for password users
- [ ] Change-password form works
- [ ] Delete-account dialog requires confirmation

---

## Running the matcher manually

In production, the scheduled pairing jobs (`pairMatchNoon`, `pairMatchHourly`)
run on a cron inside Cloud Functions.

For local dev you have two options:

**(a) Local route (recommended).** Hits the Admin SDK directly — no functions
deploy required. This is what `/dev/test` uses.

```bash
curl -X POST http://localhost:3000/api/dev/matching/run \
  -H 'Content-Type: application/json' \
  -d '{"from":3,"to":7}'
```

**(b) Deployed Cloud Function.** Mirrors prod exactly; requires
`npm run deploy:functions` first.

```ts
import { getFunctions, httpsCallable } from 'firebase/functions';
const fn = httpsCallable(getFunctions(), 'manualPairing');
await fn({ from: 3, to: 7 });
```

Or via the Firebase shell: `firebase functions:shell` → `manualPairing({from:3,to:7})`.

---

## Typecheck

```bash
npx tsc -p tsconfig.check.json --noEmit
```

Two pre-existing errors in generated files are expected and can be ignored:

- `.next/types/routes.d.ts` — regenerated by `next build`
- `node_modules/csstype/index.d.ts` — upstream package, not our code

If a stale `tsconfig.mine.tsbuildinfo` is left over from an earlier editor
run, delete it manually from File Explorer — it's harmless but unused.

---

## Common gotchas

- `/dev/*` routes 404 when `NODE_ENV === 'production'`. To test against
  a production-ish build locally, run `npm run build && npm start` and
  the dev routes stay gated.
- Email verification uses your dev Firebase project's auth domain. If links
  go to the wrong host, check `firebase.json` + the auth action URL template.
- `manualPairing` requires you to be signed in as a user with `admin: true`
  in their Firestore profile. The impersonation shortcuts on `/dev/test`
  handle this for you; if calling from the shell, sign in as an admin first.
