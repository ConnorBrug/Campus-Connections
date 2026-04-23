"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fitsGroupCapacity = exports.isLightBags = exports.fitsCapacity = exports.sameUniversityAirport = exports.sameCampusAirport = exports.withinTwoHours = exports.withinOneHour = void 0;
exports.genderCompatible = genderCompatible;
exports.groupGenderCompatible = groupGenderCompatible;
// functions/src/utils.ts
const types_1 = require("./types");
/**
 * Parse a trip's flightDateTime string to epoch ms. The app always writes
 * ISO-8601 (see submitTripDetailsAction). If a non-ISO string ever reaches the
 * matcher, `new Date()` returns NaN, which Math.abs/compare silently treat as
 * "never within window" - so such trips simply won't match rather than
 * producing bogus matches. We surface the malformed value in logs.
 */
const toMs = (iso) => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) {
        console.warn('[matching] flightDateTime failed to parse:', iso);
    }
    return t;
};
const withinOneHour = (a, b) => Math.abs(toMs(a.flightDateTime) - toMs(b.flightDateTime)) <= 60 * 60 * 1000;
exports.withinOneHour = withinOneHour;
const withinTwoHours = (a, b) => Math.abs(toMs(a.flightDateTime) - toMs(b.flightDateTime)) <= 2 * 60 * 60 * 1000;
exports.withinTwoHours = withinTwoHours;
/**
 * Two riders can share a standard pair if they go to the same university,
 * same airport, and either (a) both have a campusArea that's identical, or
 * (b) at least one has no campusArea set.
 *
 * CAVEAT: for a school with multiple campus areas (e.g. BC's 2k/Newton/
 * CoRo/Upper/Lower), a rider who somehow has a null campusArea will be
 * treated as compatible with every campus. Today the onboarding flow
 * enforces campusArea for BC, so this can only happen from manually-edited
 * docs. Revisit when a second multi-campus school is added.
 */
const sameCampusAirport = (a, b) => {
    if (a.university !== b.university)
        return false;
    if (a.campusArea && b.campusArea && a.campusArea !== b.campusArea)
        return false;
    return a.departingAirport === b.departingAirport;
};
exports.sameCampusAirport = sameCampusAirport;
/** Like sameCampusAirport but ignores campus area - only checks university + airport. */
const sameUniversityAirport = (a, b) => {
    if (a.university !== b.university)
        return false;
    return a.departingAirport === b.departingAirport;
};
exports.sameUniversityAirport = sameUniversityAirport;
function genderCompatible(a, b) {
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
/** Checks if all members of a group are gender-compatible with each other. */
function groupGenderCompatible(group) {
    for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
            if (!genderCompatible(group[i], group[j]))
                return false;
        }
    }
    return true;
}
const fitsCapacity = (pair) => {
    const checked = pair.reduce((s, t) => s + (t.numberOfCheckedBags || 0), 0);
    const carry = pair.reduce((s, t) => s + (t.numberOfCarryons || 0), 0);
    return types_1.BAG_CAPACITY.some((rule) => checked <= rule.checked && carry <= rule.carry);
};
exports.fitsCapacity = fitsCapacity;
/** Rider has <= 1 checked and <= 1 carry-on. */
const isLightBags = (t) => (t.numberOfCheckedBags || 0) <= 1 && (t.numberOfCarryons || 0) <= 1;
exports.isLightBags = isLightBags;
/** Bag capacity check for groups of 3-4 riders. */
const fitsGroupCapacity = (group) => {
    const checked = group.reduce((s, t) => s + (t.numberOfCheckedBags || 0), 0);
    const carry = group.reduce((s, t) => s + (t.numberOfCarryons || 0), 0);
    return types_1.GROUP_BAG_CAPACITY.some((rule) => checked <= rule.checked && carry <= rule.carry);
};
exports.fitsGroupCapacity = fitsGroupCapacity;
//# sourceMappingURL=utils.js.map