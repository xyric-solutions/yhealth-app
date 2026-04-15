-- ============================================
-- USER XP TRANSACTIONS TABLE
-- ============================================
-- Tracks all XP earned for gamification

DROP TABLE IF EXISTS user_xp_transactions CASCADE;
CREATE TABLE user_xp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- XP details
    xp_amount INTEGER NOT NULL,
    source_type VARCHAR(50) NOT NULL,              -- 'activity', 'workout', 'meal', 'water', 'streak', 'achievement', 'bonus'
    source_id VARCHAR(100),                        -- Reference to the source (workout_log_id, etc.)

    -- Streak bonus
    streak_day INTEGER,                            -- Which day of the streak
    multiplier FLOAT DEFAULT 1.0,                  -- Streak multiplier applied
    base_xp INTEGER,                               -- XP before multiplier

    -- Description
    description VARCHAR(200),

    -- Running total (denormalized for performance)
    total_after INTEGER,                           -- User's total XP after this transaction
    level_after INTEGER,                           -- User's level after this transaction

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_xp_transactions_user ON user_xp_transactions(user_id, created_at DESC);
CREATE INDEX idx_xp_transactions_source ON user_xp_transactions(user_id, source_type);
CREATE INDEX idx_xp_transactions_date ON user_xp_transactions(created_at DESC);
