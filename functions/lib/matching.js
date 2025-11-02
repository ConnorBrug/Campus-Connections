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
exports.fetchCandidatesForDay = fetchCandidatesForDay;
exports.runMatchingForDay = runMatchingForDay;
exports.tryImmediateMatchForRequest = tryImmediateMatchForRequest;
const admin = __importStar(require("firebase-admin"));
const config_1 = require("./config");
const utils_1 = require("./utils");
const db = admin.firestore();
// Fetch all candidate requests for a date range (inclusive day)
async function fetchCandidatesForDay(dayStart, dayEnd) {
    const startTs = admin.firestore.Timestamp.fromDate(dayStart);
    const endTs = admin.firestore.Timestamp.fromDate(dayEnd);
    const snap = await db.collection("tripRequests")
        .where("status", "in", ["pending", "queued"]) // unmatched pool
        .where("flight.boardingTime", ">=", startTs)
        .where("flight.boardingTime", "<=", endTs)
        .get();
    const list = [];
    snap.forEach(doc => {
        const d = doc.data();
        const req = {
            id: doc.id,
            ...d,
            bagUnits: d.bagUnits ?? (0, utils_1.bagUnits)(d.bags)
        };
        list.push(req);
    });
    return list;
}
// Compute compatibility map (who can pair with whom) under core constraints
function computeCompatibility(cands, timeWindowMins) {
    const n = cands.length;
    const compat = new Map();
    for (let i = 0; i < n; i++) {
        const a = cands[i];
        const set = new Set();
        for (let j = 0; j < n; j++)
            if (i !== j) {
                const b = cands[j];
                const sameCampus = a.universityId === b.universityId && a.campusArea === b.campusArea;
                if (!sameCampus)
                    continue;
                if (!(0, utils_1.withinMinutes)(a.flight.boardingTime, b.flight.boardingTime, timeWindowMins))
                    continue;
                if (!(0, utils_1.isGenderCompatible)(a, b))
                    continue;
                const totalUnits = (a.bagUnits ?? (0, utils_1.bagUnits)(a.bags)) + (b.bagUnits ?? (0, utils_1.bagUnits)(b.bags));
                if (totalUnits <= config_1.CAR_MAX_BAG_UNITS)
                    set.add(b.id);
            }
        compat.set(a.id, set);
    }
    return compat;
}
function sortByFewestOptions(cands, compat) {
    return [...cands].sort((a, b) => (compat.get(a.id)?.size ?? 0) - (compat.get(b.id)?.size ?? 0));
}
// Try to form triples within same flight code first
function attemptTriplesSameFlight(cands, timeWindowMins) {
    const used = new Set();
    const triples = [];
    // group by flight code (normalized)
    const byCode = {};
    cands.forEach(r => {
        const k = (0, utils_1.normalizeFlightCode)(r.flight.flightCode || "");
        byCode[k] = byCode[k] || [];
        byCode[k].push(r);
    });
    for (const code of Object.keys(byCode)) {
        const group = byCode[code].filter(r => !used.has(r.id));
        // sort by bag units ascending to favor light-bag triples
        group.sort((a, b) => (a.bagUnits - b.bagUnits));
        for (let i = 0; i < group.length; i++) {
            const a = group[i];
            if (used.has(a.id))
                continue;
            for (let j = i + 1; j < group.length; j++) {
                const b = group[j];
                if (used.has(b.id))
                    continue;
                for (let k = j + 1; k < group.length; k++) {
                    const c = group[k];
                    if (used.has(c.id))
                        continue;
                    const timesOk = (0, utils_1.withinMinutes)(a.flight.boardingTime, b.flight.boardingTime, timeWindowMins)
                        && (0, utils_1.withinMinutes)(a.flight.boardingTime, c.flight.boardingTime, timeWindowMins);
                    if (!timesOk)
                        continue;
                    if (!(0, utils_1.isGenderCompatible)(a, b) || !(0, utils_1.isGenderCompatible)(a, c) || !(0, utils_1.isGenderCompatible)(b, c))
                        continue;
                    const total = a.bagUnits + b.bagUnits + c.bagUnits;
                    if (total <= config_1.CAR_MAX_BAG_UNITS) {
                        triples.push([a, b, c]);
                        used.add(a.id);
                        used.add(b.id);
                        used.add(c.id);
                        break; // move to next i
                    }
                }
            }
        }
    }
    return { triples, used };
}
// Pairing strategy within a bucket: pair heavy with light to fit under max
function pairGreedy(cands) {
    const arr = [...cands].sort((a, b) => (a.bagUnits - b.bagUnits));
    const pairs = [];
    let l = 0, r = arr.length - 1;
    while (l < r) {
        const left = arr[l];
        const right = arr[r];
        if ((left.bagUnits + right.bagUnits) <= config_1.CAR_MAX_BAG_UNITS) {
            pairs.push([left, right]);
            l++;
            r--;
        }
        else {
            // right too heavy to pair with any (since left is lightest), drop right
            r--;
        }
    }
    const unused = new Set(arr.slice(l, r + 1).map(x => x.id));
    return { pairs, unused };
}
// Build a group in Firestore and mark members as matched
async function persistGroup(requests) {
    const batch = db.batch();
    const totalUnits = requests.reduce((s, r) => s + (r.bagUnits ?? 0), 0);
    const groupRef = db.collection("rideGroups").doc();
    const group = {
        universityId: requests[0].universityId,
        campusArea: requests[0].campusArea,
        memberIds: requests.map(r => r.id),
        members: requests.map(r => ({
            requestId: r.id,
            userId: r.userId,
            gender: r.gender,
            bags: r.bags,
            bagUnits: r.bagUnits,
            flight: { flightCode: r.flight.flightCode, boardingTime: (0, utils_1.tsToISO)(r.flight.boardingTime) }
        })),
        bagUnitsTotal: totalUnits,
        capacityUnits: config_1.CAR_MAX_BAG_UNITS,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    batch.set(groupRef, group);
    for (const r of requests) {
        const ref = db.collection("tripRequests").doc(r.id);
        batch.update(ref, { status: "matched", groupId: groupRef.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    await batch.commit();
}
async function runMatchingForDay(dayStart, dayEnd, isHourlyRetry = false) {
    const timeWindow = config_1.DEFAULT_TIME_WINDOW_MINS;
    const candidates = await fetchCandidatesForDay(dayStart, dayEnd);
    if (candidates.length === 0)
        return { matchedGroups: 0, matchedPeople: 0 };
    // Ensure derived bagUnits present (persist quietly if missing)
    await Promise.all(candidates.filter(c => c.bagUnits == null).map(c => db.collection("tripRequests").doc(c.id).update({ bagUnits: (0, utils_1.bagUnits)(c.bags) }).catch(() => { })));
    // First pass: within each (university,campus), prioritize same flight code triples, then pairs
    const byCampus = {};
    for (const r of candidates) {
        const k = (0, utils_1.groupKey)(r);
        (byCampus[k] = byCampus[k] || []).push(r);
    }
    let matchedGroups = 0;
    let matchedPeople = 0;
    const used = new Set();
    for (const key of Object.keys(byCampus)) {
        const pool = byCampus[key].filter(r => !used.has(r.id));
        // Triples (same flight) if riders allow expansion or default policy prefers 3
        const { triples, used: usedTriples } = attemptTriplesSameFlight(pool, timeWindow);
        for (const tri of triples) {
            await persistGroup(tri);
            tri.forEach(r => used.add(r.id));
            matchedGroups++;
            matchedPeople += 3;
        }
        // Now try pairs within same flight code first, then general within time window
        // a) same flight code pairing
        const byCode = {};
        for (const r of pool) {
            if (used.has(r.id))
                continue;
            const fc = (0, utils_1.normalizeFlightCode)(r.flight.flightCode || "");
            (byCode[fc] = byCode[fc] || []).push(r);
        }
        for (const code of Object.keys(byCode)) {
            const group = byCode[code].filter(r => !used.has(r.id));
            const { pairs } = pairGreedy(group);
            for (const p of pairs) {
                if (p.some(r => used.has(r.id)))
                    continue;
                await persistGroup(p);
                p.forEach(r => used.add(r.id));
                matchedGroups++;
                matchedPeople += p.length;
            }
        }
        // b) leftover: general pairing within time window, fairness to edge cases
        const leftovers = pool.filter(r => !used.has(r.id));
        const compat = computeCompatibility(leftovers, timeWindow);
        const sorted = sortByFewestOptions(leftovers, compat);
        const seen = new Set();
        for (const a of sorted) {
            if (used.has(a.id) || seen.has(a.id))
                continue;
            const opts = [...(compat.get(a.id) || [])].filter(id => !used.has(id) && !seen.has(id));
            // pick partner that best balances bag units (heaviest that still fits)
            const partner = opts.map(id => leftovers.find(x => x.id === id))
                .sort((x, y) => (y.bagUnits - x.bagUnits))
                .find(b => (a.bagUnits + b.bagUnits) <= config_1.CAR_MAX_BAG_UNITS);
            if (partner) {
                await persistGroup([a, partner]);
                used.add(a.id);
                used.add(partner.id);
                seen.add(a.id);
                seen.add(partner.id);
                matchedGroups++;
                matchedPeople += 2;
            }
        }
        // c) special pass: heaviest riders try to pair with zero-bag riders
        const left2 = pool.filter(r => !used.has(r.id));
        if (left2.length >= 2) {
            const zeros = left2.filter(r => (r.bagUnits ?? 0) === 0);
            if (zeros.length) {
                const heavy = left2.filter(r => (r.bagUnits ?? 0) > 0).sort((a, b) => (b.bagUnits - a.bagUnits));
                for (const h of heavy) {
                    const z = zeros.find(zr => zr.id !== h.id && (0, utils_1.isGenderCompatible)(h, zr) && (0, utils_1.withinMinutes)(h.flight.boardingTime, zr.flight.boardingTime, timeWindow) && (h.bagUnits + zr.bagUnits) <= config_1.CAR_MAX_BAG_UNITS);
                    if (z) {
                        await persistGroup([h, z]);
                        used.add(h.id);
                        used.add(z.id);
                        matchedGroups++;
                        matchedPeople += 2;
                    }
                }
            }
        }
    }
    // Mark the rest as queued or unmatched with expansion suggestions
    const remaining = candidates.filter(r => !used.has(r.id));
    if (remaining.length) {
        const batch = db.batch();
        for (const r of remaining) {
            const suggestions = buildExpansionAdvice(r);
            batch.update(db.collection("tripRequests").doc(r.id), {
                status: isHourlyRetry ? "queued" : "queued",
                expansionAdvice: suggestions,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();
    }
    return { matchedGroups, matchedPeople };
}
function buildExpansionAdvice(r) {
    const adv = [];
    if ((r.bagUnits ?? 0) <= 2)
        adv.push("You can allow groups of 3–4; your bags are light enough.");
    if ((r.bagUnits ?? 0) >= config_1.CAR_MAX_BAG_UNITS)
        adv.push("You are at the bag limit; consider XL or pairing with someone who has 0 bags.");
    adv.push("You can extend your time window to 120 minutes.");
    adv.push("You can allow cross‑campus matches.");
    return adv;
}
async function tryImmediateMatchForRequest(reqId) {
    const doc = await db.collection("tripRequests").doc(reqId).get();
    if (!doc.exists)
        return;
    const r = { id: doc.id, ...doc.data() };
    const dayStart = new Date(r.flight.boardingTime.toDate());
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(r.flight.boardingTime.toDate());
    dayEnd.setHours(23, 59, 59, 999);
    // Reuse daily matcher on a narrow pool by filtering day
    await runMatchingForDay(dayStart, dayEnd, true);
}
