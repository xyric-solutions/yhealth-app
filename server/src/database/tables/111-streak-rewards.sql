-- ============================================
-- STREAK REWARDS TABLE
-- ============================================
-- Reward definitions for streak milestone tiers.
-- Seeded on startup; milestone_days is unique.

CREATE TABLE IF NOT EXISTS streak_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    milestone_days INTEGER NOT NULL UNIQUE,
    tier_name VARCHAR(30) NOT NULL,
    reward_type VARCHAR(30) NOT NULL,          -- 'badge', 'badge_freeze', 'badge_title', 'badge_freeze_title'
    xp_bonus INTEGER NOT NULL DEFAULT 0,
    freezes_earned INTEGER NOT NULL DEFAULT 0,
    title_unlocked VARCHAR(50),
    badge_icon VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed reward tiers
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
