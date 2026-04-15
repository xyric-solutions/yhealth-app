-- Migration: Add Voice and Schedule Preferences
-- Adds columns for voice customization and AI-initiated call scheduling

-- Add voice customization columns to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS voice_id VARCHAR(50) DEFAULT 'alloy',
ADD COLUMN IF NOT EXISTS speech_pace DECIMAL(3,2) DEFAULT 1.0 CHECK (speech_pace >= 0.5 AND speech_pace <= 2.0),
ADD COLUMN IF NOT EXISTS voice_preview_played BOOLEAN DEFAULT FALSE;

-- Add schedule customization columns
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS quiet_hours_start TIME DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS quiet_hours_end TIME DEFAULT '07:00',
ADD COLUMN IF NOT EXISTS dnd_days INTEGER[] DEFAULT '{}', -- 0=Sunday, 1=Monday, etc.
ADD COLUMN IF NOT EXISTS ai_call_frequency VARCHAR(20) DEFAULT 'moderate' CHECK (ai_call_frequency IN ('off', 'minimal', 'moderate', 'proactive')),
ADD COLUMN IF NOT EXISTS preferred_call_times TIME[] DEFAULT '{}';

-- Create index for efficient quiet hours checking
CREATE INDEX IF NOT EXISTS idx_user_preferences_quiet_hours 
ON user_preferences(quiet_hours_enabled, quiet_hours_start, quiet_hours_end);

-- Comments
COMMENT ON COLUMN user_preferences.voice_id IS 'Selected TTS voice ID (e.g., alloy, echo, fable, onyx, nova, shimmer)';
COMMENT ON COLUMN user_preferences.speech_pace IS 'Speech rate multiplier: 0.5 (slow) to 2.0 (fast), default 1.0';
COMMENT ON COLUMN user_preferences.quiet_hours_enabled IS 'Whether quiet hours are enabled for AI-initiated calls';
COMMENT ON COLUMN user_preferences.quiet_hours_start IS 'Start time for quiet hours (no AI calls)';
COMMENT ON COLUMN user_preferences.quiet_hours_end IS 'End time for quiet hours';
COMMENT ON COLUMN user_preferences.dnd_days IS 'Array of day numbers (0-6) when AI should not initiate calls';
COMMENT ON COLUMN user_preferences.ai_call_frequency IS 'How often AI should initiate check-in calls: off, minimal, moderate, proactive';
COMMENT ON COLUMN user_preferences.preferred_call_times IS 'Array of preferred times for AI-initiated calls';

