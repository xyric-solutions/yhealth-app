-- ============================================
-- STREAK FREEZE LOG TABLE
-- ============================================
-- Audit trail for streak freeze usage (earned or purchased).
-- UNIQUE constraint on (user_id, freeze_date) prevents double-freeze per day.

CREATE TABLE IF NOT EXISTS streak_freeze_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    freeze_date DATE NOT NULL,
    source VARCHAR(30) NOT NULL,              -- 'milestone_7', 'milestone_30', 'milestone_90', 'xp_purchase', 'auto_applied'
    xp_cost INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, freeze_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_streak_freeze_user ON streak_freeze_log(user_id, freeze_date DESC);
