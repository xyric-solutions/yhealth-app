-- ============================================
-- USER GOALS TABLE
-- ============================================
-- SMART health goals with milestones and tracking

DROP TABLE IF EXISTS user_goals CASCADE;
CREATE TABLE user_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category goal_category NOT NULL,
    custom_goal_text VARCHAR(500),
    pillar health_pillar NOT NULL,
    is_primary BOOLEAN DEFAULT false,

    -- SMART Goal Details
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    target_value FLOAT NOT NULL,
    target_unit VARCHAR(50) NOT NULL,
    current_value FLOAT,
    start_value FLOAT,

    -- Timeline
    start_date DATE NOT NULL,
    target_date DATE NOT NULL,
    duration_weeks INTEGER NOT NULL,

    -- Milestones
    milestones JSONB DEFAULT '[]',

    -- Motivation
    motivation VARCHAR(500) NOT NULL,
    confidence_level SMALLINT NOT NULL,

    -- Status
    status goal_status DEFAULT 'active',
    progress FLOAT DEFAULT 0,

    -- Safety
    is_safety_checked BOOLEAN DEFAULT false,
    safety_warnings TEXT[] DEFAULT '{}',
    requires_doctor_consult BOOLEAN DEFAULT false,

    -- AI Metadata
    ai_suggested BOOLEAN DEFAULT false,
    ai_confidence_score FLOAT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_user_goals_user_status ON user_goals(user_id, status);
CREATE INDEX idx_user_goals_user_primary ON user_goals(user_id, is_primary);
CREATE INDEX idx_user_goals_user_pillar ON user_goals(user_id, pillar);
