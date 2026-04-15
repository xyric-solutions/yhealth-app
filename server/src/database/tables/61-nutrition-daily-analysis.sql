-- ============================================
-- NUTRITION DAILY ANALYSIS TABLE
-- ============================================
-- Stores automated daily nutrition analysis results
-- Tracks deviation from targets and AI insights

DROP TABLE IF EXISTS nutrition_daily_analysis CASCADE;
CREATE TABLE nutrition_daily_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diet_plan_id UUID REFERENCES diet_plans(id) ON DELETE SET NULL,

    -- Analysis date (one entry per user per day)
    analysis_date DATE NOT NULL,

    -- Targets for the day
    target_calories INTEGER NOT NULL,
    target_protein_g INTEGER,
    target_carbs_g INTEGER,
    target_fat_g INTEGER,

    -- Actual intake (aggregated from meal_logs)
    actual_calories INTEGER DEFAULT 0,
    actual_protein_g FLOAT DEFAULT 0,
    actual_carbs_g FLOAT DEFAULT 0,
    actual_fat_g FLOAT DEFAULT 0,
    meals_logged INTEGER DEFAULT 0,

    -- Deviation analysis
    calorie_deviation INTEGER,                      -- positive = over, negative = under
    deviation_percentage DECIMAL(5,2),              -- percentage deviation from target
    deviation_classification VARCHAR(30),           -- 'on_target', 'minor_under', 'significant_under', 'severe_under', 'minor_over', 'significant_over', 'severe_over', 'missed_day'

    -- WHOOP context factors (from health_data_records)
    whoop_workout_calories INTEGER,                 -- Calories burned from WHOOP workouts
    whoop_recovery_score INTEGER,                   -- 0-100
    whoop_strain_score DECIMAL(4,1),                -- 0-21

    -- User feedback (optional - why deviation happened)
    deviation_reason VARCHAR(50),                   -- 'intentional', 'unintentional', 'sick', 'social_event', 'forgot', 'busy', 'travel', 'stress'
    user_notes TEXT,

    -- AI analysis
    ai_analysis TEXT,                               -- Aurea's analysis of the day
    ai_recommendations JSONB DEFAULT '[]',          -- Array of recommendations [{type, message, priority}]

    -- Status
    status VARCHAR(20) DEFAULT 'analyzed',          -- 'analyzed', 'pending_user_input', 'adjustment_created', 'dismissed'
    adjustment_created BOOLEAN DEFAULT false,
    notification_sent BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One analysis per user per day
    UNIQUE(user_id, analysis_date)
);

-- Indexes for common queries
CREATE INDEX idx_nutrition_analysis_user_date ON nutrition_daily_analysis(user_id, analysis_date DESC);
CREATE INDEX idx_nutrition_analysis_status ON nutrition_daily_analysis(user_id, status);
CREATE INDEX idx_nutrition_analysis_deviation ON nutrition_daily_analysis(user_id, deviation_classification);
CREATE INDEX idx_nutrition_analysis_recent ON nutrition_daily_analysis(user_id, created_at DESC) WHERE status != 'dismissed';
