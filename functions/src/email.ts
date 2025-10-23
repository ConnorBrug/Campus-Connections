import { Resend } from 'resend';
import { logger } from 'firebase-functions';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export type EmailPayload = {
    to: string;
    subject: string;
    body: string;
    link?: string;
};

export async function sendNotificationEmail(payload: EmailPayload): Promise<void> {
    const fromEmail = process.env.FROM_EMAIL || 'Connections <noreply@yourdomain.com>';

    if (!resend) {
        logger.warn("RESEND_API_KEY is not set. Email will be logged to console instead of sent.");
        logger.info("--- Mock Email ---");
        logger.info(`To: ${payload.to}`);
        logger.info(`Subject: ${payload.subject}`);
        logger.info(`Body: ${payload.body}`);
        logger.info(`Link: ${payload.link}`);
        logger.info("--------------------");
        return;
    }

    try {
        const emailHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>${payload.subject}</h2>
                <p>${payload.body}</p>
                ${payload.link ? `<a href="${payload.link}" style="display: inline-block; padding: 10px 20px; background-color: #7FFFD4; color: #000; text-decoration: none; border-radius: 5px;">View Details</a>` : ''}
                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #ccc;" />
                <p style="font-size: 12px; color: #888;">Connections - The easiest way to share rides to the airport.</p>
            </div>
        `;

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [payload.to],
            subject: payload.subject,
            html: emailHtml,
            text: `${payload.body}\n\nView Details: ${payload.link || 'No link provided.'}`,
        });

        if (error) {
            logger.error("Resend API Error:", { error });
            throw new Error(`Failed to send email: ${error.message}`);
        }

        logger.info("Email sent successfully", { data });
    } catch (error: any) {
        logger.error("Error sending notification email:", { error: String(error) });
        throw error;
    }
}
