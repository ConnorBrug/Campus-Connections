
'use server';

// NOTE: This file is intentionally simplified for the MVP.
// It simulates sending an email by logging to the console.
// This removes the need for an email service (like Resend) and an API key for initial setup.

interface SendEmailParams {
    to: string;
    subject: string;
    body: string;
    link?: string;
}

export async function sendNotificationEmail({ to, subject, body, link }: SendEmailParams) {
    // For MVP, we log to the console instead of sending a real email.
    console.log("--- SIMULATED EMAIL (MVP) ---");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    if (link) {
        console.log(`Link: ${link}`);
    }
    console.log("-----------------------------");
    
    // In a real production app, this is where you would call your email provider.
    // For example, with Resend:
    //
    // import { Resend } from 'resend';
    // import NotificationEmail from '@/emails/NotificationEmail';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'Connections <noreply@yourdomain.com>',
    //   to: [to],
    //   subject: subject,
    //   react: NotificationEmail({ subject, body, link }),
    // });
    
    return Promise.resolve();
}
