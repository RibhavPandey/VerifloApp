-- Migration 008: Add DodoPayments support to payments table
-- Run in Supabase SQL Editor

ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'razorpay';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS dodo_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_dodo_session ON payments(dodo_session_id) WHERE dodo_session_id IS NOT NULL;
