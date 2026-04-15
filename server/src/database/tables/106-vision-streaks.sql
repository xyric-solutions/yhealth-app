-- ============================================
-- VISION STREAKS TABLE
-- ============================================
-- Tracks vision testing streak and milestone progress per user

CREATE TABLE IF NOT EXISTS vision_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Streak Data
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_exercises INTEGER DEFAULT 0,
    last_session_date DATE,

    -- Milestones
    milestones_achieved JSONB DEFAULT '[]',
    -- Format: [{ "milestone": "first_test", "achievedAt": "2026-03-31T..." }, ...]

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vision_streaks_user ON vision_streaks(user_id);
