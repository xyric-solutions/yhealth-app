-- ============================================
-- MIGRATION: Add Activity Automation Preferences
-- ============================================
-- Adds columns for activity automation settings

-- Add activity automation preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS activity_automation_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_message_style VARCHAR(20) DEFAULT 'friendly' CHECK (ai_message_style IN ('friendly', 'professional', 'motivational'));

-- Comments
COMMENT ON COLUMN user_preferences.activity_automation_enabled IS 'Enable/disable AI automation messages for activity logs from user plans';
COMMENT ON COLUMN user_preferences.ai_message_style IS 'Style of AI messages: friendly, professional, or motivational';

