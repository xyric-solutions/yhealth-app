-- ============================================
-- MEAL LOGS TABLE
-- ============================================
-- Track actual meals eaten with nutrition info

DROP TABLE IF EXISTS meal_logs CASCADE;
CREATE TABLE meal_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diet_plan_id UUID REFERENCES diet_plans(id) ON DELETE SET NULL,

    -- Meal details
    meal_type VARCHAR(50) NOT NULL,           -- 'breakfast', 'lunch', 'dinner', 'snack'
    meal_name VARCHAR(200),
    description TEXT,

    -- Nutrition info
    calories INTEGER,
    protein_grams FLOAT,
    carbs_grams FLOAT,
    fat_grams FLOAT,
    fiber_grams FLOAT,

    -- Foods eaten
    foods JSONB DEFAULT '[]',                 -- [{name, portion, calories, etc.}]

    -- Photo (optional)
    photo_url VARCHAR(500),

    -- Time
    eaten_at TIMESTAMP NOT NULL,

    -- Mood & notes
    hunger_before INTEGER,                    -- 1-5 scale
    satisfaction_after INTEGER,               -- 1-5 scale
    notes TEXT,

    -- AI analysis
    ai_feedback TEXT,
    health_score INTEGER,                     -- 1-100

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_meal_logs_user_date ON meal_logs(user_id, eaten_at DESC);
CREATE INDEX idx_meal_logs_user_type ON meal_logs(user_id, meal_type);
