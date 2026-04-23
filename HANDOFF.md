# Campus-Connections — Handoff for New Chat

Paste this whole file into a fresh Claude Cowork chat so the new assistant can pick up without losing context.

---

## 1. Project context

- **App:** Campus-Connections (`campus-connections.com`) — a Next.js 15 + Firebase app that matches college students sharing rides to/from airports. Started at Boston College; architecture is multi-university.
- **Repo root:** `C:\Users\gunne\Campus-Connections` (this is the selected Cowork folder — you have read/write access).
- **Migration in progress:** Moving from Firebase Studio + Firebase App Hosting → **local dev + Vercel hosting**. Firestore, Auth, Storage, and Cloud Functions stay on Firebase. Domain is registered at **Namecheap**.
- **Stack:** Next.js 15 App Router, TypeScript strict, Firebase (Auth + Firestore + Storage + Functions v2), Zod + React Hook Form, shadcn/ui, Tailwind.
- **Route groups:** `src/app/(auth)/...` (login, signup, onboarding), `src/app/(protected)/...` (main, profile, chat, dev), `src/app/api/...`

## 2. Decisions already locked in — DO NOT OVERWRITE

1. **OAuth-only signup.** `signup` page shows only Google + Microsoft buttons. No password form on signup. Login page still has password form for legacy accounts.
2. **Microsoft OAuth** uses `OAuthProvider('microsoft.com')` with `setCustomParameters({ prompt: 'select_account', tenant: 'organizations' })`.
3. **Email-domain gate:** Both providers validate the email maps to a known university (via `src/lib/universities.ts`) or a whitelist — otherwise sign out.
4. **Phone number is fully optional.** No cross-field Zod refine requiring phone. SMS checkbox is disabled-until-valid-phone (UX hint only). At save time: `phoneToSave = rawPhone ? (rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone) : null`, and `smsNotificationsEnabled: !!values.smsNotificationsEnabled && !!phoneToSave`.
5. **Ignore all SMS sending issues.** Phone/SMS data is collected but not sent. Do not wire Twilio.
6. **Dev-only tooling already built:** `scripts/seed-test-trips.mjs`, `src/app/(protected)/dev/matching/page.tsx`, `src/app/api/dev/matching/clean/route.ts`. All NODE_ENV-gated.

## 3. Known issues still to fix (priority order)

### BLOCKERS (do first)

- [ ] **Fix `firestore.indexes.json` field paths.** File currently references `flight.boardingTime`, `universityId`, `flight.flightCode`, but `functions/src/matching.ts` queries `flightDateTime` and `university`. The matching cron will fail with "missing index" errors in production. Align the indexes to the fields actually queried. After editing, run `firebase deploy --only firestore:indexes`.
- [ ] **Tighten `firestore.rules`.** `match /settings/{doc}` currently has `allow read: if true;` — change to `allow read: if isSignedIn();` (or tighter if there's no reason for clients to read settings at all).

### HIGH (ship-blockers for the Vercel launch)

- [ ] **Update `MIGRATION.md` §4 DNS section for Namecheap.** Include the exact Namecheap Advanced DNS entries Vercel currently requires:
  - A Record, Host `@`, Value `76.76.21.21`
  - CNAME, Host `www`, Value `cname.vercel-dns.com.`
  - Note that Namecheap's default "URL Redirect Record" for `@` must be removed first.
  - Mention SSL is automatic once DNS propagates.
- [ ] **SEO / metadata.** `src/app/layout.tsx` only sets `title`/`description`/`favicon`. Add: `metadataBase: new URL('https://campus-connections.com')`, `openGraph` (title, description, url, siteName, images, locale, type), `twitter` (card: 'summary_large_image'), `robots`, `alternates.canonical`, `manifest`, `appleWebApp`. Create `public/robots.txt`, `public/og-image.png` (1200×630), `public/apple-touch-icon.png` (180×180), `public/site.webmanifest`, and either `public/sitemap.xml` or `src/app/sitemap.ts` that emits `/`, `/login`, `/signup`, and any marketing pages.

### MEDIUM (polish the user experience)

- [ ] **Landing page (`src/app/page.tsx`) visual polish.** Audit hero, value prop, CTAs, feature sections, testimonial/trust, footer. Make sure CTAs route correctly to `/signup`.
- [ ] **Empty states.** `/main` (dashboard) and other list views need friendly empty states when there are no trips/matches/chats.
- [ ] **Error pages.** Improve `src/app/error.tsx` and `src/app/not-found.tsx` — branded, helpful, with a "back home" CTA.
- [ ] **Profile page phone field.** Add an editable phone number field to `/profile` so users who skipped phone at onboarding can add it later (and vice versa). Same PHONE_RE validation; same phone-gated SMS checkbox pattern.
- [ ] **Login page `?deleted=true` banner.** When redirected after account deletion, show a neutral acknowledgment ("Your account has been deleted.").
- [ ] **Chat page resilience.** Verify `src/app/(protected)/chat/[matchId]/...` handles a missing match doc, a cancelled match, and an expired chat (`expiresAt` in the past) without crashing. Show a friendly message instead.

### LOW (nice to have)

- [x] **CSRF / origin checks** on POST endpoints in `src/app/api/*`. ✅ Done 2026-04-22. See `src/lib/csrf.ts` (`assertSameOrigin`) — wired into every state-changing route (trips, profile, account/delete, session, manual-rides/match, cancel, delay).
- [ ] **Favicons/PWA.** Generate a full favicon set (16, 32, 180, 192, 512) from the existing SVG.
- [ ] **Accessibility audit.** Ensure all form inputs have labels, buttons have accessible names, color contrast passes WCAG AA on the brand palette.

## 3.5 Completed security + dependency work (2026-04-22)

Full security audit across 12 scope areas (auth/session, Firestore rules, API authorization, input sanitization, email/SMS injection, CSP, Storage rules, env hygiene, open redirects/SSRF, rate limiting, Cloud Functions triggers, chat expiry). All critical/high/medium findings closed. Key fixes:

- **Session cookie verification.** `POST /api/session` now `verifyIdToken` → checks `email_verified` → enforces 5-minute auth_time freshness before minting the session cookie. Both POST and DELETE gated by `assertSameOrigin`.
- **Dev impersonation hardening.** Removed hardcoded API key fallback in `src/app/api/dev/impersonate/route.ts`. Stopped echoing Firebase error messages.
- **Firebase env enforcement.** `src/lib/firebase.ts` now throws if `NEXT_PUBLIC_FIREBASE_*` env vars are missing — no silent fallbacks.
- **Photo URL allowlist.** `updateUserProfile` in `src/lib/auth.ts` restricts photoURLs to `firebasestorage.googleapis.com`, `*.firebasestorage.app`, and `lh3.googleusercontent.com`. Same check is applied for both the Firestore payload and the Firebase Auth `photoURL` sync.
- **Storage rules.** Added `contentType` matcher (`image/(jpeg|png|webp|gif)`) alongside existing UID/path scoping and size limits.
- **CSP + connect-src + img-src.** Tightened in `next.config.ts` — `img-src` and `connect-src` restricted to specific Firebase + Google OAuth hosts only.
- **Session ping.** Added 60/min/IP rate limit to `/api/session/ping`. Stopped echoing Firebase error messages.
- **Firestore rules — chat expiry.** `allow create` on `/chats/{id}` now requires `expiresAt` to be a future timestamp. `allow update` must preserve `userIds` and keep `expiresAt` as a timestamp.
- **Manual pairing admin gate.** `functions.https.onCall` for `manualPairing` now checks `context.auth.token.admin === true`. Window params clamped to `[0, 168]` hours.
- **Client-trusted userId removed.** Deleted `submitTripDetailsAction` server action (it trusted client-provided `userId`). Canonical path is now `POST /api/trips` which derives uid from the session cookie.

**Dependency upgrades (2026-04-22):**

- `functions/`: bumped to `firebase-admin@^13`, `firebase-functions@^6`, `vitest@^3`. Swapped `import * as functions from 'firebase-functions'` → `'firebase-functions/v1'` in `functions/src/index.ts` (v6 moved the v1 namespace to a subpath).
- Root: `npm audit fix` cleared `fast-xml-parser` (critical), `protobufjs` (critical), `jws` (high — HMAC bypass in jsonwebtoken), `lodash`, `node-forge`, `minimatch`, `picomatch`, `socket.io-parser`, `glob`, `yaml`, `brace-expansion`. Bumped Next from `15.5.9` → `^15.5.15` to escape the HTTP smuggling / DoS range. **Did not take Next 16 (major bump breaks Turbopack compilation in this codebase and introduces middleware→proxy rename).**
- **Final audit state:** functions 9 low, root 10 (2 low + 8 moderate). All remaining vulns are transitive inside the `firebase-admin` → `@google-cloud/storage` / `@google-cloud/firestore` chain (`@tootallnate/once`, `retry-request`, `uuid` v3/v5/v6 buf bounds). Google's SDK doesn't pass user input to these functions, so not exploitable in this app. Will clear upstream when Firebase bumps `@google-cloud/storage` past `uuid@9`.
- **Do NOT run `npm audit fix --force`** on root or functions — it would downgrade `firebase-admin` to v10 and re-introduce all the criticals we just fixed.

## 4. Files most relevant to the pending work

- `C:\Users\gunne\Campus-Connections\firestore.indexes.json` — **has the blocker bug.**
- `C:\Users\gunne\Campus-Connections\firestore.rules` — `/settings/{doc}` read rule needs tightening.
- `C:\Users\gunne\Campus-Connections\functions\src\matching.ts` — source of truth for which fields the indexes need to cover.
- `C:\Users\gunne\Campus-Connections\MIGRATION.md` — §4 DNS section needs Namecheap specifics.
- `C:\Users\gunne\Campus-Connections\src\app\layout.tsx` — metadata is minimal.
- `C:\Users\gunne\Campus-Connections\public\` — only contains `favicon.svg`; needs robots, sitemap, og-image, manifest, apple-touch-icon.
- `C:\Users\gunne\Campus-Connections\src\app\page.tsx` — landing page polish.
- `C:\Users\gunne\Campus-Connections\src\app\error.tsx`, `src\app\not-found.tsx` — improve.
- `C:\Users\gunne\Campus-Connections\src\app\(protected)\profile\...` — add editable phone field.
- `C:\Users\gunne\Campus-Connections\src\app\(auth)\login\LoginClient.tsx` — add `?deleted=true` banner.
- `C:\Users\gunne\Campus-Connections\src\app\(protected)\chat\...` — harden against missing/expired match.
- `C:\Users\gunne\Campus-Connections\src\app\(auth)\onboarding\page.tsx` — **already correct, phone is optional. Do not re-add cross-field refine.**

## 5. Gotchas you'll hit

- **Windows-mount null-byte corruption.** When using the `Write` tool on this Windows-mounted folder, large files can be truncated or padded with `\x00` bytes. Workaround: write the file to `/tmp` via a bash heredoc, then `cp` it into the destination. Verify with `wc -c` + `tail` afterward.
- **Heredoc-append duplicates file tails.** The `cat >>` recovery pattern (used when `Edit` truncates a file) can leave a duplicated block at the end if the heredoc overlaps with surviving content — exactly what happened to `src/lib/auth.ts` during the security audit (lines 678-722 got duplicated twice). After any heredoc recovery, always grep for suspiciously duplicated function signatures (`grep -n "export async function X" file.ts` should return 1 result per function, not 2+).
- **Linux-mount can show a stale view.** The `mcp__workspace__bash` mount occasionally sees an older/shorter version of a file than the `Read`/`Edit` tools do. When in doubt, `Read` is the source of truth because the user's `tsc` reads the same file the `Read` tool sees.
- **Subagent hallucinations.** A prior audit claimed `/onboarding` didn't exist and `sendTripRequestConfirmation` was missing from `functions/src/email.ts`. Both claims were wrong. Verify audit findings against the actual files with `Read` or `grep` before acting on them.
- **Firestore composite indexes** must be deployed (`firebase deploy --only firestore:indexes`) before the matching cron will work in prod. Emulator ignores them.
- **Env vars on Vercel.** Firebase Admin creds go in Vercel → Project → Settings → Environment Variables: `FIREBASE_SERVICE_ACCOUNT_JSON` (or split triple). Don't commit them. `.env.local` stays gitignored.

## 6. First-message script for the new chat

> I'm continuing work on Campus-Connections (see `HANDOFF.md` in the repo). Read `HANDOFF.md` first, then start with the blockers: fix `firestore.indexes.json` to match the fields actually queried in `functions/src/matching.ts`, and tighten the `/settings/{doc}` read rule in `firestore.rules`. After that, work the high-priority list in order. Don't overwrite the locked-in decisions in §2. Ignore SMS.

---

*Generated from prior chat on 2026-04-21. Updated 2026-04-22 with security audit + dep upgrade results.*
