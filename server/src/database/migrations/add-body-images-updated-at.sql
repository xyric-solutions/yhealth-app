-- ============================================
-- MIGRATION: Add updated_at column to user_body_images
-- ============================================
-- Adds the missing updated_at column and trigger

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_body_images' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_body_images 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        
        -- Update existing rows to have current timestamp
        UPDATE user_body_images 
        SET updated_at = COALESCE(analyzed_at, created_at, CURRENT_TIMESTAMP)
        WHERE updated_at IS NULL;
    END IF;
END $$;

-- Add trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_user_body_images_updated_at ON user_body_images;
CREATE TRIGGER update_user_body_images_updated_at 
    BEFORE UPDATE ON user_body_images 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

