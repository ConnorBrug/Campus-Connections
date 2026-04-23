"use strict";
// functions/src/email.ts
//
// Transactional email via Resend (https://resend.com).
//
// Configuration (all via environment variables / Firebase secrets):
//   RESEND_API_KEY  — required. Get one at https://resend.com/api-keys
//   EMAIL_FROM      — "Name <addr@yourdomain>". Domain must be verified in
//                     Resend. Defaults to the hard-coded marketing address.
//   APP_URL         — Absolute origin used in links. Defaults to the prod URL.
//
// Local dev:   put the vars in functions/.env (gitignored).
// Production:  firebase functions:secrets:set RESEND_API_KEY  (etc.)
//
// If RESEND_API_KEY is unset every send is a silent no-op. This keeps local
// matching runs from blowing up when the mail provider isn't configured, and
// mirrors the old nodemailer behaviour callers already rely on.
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMatchNotification = sendMatchNotification;
exports.sendTripRequestConfirmation = sendTripRequestConfirmation;
exports.sendNoMatchNotification = sendNoMatchNotification;
exports.sendXlRideSuggestion = sendXlRideSuggestion;
const resend_1 = require("resend");
const APP_URL = process.env.APP_URL || 'https://campus-connections.com';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Campus Connections <noreply@campus-connections.com>';
let cachedClient = null;
function getClient() {
    if (cachedClient)
        return cachedClient;
    const key = process.env.RESEND_API_KEY;
    if (!key)
        return null;
    cachedClient = new resend_1.Resend(key);
    return cachedClient;
}
/**
 * Escape untrusted strings before interpolating into an HTML template.
 * User-supplied names / airport codes / flight codes go through this so a
 * malicious display name like `<script>` can't execute in recipients' inboxes.
 */
function esc(v) {
    if (v == null)
        return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
async function send({ to, subject, html, text }) {
    const client = getClient();
    if (!client)
        return;
    try {
        await client.emails.send({
            from: FROM_ADDRESS,
            to,
            subject,
            html,
            text,
        });
    }
    catch (e) {
        // Log but never throw — notification failure shouldn't break matching.
        console.error('[email] Resend send failed:', e);
    }
}
// Reusable pieces so every email looks the same.
const BRAND_BLOCK = (body, ctaHref, ctaLabel) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
    ${body}
    <p style="margin-top: 24px;">
      <a href="${esc(ctaHref)}"
         style="background: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        ${esc(ctaLabel)}
      </a>
    </p>
    <p style="margin-top: 32px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
      Campus Connections · Rides for verified university students<br/>
      You're receiving this because you signed up at campus-connections.com.
    </p>
  </div>`;
/** Match-found notification. */
async function sendMatchNotification(recipient, partner) {
    if (!recipient.userEmail)
        return;
    const recipientName = recipient.userName || 'Rider';
    const partnerName = partner.userName || 'your match';
    const flightDate = recipient.flightDate || recipient.flightDateTime?.slice(0, 10) || 'your flight date';
    const subject = `You've been matched for your ${recipient.departingAirport} trip!`;
    const html = BRAND_BLOCK(`
    <h2 style="margin-top:0;">Hey ${esc(recipientName)}!</h2>
    <p>Great news — you've been matched with <strong>${esc(partnerName)}</strong> for your trip on <strong>${esc(flightDate)}</strong>.</p>
    <ul>
      <li><strong>Your flight:</strong> ${esc(recipient.flightCode)} from ${esc(recipient.departingAirport)}</li>
      <li><strong>Partner's flight:</strong> ${esc(partner.flightCode)} from ${esc(partner.departingAirport)}</li>
    </ul>
    <p>Log in to chat with your match and coordinate your ride.</p>`, `${APP_URL}/main`, 'Open Campus Connections');
    const text = `Hey ${recipientName}!\n\n` +
        `You've been matched with ${partnerName} for your ${flightDate} trip from ${recipient.departingAirport}.\n\n` +
        `Your flight: ${recipient.flightCode}\n` +
        `Partner's flight: ${partner.flightCode}\n\n` +
        `Open Campus Connections: ${APP_URL}/main`;
    await send({ to: recipient.userEmail, subject, html, text });
}
/** Trip-request received confirmation. */
async function sendTripRequestConfirmation(recipient) {
    if (!recipient.userEmail)
        return;
    const recipientName = recipient.userName || 'Rider';
    const flightDate = recipient.flightDate || recipient.flightDateTime?.slice(0, 10) || 'your flight date';
    const subject = `Trip request received for ${recipient.departingAirport}`;
    const html = BRAND_BLOCK(`
    <h2 style="margin-top:0;">Hi ${esc(recipientName)},</h2>
    <p>We received your trip request and added you to the matching pool.</p>
    <ul>
      <li><strong>Flight:</strong> ${esc(recipient.flightCode)}</li>
      <li><strong>Date:</strong> ${esc(flightDate)}</li>
      <li><strong>Airport:</strong> ${esc(recipient.departingAirport)}</li>
    </ul>
    <p>We will keep searching and notify you as soon as a match is found.</p>`, `${APP_URL}/main`, 'Open Campus Connections');
    const text = `Hi ${recipientName},\n\n` +
        `We received your trip request and added you to the matching pool.\n` +
        `Flight ${recipient.flightCode} from ${recipient.departingAirport} on ${flightDate}.\n\n` +
        `We'll email you as soon as we find a match.\n\n` +
        `${APP_URL}/main`;
    await send({ to: recipient.userEmail, subject, html, text });
}
/** No-match-found notification. */
async function sendNoMatchNotification(recipient) {
    if (!recipient.userEmail)
        return;
    const recipientName = recipient.userName || 'Rider';
    const subject = 'No match found for your upcoming trip';
    const html = BRAND_BLOCK(`
    <h2 style="margin-top:0;">Hey ${esc(recipientName)},</h2>
    <p>We weren't able to find a compatible match for your trip from <strong>${esc(recipient.departingAirport)}</strong>.</p>
    <p>You may want to arrange an alternative ride. If your plans change you can always cancel and resubmit a new trip request.</p>`, `${APP_URL}/main`, 'Open Campus Connections');
    const text = `Hey ${recipientName},\n\n` +
        `We couldn't find a compatible match for your trip from ${recipient.departingAirport}.\n` +
        `Please arrange an alternative ride or submit a new request.\n\n` +
        `${APP_URL}/main`;
    await send({ to: recipient.userEmail, subject, html, text });
}
/** Suggest an XL ride when the combined luggage is heavy. */
async function sendXlRideSuggestion(recipient) {
    if (!recipient.userEmail)
        return;
    const recipientName = recipient.userName || 'Rider';
    const subject = 'Your luggage might need an XL ride';
    const html = BRAND_BLOCK(`
    <h2 style="margin-top:0;">Hey ${esc(recipientName)},</h2>
    <p>We noticed the combined luggage on your trip from <strong>${esc(recipient.departingAirport)}</strong> may not fit in a standard rideshare.</p>
    <p>Consider booking an <strong>XL vehicle</strong> so everyone (and their bags) have room.</p>`, `${APP_URL}/main`, 'View your trip');
    const text = `Hey ${recipientName},\n\n` +
        `Your combined luggage may not fit in a standard rideshare. Consider booking XL from ${recipient.departingAirport}.\n\n` +
        `${APP_URL}/main`;
    await send({ to: recipient.userEmail, subject, html, text });
}
//# sourceMappingURL=email.js.map