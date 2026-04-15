-- ============================================
-- Migration: Add calories field to shopping_list_items
-- ============================================
-- Adds optional calories field to track nutritional information per item

ALTER TABLE shopping_list_items
ADD COLUMN IF NOT EXISTS calories INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN shopping_list_items.calories IS 'Calories per item/portion (optional)';

