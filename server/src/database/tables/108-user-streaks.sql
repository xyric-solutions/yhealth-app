-- ============================================
-- USER STREAKS TABLE
-- ============================================
-- Central streak state for the unified master streak system.
-- Replaces scattered streak tracking on users table.
-- Part of Streaks & Gamification feature.

CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Streak state
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    streak_started_at DATE,
    total_active_days INTEGER NOT NULL DEFAULT 0,

    -- Freeze economy
    freezes_available INTEGER NOT NULL DEFAULT 0 CHECK (freezes_available >= 0 AND freezes_available <= 3),
    freezes_used_total INTEGER NOT NULL DEFAULT 0,
    last_freeze_date DATE,

    -- User timezone for midnight calculations
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_timezone ON user_streaks(timezone);
CREATE INDEX IF NOT EXISTS idx_user_streaks_last_activity ON user_streaks(last_activity_date);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current ON user_streaks(current_streak DESC);
