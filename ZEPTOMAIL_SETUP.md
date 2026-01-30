# ZeptoMail Setup Guide (zeptomail.zoho.in)

Follow these steps exactly. Do not skip any step.

---

## Step 1: Login to ZeptoMail

1. Open your browser.
2. Go to: **https://zeptomail.zoho.in**
3. Login with your Zoho account.

---

## Step 2: Add Your Domain (if not done)

1. On the left side, click **"Mail Agents"**.
2. Click your Mail Agent (or create one if you don't have any).
3. Click **"Domains"** in the left menu.
4. Click **"Add Domain"**.
5. Type: **verifloapp.com** (your website domain).
6. Click Add.
7. ZeptoMail will show you some DNS records (like TXT, CNAME).
8. Go to your domain provider (where you bought verifloapp.com) and add those records.
9. Wait 10–30 minutes. Then in ZeptoMail, click **"Verify"** next to your domain.
10. When it says "Verified", you're done.

---

## Step 3: Get the Send Mail Token (IMPORTANT)

**This is NOT the SMTP password. Do not use SMTP password.**

1. On the left side, click **"Mail Agents"**.
2. Click your Mail Agent name.
3. Click **"SMTP/API"** in the left menu.
4. You will see two tabs: **"SMTP"** and **"API"**.
5. **Click the "API" tab.** (Not SMTP!)
6. Find **"Send Mail Token"**.
7. Click the **copy icon** (small copy button) next to the token.
8. The token is a long string of letters and numbers. Paste it somewhere safe (like Notepad) to check:
   - It should NOT start with "Zoho-enczapikey" – that's fine, we add it in code.
   - It should be one long string, no spaces in the middle.
   - If you see "Generate" button, you can generate a new token and copy that.

---

## Step 4: Add to Railway

1. Go to **Railway** dashboard.
2. Open your backend project.
3. Click **"Variables"** (or "Environment").
4. Add or update these:

| Variable Name      | Value                          |
|--------------------|--------------------------------|
| ZOHO_MAIL_TOKEN    | (paste the token you copied)   |
| ZOHO_SENDER_EMAIL  | support@verifloapp.com        |

5. **Important:** When pasting ZOHO_MAIL_TOKEN:
   - Paste ONLY the token. No quotes. No extra spaces.
   - Do NOT add "Zoho-enczapikey" in front – the code adds it.
6. Click **Save**.
7. Railway will redeploy automatically. Wait 1–2 minutes.

---

## Step 5: Remove Old Variables (if any)

If you have these from before, you can remove them:
- RESEND_API_KEY
- RESEND_SENDER_EMAIL
- ZOHO_SMTP_PASS (we use ZOHO_MAIL_TOKEN now)
- ZOHO_MAIL_DOMAIN (not needed – we use India by default)

---

## Step 6: Test

1. Go to your app: https://verifloapp.com
2. Sign up with a new email (or use the one you verified in ZeptoMail).
3. Check that email inbox for the welcome email.
4. If it doesn't come, check Railway logs. Look for:
   - `[email] ZeptoMail India configured` – good
   - `[signup-welcome-email] Sending to:` – request reached backend
   - `[email] Send failed:` – token or config issue

---

## Common Mistakes

1. **Using SMTP password instead of API token** – Always use the token from the **API** tab, not SMTP.
2. **Wrong domain** – Sender email (support@verifloapp.com) must use a domain you verified in ZeptoMail.
3. **Quotes or spaces** – When pasting token in Railway, don't add quotes or extra spaces.
4. **Not redeploying** – After changing variables, wait for Railway to redeploy.

---

## Still Not Working?

Check Railway logs. If you see **"Invalid API Token"** (SERR_157):
1. Go back to ZeptoMail → Mail Agents → SMTP/API → **API** tab.
2. Click **"Generate"** to create a new token.
3. Copy the new token.
4. Update ZOHO_MAIL_TOKEN in Railway with the new token.
5. Wait for redeploy and test again.
