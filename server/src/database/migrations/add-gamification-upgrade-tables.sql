-- ============================================
-- Migration: Gamification Upgrade Tables
-- ============================================
-- Description: Variable rewards, daily pledges, teams, team members,
-- achievement definitions, and user achievements.

-- Variable reward drops (probabilistic rewards after activity completion)
CREATE TABLE IF NOT EXISTS variable_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_type VARCHAR(30) NOT NULL,
    reward_value JSONB NOT NULL,
    trigger_event VARCHAR(50) NOT NULL,
    probability NUMERIC(4,3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vr_user_date ON variable_rewards(user_id, created_at DESC);

-- Daily micro-commitments (pledges)
CREATE TABLE IF NOT EXISTS daily_pledges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    pledge_text TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,
    target_value NUMERIC(10,2),
    actual_value NUMERIC(10,2),
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date, category)
);
CREATE INDEX IF NOT EXISTS idx_dp_user_date ON daily_pledges(user_id, date DESC);

-- Teams for social accountability
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'accountability' CHECK (type IN ('accountability', 'competition')),
    max_members INTEGER DEFAULT 5,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('captain', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tm_user ON team_members(user_id);

-- Achievement tree definitions (5 trees x 5 tiers = 25)
CREATE TABLE IF NOT EXISTS achievement_definitions (
    id VARCHAR(50) PRIMARY KEY,
    tree VARCHAR(30) NOT NULL CHECK (tree IN ('consistency', 'strength', 'nutrition', 'recovery', 'social')),
    tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    requirement JSONB NOT NULL,
    xp_reward INTEGER NOT NULL,
    badge_icon VARCHAR(50),
    prerequisite_id VARCHAR(50) REFERENCES achievement_definitions(id)
);

-- User achievement progress tracking
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL REFERENCES achievement_definitions(id),
    progress NUMERIC(5,2) DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    unlocked_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_ua_user ON user_achievements(user_id);
