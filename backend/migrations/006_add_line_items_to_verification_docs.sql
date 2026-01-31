-- Migration 006: Add line_items column to verification_docs for invoice line item extraction
-- Run this in your Supabase SQL Editor

ALTER TABLE verification_docs
ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN verification_docs.line_items IS 'Extracted line items: [{description, quantity, unitPrice, lineTotal, confidence}]';
