-- MIGRATION: Add voice_assistant_name to user_preferences
-- This allows users to customize their AI coach name

DO $$
BEGIN
    -- Check if column already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_preferences' 
        AND column_name = 'voice_assistant_name'
    ) THEN
        ALTER TABLE user_preferences 
        ADD COLUMN voice_assistant_name VARCHAR(100) DEFAULT 'Aurea';
        
        COMMENT ON COLUMN user_preferences.voice_assistant_name IS 'Custom name for the AI coach/voice assistant (e.g., "Aurea", "YHealth Coach", user-defined name)';
    END IF;
END $$;

