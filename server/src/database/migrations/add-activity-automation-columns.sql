-- ============================================
-- MIGRATION: Add Automation Tracking Columns to activity_logs
-- ============================================
-- Adds columns to track when automation messages have been sent
-- for activity logs from user plans

-- Add automation tracking columns
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS start_message_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN DEFAULT true;

-- Add index for automation queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_automation_enabled 
  ON activity_logs(user_id, scheduled_date) 
  WHERE automation_enabled = true;

-- Add index for reminder queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_reminder_sent 
  ON activity_logs(user_id, scheduled_date) 
  WHERE reminder_sent_at IS NULL AND automation_enabled = true;

-- Comments
COMMENT ON COLUMN activity_logs.reminder_sent_at IS 'Timestamp when reminder message was sent before activity';
COMMENT ON COLUMN activity_logs.start_message_sent_at IS 'Timestamp when start message was sent at activity time';
COMMENT ON COLUMN activity_logs.followup_sent_at IS 'Timestamp when follow-up message was sent after activity';
COMMENT ON COLUMN activity_logs.automation_enabled IS 'Whether automation messages are enabled for this activity log';

