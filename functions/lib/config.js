"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_NOON_CRON = exports.HOURLY_AFTER_NOON_CRON = exports.DEFAULT_GROUP_SIZES = exports.DEFAULT_TIME_WINDOW_MINS = exports.CAR_MAX_BAG_UNITS = exports.BAG_UNIT_WEIGHTS = exports.TIMEZONE = void 0;
exports.TIMEZONE = process.env.TZ || (process.env.FUNCTIONS_EMULATOR ? "UTC" : (process.env.APP_TIMEZONE || "UTC"));
// Bag weighting model — tune as needed
exports.BAG_UNIT_WEIGHTS = { checked: 2, carryOn: 1 };
exports.CAR_MAX_BAG_UNITS = 7; // fits (3 checked + 1 carry-on) or (2 checked + 2 carry-on)
// Time window for matching (minutes)
exports.DEFAULT_TIME_WINDOW_MINS = 60;
// Group sizes to attempt by default
exports.DEFAULT_GROUP_SIZES = [3, 2]; // prefer 3 if fits, else 2
// For hourly retrier: which hours after noon to run (local TZ)
exports.HOURLY_AFTER_NOON_CRON = "0 13-23 * * *"; // 13:00..23:00
exports.DAILY_NOON_CRON = "0 12 * * *"; // 12:00 daily
