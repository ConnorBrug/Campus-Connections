// scripts/test-resend.mjs
//
// Smoke-test for the Resend integration. Sends a single email via the
// Resend sandbox sender so you can confirm RESEND_API_KEY works before
// redeploying Cloud Functions.
//
// Usage (PowerShell):
//   $env:RESEND_API_KEY = "re_your_real_key_here"
//   node scripts/test-resend.mjs
//
// Usage (bash / zsh):
//   RESEND_API_KEY=re_your_real_key_here node scripts/test-resend.mjs
//
// A success prints `sent: { id: '...' }` and an email lands in TO_EMAIL.
// A failure prints the Resend error object and exits with code 1.

import { Resend } from 'resend';

const KEY = process.env.RESEND_API_KEY;
if (!KEY) {
  console.error('RESEND_API_KEY is not set. Export it first, e.g.:');
  console.error('  $env:RESEND_API_KEY = "re_..."   (PowerShell)');
  console.error('  RESEND_API_KEY=re_... node scripts/test-resend.mjs   (bash)');
  process.exit(1);
}

// `onboarding@resend.dev` is Resend's shared sandbox sender — works before
// you verify a custom domain. Swap to your verified domain once DNS is green.
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const TO_EMAIL = process.env.TO_EMAIL || 'connorbrugger@gmail.com';

const resend = new Resend(KEY);

const { data, error } = await resend.emails.send({
  from: FROM_EMAIL,
  to: TO_EMAIL,
  subject: 'Campus Connections — Resend smoke test',
  html: `
    <p>If you're reading this, your Resend API key is wired up correctly
    and Cloud Functions will be able to send match emails once redeployed.</p>
    <p><strong>From:</strong> ${FROM_EMAIL}<br/>
       <strong>To:</strong> ${TO_EMAIL}<br/>
       <strong>Sent at:</strong> ${new Date().toISOString()}</p>
  `,
});

if (error) {
  console.error('send failed:', error);
  process.exit(1);
}

console.log('sent:', data);
