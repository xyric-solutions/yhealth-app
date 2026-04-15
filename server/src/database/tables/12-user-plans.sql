-- ============================================
-- USER PLANS TABLE
-- ============================================
-- AI-generated health plans with activities

DROP TABLE IF EXISTS user_plans CASCADE;
CREATE TABLE user_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES user_goals(id) ON DELETE CASCADE,

    -- Plan metadata
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    pillar health_pillar NOT NULL,
    goal_category goal_category NOT NULL,

    -- Duration
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_weeks INTEGER NOT NULL,
    current_week INTEGER DEFAULT 1,

    -- Status
    status plan_status DEFAULT 'draft',
    paused_at TIMESTAMP,
    resumed_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Activities
    activities JSONB DEFAULT '[]',

    -- Weekly focuses
    weekly_focuses JSONB DEFAULT '[]',

    -- AI generation metadata
    ai_generated BOOLEAN DEFAULT true,
    ai_model VARCHAR(50),
    generation_params JSONB,

    -- User adjustments
    user_adjustments JSONB DEFAULT '[]',

    -- Progress
    overall_progress FLOAT DEFAULT 0,
    weekly_completion_rates JSONB DEFAULT '[]',

    -- User feedback
    user_rating SMALLINT,
    user_feedback TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_user_plans_user_status ON user_plans(user_id, status);
CREATE INDEX idx_user_plans_user_goal ON user_plans(user_id, goal_id);
