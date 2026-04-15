-- ============================================
-- NUTRITION ADHERENCE PATTERNS TABLE
-- ============================================
-- Stores learned behavioral patterns from nutrition tracking
-- Used for personalized coaching and recommendations

DROP TABLE IF EXISTS nutrition_adherence_patterns CASCADE;
CREATE TABLE nutrition_adherence_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Pattern identification
    pattern_type VARCHAR(50) NOT NULL,              -- 'day_of_week', 'meal_type', 'workout_day', 'recovery_level', 'time_of_day', 'streak', 'blocker'
    pattern_key VARCHAR(100) NOT NULL,              -- e.g., 'monday', 'breakfast', 'high_strain_day', 'social_event'

    -- Pattern statistics
    occurrences INTEGER DEFAULT 1,                  -- How many times pattern observed
    total_observations INTEGER DEFAULT 1,           -- Total observations for this category
    success_rate DECIMAL(5,2),                      -- 0-100% on-target rate
    average_deviation DECIMAL(7,2),                 -- Average calorie deviation when pattern occurs
    average_deviation_percent DECIMAL(5,2),         -- Average percentage deviation

    -- Detailed pattern data
    pattern_details JSONB DEFAULT '{}',             -- Flexible storage for pattern-specific data
    -- Examples:
    -- day_of_week: {avg_calories, common_missed_meals, typical_time_of_first_meal}
    -- workout_day: {pre_workout_nutrition, post_workout_nutrition, total_vs_rest_day}
    -- blocker: {trigger, frequency, severity, successful_strategies}

    -- Temporal tracking
    first_observed DATE,
    last_occurrence DATE,
    streak_count INTEGER DEFAULT 0,                 -- Current streak if applicable

    -- AI-generated insights
    ai_insight TEXT,                                -- What Aurea has learned about this pattern
    recommendation TEXT,                            -- Suggested intervention
    intervention_type VARCHAR(50),                  -- 'reminder', 'suggestion', 'adjustment', 'coaching'

    -- Confidence and validity
    confidence_score DECIMAL(5,2) DEFAULT 0,        -- 0-100, how confident we are in this pattern
    min_observations_required INTEGER DEFAULT 3,    -- Minimum observations needed for pattern validity
    is_valid BOOLEAN DEFAULT false,                 -- Pattern has enough data to be actionable
    is_active BOOLEAN DEFAULT true,                 -- Pattern is still relevant

    -- Effectiveness tracking
    interventions_attempted INTEGER DEFAULT 0,
    interventions_successful INTEGER DEFAULT 0,
    intervention_success_rate DECIMAL(5,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One pattern per type+key per user
    UNIQUE(user_id, pattern_type, pattern_key)
);

-- Indexes
CREATE INDEX idx_adherence_patterns_user ON nutrition_adherence_patterns(user_id, is_active);
CREATE INDEX idx_adherence_patterns_type ON nutrition_adherence_patterns(user_id, pattern_type) WHERE is_active = true;
CREATE INDEX idx_adherence_patterns_valid ON nutrition_adherence_patterns(user_id) WHERE is_valid = true AND is_active = true;
CREATE INDEX idx_adherence_patterns_confidence ON nutrition_adherence_patterns(user_id, confidence_score DESC) WHERE is_valid = true;
