/**
 * Dev-only local matching runner.
 *
 * POST /api/dev/matching/run { from?: number, to?: number }
 *
 * Loads pending trip requests whose flightDateTime falls in [now+from, now+to]
 * hours, runs the same pairing algorithm the `manualPairing` Cloud Function
 * uses, and writes match docs + updates trip docs via the Admin SDK.
 *
 * Why this exists: /dev/test calls `manualPairing` (a deployed Cloud
 * Function), and locally that call fails unless functions are deployed/emulated.
 * When it fails the trip stays `pending` and the impersonated user never sees
 * a match. This route does the same work in-process so the dev loop works
 * without a functions deploy.
 *
 * Parity with functions/src/matching.ts is intentional — when that file
 * changes, mirror the change here (the logic is pure, no Firestore-specific
 * behavior, so it's easy to keep in sync). Email/SMS side-effects are
 * deliberately omitted; dev testing doesn't need them.
 *
 * Gated by NODE_ENV !== 'production'.
 */

import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { TripRequest, Match, MatchTier } from '@/lib/types';

// ----- Bag capacity rules (mirror functions/src/types.ts) -----
const BAG_CAPACITY = [
  { checked: 2, carry: 2 },
  { checked: 3, carry: 1 },
] as const;

const GROUP_BAG_CAPACITY = [
  { checked: 3, carry: 3 },
  { checked: 4, carry: 2 },
] as const;

// ----- Pure helpers (mirror functions/src/utils.ts) -----
const toMs = (iso: string) => new Date(iso).getTime();

const withinOneHour = (a: TripRequest, b: TripRequest) =>
  Math.abs(toMs(a.flightDateTime) - toMs(b.flightDateTime)) <= 60 * 60 * 1000;

const withinTwoHours = (a: TripRequest, b: TripRequest) =>
  Math.abs(toMs(a.flightDateTime) - toMs(b.flightDateTime)) <= 2 * 60 * 60 * 1000;

const sameCampusAirport = (a: TripRequest, b: TripRequest) => {
  if (a.university !== b.university) return false;
  if (a.campusArea && b.campusArea && a.campusArea !== b.campusArea) return false;
  return a.departingAirport === b.departingAirport;
};

const sameUniversityAirport = (a: TripRequest, b: TripRequest) => {
  if (a.university !== b.university) return false;
  return a.departingAirport === b.departingAirport;
};

function genderCompatible(a: TripRequest, b: TripRequest): boolean {
  const aPref = a.userPreferences;
  const bPref = b.userPreferences;
  const aGender = a.userGender;
  const bGender = b.userGender;

  const aWants = aPref === 'No preference' || (!!bGender && aPref === bGender);
  const bWants = bPref === 'No preference' || (!!aGender && bPref === aGender);

  if (aPref !== 'No preference' && bPref !== 'No preference' && !!aGender && !!bGender) {
    return aPref === bGender && bPref === aGender;
  }
  return aWants && bWants;
}

function groupGenderCompatible(group: TripRequest[]): boolean {
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      if (!genderCompatible(group[i], group[j])) return false;
    }
  }
  return true;
}

const fitsCapacity = (pair: TripRequest[]) => {
  const checked = pair.reduce((s, t) => s + (t.numberOfCheckedBags || 0), 0);
  const carry = pair.reduce((s, t) => s + (t.numberOfCarryons || 0), 0);
  return BAG_CAPACITY.some((r) => checked <= r.checked && carry <= r.carry);
};

const isLightBags = (t: TripRequest) =>
  (t.numberOfCheckedBags || 0) <= 1 && (t.numberOfCarryons || 0) <= 1;

const fitsGroupCapacity = (group: TripRequest[]) => {
  const checked = group.reduce((s, t) => s + (t.numberOfCheckedBags || 0), 0);
  const carry = group.reduce((s, t) => s + (t.numberOfCarryons || 0), 0);
  return GROUP_BAG_CAPACITY.some((r) => checked <= r.checked && carry <= r.carry);
};

// ----- Scoring + pick (mirror functions/src/matching.ts) -----
function candidateScore(a: TripRequest, b: TripRequest): number {
  const sameFlight = a.flightCode && b.flightCode && a.flightCode === b.flightCode ? 1 : 0;
  const aBags = (a.numberOfCheckedBags || 0) + (a.numberOfCarryons || 0);
  const bBags = (b.numberOfCheckedBags || 0) + (b.numberOfCarryons || 0);
  const spread = Math.abs(aBags - bBags);
  const timeGapMin = Math.abs(toMs(a.flightDateTime) - toMs(b.flightDateTime)) / 60000;
  return sameFlight * 10000 + spread * 100 - Math.floor(timeGapMin);
}

function pickBestCandidate(
  a: TripRequest,
  candidates: TripRequest[],
): { best: TripRequest | null; genderRelaxed: boolean } {
  let bestPreferred: TripRequest | null = null;
  let scorePreferred = -Infinity;
  let bestFallback: TripRequest | null = null;
  let scoreFallback = -Infinity;

  for (const b of candidates) {
    const s = candidateScore(a, b);
    if (genderCompatible(a, b)) {
      if (s > scorePreferred) {
        scorePreferred = s;
        bestPreferred = b;
      }
    } else if (s > scoreFallback) {
      scoreFallback = s;
      bestFallback = b;
    }
  }

  if (bestPreferred) return { best: bestPreferred, genderRelaxed: false };
  if (bestFallback) return { best: bestFallback, genderRelaxed: true };
  return { best: null, genderRelaxed: false };
}

const groupKey = (t: TripRequest) =>
  `${t.university}::${t.campusArea ?? ''}::${t.departingAirport}`;

function computePairs(all: TripRequest[]): { pairs: [TripRequest, TripRequest][]; unmatched: TripRequest[] } {
  const buckets = new Map<string, TripRequest[]>();
  for (const t of all) {
    const k = groupKey(t);
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(t);
  }

  const pairs: [TripRequest, TripRequest][] = [];
  const unmatched: TripRequest[] = [];

  for (const group of buckets.values()) {
    const pool = group.slice().sort((a, b) => {
      const cand = (u: TripRequest) =>
        group.filter(
          (x) => x.id !== u.id && sameCampusAirport(u, x) && withinOneHour(u, x) && genderCompatible(u, x),
        ).length;
      const aCand = cand(a);
      const bCand = cand(b);
      if (aCand !== bCand) return aCand - bCand;
      const aBags = (a.numberOfCheckedBags || 0) + (a.numberOfCarryons || 0);
      const bBags = (b.numberOfCheckedBags || 0) + (b.numberOfCarryons || 0);
      return bBags - aBags;
    });

    while (pool.length) {
      const a = pool.shift()!;
      const candidates = pool.filter(
        (b) => sameCampusAirport(a, b) && withinOneHour(a, b) && fitsCapacity([a, b]),
      );
      const { best } = pickBestCandidate(a, candidates);
      if (best) {
        const idx = pool.findIndex((x) => x.id === best.id);
        if (idx >= 0) pool.splice(idx, 1);
        pairs.push([a, best]);
      } else {
        unmatched.push(a);
      }
    }
  }
  return { pairs, unmatched };
}

function computeFallbacks(unmatched: TripRequest[]): {
  groups: TripRequest[][];
  xlSuggested: TripRequest[];
  relaxedCampusPairs: [TripRequest, TripRequest][];
  relaxedTimePairs: [TripRequest, TripRequest][];
  noMatchWarnings: TripRequest[];
} {
  const remaining = new Set(unmatched.map((t) => t.id));
  const byId = new Map(unmatched.map((t) => [t.id, t]));
  const getRemaining = () => [...remaining].map((id) => byId.get(id)!);

  // Tier 1: light-bag groups of 3-4
  const groups: TripRequest[][] = [];
  const lightBag = getRemaining().filter(isLightBags);
  const lightBagBuckets = new Map<string, TripRequest[]>();
  for (const t of lightBag) {
    const k = groupKey(t);
    (lightBagBuckets.get(k) ?? lightBagBuckets.set(k, []).get(k)!).push(t);
  }
  for (const bucket of lightBagBuckets.values()) {
    bucket.sort((a, b) => toMs(a.flightDateTime) - toMs(b.flightDateTime));
    let i = 0;
    while (i < bucket.length) {
      if (!remaining.has(bucket[i].id)) {
        i++;
        continue;
      }
      const candidates = [bucket[i]];
      for (let j = i + 1; j < bucket.length && candidates.length < 4; j++) {
        if (!remaining.has(bucket[j].id)) continue;
        const prospect = [...candidates, bucket[j]];
        if (
          withinOneHour(candidates[0], bucket[j]) &&
          groupGenderCompatible(prospect) &&
          fitsGroupCapacity(prospect)
        ) {
          candidates.push(bucket[j]);
        }
      }
      if (candidates.length >= 3) {
        groups.push(candidates);
        for (const c of candidates) remaining.delete(c.id);
      }
      i++;
    }
  }

  // Tier 2: heavy-bag → XL suggestion
  const xlSuggested: TripRequest[] = [];
  for (const t of getRemaining()) {
    if (!isLightBags(t)) {
      xlSuggested.push(t);
      remaining.delete(t.id);
    }
  }

  // Tier 3: relax campus
  const relaxedCampusPairs: [TripRequest, TripRequest][] = [];
  const campusPool = getRemaining().filter((t) => !!t.campusArea);
  const usedInCampus = new Set<string>();
  for (let i = 0; i < campusPool.length; i++) {
    if (usedInCampus.has(campusPool[i].id)) continue;
    const a = campusPool[i];
    const candidates = campusPool
      .slice(i + 1)
      .filter((b) => !usedInCampus.has(b.id))
      .filter((b) => sameUniversityAirport(a, b))
      .filter((b) => withinOneHour(a, b))
      .filter((b) => fitsCapacity([a, b]));
    const { best } = pickBestCandidate(a, candidates);
    if (best) {
      relaxedCampusPairs.push([a, best]);
      usedInCampus.add(a.id);
      usedInCampus.add(best.id);
      remaining.delete(a.id);
      remaining.delete(best.id);
    }
  }

  // Tier 4: relax time to 2 hours
  const relaxedTimePairs: [TripRequest, TripRequest][] = [];
  const timePool = getRemaining();
  const usedInTime = new Set<string>();
  for (let i = 0; i < timePool.length; i++) {
    if (usedInTime.has(timePool[i].id)) continue;
    const a = timePool[i];
    const candidates = timePool
      .slice(i + 1)
      .filter((b) => !usedInTime.has(b.id))
      .filter((b) => sameCampusAirport(a, b))
      .filter((b) => withinTwoHours(a, b))
      .filter((b) => fitsCapacity([a, b]));
    const { best } = pickBestCandidate(a, candidates);
    if (best) {
      relaxedTimePairs.push([a, best]);
      usedInTime.add(a.id);
      usedInTime.add(best.id);
      remaining.delete(a.id);
      remaining.delete(best.id);
    }
  }

  // Tier 5: no-match warning for lone riders < 3h from flight
  const now = Date.now();
  const noMatchWarnings: TripRequest[] = [];
  for (const t of getRemaining()) {
    const hoursUntilFlight = (toMs(t.flightDateTime) - now) / 3600_000;
    if (hoursUntilFlight < 3) noMatchWarnings.push(t);
  }

  return { groups, xlSuggested, relaxedCampusPairs, relaxedTimePairs, noMatchWarnings };
}

// ----- Firestore writes -----
type WriteBatch = FirebaseFirestore.WriteBatch;

function chatExpiryFromRiders(riders: TripRequest[]) {
  const latest = riders.reduce((mx, r) => Math.max(mx, toMs(r.flightDateTime)), 0);
  return Timestamp.fromDate(new Date(latest + 4 * 3600_000));
}

function writeMatch(
  batch: WriteBatch,
  riders: TripRequest[],
  tier: MatchTier,
  reason: string,
): string {
  const matchRef = adminDb.collection('matches').doc();
  const participants: Match['participants'] = {};
  for (const r of riders) {
    participants[r.userId] = {
      userId: r.userId,
      userName: r.userName ?? 'User',
      userPhotoUrl: r.userPhotoUrl ?? null,
      university: r.university,
      flightCode: r.flightCode,
      flightDateTime: r.flightDateTime,
    };
  }

  const allSameFlight = riders.every((r) => r.flightCode === riders[0].flightCode);
  const match: Match = {
    id: matchRef.id,
    participantIds: riders.map((r) => r.userId),
    participants,
    requestIds: riders.map((r) => r.id),
    university: riders[0].university,
    campusArea: riders[0].campusArea ?? null,
    departingAirport: riders[0].departingAirport,
    flightCode: allSameFlight ? riders[0].flightCode : undefined,
    assignedAtISO: new Date().toISOString(),
    status: 'matched',
    reason,
    matchTier: tier,
  };
  batch.set(matchRef, match);

  for (const r of riders) {
    batch.update(adminDb.collection('tripRequests').doc(r.id), {
      status: 'matched',
      matchId: matchRef.id,
      matchedUserId: riders.find((x) => x.userId !== r.userId)?.userId ?? null,
      cancellationAlert: false,
      fallbackTier: tier,
    });
  }

  // Start the chat doc + system message so "Go to Chat" works immediately.
  const chatId = riders.map((r) => r.userId).sort().join('_');
  const chatRef = adminDb.collection('chats').doc(chatId);
  const lines = riders.map((r) => {
    const dt = new Date(r.flightDateTime);
    const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `- ${r.userName ?? 'Rider'}: Flight ${r.flightCode} at ${timeStr}.`;
  });
  const systemMsg = [
    'This is an automated message to start your coordination.',
    '',
    ...lines,
    '',
    "Recommendation: Plan to arrive at the airport at least 1 hour before the earlier flight's boarding time.",
  ].join('\n');

  batch.set(
    chatRef,
    {
      userIds: riders.map((r) => r.userId),
      lastMessage: 'Chat initiated.',
      expiresAt: chatExpiryFromRiders(riders),
      typing: null,
    },
    { merge: true },
  );
  // Use a DETERMINISTIC doc id for the system "start" message so repeated
  // Run-scenario clicks overwrite it instead of stacking up duplicates.
  // (User-sent messages still use auto-IDs and are preserved.)
  const msgRef = chatRef.collection('messages').doc('__system_init');
  batch.set(msgRef, {
    text: systemMsg,
    senderId: 'system',
    timestamp: FieldValue.serverTimestamp(),
  });

  return matchRef.id;
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { from?: number; to?: number };
    const hoursFrom = typeof body.from === 'number' ? body.from : 3;
    const hoursTo = typeof body.to === 'number' ? body.to : 24;

    const now = Date.now();
    const minISO = new Date(now + hoursFrom * 3600_000).toISOString();
    const maxISO = new Date(now + hoursTo * 3600_000).toISOString();

    // Single-field query on `status` + in-memory time filter. The Cloud
    // Function's composite query (status + flightDateTime range) needs a
    // Firestore index; for dev the pool is tiny, so filtering in JS is
    // both simpler and avoids making the dev loop depend on a deployed
    // index.
    const snap = await adminDb
      .collection('tripRequests')
      .where('status', '==', 'pending')
      .get();

    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TripRequest);
    const pending = all.filter((t) => {
      const iso = t.flightDateTime;
      return typeof iso === 'string' && iso >= minISO && iso < maxISO;
    });
    if (!pending.length) {
      return NextResponse.json({
        ok: true,
        window: { hoursFrom, hoursTo, minISO, maxISO },
        pendingCount: 0,
        created: 0,
        groups: 0,
        fallbacks: 0,
        note: 'No pending trips in window.',
      });
    }

    const { pairs, unmatched } = computePairs(pending);

    const batch = adminDb.batch();
    const createdMatchIds: string[] = [];
    let created = 0;
    let fallbacks = 0;

    for (const [a, b] of pairs) {
      createdMatchIds.push(writeMatch(batch, [a, b], 'standard', 'Best available pair'));
      created++;
    }

    let groupCount = 0;
    let xlCount = 0;
    let relaxedCampusCount = 0;
    let relaxedTimeCount = 0;
    let noMatchCount = 0;

    if (unmatched.length > 0) {
      const fb = computeFallbacks(unmatched);

      for (const g of fb.groups) {
        createdMatchIds.push(writeMatch(batch, g, 'group', `Light-bag group of ${g.length}`));
        created++;
        fallbacks++;
        groupCount++;
      }

      for (const t of fb.xlSuggested) {
        batch.update(adminDb.collection('tripRequests').doc(t.id), {
          xlRideSuggested: true,
          fallbackTier: 'xl-suggested',
        });
        fallbacks++;
        xlCount++;
      }

      for (const [a, b] of fb.relaxedCampusPairs) {
        createdMatchIds.push(writeMatch(batch, [a, b], 'relaxed-campus', 'Cross-campus match'));
        created++;
        fallbacks++;
        relaxedCampusCount++;
      }

      for (const [a, b] of fb.relaxedTimePairs) {
        createdMatchIds.push(writeMatch(batch, [a, b], 'relaxed-time', '2-hour window match'));
        created++;
        fallbacks++;
        relaxedTimeCount++;
      }

      for (const t of fb.noMatchWarnings) {
        batch.update(adminDb.collection('tripRequests').doc(t.id), {
          noMatchWarningSent: true,
          fallbackTier: 'no-match',
        });
        fallbacks++;
        noMatchCount++;
      }
    }

    await batch.commit();

    return NextResponse.json({
      ok: true,
      window: { hoursFrom, hoursTo, minISO, maxISO },
      pendingCount: pending.length,
      created,
      groups: groupCount,
      fallbacks,
      breakdown: {
        standardPairs: pairs.length,
        lightBagGroups: groupCount,
        xlSuggested: xlCount,
        relaxedCampusPairs: relaxedCampusCount,
        relaxedTimePairs: relaxedTimeCount,
        noMatchWarnings: noMatchCount,
      },
      matchIds: createdMatchIds,
    });
  } catch (err) {
    console.error('POST /api/dev/matching/run error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Run failed' },
      { status: 500 },
    );
  }
}
