-- ============================================
-- VISION TEST SESSIONS TABLE
-- ============================================
-- Stores each color vision test or eye exercise session
-- Part of Wellbeing module — Vision Health

CREATE TABLE IF NOT EXISTS vision_test_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Test Configuration
    test_type VARCHAR(30) NOT NULL,           -- 'color_vision_quick', 'color_vision_advanced', 'eye_exercise'
    difficulty VARCHAR(20) NOT NULL DEFAULT 'standard',  -- 'quick', 'standard', 'advanced'
    total_plates INTEGER NOT NULL DEFAULT 10,

    -- Results
    correct_count INTEGER DEFAULT 0,
    accuracy_percentage NUMERIC(5,2) DEFAULT 0,
    average_response_time_ms INTEGER,
    total_duration_seconds INTEGER,

    -- Classification
    vision_classification VARCHAR(30),        -- 'normal', 'protan_weak', 'protan_strong', 'deutan_weak', etc.
    confidence_score NUMERIC(5,2),            -- 0-100

    -- Eye Exercise fields (when test_type = 'eye_exercise')
    exercise_type VARCHAR(30),                -- 'trataka', 'eye_circles', 'focus_shift', 'palming'
    exercise_duration_seconds INTEGER,

    -- Anti-cheat
    plate_seed VARCHAR(64),                   -- seed for plate randomization

    -- User Feedback
    notes TEXT,
    mood_before SMALLINT CHECK (mood_before >= 1 AND mood_before <= 10),
    mood_after SMALLINT CHECK (mood_after >= 1 AND mood_after <= 10),

    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vision_sessions_user ON vision_test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_vision_sessions_type ON vision_test_sessions(test_type);
CREATE INDEX IF NOT EXISTS idx_vision_sessions_user_date ON vision_test_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vision_sessions_classification ON vision_test_sessions(vision_classification) WHERE vision_classification IS NOT NULL;
