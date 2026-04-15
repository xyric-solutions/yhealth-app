-- ============================================
-- MIGRATION: Add product_tour_completed to user_preferences
-- ============================================
-- Tracks whether the user has completed or skipped the product tour walkthrough

-- Add product_tour_completed column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_preferences'
        AND column_name = 'product_tour_completed'
    ) THEN
        ALTER TABLE user_preferences
        ADD COLUMN product_tour_completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add product_tour_completed_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_preferences'
        AND column_name = 'product_tour_completed_at'
    ) THEN
        ALTER TABLE user_preferences
        ADD COLUMN product_tour_completed_at TIMESTAMP;
    END IF;
END $$;

COMMENT ON COLUMN user_preferences.product_tour_completed IS 'Whether user has completed or skipped the product tour';
COMMENT ON COLUMN user_preferences.product_tour_completed_at IS 'When the tour was completed or skipped';
