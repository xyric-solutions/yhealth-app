-- ============================================
-- USER RECIPES TABLE
-- ============================================
-- Custom recipes created by users

DROP TABLE IF EXISTS user_recipes CASCADE;
CREATE TABLE user_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Recipe details
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'other',  -- breakfast, lunch, dinner, snack, dessert, other
    cuisine VARCHAR(100),                   -- italian, mexican, asian, etc.

    -- Nutritional information (per serving)
    servings INTEGER DEFAULT 1,
    calories_per_serving INTEGER,
    protein_grams INTEGER,
    carbs_grams INTEGER,
    fat_grams INTEGER,
    fiber_grams INTEGER,

    -- Recipe content
    ingredients JSONB DEFAULT '[]',         -- [{name, quantity, unit, notes}]
    instructions JSONB DEFAULT '[]',        -- [{step, description}]

    -- Time info
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    total_time_minutes INTEGER,

    -- Tags and preferences
    tags JSONB DEFAULT '[]',                -- ['high-protein', 'low-carb', 'quick', etc.]
    dietary_flags JSONB DEFAULT '[]',       -- ['vegetarian', 'vegan', 'gluten-free', etc.]

    -- Media
    image_url VARCHAR(500),

    -- Ratings
    difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
    rating INTEGER,                          -- user's own rating 1-5
    times_made INTEGER DEFAULT 0,

    -- Favorites
    is_favorite BOOLEAN DEFAULT false,

    -- Source
    source VARCHAR(100),                     -- 'user', 'ai_generated', 'imported'
    source_url VARCHAR(500),                 -- if imported from web

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_user_recipes_user ON user_recipes(user_id);
CREATE INDEX idx_user_recipes_category ON user_recipes(user_id, category);
CREATE INDEX idx_user_recipes_favorite ON user_recipes(user_id) WHERE is_favorite = true;
