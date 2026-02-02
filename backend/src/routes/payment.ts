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

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!keySecret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
  return expected === signature;
}

// Create Razorpay order
router.post('/create-order', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    if (!keyId || !keySecret) return res.status(500).json({ error: 'Payment not configured' });

    const { type, planId, addonId, period } = req.body || {};

    let amountPaise: number;
    let currency = 'INR';
    let metadata: Record<string, any> = { userId: req.user.id };

    if (type === 'intro_offer') {
      amountPaise = usdToPaise(INTRO_OFFER.price);
      metadata.type = 'intro_offer';
      metadata.plan = INTRO_OFFER.plan;
    } else if (type === 'subscription' && planId && PLAN_PRICES[planId]) {
      const prices = PLAN_PRICES[planId];
      const usd = period === 'yearly' ? prices.yearly : prices.monthly;
      amountPaise = usdToPaise(usd);
      metadata.type = 'subscription';
      metadata.planId = planId;
      metadata.period = period || 'monthly';
    } else if (type === 'addon_docs' && addonId && ADDON_DOCS[addonId]) {
      const addon = ADDON_DOCS[addonId];
      amountPaise = usdToPaise(addon.price);
      metadata.type = 'addon_docs';
      metadata.docs = addon.docs;
    } else if (type === 'addon_credits' && addonId && ADDON_CREDITS[addonId]) {
      const addon = ADDON_CREDITS[addonId];
      amountPaise = usdToPaise(addon.price);
      metadata.type = 'addon_credits';
      metadata.credits = addon.credits;
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

export default router;
