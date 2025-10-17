// lib/email.ts
export type EmailPayload = {
    to: string;      // Real email address in production
    subject: string;
    body: string;
    link?: string;
  };
  
  export async function sendNotificationEmail(payload: EmailPayload): Promise<void> {
    // TODO: integrate your provider (SendGrid/SES/Resend/etc.)
    console.log("Mock email:", payload);
  }
  