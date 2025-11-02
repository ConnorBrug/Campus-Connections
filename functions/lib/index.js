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
exports.onTripRequestUpdated = exports.onTripRequestCreated = exports.retryHourlyAfterNoon = exports.matchTomorrowAtNoon = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const config_1 = require("./config");
const matching_1 = require("./matching");
admin.initializeApp();
function tomorrowRange(now = new Date()) {
    const tzNow = new Date(now.toLocaleString("en-US", { timeZone: config_1.TIMEZONE }));
    const start = new Date(tzNow);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tzNow);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
// 1) Daily noon run — match everyone for tomorrow
exports.matchTomorrowAtNoon = (0, scheduler_1.onSchedule)({ schedule: config_1.DAILY_NOON_CRON, timeZone: config_1.TIMEZONE }, async () => {
    const { start, end } = tomorrowRange();
    const { matchedGroups, matchedPeople } = await (0, matching_1.runMatchingForDay)(start, end, false);
    logger.info("Noon matcher done", { matchedGroups, matchedPeople, tz: config_1.TIMEZONE });
});
// 2) Hourly after noon — retry unmatched for next-day flights
exports.retryHourlyAfterNoon = (0, scheduler_1.onSchedule)({ schedule: config_1.HOURLY_AFTER_NOON_CRON, timeZone: config_1.TIMEZONE }, async () => {
    const { start, end } = tomorrowRange();
    const { matchedGroups, matchedPeople } = await (0, matching_1.runMatchingForDay)(start, end, true);
    logger.info("Hourly retry done", { matchedGroups, matchedPeople, tz: config_1.TIMEZONE });
});
// 3) Late submissions — try to match immediately
exports.onTripRequestCreated = (0, firestore_1.onDocumentCreated)("tripRequests/{id}", async (event) => {
    const id = event.params.id;
    await (0, matching_1.tryImmediateMatchForRequest)(id);
});
// 4) Flight updates — delayed/canceled flows
exports.onTripRequestUpdated = (0, firestore_1.onDocumentUpdated)("tripRequests/{id}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const id = event.params.id;
    // If canceled: remove from pool (set status) and ungroup if needed
    if (after.status === "canceled" && before.status !== "canceled") {
        await event.data?.after.ref.update({ groupId: null, status: "canceled" });
        return;
    }
    // If delayed: offer choice via UI; when they set status back to queued, we attempt rematch
    if (after.status === "delayed" && before.status !== "delayed") {
        // No automatic action — UI should set status to "queued" if they opt back in
        return;
    }
    // If they opted back into pool (status changed to queued), attempt immediate match
    if (after.status === "queued" && before.status !== "queued") {
        await (0, matching_1.tryImmediateMatchForRequest)(id);
    }
});
