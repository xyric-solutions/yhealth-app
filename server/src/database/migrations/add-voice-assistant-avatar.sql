-- ============================================
-- MIGRATION: Add voice_assistant_avatar_url to user_preferences
-- ============================================
-- Adds support for custom voice assistant avatars

-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_preferences' 
        AND column_name = 'voice_assistant_avatar_url'
    ) THEN
        ALTER TABLE user_preferences 
        ADD COLUMN voice_assistant_avatar_url VARCHAR(500);
    END IF;
END $$;

