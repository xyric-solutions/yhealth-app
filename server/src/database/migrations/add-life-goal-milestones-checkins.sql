-- ============================================
-- LIFE GOAL MILESTONES & CHECK-INS
-- ============================================
-- Adds active tracking for life goals beyond journal mentions

-- Expand category constraint to include new life goal categories
ALTER TABLE life_goals DROP CONSTRAINT IF EXISTS life_goals_category_check;
ALTER TABLE life_goals ADD CONSTRAINT life_goals_category_check CHECK (category IN (
    'spiritual', 'social', 'productivity', 'happiness',
    'anxiety_management', 'creative', 'personal_growth',
    'financial', 'faith', 'relationships', 'education',
    'career', 'health_wellness', 'custom'
));

-- ============================================
-- LIFE GOAL MILESTONES TABLE
-- ============================================
-- Structured milestones within a life goal for step-by-step progress

CREATE TABLE IF NOT EXISTS life_goal_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    life_goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Milestone definition
    title VARCHAR(200) NOT NULL,
    description TEXT,
    target_date DATE,

    -- Optional numeric tracking
    target_value FLOAT,
    current_value FLOAT DEFAULT 0,

    -- Status
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_life_goal_milestones_goal ON life_goal_milestones(life_goal_id);
CREATE INDEX IF NOT EXISTS idx_life_goal_milestones_user ON life_goal_milestones(user_id);

-- ============================================
-- LIFE GOAL CHECK-INS TABLE
-- ============================================
-- Active progress check-ins for life goals (not just journal mentions)

CREATE TABLE IF NOT EXISTS life_goal_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    life_goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Check-in data
    checkin_date DATE NOT NULL,
    progress_value FLOAT,       -- numeric progress if applicable
    note TEXT,                   -- free-text reflection
    mood_about_goal INTEGER CHECK (mood_about_goal BETWEEN 1 AND 5),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One check-in per goal per day
    UNIQUE(life_goal_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_life_goal_checkins_goal ON life_goal_checkins(life_goal_id);
CREATE INDEX IF NOT EXISTS idx_life_goal_checkins_user_date ON life_goal_checkins(user_id, checkin_date DESC);
