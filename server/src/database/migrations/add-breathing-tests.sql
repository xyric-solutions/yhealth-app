-- ============================================
-- BREATHING TESTS MIGRATION
-- ============================================
-- Adds breathing_tests table for lung health tracking
-- Part of Wellbeing module (F7.x)

-- ============================================
-- BREATHING TESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS breathing_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Test Configuration
    test_type VARCHAR(50) NOT NULL DEFAULT 'breath_hold',  -- breath_hold, box_breathing, 4-7-8, custom
    pattern_name VARCHAR(100),

    -- Test Results
    breath_hold_duration_seconds DECIMAL(6,2),  -- How long they held breath (for breath_hold tests)
    total_cycles_completed INTEGER DEFAULT 0,    -- Number of breathing cycles completed
    total_duration_seconds INTEGER NOT NULL,     -- Total test duration

    -- Performance Metrics
    average_inhale_duration DECIMAL(5,2),
    average_exhale_duration DECIMAL(5,2),
    average_hold_duration DECIMAL(5,2),
    consistency_score INTEGER,  -- 0-100 (how consistent timing was across cycles)

    -- User Feedback
    difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
    notes TEXT,

    -- Calculated Health Indicators
    lung_capacity_estimate VARCHAR(20),  -- poor, fair, good, excellent
    improvement_from_baseline DECIMAL(5,2),  -- percentage improvement from first test

    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary lookup: user's tests sorted by completion date
CREATE INDEX IF NOT EXISTS idx_breathing_tests_user ON breathing_tests(user_id, completed_at DESC);

-- Filter by test type
CREATE INDEX IF NOT EXISTS idx_breathing_tests_type ON breathing_tests(user_id, test_type);

-- Date-based queries for timeline/charts
CREATE INDEX IF NOT EXISTS idx_breathing_tests_date ON breathing_tests(DATE(completed_at));

-- User with date range for analytics
CREATE INDEX IF NOT EXISTS idx_breathing_tests_user_date ON breathing_tests(user_id, DATE(completed_at) DESC);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
