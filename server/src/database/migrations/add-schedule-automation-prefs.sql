-- ============================================
-- MIGRATION: Add Schedule Automation Preferences
-- ============================================
-- Adds columns for AI Coach schedule automation settings

-- Add schedule automation preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS schedule_automation_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS schedule_reminder_minutes INTEGER DEFAULT 5;

-- Comments
COMMENT ON COLUMN user_preferences.schedule_automation_enabled IS 'Enable/disable AI schedule reminders from the AI Coach';
COMMENT ON COLUMN user_preferences.schedule_reminder_minutes IS 'Minutes before activity to send reminder (user configurable)';
