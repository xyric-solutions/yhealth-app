-- ============================================
-- NUTRITION CALORIE ADJUSTMENTS TABLE
-- ============================================
-- Tracks calorie redistribution plans and user responses
-- Stores adaptive adjustment history for learning

DROP TABLE IF EXISTS nutrition_calorie_adjustments CASCADE;
CREATE TABLE nutrition_calorie_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES nutrition_daily_analysis(id) ON DELETE CASCADE,
    diet_plan_id UUID REFERENCES diet_plans(id) ON DELETE SET NULL,

    -- Adjustment details
    adjustment_type VARCHAR(30) NOT NULL,           -- 'next_day', 'redistribute', 'gradual', 'skip'
    calorie_deficit INTEGER NOT NULL,               -- The deficit/surplus to address (positive = under, negative = over)
    original_deficit INTEGER NOT NULL,              -- Original deficit before any caps applied

    -- Redistribution plan
    redistribution_days INTEGER,                    -- Number of days to spread adjustment
    daily_adjustment INTEGER,                       -- Calories to add/subtract per day
    redistribution_plan JSONB,                      -- {date: adjustment_amount} for each day

    -- Calories that won't be compensated (for large deficits)
    skipped_calories INTEGER DEFAULT 0,
    skip_reason VARCHAR(100),                       -- 'sustainability', 'safety', 'user_choice'

    -- User choice
    user_choice VARCHAR(20),                        -- 'accept', 'modify', 'skip', null (pending)
    user_modified_plan JSONB,                       -- User's modifications if any
    choice_made_at TIMESTAMP,

    -- Health safety validation
    safety_approved BOOLEAN DEFAULT true,
    safety_warnings JSONB DEFAULT '[]',             -- Array of warning messages

    -- AI coaching message
    coaching_message TEXT,                          -- Empathetic explanation from Aurea
    options_presented JSONB,                        -- Options that were presented to user

    -- Status tracking
    status VARCHAR(20) DEFAULT 'proposed',          -- 'proposed', 'accepted', 'active', 'completed', 'skipped', 'expired'
    starts_at DATE,
    ends_at DATE,
    completed_at TIMESTAMP,

    -- Effectiveness tracking (for learning)
    actual_adherence_rate DECIMAL(5,2),             -- How well user followed the adjustment
    effectiveness_score DECIMAL(5,2),               -- Did adjustment help meet goals?

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_calorie_adjustments_user ON nutrition_calorie_adjustments(user_id, created_at DESC);
CREATE INDEX idx_calorie_adjustments_status ON nutrition_calorie_adjustments(user_id, status);
CREATE INDEX idx_calorie_adjustments_active ON nutrition_calorie_adjustments(user_id) WHERE status = 'active';
CREATE INDEX idx_calorie_adjustments_pending ON nutrition_calorie_adjustments(user_id) WHERE user_choice IS NULL AND status = 'proposed';
