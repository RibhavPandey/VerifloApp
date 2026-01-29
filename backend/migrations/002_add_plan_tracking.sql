-- Migration 002: Add subscription plan tracking
-- Run this in your Supabase SQL Editor

-- Add subscription_plan column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';

-- Add monthly_credits_reset_at column for tracking credit resets
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS monthly_credits_reset_at TIMESTAMP;

-- Add index for plan lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan ON profiles(subscription_plan);

-- Add comments
COMMENT ON COLUMN profiles.subscription_plan IS 'User subscription plan: free, starter, pro, enterprise';
COMMENT ON COLUMN profiles.monthly_credits_reset_at IS 'Timestamp when monthly credits were last reset';
