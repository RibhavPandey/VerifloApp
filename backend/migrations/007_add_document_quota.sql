-- Migration 007: Add document quota and payment tracking
-- Run this in your Supabase SQL Editor

-- Add document quota columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS documents_used INTEGER DEFAULT 0;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS monthly_documents_reset_at TIMESTAMP;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS credits_expires_at TIMESTAMP;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_id TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;

-- Add comments
COMMENT ON COLUMN profiles.documents_used IS 'Documents extracted in current billing period';
COMMENT ON COLUMN profiles.monthly_documents_reset_at IS 'When document quota was last reset';
COMMENT ON COLUMN profiles.credits_expires_at IS 'When credit pack credits expire (30 days from purchase)';
COMMENT ON COLUMN profiles.subscription_id IS 'Razorpay subscription ID for recurring billing';
COMMENT ON COLUMN profiles.razorpay_customer_id IS 'Razorpay customer ID';

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  type TEXT NOT NULL CHECK (type IN ('subscription', 'addon_docs', 'addon_credits', 'intro_offer')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
