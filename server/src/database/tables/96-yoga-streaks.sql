-- ============================================
-- YOGA STREAKS TABLE
-- ============================================
-- Streak tracking and milestone achievements per user
-- Part of Wellbeing module (F7.9)

DROP TABLE IF EXISTS yoga_streaks CASCADE;
CREATE TABLE yoga_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Streak Data
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    last_session_date DATE,

    -- Milestones
    milestones_achieved JSONB DEFAULT '[]',
    -- Format: [{ milestone: "7_day_streak", achievedAt: "2025-03-01T..." }, ...]

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
