import { SendMailClient } from 'zeptomail';

// ZeptoMail India (zeptomail.zoho.in) - domain must be 'in'
const rawToken = (process.env.ZOHO_MAIL_TOKEN || process.env.ZOHO_SMTP_PASS || '').trim();
const senderEmail = process.env.ZOHO_SENDER_EMAIL || 'support@verifloapp.com';
const domain = 'in'; // India - zeptomail.zoho.in

let client: SendMailClient | null = null;

if (rawToken) {
  // Remove quotes/newlines if pasted with them
  const cleaned = rawToken.replace(/^["']|["']$/g, '').replace(/\r?\n/g, '').trim();
  const token = cleaned.toLowerCase().startsWith('zoho-enczapikey') ? cleaned : `Zoho-enczapikey ${cleaned}`;
  client = new SendMailClient({ url: '', token, domain });
  console.log('[email] ZeptoMail India configured, from:', senderEmail);
} else {
  console.warn('[email] ZOHO_MAIL_TOKEN not set. Email disabled.');
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!client) {
    console.warn('Email service not configured. Skipping email send.');
    return false;
  }

  try {
    const fromStr = options.from || `Veriflo <${senderEmail}>`;
    const match = fromStr.match(/^(.+?)\s*<([^>]+)>$/);
    const fromName = match ? match[1].trim() : 'Veriflo';
    const fromAddr = match ? match[2].trim() : senderEmail;

    await client.sendMail({
      from: { address: fromAddr, name: fromName },
      to: [{ email_address: { address: options.to, name: '' } }],
      subject: options.subject,
      htmlbody: options.html,
    });
    return true;
  } catch (error: any) {
    const err = error?.error || error;
    const details = err?.details || err;
    console.error('[email] Send failed:', err?.code || err?.message, JSON.stringify(details));
    return false;
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://verifloapp.com'}/dashboard`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Veriflo</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Arial, sans-serif; color: #111;">
        <div style="max-width: 520px; margin: 48px auto; padding: 40px; background: #ffffff; border-radius: 16px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Welcome to Veriflo</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 600; letter-spacing: -0.4px;">Stop fighting your data.</h1>
          <p style="margin: 0 0 28px; font-size: 16px; color: #444; line-height: 1.6;">If you've ever spent hours fixing spreadsheets or cleaning files just to get usable data — you're not alone. Veriflo automates that work for you.</p>
          <p style="margin: 0 0 32px; font-size: 15px; color: #555;">Upload a file and see clean, structured data in seconds.</p>
          <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 30px; background: #111; color: #ffffff; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600;">Upload your first file →</a>
          <p style="margin-top: 36px; font-size: 13px; color: #888; line-height: 1.5;">If you didn't create a Veriflo account, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to Veriflo!',
    html,
  });
}

export async function sendCreditLowWarning(email: string, name: string, credits: number): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Low Credits Warning</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f59e0b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Low Credits Warning</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${name || 'there'},</p>
          <p>Your account is running low on credits. You currently have <strong>${credits} credits</strong> remaining.</p>
          <p>To continue using Veriflo, please consider upgrading your plan or purchasing additional credits.</p>
          <p style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'https://verifloapp.com'}/pricing" 
               style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Pricing
            </a>
          </p>
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            If you have any questions, feel free to reach out to our support team.
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Low Credits Warning - Veriflo',
    html,
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Reset Your Password</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi there,</p>
          <p>We received a request to reset your password for your Veriflo account.</p>
          <p>Click the button below to reset your password:</p>
          <p style="margin-top: 30px; text-align: center;">
            <a href="${resetUrl}" 
               style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.
          </p>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            Or copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Reset Your Password - Veriflo',
    html,
  });
}
