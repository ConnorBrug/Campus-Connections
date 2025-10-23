// lib/email.ts
import { Resend } from 'resend';
import NotificationEmail from '@/emails/NotificationEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export type EmailPayload = {
    to: string;
    subject: string;
    body: string;
    link?: string;
};

export async function sendNotificationEmail(payload: EmailPayload): Promise<void> {
    const fromEmail = process.env.FROM_EMAIL || 'Connections <noreply@yourdomain.com>';

    if (!process.env.RESEND_API_KEY) {
        console.warn("RESEND_API_KEY is not set. Email will be logged to console instead of sent.");
        console.log("--- Mock Email ---");
        console.log("To:", payload.to);
        console.log("Subject:", payload.subject);
        console.log("Body:", payload.body);
        console.log("Link:", payload.link);
        console.log("--------------------");
        return; // <-- not sending without key
    }

    try {
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [payload.to],
            subject: payload.subject,
            react: NotificationEmail({
                subject: payload.subject,
                body: payload.body,
                link: payload.link,
            }),
            text: `${payload.body}\n\nView Details: ${payload.link || 'No link provided.'}`,
        });

        if (error) {
            console.error("Resend API Error:", error);
            throw new Error(`Failed to send email: ${error.message}`);
        }

        console.log("Email sent successfully:", data);
    } catch (error) {
        console.error("Error sending notification email:", error);
        throw error;
    }
}
