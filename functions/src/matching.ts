// functions/src/matching.ts
import * as admin from 'firebase-admin';
import { TripRequest, Match, MatchTier } from './types';
import {
  withinOneHour, withinTwoHours,
  sameCampusAirport, sameUniversityAirport,
  genderCompatible, groupGenderCompatible,
  fitsCapacity, fitsGroupCapacity, isLightBags,
} from './utils';
import { sendMatchNotification, sendNoMatchNotification, sendXlRideSuggestion } from './email';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const toMs = (iso: string) => new Date(iso).getTime();
const isoNow = () => new Date().toISOString();
const chatExpiryFromRiders = (riders: TripRequest[]) => {
  const latest = riders.reduce((mx, r) => Math.max(mx, toMs(r.flightDateTime)), 0);
  return admin.firestore.Timestamp.fromDate(new Date(latest + 4 * 3600_000));
};

function pickBestCandidate(a: TripRequest, candidates: TripRequest[]): { best: TripRequest | null; genderRelaxed: boolean } {
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

/**
 * Score how well `b` pairs with `a`. Higher is better.
 *
 * Weights are intentionally lopsided:
 *   - sameFlight:  +10000   (same flight = same terminal + same ride timing;
 *                            dominates everything short of capacity failure)
 *   - bagSpread:   +100 * |aBags - bBags|  (encourages mixing a heavy rider
 *                            with a light rider so both fit in capacity)
 *   - timeGap:     - minutes between flights (soft tiebreaker)
 *
 * Capacity / gender / campus / time-window filters happen BEFORE scoring;
 * candidateScore is called only on riders that are already viable.
 */
function candidateScore(a: TripRequest, b: TripRequest): number {
  const sameFlight = a.flightCode && b.flightCode && a.flightCode === b.flightCode ? 1 : 0;
  const aBags = (a.numberOfCheckedBags || 0) + (a.numberOfCarryons || 0);
  const bBags = (b.numberOfCheckedBags || 0) + (b.numberOfCarryons || 0);
  const spread = Math.abs(aBags - bBags);
  const timeGapMin = Math.abs(toMs(a.flightDateTime) - toMs(b.flightDateTime)) / 60000;
  return sameFlight * 10000 + spread * 100 - Math.floor(timeGapMin);
}

const groupKey = (t: TripRequest) =>
  `${t.university}::${t.campusArea ?? ''}::${t.departingAirport}`;

export function computePairs(all: TripRequest[]): { pairs: [TripRequest, TripRequest][], unmatched: TripRequest[] } {
  const buckets = new Map<string, TripRequest[]>();
  for (const t of all) (buckets.get(groupKey(t)) ?? buckets.set(groupKey(t), []).get(groupKey(t))!).push(t);

  const pairs: [TripRequest, TripRequest][] = [];
  const unmatched: TripRequest[] = [];

  for (const group of buckets.values()) {
    const pool = group.slice().sort((a, b) => {
      const cand = (u: TripRequest) => group.filter(x =>
        x.id !== u.id && sameCampusAirport(u, x) && withinOneHour(u, x) && genderCompatible(u, x)
      ).length;
      const aCand = cand(a);
      const bCand = cand(b);
      if (aCand !== bCand) return aCand - bCand;

      const aBags = (a.numberOfCheckedBags || 0) + (a.numberOfCarryons || 0);
      const bBags = (b.numberOfCheckedBags || 0) + (b.numberOfCarryons || 0);
      return bBags - aBags; // heavier first
    });

    while (pool.length) {
      const a = pool.shift()!;
      const candidates = pool.filter((b) =>
        sameCampusAirport(a, b) && withinOneHour(a, b) && fitsCapacity([a, b])
      );
      const { best } = pickBestCandidate(a, candidates);

      if (best) {
        const idx = pool.findIndex(x => x.id === best!.id);
        if (idx >= 0) pool.splice(idx, 1);
        pairs.push([a, best]);
      } else {
        unmatched.push(a);
      }
    }
  }
  return { pairs, unmatched };
}

/**
 * Writes a match document + updates all trip requests in a batch.
 * Works for 2, 3, or 4 riders.
 */
function writeMatchToBatch(
  batch: FirebaseFirestore.WriteBatch,
  riders: TripRequest[],
  tier: MatchTier,
  reason: string,
): { matchRef: FirebaseFirestore.DocumentReference; match: Match } {
  const matchRef = db.collection('matches').doc();

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

  const allSameFlight = riders.every(r => r.flightCode === riders[0].flightCode);

  const match: Match = {
    id: matchRef.id,
    participantIds: riders.map(r => r.userId),
    participants,
    requestIds: riders.map(r => r.id),
    university: riders[0].university,
    campusArea: riders[0].campusArea ?? null,
    departingAirport: riders[0].departingAirport,
    flightCode: allSameFlight ? riders[0].flightCode : undefined,
    assignedAtISO: isoNow(),
    status: 'matched',
    reason,
    matchTier: tier,
  };

  batch.set(matchRef, match);

  for (const r of riders) {
    batch.update(db.collection('tripRequests').doc(r.id), {
      status: 'matched',
      matchId: matchRef.id,
      matchedUserId: riders.find(x => x.userId !== r.userId)?.userId ?? null,
      cancellationAlert: false,
      fallbackTier: tier,
    });
  }

  const chatId = riders.map(r => r.userId).sort().join('_');
  const chatRef = db.collection('chats').doc(chatId);

  const lines = riders.map(r => {
    const dt = new Date(r.flightDateTime);
    const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `- ${r.userName ?? 'Rider'}: Flight ${r.flightCode} at ${timeStr}.`;
  });

  const systemMsg = [
    'This is an automated message to start your coordination.',
    '',
    ...lines,
    '',
    'Recommendation: Plan to arrive at the airport at least 1 hour before the earlier flight\'s boarding time.',
  ].join('\n');

  batch.set(chatRef, {
    userIds: riders.map(r => r.userId),
    lastMessage: 'Chat initiated.',
    expiresAt: chatExpiryFromRiders(riders),
    typing: null,
  }, { merge: true });

  const msgRef = chatRef.collection('messages').doc();
  batch.set(msgRef, {
    text: systemMsg,
    senderId: 'system',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { matchRef, match };
}

/**
 * Fallback matching tiers for unmatched riders.
 * Returns arrays of groups matched and riders still unmatched.
 */
export function computeFallbacks(
  unmatched: TripRequest[],
  _allPending: TripRequest[],
): {
  groups: TripRequest[][];
  xlSuggested: TripRequest[];
  relaxedCampusPairs: [TripRequest, TripRequest][];
  relaxedTimePairs: [TripRequest, TripRequest][];
  noMatchWarnings: TripRequest[];
  stillUnmatched: TripRequest[];
} {
  const remaining = new Set(unmatched.map(t => t.id));
  const byId = new Map(unmatched.map(t => [t.id, t]));
  const getRemaining = () => [...remaining].map(id => byId.get(id)!);

  // ---- Tier 1: Light bags, groups of 3-4 ----
  const groups: TripRequest[][] = [];
  const lightBag = getRemaining().filter(t => isLightBags(t));
  const lightBagBuckets = new Map<string, TripRequest[]>();
  for (const t of lightBag) {
    const key = `${t.university}::${t.campusArea ?? ''}::${t.departingAirport}`;
    (lightBagBuckets.get(key) ?? lightBagBuckets.set(key, []).get(key)!).push(t);
  }

  for (const bucket of lightBagBuckets.values()) {
    bucket.sort((a, b) => new Date(a.flightDateTime).getTime() - new Date(b.flightDateTime).getTime());

    let i = 0;
    while (i < bucket.length) {
      if (!remaining.has(bucket[i].id)) { i++; continue; }
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

  // ---- Tier 2: Heavy bags, XL suggestion ----
  const xlSuggested: TripRequest[] = [];
  for (const t of getRemaining()) {
    if (!isLightBags(t)) {
      xlSuggested.push(t);
      remaining.delete(t.id);
    }
  }

  // ---- Tier 3: Expand campus area ----
  const relaxedCampusPairs: [TripRequest, TripRequest][] = [];
  const campusPool = getRemaining().filter(t => !!t.campusArea);
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

  // ---- Tier 4: Expand time to 2 hours ----
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

  // ---- Tier 5: No match warning ----
  const now = Date.now();
  const noMatchWarnings: TripRequest[] = [];
  const stillUnmatched: TripRequest[] = [];
  for (const t of getRemaining()) {
    const hoursUntilFlight = (new Date(t.flightDateTime).getTime() - now) / 3600_000;
    if (hoursUntilFlight < 3) {
      noMatchWarnings.push(t);
    } else {
      stillUnmatched.push(t);
    }
  }

  return { groups, xlSuggested, relaxedCampusPairs, relaxedTimePairs, noMatchWarnings, stillUnmatched };
}

/**
 * Finds the single best match for a given trip from a pool of pending trips.
 * Used for late-submission instant matching.
 */
export function findBestMatchForTrip(
  trip: TripRequest,
  pool: TripRequest[],
): TripRequest | null {
  const candidates = pool.filter((b) =>
    b.id !== trip.id &&
    b.userId !== trip.userId &&
    sameCampusAirport(trip, b) &&
    withinOneHour(trip, b) &&
    fitsCapacity([trip, b])
  );
  return pickBestCandidate(trip, candidates).best;
}

async function loadPending(minISO: string, maxISO: string): Promise<TripRequest[]> {
  const snap = await db.collection('tripRequests')
    .where('status', '==', 'pending')
    .where('flightDateTime', '>=', minISO)
    .where('flightDateTime', '<',  maxISO)
    .get();

  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as TripRequest);
}

export async function runPairingForWindow(hoursFrom: number, hoursTo: number) {
  const now = Date.now();
  const minISO = new Date(now + hoursFrom * 3600_000).toISOString();
  const maxISO = new Date(now + hoursTo * 3600_000).toISOString();

  const pending = await loadPending(minISO, maxISO);
  if (!pending.length) return { created: 0, groups: 0, fallbacks: 0 };

  const { pairs, unmatched } = computePairs(pending);

  const batch = db.batch();
  let created = 0;
  const matchedTrips: TripRequest[][] = [];

  for (const [a, b] of pairs) {
    writeMatchToBatch(batch, [a, b], 'standard', 'Best available pair');
    matchedTrips.push([a, b]);
    created++;
  }

  let fallbacks = 0;
  if (unmatched.length > 0) {
    const fb = computeFallbacks(unmatched, pending);

    for (const group of fb.groups) {
      writeMatchToBatch(batch, group, 'group', `Light-bag group of ${group.length}`);
      matchedTrips.push(group);
      created++;
      fallbacks++;
    }

    for (const t of fb.xlSuggested) {
      batch.update(db.collection('tripRequests').doc(t.id), {
        xlRideSuggested: true,
        fallbackTier: 'xl-suggested',
      });
      fallbacks++;
    }

    for (const [a, b] of fb.relaxedCampusPairs) {
      writeMatchToBatch(batch, [a, b], 'relaxed-campus', 'Cross-campus match');
      matchedTrips.push([a, b]);
      created++;
      fallbacks++;
    }

    for (const [a, b] of fb.relaxedTimePairs) {
      writeMatchToBatch(batch, [a, b], 'relaxed-time', '2-hour window match');
      matchedTrips.push([a, b]);
      created++;
      fallbacks++;
    }

    for (const t of fb.noMatchWarnings) {
      batch.update(db.collection('tripRequests').doc(t.id), {
        noMatchWarningSent: true,
        fallbackTier: 'no-match',
      });
      fallbacks++;
    }

    for (const t of fb.xlSuggested) {
      sendXlRideSuggestion(t).catch(() => {});
    }
    for (const t of fb.noMatchWarnings) {
      sendNoMatchNotification(t).catch(() => {});
    }
  }

  if (created > 0 || unmatched.length > 0) {
    await batch.commit();

    for (const group of matchedTrips) {
      for (const rider of group) {
        const partners = group.filter(x => x.userId !== rider.userId);
        if (partners.length > 0) {
          sendMatchNotification(rider, partners[0]).catch(() => {});
        }
      }
    }
  }

  return { created, groups: pairs.length, fallbacks };
}
