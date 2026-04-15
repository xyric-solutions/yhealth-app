-- ============================================
-- SHOPPING LIST TABLE
-- ============================================
-- User shopping list with manual and AI-generated items

DROP TABLE IF EXISTS shopping_list_items CASCADE;
CREATE TABLE shopping_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Item details
    name VARCHAR(200) NOT NULL,
    quantity VARCHAR(50),                        -- "2 lbs", "500g", "1 bunch"
    category VARCHAR(50),                        -- 'produce', 'protein', 'dairy', 'grains', 'pantry', 'other'
    notes TEXT,                                  -- Additional notes
    calories INTEGER,                            -- Calories per item/portion (optional)

    -- Source tracking
    source VARCHAR(50) DEFAULT 'manual',         -- 'manual', 'ai_generated', 'diet_plan'
    source_description TEXT,                     -- AI prompt or diet plan name

    -- Status
    is_purchased BOOLEAN DEFAULT false,
    purchased_at TIMESTAMP,

    -- Priority
    priority INTEGER DEFAULT 0,                  -- Higher = more important

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_shopping_list_user ON shopping_list_items(user_id, is_purchased);
CREATE INDEX idx_shopping_list_category ON shopping_list_items(user_id, category);
CREATE INDEX idx_shopping_list_created ON shopping_list_items(user_id, created_at DESC);
