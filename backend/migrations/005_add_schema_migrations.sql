-- Migration 005: Create schema_migrations table to track applied migrations
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial migration record (manually applied)
INSERT INTO schema_migrations (version) VALUES ('001_add_admin_support')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('002_add_plan_tracking')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('003_add_audit_logs')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('004_add_support_tickets')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('005_add_schema_migrations')
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE schema_migrations IS 'Tracks which database migrations have been applied';
