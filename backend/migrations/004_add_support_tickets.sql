-- Migration 004: Create support_tickets table
-- Run this in your Supabase SQL Editor

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view and create their own tickets
CREATE POLICY "Users can view own tickets" ON support_tickets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tickets" ON support_tickets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all tickets (will be added via service role in backend)

-- Add comment
COMMENT ON TABLE support_tickets IS 'Support ticket system for user issues and requests';
