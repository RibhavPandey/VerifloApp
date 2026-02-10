export const emailTemplates = {
    day1NoUpload: {
        subject: 'Quick question - stuck on something?',
        html: (name: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #0a0a0a;">Haven't uploaded yet?</h1>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #666;">Hi ${name},</p>
                    
                    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #666;">
                      I noticed you signed up for Veriflo yesterday but haven't uploaded an invoice yet.
                    </p>
                    
                    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #666;">
                      Is something confusing? Here's how to get started in 60 seconds:
                    </p>
                    
                    <div style="background-color: #f9fafb; border-left: 3px solid #0a0a0a; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                      <ol style="margin: 0; padding-left: 20px; color: #0a0a0a;">
                        <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.5;">Click "Extract Data" in your dashboard</li>
                        <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.5;">Upload an invoice PDF</li>
                        <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.5;">Review the extracted data</li>
                        <li style="margin-bottom: 0; font-size: 14px; line-height: 1.5;">Export to Tally/QuickBooks</li>
                      </ol>
                    </div>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0 24px;">
                          <a href="${process.env.VITE_SITE_URL || 'https://veriflo.app'}/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #0a0a0a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                            Try It Now
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: #999;">
                      Need help? Just reply to this email.
                    </p>
                    
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666;">
                      Ribhav<br>
                      <span style="color: #999;">Founder, Veriflo</span>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #f0f0f0; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #999;">
                      Veriflo · Invoice automation made simple
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    },

    day3Features: {
        subject: 'Try these 3 powerful features',
        html: (name: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <tr>
                  <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #0a0a0a;">3 features you might have missed</h1>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #666;">Hi ${name},</p>
                    
                    <!-- Feature 1 -->
                    <div style="margin-bottom: 24px; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                      <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #0a0a0a;">1. AI Chat</h3>
                      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666;">
                        Ask questions about your data in plain English. "What's the total sales?" or "Chart by region"
                      </p>
                    </div>
                    
                    <!-- Feature 2 -->
                    <div style="margin-bottom: 24px; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                      <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #0a0a0a;">2. Workflow Automation</h3>
                      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666;">
                        Record actions once, run them on any file. Perfect for monthly reports.
                      </p>
                    </div>
                    
                    <!-- Feature 3 -->
                    <div style="margin-bottom: 24px; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                      <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #0a0a0a;">3. Direct ERP Export</h3>
                      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666;">
                        Export directly to Tally, QuickBooks, or Zoho. No manual data entry.
                      </p>
                    </div>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0 24px;">
                          <a href="${process.env.VITE_SITE_URL || 'https://veriflo.app'}/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #0a0a0a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                            Explore Features
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666;">
                      Ribhav<br>
                      <span style="color: #999;">Founder, Veriflo</span>
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #f0f0f0; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #999;">
                      Veriflo · Invoice automation made simple
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    },

    day7Upgrade: {
        subject: 'Special offer: 50% off your first month',
        html: (name: string, invoicesProcessed: number) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <tr>
                  <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #0a0a0a;">You've saved ${invoicesProcessed * 10} minutes this week 🎉</h1>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #666;">Hi ${name},</p>
                    
                    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #666;">
                      You've processed ${invoicesProcessed} invoices with Veriflo. That's ${invoicesProcessed * 10} minutes you didn't spend on manual data entry!
                    </p>
                    
                    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #666;">
                      Want to keep going? Upgrade to Pro for unlimited invoices.
                    </p>
                    
                    <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 20px; margin-bottom: 24px; border-radius: 8px; text-align: center;">
                      <p style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #0a0a0a;">
                        Special Offer: 50% Off First Month
                      </p>
                      <p style="margin: 0; font-size: 14px; color: #666;">
                        Use code <strong style="color: #0a0a0a;">FIRSTWEEK</strong> at checkout
                      </p>
                    </div>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                          <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #0a0a0a;">Pro Plan - $24.50/mo (50% off)</p>
                          <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px;">
                            <li style="margin-bottom: 6px;">Unlimited invoices</li>
                            <li style="margin-bottom: 6px;">Tally/QuickBooks export</li>
                            <li style="margin-bottom: 6px;">Workflow automation</li>
                            <li style="margin-bottom: 0;">Priority support</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0 24px;">
                          <a href="${process.env.VITE_SITE_URL || 'https://veriflo.app'}/pricing" style="display: inline-block; padding: 14px 32px; background-color: #0a0a0a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                            Upgrade Now
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666;">
                      Ribhav<br>
                      <span style="color: #999;">Founder, Veriflo</span>
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #f0f0f0; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #999;">
                      Veriflo · Invoice automation made simple
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    },

    day14WinBack: {
        subject: 'We miss you - here\'s 50% off to come back',
        html: (name: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <tr>
                  <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #0a0a0a;">We miss you!</h1>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #666;">Hi ${name},</p>
                    
                    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #666;">
                      Haven't seen you in a while. Did something not work?
                    </p>
                    
                    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #666;">
                      We just added:
                    </p>
                    
                    <ul style="margin: 0 0 24px; padding-left: 20px; color: #666; font-size: 15px; line-height: 1.8;">
                      <li>Bulk processing (20+ invoices at once)</li>
                      <li>QuickBooks direct export</li>
                      <li>Improved accuracy (now 96%+)</li>
                    </ul>
                    
                    <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 20px; margin-bottom: 24px; border-radius: 8px; text-align: center;">
                      <p style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #0a0a0a;">
                        Come Back Offer: 50% Off
                      </p>
                      <p style="margin: 0; font-size: 14px; color: #666;">
                        Use code <strong style="color: #0a0a0a;">COMEBACK</strong> - Valid for 7 days
                      </p>
                    </div>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0 24px;">
                          <a href="${process.env.VITE_SITE_URL || 'https://veriflo.app'}/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #0a0a0a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                            Give It Another Try
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #999;">
                      Or if Veriflo isn't right for you, I'd love to know why (just reply to this email).
                    </p>
                    
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666;">
                      Ribhav<br>
                      <span style="color: #999;">Founder, Veriflo</span>
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #f0f0f0; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #999;">
                      Veriflo · Invoice automation made simple
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    },
};
