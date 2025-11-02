"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bagUnits = bagUnits;
exports.isGenderCompatible = isGenderCompatible;
exports.withinMinutes = withinMinutes;
exports.tsToISO = tsToISO;
exports.groupKey = groupKey;
exports.normalizeFlightCode = normalizeFlightCode;
const config_1 = require("./config");
function bagUnits(bags) {
    return (bags.checked * config_1.BAG_UNIT_WEIGHTS.checked) + (bags.carryOn * config_1.BAG_UNIT_WEIGHTS.carryOn);
}
function isGenderCompatible(a, b) {
    const prefA = a.genderPreference;
    const prefB = b.genderPreference;
    const gA = a.gender;
    const gB = b.gender;
    const okFor = (pref, self, other) => {
        if (pref === "any")
            return true;
        if (pref === "same")
            return self === other && self !== "unspecified" && other !== "unspecified";
        if (pref === "female_only")
            return other === "female";
        if (pref === "male_only")
            return other === "male";
        return true;
    };
    return okFor(prefA, gA, gB) && okFor(prefB, gB, gA);
}
function withinMinutes(a, b, mins) {
    const diff = Math.abs(a.toMillis() - b.toMillis());
    return diff <= mins * 60000;
}
function tsToISO(ts) {
    return new Date(ts.toMillis()).toISOString();
}
function groupKey(req) {
    return `${req.universityId}__${req.campusArea}`;
}
function normalizeFlightCode(code) {
    return code.trim().toUpperCase();
}
