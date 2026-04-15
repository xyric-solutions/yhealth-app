-- ============================================
-- STREAK ACTIVITY LOG TABLE
-- ============================================
-- Immutable audit trail of daily activities that count toward the streak.
-- UNIQUE constraint on (user_id, activity_date, activity_type) ensures idempotency.

CREATE TABLE IF NOT EXISTS streak_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    activity_type VARCHAR(50) NOT NULL,       -- 'workout', 'yoga', 'meditation', 'ai_chat', 'meal_log', 'mood_checkin', 'breathing', 'journal', 'water', 'daily_checkin'
    source_id VARCHAR(100),                   -- reference to original record
    streak_day INTEGER NOT NULL,              -- which day of the streak this was
    xp_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, activity_date, activity_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_streak_activity_user_date ON streak_activity_log(user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_streak_activity_date ON streak_activity_log(activity_date);
