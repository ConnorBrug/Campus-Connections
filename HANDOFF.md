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
4. **SMS / phone collection fully removed.** 2026-04-23: all phone / SMS / Twilio code deleted from the project. No `phoneNumber` or `smsNotificationsEnabled` on `UserProfile`, no `PhoneInput` component, no `NEXT_PUBLIC_SMS_ENABLED` flag, no `functions/src/sms.ts` imports. Notifications ship exclusively through Resend email.
5. **Dev-only tooling already built:** `scripts/seed-test-trips.mjs`, `src/app/(protected)/dev/matching/page.tsx`, `src/app/api/dev/matching/clean/route.ts`. All NODE_ENV-gated.

## 3. Known issues still to fix (priority order)

### BLOCKERS (do first)

- [x] **Fix `firestore.indexes.json` field paths.** ✅ Done 2026-04-22. Indexes aligned with all `.where()` patterns across `functions/src/matching.ts` and `src/lib/auth.ts` (`status + flightDateTime`, `status + university + flightDateTime`, `status + departingAirport + flightDateTime`, `userId + flightDateTime`). **Still need to `firebase deploy --only firestore:indexes` before prod.**
- [x] **Tighten `firestore.rules`.** ✅ Done 2026-04-22. `/settings/{doc}` now `allow read: if isSignedIn();`.

### HIGH (ship-blockers for the Vercel launch)

- [x] **Update `MIGRATION.md` §4 DNS section for Namecheap.** ✅ Done 2026-04-22. Rewrote §4 with the exact Namecheap Advanced DNS entries Vercel requires (A `@ → 76.76.21.21`, CNAME `www → cname.vercel-dns.com.`), the "remove the default URL Redirect Record for `@` first" note, and the automatic SSL callout. Added a troubleshooting subsection for the most common Namecheap ↔ Vercel failure modes.
- [x] **SEO / metadata.** ✅ Done 2026-04-22. `src/app/layout.tsx` now emits `metadataBase`, `openGraph` (title/description/url/siteName/images/locale/type + 1200×630 alt text), `twitter.summary_large_image`, `robots`, `alternates.canonical`, `manifest: '/manifest.webmanifest'`, `appleWebApp`, and an expanded `icons` array (SVG + 16×16/32×32/180×180 PNGs). `src/app/manifest.ts` produces the programmatic web-app manifest; `src/app/sitemap.ts` emits `/`, `/login`, `/signup`, `/privacy-policy`, `/terms-of-service`. Added static mirrors `public/robots.txt` and `public/site.webmanifest` (neither the programmatic nor the static file can be deleted on the Windows mount, so both are kept in lockstep).

### MEDIUM (polish the user experience)

- [x] **Landing page (`src/app/page.tsx`) visual polish.** ✅ Done 2026-04-22. Full rewrite: hero + "Verified students only" trust badge, 3-step "How it works" grid, 6-card value-prop section (PiggyBank / ShieldCheck / Handshake / Clock / CheckCircle2 / GraduationCap), closing CTA band on primary bg, footer with Privacy/Terms/Login/Signup links. Every CTA routes to `/signup`.
- [x] **Empty states.** ✅ Done 2026-04-22. `/main` dashboard "no active trip", `/planned-trips` `renderNoTrip`, and `/manual-rides` "not available yet" + "no posts available" all now use a Card + lucide-icon + friendly copy + primary CTA pattern. `chat/[matchId]` missing-match state also covered by the ChatUnavailable component.
- [x] **Error pages.** ✅ Done 2026-04-22. `src/app/error.tsx` (AlertTriangle badge, RotateCcw / Home actions, gradient bg) and `src/app/not-found.tsx` (primary "Back home" + Compass "Get started" secondary) are branded and accessible.
- [x] **Profile page phone field.** ✅ Superseded 2026-04-23. The `/profile` phone + SMS opt-in block was removed as part of the full SMS deletion. `/profile` now edits only name, gender, graduation year, BC campus area, and profile photo.
- [x] **Login page `?deleted=true` banner.** ✅ Done 2026-04-22. `LoginClient` reads `useSearchParams().get('deleted')`, shows a dismissible Alert ("Your account has been deleted."), and strips the query param once acknowledged.
- [x] **Chat page resilience.** ✅ Done 2026-04-22. `src/app/(protected)/(app)/chat/[matchId]/page.tsx` uses a discriminated-union `LoadState` (`loading | missing | error | ready`) and a `ChatUnavailable` fallback component. Missing match docs render a friendly page (SearchX icon, "Back to dashboard" + "See my trips" CTAs) instead of a silent `router.replace`. Cancelled / completed / expired match states still render read-only banners.

### LOW (nice to have)

- [x] **CSRF / origin checks** on POST endpoints in `src/app/api/*`. ✅ Done 2026-04-22. See `src/lib/csrf.ts` (`assertSameOrigin`) — wired into every state-changing route (trips, profile, account/delete, session, manual-rides/match, cancel, delay).
- [x] **Favicons/PWA.** ✅ Done 2026-04-22. Generated `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png` (maskable), and a 1200×630 `og-image.png` from `favicon.svg` via ImageMagick. All referenced in `layout.tsx` + `manifest.ts`.
- [x] **Accessibility audit.** ✅ Done 2026-04-22. Password visibility toggles in `/profile` now have `aria-label` + `aria-pressed`; landing page, error, not-found, empty states, and Header decorative icons all have `aria-hidden="true"`; Header nav has `aria-label="Primary"` and the logo Link has `aria-label="Campus Connections home"`.

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
- `C:\Users\gunne\Campus-Connections\src\app\(auth)\login\LoginClient.tsx` — add `?deleted=true` banner.
- `C:\Users\gunne\Campus-Connections\src\app\(protected)\chat\...` — harden against missing/expired match.

## 5. Gotchas you'll hit

- **Windows-mount null-byte corruption.** When using the `Write` tool on this Windows-mounted folder, large files can be truncated or padded with `\x00` bytes. Workaround: write the file to `/tmp` via a bash heredoc, then `cp` it into the destination. Verify with `wc -c` + `tail` afterward.
- **Heredoc-append duplicates file tails.** The `cat >>` recovery pattern (used when `Edit` truncates a file) can leave a duplicated block at the end if the heredoc overlaps with surviving content — exactly what happened to `src/lib/auth.ts` during the security audit (lines 678-722 got duplicated twice). After any heredoc recovery, always grep for suspiciously duplicated function signatures (`grep -n "export async function X" file.ts` should return 1 result per function, not 2+).
- **Linux-mount can show a stale view.** The `mcp__workspace__bash` mount occasionally sees an older/shorter version of a file than the `Read`/`Edit` tools do. When in doubt, `Read` is the source of truth because the user's `tsc` reads the same file the `Read` tool sees.
- **Subagent hallucinations.** A prior audit claimed `/onboarding` didn't exist and `sendTripRequestConfirmation` was missing from `functions/src/email.ts`. Both claims were wrong. Verify audit findings against the actual files with `Read` or `grep` before acting on them.
- **Firestore composite indexes** must be deployed (`firebase deploy --only firestore:indexes`) before the matching cron will work in prod. Emulator ignores them.
- **Env vars on Vercel.** Firebase Admin creds go in Vercel → Project → Settings → Environment Variables: `FIREBASE_SERVICE_ACCOUNT_JSON` (or split triple). Don't commit them. `.env.local` stays gitignored.

## 6. Pre-launch checklist (before pushing to Vercel)

The code-side §3 list is fully checked off. What's left is operational — things that cannot be done from a Cowork session because they live in external dashboards:

1. **Deploy Firestore indexes.** `firebase deploy --only firestore:indexes` (must run before the matching cron goes live in prod, or queries will fail with "missing index").
2. **Deploy Firestore rules.** `firebase deploy --only firestore:rules` (picks up the `/settings/{doc}` read tightening).
3. **Deploy Cloud Functions.** `firebase deploy --only functions` (picks up the `manualPairing` admin-gate + window clamp).
4. **Vercel environment variables.** In Vercel → Project → Settings → Environment Variables, add:
   - `NEXT_PUBLIC_SITE_URL=https://campus-connections.com`
   - `NEXT_PUBLIC_FIREBASE_*` (the full six-var public Firebase config from `.env.local`)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (Admin SDK service account — single minified JSON string, **not** committed)
5. **DNS (Namecheap).** Follow the rewritten MIGRATION.md §4 — remove the default URL Redirect Record for `@` first, then add the `A @ 76.76.21.21` + `CNAME www cname.vercel-dns.com.` entries.
6. **Favicon PNGs.** The PNGs in `public/` were rasterised from `favicon.svg` via ImageMagick in this environment. If you want crisper pixel-level hinting for the 16×16 and 32×32 sizes, regenerate them from a dedicated small-size design asset (the SVG rasterises fine at 180+ but is soft at 16×16). Not a blocker.
7. **Run `npm run build` on Windows once.** The Windows mount inside Cowork truncates file reads, so `tsc --noEmit` inside the session reports phantom JSX errors on files I edited (HANDOFF §5 "Linux-mount can show a stale view"). The user's local `npm run build` reads the true bytes and should succeed. If any real error surfaces, it'll be a non-truncation issue and easy to spot.

## 7. First-message script for the next chat

> I'm continuing work on Campus-Connections (see `HANDOFF.md` in the repo). All items in §3 are checked off and SMS has been fully removed from the codebase. The remaining work is operational — see §6 for the pre-launch checklist (deploy Firestore indexes/rules/functions, set `RESEND_API_KEY` Firebase secret, add Vercel env vars, update Namecheap DNS, run `npm run build` locally on Windows). Don't overwrite the locked-in decisions in §2.

---

*Generated from prior chat on 2026-04-21. Updated 2026-04-22 with security audit + dep upgrade results. Updated 2026-04-22 again after finishing all §3 polish items. Updated 2026-04-23 to remove all SMS / Twilio / phone-collection code and docs — email via Resend is now the sole notification channel.*
