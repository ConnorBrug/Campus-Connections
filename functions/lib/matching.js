"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePairs = computePairs;
exports.computeFallbacks = computeFallbacks;
exports.findBestMatchForTrip = findBestMatchForTrip;
exports.runPairingForWindow = runPairingForWindow;
// functions/src/matching.ts
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("./utils");
const email_1 = require("./email");
const sms_1 = require("./sms");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
const toMs = (iso) => new Date(iso).getTime();
const isoNow = () => new Date().toISOString();
const chatExpiryFromRiders = (riders) => {
    const latest = riders.reduce((mx, r) => Math.max(mx, toMs(r.flightDateTime)), 0);
    return admin.firestore.Timestamp.fromDate(new Date(latest + 4 * 3600_000));
};
function pickBestCandidate(a, candidates) {
    let bestPreferred = null;
    let scorePreferred = -Infinity;
    let bestFallback = null;
    let scoreFallback = -Infinity;
    for (const b of candidates) {
        const s = candidateScore(a, b);
        if ((0, utils_1.genderCompatible)(a, b)) {
            if (s > scorePreferred) {
                scorePreferred = s;
                bestPreferred = b;
            }
        }
        else if (s > scoreFallback) {
            scoreFallback = s;
            bestFallback = b;
        }
    }
    if (bestPreferred)
        return { best: bestPreferred, genderRelaxed: false };
    if (bestFallback)
        return { best: bestFallback, genderRelaxed: true };
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
function candidateScore(a, b) {
    const sameFlight = a.flightCode && b.flightCode && a.flightCode === b.flightCode ? 1 : 0;
    const aBags = (a.numberOfCheckedBags || 0) + (a.numberOfCarryons || 0);
    const bBags = (b.numberOfCheckedBags || 0) + (b.numberOfCarryons || 0);
    const spread = Math.abs(aBags - bBags);
    const timeGapMin = Math.abs(toMs(a.flightDateTime) - toMs(b.flightDateTime)) / 60000;
    return sameFlight * 10000 + spread * 100 - Math.floor(timeGapMin);
}
const groupKey = (t) => `${t.university}::${t.campusArea ?? ''}::${t.departingAirport}`;
function computePairs(all) {
    const buckets = new Map();
    for (const t of all)
        (buckets.get(groupKey(t)) ?? buckets.set(groupKey(t), []).get(groupKey(t))).push(t);
    const pairs = [];
    const unmatched = [];
    for (const group of buckets.values()) {
        const pool = group.slice().sort((a, b) => {
            const cand = (u) => group.filter(x => x.id !== u.id && (0, utils_1.sameCampusAirport)(u, x) && (0, utils_1.withinOneHour)(u, x) && (0, utils_1.genderCompatible)(u, x)).length;
            const aCand = cand(a);
            const bCand = cand(b);
            if (aCand !== bCand)
                return aCand - bCand;
            const aBags = (a.numberOfCheckedBags || 0) + (a.numberOfCarryons || 0);
            const bBags = (b.numberOfCheckedBags || 0) + (b.numberOfCarryons || 0);
            return bBags - aBags; // heavier first
        });
        while (pool.length) {
            const a = pool.shift();
            const candidates = pool.filter((b) => (0, utils_1.sameCampusAirport)(a, b) && (0, utils_1.withinOneHour)(a, b) && (0, utils_1.fitsCapacity)([a, b]));
            const { best } = pickBestCandidate(a, candidates);
            if (best) {
                const idx = pool.findIndex(x => x.id === best.id);
                if (idx >= 0)
                    pool.splice(idx, 1);
                pairs.push([a, best]);
            }
            else {
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
function writeMatchToBatch(batch, riders, tier, reason) {
    const matchRef = db.collection('matches').doc();
    const participants = {};
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
    const match = {
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
function computeFallbacks(unmatched, _allPending) {
    const remaining = new Set(unmatched.map(t => t.id));
    const byId = new Map(unmatched.map(t => [t.id, t]));
    const getRemaining = () => [...remaining].map(id => byId.get(id));
    // ---- Tier 1: Light bags, groups of 3-4 ----
    const groups = [];
    const lightBag = getRemaining().filter(t => (0, utils_1.isLightBags)(t));
    const lightBagBuckets = new Map();
    for (const t of lightBag) {
        const key = `${t.university}::${t.campusArea ?? ''}::${t.departingAirport}`;
        (lightBagBuckets.get(key) ?? lightBagBuckets.set(key, []).get(key)).push(t);
    }
    for (const bucket of lightBagBuckets.values()) {
        bucket.sort((a, b) => new Date(a.flightDateTime).getTime() - new Date(b.flightDateTime).getTime());
        let i = 0;
        while (i < bucket.length) {
            if (!remaining.has(bucket[i].id)) {
                i++;
                continue;
            }
            const candidates = [bucket[i]];
            for (let j = i + 1; j < bucket.length && candidates.length < 4; j++) {
                if (!remaining.has(bucket[j].id))
                    continue;
                const prospect = [...candidates, bucket[j]];
                if ((0, utils_1.withinOneHour)(candidates[0], bucket[j]) &&
                    (0, utils_1.groupGenderCompatible)(prospect) &&
                    (0, utils_1.fitsGroupCapacity)(prospect)) {
                    candidates.push(bucket[j]);
                }
            }
            if (candidates.length >= 3) {
                groups.push(candidates);
                for (const c of candidates)
                    remaining.delete(c.id);
            }
            i++;
        }
    }
    // ---- Tier 2: Heavy bags, XL suggestion ----
    const xlSuggested = [];
    for (const t of getRemaining()) {
        if (!(0, utils_1.isLightBags)(t)) {
            xlSuggested.push(t);
            remaining.delete(t.id);
        }
    }
    // ---- Tier 3: Expand campus area ----
    const relaxedCampusPairs = [];
    const campusPool = getRemaining().filter(t => !!t.campusArea);
    const usedInCampus = new Set();
    for (let i = 0; i < campusPool.length; i++) {
        if (usedInCampus.has(campusPool[i].id))
            continue;
        const a = campusPool[i];
        const candidates = campusPool
            .slice(i + 1)
            .filter((b) => !usedInCampus.has(b.id))
            .filter((b) => (0, utils_1.sameUniversityAirport)(a, b))
            .filter((b) => (0, utils_1.withinOneHour)(a, b))
            .filter((b) => (0, utils_1.fitsCapacity)([a, b]));
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
    const relaxedTimePairs = [];
    const timePool = getRemaining();
    const usedInTime = new Set();
    for (let i = 0; i < timePool.length; i++) {
        if (usedInTime.has(timePool[i].id))
            continue;
        const a = timePool[i];
        const candidates = timePool
            .slice(i + 1)
            .filter((b) => !usedInTime.has(b.id))
            .filter((b) => (0, utils_1.sameCampusAirport)(a, b))
            .filter((b) => (0, utils_1.withinTwoHours)(a, b))
            .filter((b) => (0, utils_1.fitsCapacity)([a, b]));
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
    const noMatchWarnings = [];
    const stillUnmatched = [];
    for (const t of getRemaining()) {
        const hoursUntilFlight = (new Date(t.flightDateTime).getTime() - now) / 3600_000;
        if (hoursUntilFlight < 3) {
            noMatchWarnings.push(t);
        }
        else {
            stillUnmatched.push(t);
        }
    }
    return { groups, xlSuggested, relaxedCampusPairs, relaxedTimePairs, noMatchWarnings, stillUnmatched };
}
/**
 * Finds the single best match for a given trip from a pool of pending trips.
 * Used for late-submission instant matching.
 */
function findBestMatchForTrip(trip, pool) {
    const candidates = pool.filter((b) => b.id !== trip.id &&
        b.userId !== trip.userId &&
        (0, utils_1.sameCampusAirport)(trip, b) &&
        (0, utils_1.withinOneHour)(trip, b) &&
        (0, utils_1.fitsCapacity)([trip, b]));
    return pickBestCandidate(trip, candidates).best;
}
async function loadPending(minISO, maxISO) {
    const snap = await db.collection('tripRequests')
        .where('status', '==', 'pending')
        .where('flightDateTime', '>=', minISO)
        .where('flightDateTime', '<', maxISO)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function runPairingForWindow(hoursFrom, hoursTo) {
    const now = Date.now();
    const minISO = new Date(now + hoursFrom * 3600_000).toISOString();
    const maxISO = new Date(now + hoursTo * 3600_000).toISOString();
    const pending = await loadPending(minISO, maxISO);
    if (!pending.length)
        return { created: 0, groups: 0, fallbacks: 0 };
    const { pairs, unmatched } = computePairs(pending);
    const batch = db.batch();
    let created = 0;
    const matchedTrips = [];
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
            (0, email_1.sendXlRideSuggestion)(t).catch(() => { });
            (0, sms_1.sendXlRideSuggestionSms)(t).catch(() => { });
        }
        for (const t of fb.noMatchWarnings) {
            (0, email_1.sendNoMatchNotification)(t).catch(() => { });
            (0, sms_1.sendNoMatchSms)(t).catch(() => { });
        }
    }
    if (created > 0 || unmatched.length > 0) {
        await batch.commit();
        for (const group of matchedTrips) {
            for (const rider of group) {
                const partners = group.filter(x => x.userId !== rider.userId);
                if (partners.length > 0) {
                    (0, email_1.sendMatchNotification)(rider, partners[0]).catch(() => { });
                    (0, sms_1.sendMatchSms)(rider, partners[0]).catch(() => { });
                }
            }
        }
    }
    return { created, groups: pairs.length, fallbacks };
}
//# sourceMappingURL=matching.js.map