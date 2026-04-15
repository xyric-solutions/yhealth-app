-- ============================================
-- STREAK SYSTEM MIGRATION
-- ============================================
-- Run this to add streak tables to an existing database.
-- All statements are idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- 1. User Streaks (central state)
CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    streak_started_at DATE,
    total_active_days INTEGER NOT NULL DEFAULT 0,
    freezes_available INTEGER NOT NULL DEFAULT 0 CHECK (freezes_available >= 0 AND freezes_available <= 3),
    freezes_used_total INTEGER NOT NULL DEFAULT 0,
    last_freeze_date DATE,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_timezone ON user_streaks(timezone);
CREATE INDEX IF NOT EXISTS idx_user_streaks_last_activity ON user_streaks(last_activity_date);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current ON user_streaks(current_streak DESC);

-- 2. Streak Activity Log (audit trail)
CREATE TABLE IF NOT EXISTS streak_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(100),
    streak_day INTEGER NOT NULL,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, activity_date, activity_type)
);
CREATE INDEX IF NOT EXISTS idx_streak_activity_user_date ON streak_activity_log(user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_streak_activity_date ON streak_activity_log(activity_date);

-- 3. Streak Freeze Log
CREATE TABLE IF NOT EXISTS streak_freeze_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    freeze_date DATE NOT NULL,
    source VARCHAR(30) NOT NULL,
    xp_cost INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, freeze_date)
);
CREATE INDEX IF NOT EXISTS idx_streak_freeze_user ON streak_freeze_log(user_id, freeze_date DESC);

-- 4. Streak Rewards (seed data)
CREATE TABLE IF NOT EXISTS streak_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    milestone_days INTEGER NOT NULL UNIQUE,
    tier_name VARCHAR(30) NOT NULL,
    reward_type VARCHAR(30) NOT NULL,
    xp_bonus INTEGER NOT NULL DEFAULT 0,
    freezes_earned INTEGER NOT NULL DEFAULT 0,
    title_unlocked VARCHAR(50),
    badge_icon VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO streak_rewards (milestone_days, tier_name, reward_type, xp_bonus, freezes_earned, title_unlocked, badge_icon) VALUES
    (3,   'Spark',        'badge',              25,    0, NULL,               'spark'),
    (7,   'Flame',        'badge_freeze',       100,   1, 'Week Warrior',     'flame'),
    (14,  'Blaze',        'badge_title',        200,   0, 'Fortnight Fighter','blaze'),
    (30,  'Inferno',      'badge_freeze_title', 500,   1, 'Month Master',    'inferno'),
    (60,  'Wildfire',     'badge_title',        1000,  0, 'Sixty Strong',    'wildfire'),
    (90,  'Supernova',    'badge_freeze_title', 2000,  1, 'Streak Legend',   'supernova'),
    (180, 'Phoenix',      'badge_title',        5000,  0, 'Half-Year Hero',  'phoenix'),
    (365, 'Eternal Flame','badge_title',        10000, 0, 'Year of Fire',    'eternal')
ON CONFLICT (milestone_days) DO NOTHING;
