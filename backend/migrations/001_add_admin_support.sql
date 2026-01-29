-- Migration 001: Add admin support to profiles table
-- Run this in your Supabase SQL Editor

-- Add is_admin column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);

-- Add comment
COMMENT ON COLUMN profiles.is_admin IS 'Whether this user has admin privileges';
