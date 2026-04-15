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
