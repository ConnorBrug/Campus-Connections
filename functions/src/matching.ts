// functions/src/matching.ts
import * as admin from 'firebase-admin';
import { TripRequest, Match, BAG_CAPACITY } from './types';
import { withinOneHour, sameCampusAirport, genderCompatible, fitsCapacity } from './utils';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const toMs = (iso: string) => new Date(iso).getTime();
const isoNow = () => new Date().toISOString();

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
      let best: TripRequest | null = null;
      let scoreBest = -Infinity;

      for (const b of pool) {
        if (!sameCampusAirport(a, b)) continue;
        if (!withinOneHour(a, b)) continue;
        if (!genderCompatible(a, b)) continue;
        if (!fitsCapacity([a, b])) continue;

        const s = candidateScore(a, b);
        if (s > scoreBest) {
          scoreBest = s;
          best = b;
        }
      }

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

async function loadPending(minISO: string, maxISO: string): Promise<TripRequest[]> {
  const snap = await db.collection('tripRequests')
    .where('status', '==', 'pending')
    .where('flightDateTime', '>=', minISO)
    .where('flightDateTime', '<',  maxISO)
    .get();

  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TripRequest[];
}

export async function runPairingForWindow(hoursFrom: number, hoursTo: number) {
  const now = Date.now();
  const minISO = new Date(now + hoursFrom * 3600_000).toISOString();
  const maxISO = new Date(now + hoursTo * 3600_000).toISOString();

  const pending = await loadPending(minISO, maxISO);
  if (!pending.length) return { created: 0, groups: 0 };

  const { pairs } = computePairs(pending);

  const batch = db.batch();
  let created = 0;

  for (const [a, b] of pairs) {
    const matchRef = db.collection('matches').doc();

    const match: Match = {
      id: matchRef.id,
      participantIds: [a.userId, b.userId],
      participants: {
        [a.userId]: {
          userId: a.userId,
          userName: a.userName ?? 'User',
          userPhotoUrl: a.userPhotoUrl ?? null,
          university: a.university,
          flightCode: a.flightCode,
          flightDateTime: a.flightDateTime,
        },
        [b.userId]: {
          userId: b.userId,
          userName: b.userName ?? 'User',
          userPhotoUrl: b.userPhotoUrl ?? null,
          university: b.university,
          flightCode: b.flightCode,
          flightDateTime: b.flightDateTime,
        },
      },
      requestIds: [a.id, b.id],
      university: a.university,
      campusArea: a.campusArea ?? null,
      departingAirport: a.departingAirport,
      flightCode: a.flightCode === b.flightCode ? a.flightCode : undefined,
      assignedAtISO: isoNow(),
      status: 'matched',
      reason: 'Best available pair',
    };

    batch.set(matchRef, match);

    batch.update(db.collection('tripRequests').doc(a.id), {
      status: 'matched',
      matchId: matchRef.id,
      matchedUserId: b.id,
      cancellationAlert: false,
    });
    batch.update(db.collection('tripRequests').doc(b.id), {
      status: 'matched',
      matchId: matchRef.id,
      matchedUserId: a.id,
      cancellationAlert: false,
    });

    created++;
  }

  if (created > 0) await batch.commit();
  return { created, groups: pairs.length };
}
