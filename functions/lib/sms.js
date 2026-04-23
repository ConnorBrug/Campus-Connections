"use strict";
// functions/src/sms.ts
//
// Transactional SMS via Twilio.
//
// Configuration (environment variables / Firebase secrets):
//   TWILIO_ACCOUNT_SID   — required
//   TWILIO_AUTH_TOKEN    — required
//   TWILIO_FROM_NUMBER   — required. Must be a Twilio-owned number in E.164
//                          form, e.g. +15551234567.
//   APP_URL              — Absolute origin, matches email.ts. Defaults to prod.
//
// Opt-in rules (enforced by this module — callers don't need to pre-check):
//   1. Recipient must have `phoneNumber` set on their /users/{uid} doc.
//   2. Recipient must have `smsNotificationsEnabled === true`.
//   3. Phone number must pass E.164 validation (+1 followed by 10 digits for US).
// A violation of any of these is a silent no-op. Failures from Twilio are
// logged but never thrown — SMS must never break the matching pipeline.
//
// All outbound message bodies are built from a small set of safe templates;
// any user-supplied string (display name, airport code, flight code) is run
// through `sanitizeForSms()` before interpolation, which strips control
// characters and caps length so a malicious display name can't break the
// message or be used to inject a fake link.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUsPhone = normalizeUsPhone;
exports.sendMatchSms = sendMatchSms;
exports.sendNoMatchSms = sendNoMatchSms;
exports.sendXlRideSuggestionSms = sendXlRideSuggestionSms;
const admin = __importStar(require("firebase-admin"));
const twilio_1 = __importDefault(require("twilio"));
const APP_URL = process.env.APP_URL || 'https://campus-connections.com';
let cachedClient = null;
function getClient() {
    if (cachedClient)
        return cachedClient;
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token)
        return null;
    cachedClient = (0, twilio_1.default)(sid, token);
    return cachedClient;
}
function getFromNumber() {
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!from)
        return null;
    if (!/^\+\d{10,15}$/.test(from)) {
        console.error('[sms] TWILIO_FROM_NUMBER is not E.164');
        return null;
    }
    return from;
}
/**
 * Strict US phone validator. Accepts either E.164 (+15551234567) or a raw
 * 10-digit string, and returns the canonical E.164 form on success.
 * Returns null for anything else.
 */
function normalizeUsPhone(raw) {
    if (!raw)
        return null;
    const digits = String(raw).replace(/\D+/g, '');
    if (digits.length === 10)
        return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1'))
        return `+${digits}`;
    return null;
}
/**
 * Strip anything that would let a malicious display name or flight code
 * break the message or inject a fake URL. Keep it short — SMS is 160 chars
 * per segment and we want to stay in one segment when possible.
 */
function sanitizeForSms(v, maxLen = 40) {
    if (v == null)
        return '';
    let s = String(v)
        // Strip control characters and zero-width / direction-override tricks.
        .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, '')
        // Collapse whitespace.
        .replace(/\s+/g, ' ')
        .trim();
    if (s.length > maxLen)
        s = s.slice(0, maxLen - 1) + '…';
    return s;
}
/**
 * Fetch the SMS-eligibility of a given user. Returns null if the user can't
 * receive SMS (missing doc, no phone, phone invalid, or opted out).
 */
async function loadRecipientPrefs(userId) {
    if (!userId)
        return null;
    const snap = await admin.firestore().collection('users').doc(userId).get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    if (!data)
        return null;
    if (data.smsNotificationsEnabled !== true)
        return null;
    const e164 = normalizeUsPhone(data.phoneNumber);
    if (!e164)
        return null;
    return { phoneE164: e164, enabled: true };
}
async function send({ toE164, body }) {
    const client = getClient();
    if (!client)
        return;
    const from = getFromNumber();
    if (!from)
        return;
    try {
        await client.messages.create({ from, to: toE164, body });
    }
    catch (e) {
        console.error('[sms] Twilio send failed:', e);
    }
}
/** Match-found SMS. Mirrors sendMatchNotification. */
async function sendMatchSms(recipient, partner) {
    const prefs = await loadRecipientPrefs(recipient.userId);
    if (!prefs)
        return;
    const partnerName = sanitizeForSms(partner.userName || 'your match', 30);
    const airport = sanitizeForSms(recipient.departingAirport, 10);
    const body = `Campus Connections: You've been matched with ${partnerName} for your ${airport} trip. ` +
        `Open the app to chat: ${APP_URL}/main\n\nReply STOP to opt out.`;
    await send({ toE164: prefs.phoneE164, body });
}
/** No-match warning SMS. */
async function sendNoMatchSms(recipient) {
    const prefs = await loadRecipientPrefs(recipient.userId);
    if (!prefs)
        return;
    const airport = sanitizeForSms(recipient.departingAirport, 10);
    const body = `Campus Connections: No match yet for your ${airport} trip. ` +
        `Consider an alternate ride. ${APP_URL}/main\n\nReply STOP to opt out.`;
    await send({ toE164: prefs.phoneE164, body });
}
/** XL ride suggestion SMS. */
async function sendXlRideSuggestionSms(recipient) {
    const prefs = await loadRecipientPrefs(recipient.userId);
    if (!prefs)
        return;
    const airport = sanitizeForSms(recipient.departingAirport, 10);
    const body = `Campus Connections: Your combined luggage for your ${airport} trip may not fit a standard rideshare. ` +
        `Consider booking an XL. ${APP_URL}/main\n\nReply STOP to opt out.`;
    await send({ toE164: prefs.phoneE164, body });
}
//# sourceMappingURL=sms.js.map