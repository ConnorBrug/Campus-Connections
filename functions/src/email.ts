// functions/src/email.ts
import * as nodemailer from 'nodemailer';
import { TripRequest } from './types';

// Configure via environment variables (secrets).
//
// For production, set these with Firebase secrets:
//   firebase functions:secrets:set SMTP_HOST
//   firebase functions:secrets:set SMTP_USER
//   firebase functions:secrets:set SMTP_PASS
//   (optional) firebase functions:secrets:set SMTP_PORT
//   (optional) firebase functions:secrets:set APP_URL
//
// For local development, put them in functions/.env (gitignored).
//
// NOTE: `functions.config()` has been removed in favor of env vars / secrets.
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const APP_URL = process.env.APP_URL || 'https://campus-connections.com';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Connections <noreply@campus-connections.com>';

/**
 * Send a match notification email to `recipient`, telling them about `partner`.
 */
export async function sendMatchNotification(
  recipient: TripRequest,
  partner: TripRequest
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter || !recipient.userEmail) return;

  const recipientName = recipient.userName ?? 'Rider';
  const partnerName = partner.userName ?? 'your match';
  const flightDate = recipient.flightDate ?? recipient.flightDateTime?.slice(0, 10) ?? 'your flight date';

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: recipient.userEmail,
    subject: `You've been matched for your ${recipient.departingAirport} trip!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hey ${recipientName}!</h2>
        <p>Great news — you've been matched with <strong>${partnerName}</strong> for your upcoming trip on <strong>${flightDate}</strong>.</p>
        <p>Here are the details:</p>
        <ul>
          <li><strong>Your flight:</strong> ${recipient.flightCode} from ${recipient.departingAirport}</li>
          <li><strong>Partner's flight:</strong> ${partner.flightCode} from ${partner.departingAirport}</li>
        </ul>
        <p>Log in to Connections to chat with your match and coordinate your ride.</p>
        <p style="margin-top: 24px;">
          <a href="${APP_URL}/main"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Open Connections
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          — The Connections Team
        </p>
      </div>
    `,
  });
}

/**
 * Send a "trip request received" confirmation.
 */
export async function sendTripRequestConfirmation(recipient: TripRequest): Promise<void> {
  const transporter = getTransporter();
  if (!transporter || !recipient.userEmail) return;

  const recipientName = recipient.userName ?? 'Rider';
  const flightDate = recipient.flightDate ?? recipient.flightDateTime?.slice(0, 10) ?? 'your flight date';

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: recipient.userEmail,
    subject: `Trip request received for ${recipient.departingAirport}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${recipientName},</h2>
        <p>We received your trip request and added you to the matching pool.</p>
        <ul>
          <li><strong>Flight:</strong> ${recipient.flightCode}</li>
          <li><strong>Date:</strong> ${flightDate}</li>
          <li><strong>Airport:</strong> ${recipient.departingAirport}</li>
        </ul>
        <p>We will keep searching and notify you as soon as a match is found.</p>
        <p style="margin-top: 24px;">
          <a href="${APP_URL}/main"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Open Connections
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          — The Connections Team
        </p>
      </div>
    `,
  });
}

/**
 * Send a "no match found" notification.
 */
export async function sendNoMatchNotification(recipient: TripRequest): Promise<void> {
  const transporter = getTransporter();
  if (!transporter || !recipient.userEmail) return;

  const recipientName = recipient.userName ?? 'Rider';

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: recipient.userEmail,
    subject: 'No match found for your upcoming trip',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hey ${recipientName},</h2>
        <p>We thank you for giving us the chance to help you find a match for your upcoming trip from <strong>${recipient.departingAirport}</strong>.</p>
        <p>Unfortunately, we were unable to find a compatible match for your flight. We recommend arranging alternative transportation to the airport.</p>
        <p>If your plans change, you can always cancel and resubmit a new trip request.</p>
        <p style="margin-top: 24px;">
          <a href="${APP_URL}/main"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Open Connections
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          — The Connections Team
        </p>
      </div>
    `,
  });
}

/**
 * Suggest an XL ride for riders with heavy bags.
 */
export async function sendXlRideSuggestion(recipient: TripRequest): Promise<void> {
  const transporter = getTransporter();
  if (!transporter || !recipient.userEmail) return;

  const recipientName = recipient.userName ?? 'Rider';

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: recipient.userEmail,
    subject: 'Your luggage might need an XL ride',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hey ${recipientName},</h2>
        <p>We noticed your combined luggage might need a little extra space. We suggest considering an <strong>XL ride</strong> for your trip from <strong>${recipient.departingAirport}</strong>.</p>
        <p>An XL vehicle can accommodate more bags and ensure a comfortable ride to the airport.</p>
        <p>Log in to Connections to view your trip details or update your plans.</p>
        <p style="margin-top: 24px;">
          <a href="${APP_URL}/main"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Open Connections
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          — The Connections Team
        </p>
      </div>
    `,
  });
}
