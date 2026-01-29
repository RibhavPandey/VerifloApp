import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
let resend: Resend | null = null;

if (resendApiKey) {
  resend = new Resend(resendApiKey);
} else {
  console.warn('RESEND_API_KEY not set. Email functionality will be disabled.');
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!resend) {
    console.warn('Email service not configured. Skipping email send.');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: options.from || 'Veriflo <noreply@verifloapp.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ExcelAI Pro</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to ExcelAI Pro!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${name || 'there'},</p>
          <p>Thank you for signing up for ExcelAI Pro! We're excited to have you on board.</p>
          <p>Get started by:</p>
          <ul>
            <li>Uploading your first spreadsheet</li>
            <li>Extracting data from documents</li>
            <li>Creating automated workflows</li>
          </ul>
          <p style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'https://verifloapp.com'}/dashboard" 
               style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Go to Dashboard
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
    subject: 'Welcome to ExcelAI Pro!',
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
          <p>To continue using ExcelAI Pro, please consider upgrading your plan or purchasing additional credits.</p>
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
    subject: 'Low Credits Warning - ExcelAI Pro',
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
          <p>We received a request to reset your password for your ExcelAI Pro account.</p>
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
    subject: 'Reset Your Password - ExcelAI Pro',
    html,
  });
}
