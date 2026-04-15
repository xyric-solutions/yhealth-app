-- ============================================
-- ASSESSMENT RESPONSES TABLE
-- ============================================
-- User responses to assessments (quick/deep)

DROP TABLE IF EXISTS assessment_responses CASCADE;
CREATE TABLE assessment_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_type assessment_type NOT NULL,
    goal_category goal_category NOT NULL,

    -- Responses
    responses JSONB DEFAULT '[]',

    -- Deep assessment conversation
    conversation_transcript JSONB,

    -- Extracted insights
    extracted_insights JSONB,

    -- Baseline data
    baseline_data JSONB DEFAULT '{}',

    -- Body stats
    body_stats JSONB,

    -- Status
    is_complete BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    time_spent_seconds INTEGER,

    -- Mode switch tracking
    switched_from_mode assessment_type,
    switched_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_assessment_responses_user_complete ON assessment_responses(user_id, is_complete);
CREATE INDEX idx_assessment_responses_user_type ON assessment_responses(user_id, assessment_type);
