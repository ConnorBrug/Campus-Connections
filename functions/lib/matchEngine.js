import { differenceInHours, differenceInMinutes, parseISO, addHours, isPast } from "date-fns";
// Bag constraints (v1 simple pair-matching)
const MAX_CHECKED = 3;
const MAX_CARRY = 2;
export function isEligiblePair(a, b) {
    if (a.university !== b.university)
        return false;
    // BC campus alignment
    if (a.university === "Boston College") {
        if ((a.campusArea || "") !== (b.campusArea || ""))
            return false;
    }
    // same airport
    if (a.departingAirport !== b.departingAirport)
        return false;
    // time window within 60 minutes
    const h = Math.abs(differenceInHours(parseISO(a.flightDateTime), parseISO(b.flightDateTime)));
    if (h > 1)
        return false;
    // bag totals
    const combinedChecked = a.numberOfCheckedBags + b.numberOfCheckedBags;
    const combinedCarry = a.numberOfCarryons + b.numberOfCarryons;
    if (combinedChecked > MAX_CHECKED)
        return false;
    if (combinedCarry > MAX_CARRY)
        return false;
    return true;
}
export function prefersEachOther(a, b) {
    const aOk = a.userPreferences === "No preference" || a.userPreferences === b.userGender;
    const bOk = b.userPreferences === "No preference" || b.userPreferences === a.userGender;
    return aOk && bOk;
}
// Prioritize riders with fewest candidate options, to avoid stranding edge cases
export function sortByRarity(pending) {
    const optionCounts = new Map();
    for (const t of pending) {
        let count = 0;
        for (const other of pending) {
            if (t.id === other.id)
                continue;
            if (isEligiblePair(t, other))
                count++;
        }
        optionCounts.set(t.id, count);
    }
    return [...pending].sort((a, b) => (optionCounts.get(a.id) - optionCounts.get(b.id)));
}
export function bestPartnerFor(target, pool) {
    const eligible = pool.filter((m) => isEligiblePair(target, m));
    if (!eligible.length)
        return null;
    const preferred = eligible.filter((m) => prefersEachOther(target, m));
    const ranked = (preferred.length ? preferred : eligible).sort((a, b) => Math.abs(differenceInMinutes(parseISO(target.flightDateTime), parseISO(a.flightDateTime))) -
        Math.abs(differenceInMinutes(parseISO(target.flightDateTime), parseISO(b.flightDateTime))));
    return ranked[0] ?? null;
}
// Decide if a trip is old enough to delete (48h after flight)
export function shouldCleanup(trip) {
    const cutoff = addHours(parseISO(trip.flightDateTime), 48);
    return isPast(cutoff);
}
//# sourceMappingURL=matchEngine.js.map