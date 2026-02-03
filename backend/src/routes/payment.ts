import express from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { getMonthlyCredits, getMonthlyDocuments, isValidPlan } from '../utils/plans.js';

const router = express.Router();

const keyId = process.env.LIVE_KEY_ID;
const keySecret = process.env.LIVE_KEY_SECRET;
const USD_TO_INR = Number(process.env.USD_TO_INR) || 85;
const dodoApiKey = process.env.DODO_PAYMENTS_API_KEY;
const dodoWebhookSecret = process.env.DODO_WEBHOOK_SECRET;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function usdToPaise(usd: number): number {
  const inr = Math.round(usd * USD_TO_INR);
  return inr * 100; // paise
}

// Plan and addon pricing (USD)
const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  starter: { monthly: 29, yearly: 290 }, // 10 months price for yearly
  pro: { monthly: 79, yearly: 790 },
};

const ADDON_DOCS: Record<string, { docs: number; price: number }> = {
  '50': { docs: 50, price: 8 },
  '100': { docs: 100, price: 15 },
  '250': { docs: 250, price: 35 },
};

const ADDON_CREDITS: Record<string, { credits: number; price: number }> = {
  small: { credits: 500, price: 9 },
  medium: { credits: 1200, price: 19 },
  large: { credits: 3000, price: 39 },
};

// Intro offer: first month at $19 for Starter
const INTRO_OFFER = { plan: 'starter', price: 19 };

function getDodoProductId(type: string, planId?: string, addonId?: string, period?: string): string | null {
  const key = type === 'intro_offer' ? 'DODO_PRODUCT_INTRO'
    : type === 'subscription' && planId ? `DODO_PRODUCT_${planId.toUpperCase()}_${(period === 'yearly' ? 'YEARLY' : 'MONTHLY')}`
    : type === 'addon_docs' && addonId ? `DODO_PRODUCT_DOCS_${addonId}`
    : type === 'addon_credits' && addonId ? `DODO_PRODUCT_CREDITS_${addonId.toUpperCase()}`
    : null;
  return key ? (process.env[key] || null) : null;
}

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!keySecret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
  return expected === signature;
}

// Create order (Razorpay for India, DodoPayments for International)
router.post('/create-order', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const { type, planId, addonId, period, region = 'IN' } = req.body || {};
    const metadata: Record<string, any> = { userId: req.user.id };

    if (type === 'intro_offer') {
      metadata.type = 'intro_offer';
      metadata.plan = INTRO_OFFER.plan;
    } else if (type === 'subscription' && planId && PLAN_PRICES[planId]) {
      metadata.type = 'subscription';
      metadata.planId = planId;
      metadata.period = period || 'monthly';
    } else if (type === 'addon_docs' && addonId && ADDON_DOCS[addonId]) {
      metadata.type = 'addon_docs';
      metadata.docs = ADDON_DOCS[addonId].docs;
    } else if (type === 'addon_credits' && addonId && ADDON_CREDITS[addonId]) {
      metadata.type = 'addon_credits';
      metadata.credits = ADDON_CREDITS[addonId].credits;
    } else {
      return res.status(400).json({ error: 'Invalid payment type or parameters' });
    }

    // International: DodoPayments
    if (region === 'INTL') {
      if (!dodoApiKey) return res.status(500).json({ error: 'International payments not configured' });
      const productId = getDodoProductId(type, planId, addonId, period);
      if (!productId) return res.status(400).json({ error: 'Product not configured for this plan' });

      const dodoRes = await fetch(
        `https://${process.env.NODE_ENV === 'production' ? 'live' : 'test'}.dodopayments.com/checkouts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${dodoApiKey}`,
          },
          body: JSON.stringify({
            product_cart: [{ product_id: productId, quantity: 1 }],
            return_url: `${frontendUrl.replace(/\/$/, '')}/pricing?dodo_success=1`,
            metadata,
          }),
        }
      );
      if (!dodoRes.ok) {
        const errText = await dodoRes.text();
        console.error('Dodo create checkout error:', dodoRes.status, errText);
        return res.status(500).json({ error: 'Failed to create checkout' });
      }
      const session = (await dodoRes.json()) as { checkout_url?: string; session_id?: string };
      return res.json({
        provider: 'dodo',
        checkout_url: session.checkout_url,
        session_id: session.session_id,
      });
    }

    // India: Razorpay
    if (!keyId || !keySecret) return res.status(500).json({ error: 'Payment not configured' });

    let amountPaise: number;
    const currency = 'INR';

    if (type === 'intro_offer') {
      amountPaise = usdToPaise(INTRO_OFFER.price);
    } else if (type === 'subscription' && planId && PLAN_PRICES[planId]) {
      const prices = PLAN_PRICES[planId];
      const usd = period === 'yearly' ? prices.yearly : prices.monthly;
      amountPaise = usdToPaise(usd);
    } else if (type === 'addon_docs' && addonId && ADDON_DOCS[addonId]) {
      amountPaise = usdToPaise(ADDON_DOCS[addonId].price);
    } else if (type === 'addon_credits' && addonId && ADDON_CREDITS[addonId]) {
      amountPaise = usdToPaise(ADDON_CREDITS[addonId].price);
    } else {
      return res.status(400).json({ error: 'Invalid payment type or parameters' });
    }

    if (amountPaise < 100) return res.status(400).json({ error: 'Amount too small' });

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency,
      receipt: `rcpt_${Date.now()}_${req.user.id.slice(0, 8)}`,
      notes: metadata,
    });

    res.json({
      provider: 'razorpay',
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      metadata,
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

// Verify payment and update profile
router.post('/verify', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Fetch order notes to know what was purchased
    const razorpay = new Razorpay({ key_id: keyId!, key_secret: keySecret! });
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const notes = (order.notes || {}) as Record<string, string>;

    const paymentType = notes.type;
    const userId = req.user.id;

    if (paymentType === 'intro_offer') {
      const plan = notes.plan || 'starter';
      await supabaseAdmin.from('profiles').update({
        subscription_plan: plan,
        credits: getMonthlyCredits(plan),
        documents_used: 0,
        monthly_credits_reset_at: new Date().toISOString(),
        monthly_documents_reset_at: new Date().toISOString(),
      }).eq('id', userId);
    } else if (paymentType === 'subscription') {
      const planId = notes.planId || 'starter';
      if (isValidPlan(planId)) {
        await supabaseAdmin.from('profiles').update({
          subscription_plan: planId,
          credits: getMonthlyCredits(planId),
          documents_used: 0,
          monthly_credits_reset_at: new Date().toISOString(),
          monthly_documents_reset_at: new Date().toISOString(),
        }).eq('id', userId);
      }
    } else if (paymentType === 'addon_docs') {
      const docs = parseInt(notes.docs || '0', 10);
      if (docs > 0) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('documents_used').eq('id', userId).single();
        const current = typeof profile?.documents_used === 'number' ? profile.documents_used : 0;
        await supabaseAdmin.from('profiles').update({
          documents_used: Math.max(0, current - docs),
        }).eq('id', userId);
      }
    } else if (paymentType === 'addon_credits') {
      const credits = parseInt(notes.credits || '0', 10);
      if (credits > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
        const current = typeof profile?.credits === 'number' ? profile.credits : 0;
        await supabaseAdmin.from('profiles').update({
          credits: current + credits,
          credits_expires_at: expiresAt.toISOString(),
        }).eq('id', userId);
      }
    }

    const amountPaise = typeof order.amount === 'number' ? order.amount : 0;
    await supabaseAdmin.from('payments').insert({
      user_id: userId,
      provider: 'razorpay',
      razorpay_order_id,
      razorpay_payment_id,
      amount_paise: amountPaise,
      currency: order.currency || 'INR',
      type: paymentType || 'subscription',
      metadata: notes,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

// Apply same profile updates for Dodo (shared logic)
async function applyPaymentFulfillment(userId: string, notes: Record<string, string>) {
  const paymentType = notes.type;

  if (paymentType === 'intro_offer') {
    const plan = notes.plan || 'starter';
    await supabaseAdmin.from('profiles').update({
      subscription_plan: plan,
      credits: getMonthlyCredits(plan),
      documents_used: 0,
      monthly_credits_reset_at: new Date().toISOString(),
      monthly_documents_reset_at: new Date().toISOString(),
    }).eq('id', userId);
  } else if (paymentType === 'subscription') {
    const planId = notes.planId || 'starter';
    if (isValidPlan(planId)) {
      await supabaseAdmin.from('profiles').update({
        subscription_plan: planId,
        credits: getMonthlyCredits(planId),
        documents_used: 0,
        monthly_credits_reset_at: new Date().toISOString(),
        monthly_documents_reset_at: new Date().toISOString(),
      }).eq('id', userId);
    }
  } else if (paymentType === 'addon_docs') {
    const docs = parseInt(notes.docs || '0', 10);
    if (docs > 0) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('documents_used').eq('id', userId).single();
      const current = typeof profile?.documents_used === 'number' ? profile.documents_used : 0;
      await supabaseAdmin.from('profiles').update({
        documents_used: Math.max(0, current - docs),
      }).eq('id', userId);
    }
  } else if (paymentType === 'addon_credits') {
    const credits = parseInt(notes.credits || '0', 10);
    if (credits > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single();
      const current = typeof profile?.credits === 'number' ? profile.credits : 0;
      await supabaseAdmin.from('profiles').update({
        credits: current + credits,
        credits_expires_at: expiresAt.toISOString(),
      }).eq('id', userId);
    }
  }
}

// Dodo webhook handler (exported for use with express.raw in index.ts)
export async function handleDodoWebhook(req: express.Request, res: express.Response) {
  const rawBody = req.body;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ error: 'Invalid body' });
  }
  const payloadStr = rawBody.toString('utf8');

  const webhookId = req.headers['webhook-id'] as string;
  const webhookSignature = req.headers['webhook-signature'] as string;
  const webhookTimestamp = req.headers['webhook-timestamp'] as string;

  if (!dodoWebhookSecret || !webhookId || !webhookSignature || !webhookTimestamp) {
    return res.status(400).json({ error: 'Missing webhook headers or secret' });
  }

  try {
    const signedPayload = `${webhookId}.${webhookTimestamp}.${payloadStr}`;
    const expectedSig = crypto.createHmac('sha256', dodoWebhookSecret).update(signedPayload).digest('hex');
    const sigParts = webhookSignature.split(',');
    const sigMatch = sigParts.some((part: string) => {
      const m = part.trim().match(/^v1=(.+)$/);
      if (!m) return false;
      const sig = m[1];
      try {
        return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
      } catch {
        return false;
      }
    });
    if (!sigMatch) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(payloadStr);
    if (payload.type !== 'payment.succeeded') {
      return res.status(200).json({ received: true });
    }

    const data = payload.data || {};
    const metadata = (data.metadata || {}) as Record<string, string>;
    const userId = metadata.userId;
    if (!userId) {
      console.error('Dodo webhook: no userId in metadata');
      return res.status(200).json({ received: true });
    }

    await applyPaymentFulfillment(userId, metadata);

    const totalAmount = typeof data.total_amount === 'number' ? data.total_amount : 0;
    await supabaseAdmin.from('payments').insert({
      user_id: userId,
      provider: 'dodo',
      dodo_session_id: data.checkout_session_id || null,
      razorpay_order_id: null,
      razorpay_payment_id: null,
      amount_paise: totalAmount,
      currency: data.currency || 'USD',
      type: metadata.type || 'subscription',
      metadata,
    });

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Dodo webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

export default router;
