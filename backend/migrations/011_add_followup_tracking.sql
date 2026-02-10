-- Add follow-up email tracking to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_followup_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followup_stage text DEFAULT 'none';

COMMENT ON COLUMN profiles.last_followup_at IS 'When last follow-up email was sent';
COMMENT ON COLUMN profiles.followup_stage IS 'Follow-up stage: none, day2, day5, day7';
