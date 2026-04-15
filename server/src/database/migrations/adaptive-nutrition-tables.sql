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
-- ============================================
-- NUTRITION USER PREFERENCES TABLE
-- ============================================
-- User-specific settings for adaptive nutrition coaching
-- Controls analysis timing, adjustment behavior, notifications

DROP TABLE IF EXISTS nutrition_user_preferences CASCADE;
CREATE TABLE nutrition_user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Analysis scheduling
    analysis_time VARCHAR(5) DEFAULT '21:00',       -- Time for daily analysis (HH:MM in user's local timezone)
    analysis_enabled BOOLEAN DEFAULT true,          -- Master switch for daily analysis

    -- Adjustment preferences
    auto_adjust_enabled BOOLEAN DEFAULT true,       -- Automatically propose adjustments
    max_daily_adjustment_calories INTEGER DEFAULT 200, -- Max calories to add/subtract in one day
    max_redistribution_days INTEGER DEFAULT 3,      -- Max days to spread adjustment
    prefer_next_day_adjustment BOOLEAN DEFAULT false, -- Prefer adjusting next day vs spreading

    -- Adjustment strategy
    adjustment_strategy VARCHAR(30) DEFAULT 'balanced', -- 'aggressive', 'balanced', 'conservative'
    -- aggressive: compensate fully, short timeframe
    -- balanced: partial compensation, medium timeframe
    -- conservative: minimal compensation, prioritize consistency

    -- Notification preferences
    notify_on_deviation BOOLEAN DEFAULT true,       -- Send notification when deviation detected
    deviation_threshold_percent DECIMAL(5,2) DEFAULT 15.0, -- Only notify if deviation > X%
    notify_on_pattern_detected BOOLEAN DEFAULT true, -- Notify when new pattern identified
    notification_channel VARCHAR(20) DEFAULT 'push', -- 'push', 'in_app', 'both', 'none'

    -- WHOOP integration preferences
    factor_workout_calories BOOLEAN DEFAULT true,   -- Adjust targets based on WHOOP workout burn
    workout_calorie_addback_percent INTEGER DEFAULT 60, -- % of workout calories to add back (50-70%)
    skip_if_recovery_below INTEGER DEFAULT 40,      -- Skip adjustments if WHOOP recovery below this
    increase_carbs_on_high_strain BOOLEAN DEFAULT true, -- Auto-increase carbs on high strain days

    -- Safety overrides
    min_calories_override INTEGER,                  -- User-set minimum (must be >= system minimum)
    max_calories_override INTEGER,                  -- User-set maximum

    -- Learning preferences
    allow_pattern_learning BOOLEAN DEFAULT true,    -- Enable pattern detection
    share_deviation_feedback BOOLEAN DEFAULT true,  -- Allow providing reasons for deviations

    -- UI preferences
    show_daily_insights BOOLEAN DEFAULT true,       -- Show insights widget on dashboard
    show_adjustment_card BOOLEAN DEFAULT true,      -- Show adjustment proposals
    show_patterns_chart BOOLEAN DEFAULT true,       -- Show adherence patterns visualization
    insights_detail_level VARCHAR(20) DEFAULT 'standard', -- 'minimal', 'standard', 'detailed'

    -- Coaching tone preference
    coaching_tone VARCHAR(20) DEFAULT 'supportive', -- 'direct', 'supportive', 'celebratory'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_nutrition_prefs_user ON nutrition_user_preferences(user_id);
CREATE INDEX idx_nutrition_prefs_enabled ON nutrition_user_preferences(user_id) WHERE analysis_enabled = true;
