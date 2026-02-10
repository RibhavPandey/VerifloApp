const baseUrl = process.env.FRONTEND_URL || 'https://verifloapp.com';
const extractUrl = `${baseUrl}/extract/new`;
const pricingUrl = `${baseUrl}/pricing`;

export const emailTemplates: Record<string, { subject: string; html: string | ((name: string, invoicesProcessed?: number) => string) }> = {
  day2: {
    subject: "You haven't extracted yet — try Veriflo in 2 minutes",
    html: (name) => `
      <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111;">
        <div style="max-width:520px;margin:48px auto;padding:40px;">
          <p style="margin:0 0 8px;font-size:14px;color:#666;">Hi ${name || 'there'},</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;">You haven't extracted yet</h1>
          <p style="margin:0 0 24px;font-size:16px;color:#444;line-height:1.6;">Upload a PDF invoice and let AI extract the data in seconds. No setup required.</p>
          <a href="${extractUrl}" style="display:inline-block;padding:14px 30px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;">Extract your first invoice →</a>
          <p style="margin-top:32px;font-size:13px;color:#888;">If you didn't create a Veriflo account, you can ignore this email.</p>
        </div>
      </body></html>
    `,
  },
  day5: {
    subject: "Here's a quick way to try Veriflo extraction",
    html: (name) => `
      <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111;">
        <div style="max-width:520px;margin:48px auto;padding:40px;">
          <p style="margin:0 0 8px;font-size:14px;color:#666;">Hi ${name || 'there'},</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;">Still waiting to try extraction?</h1>
          <p style="margin:0 0 24px;font-size:16px;color:#444;line-height:1.6;">One click: upload a sample invoice and see structured data. Takes under 2 minutes.</p>
          <a href="${extractUrl}" style="display:inline-block;padding:14px 30px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;">Try extraction now →</a>
          <p style="margin-top:32px;font-size:13px;color:#888;">If you didn't create a Veriflo account, you can ignore this email.</p>
        </div>
      </body></html>
    `,
  },
  day7: {
    subject: "Your first week with Veriflo",
    html: (name, invoicesProcessed = 0) => `
      <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111;">
        <div style="max-width:520px;margin:48px auto;padding:40px;">
          <p style="margin:0 0 8px;font-size:14px;color:#666;">Hi ${name || 'there'},</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;">Your first week with Veriflo</h1>
          <p style="margin:0 0 24px;font-size:16px;color:#444;line-height:1.6;">
            ${invoicesProcessed > 0
              ? "You've tried extraction. Need more documents or credits? Upgrade for 150 docs/month and more."
              : "You're on the free plan — 10 docs and 100 credits per month. Ready for more? Check our plans."}
          </p>
          <a href="${pricingUrl}" style="display:inline-block;padding:14px 30px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;">View pricing →</a>
          <p style="margin-top:32px;font-size:13px;color:#888;">Questions? Reply to this email.</p>
        </div>
      </body></html>
    `,
  },
};
