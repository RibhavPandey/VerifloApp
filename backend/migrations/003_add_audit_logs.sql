-- Migration 003: Create audit_logs table
-- Run this in your Supabase SQL Editor

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert audit logs (for backend)
-- Note: This requires service role key, which is fine for backend operations

-- Add comment
COMMENT ON TABLE audit_logs IS 'Audit log for tracking user actions and system events';
