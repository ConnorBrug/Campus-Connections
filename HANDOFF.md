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

- [ ] **CSRF / origin checks** on POST endpoints in `src/app/api/*`. Rely on SameSite=lax for most, but add origin checks on anything state-changing from outside the app.
- [ ] **Favicons/PWA.** Generate a full favicon set (16, 32, 180, 192, 512) from the existing SVG.
- [ ] **Accessibility audit.** Ensure all form inputs have labels, buttons have accessible names, color contrast passes WCAG AA on the brand palette.

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
- **Subagent hallucinations.** A prior audit claimed `/onboarding` didn't exist and `sendTripRequestConfirmation` was missing from `functions/src/email.ts`. Both claims were wrong. Verify audit findings against the actual files with `Read` or `grep` before acting on them.
- **Firestore composite indexes** must be deployed (`firebase deploy --only firestore:indexes`) before the matching cron will work in prod. Emulator ignores them.
- **Env vars on Vercel.** Firebase Admin creds go in Vercel → Project → Settings → Environment Variables: `FIREBASE_SERVICE_ACCOUNT_JSON` (or split triple). Don't commit them. `.env.local` stays gitignored.

## 6. First-message script for the new chat

> I'm continuing work on Campus-Connections (see `HANDOFF.md` in the repo). Read `HANDOFF.md` first, then start with the blockers: fix `firestore.indexes.json` to match the fields actually queried in `functions/src/matching.ts`, and tighten the `/settings/{doc}` read rule in `firestore.rules`. After that, work the high-priority list in order. Don't overwrite the locked-in decisions in §2. Ignore SMS.

---

*Generated from prior chat on 2026-04-21.*
