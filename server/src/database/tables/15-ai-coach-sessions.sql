-- ============================================
-- AI COACH SESSIONS TABLE
-- ============================================
-- Chat history for personalized coaching and diagnosis

DROP TABLE IF EXISTS ai_coach_sessions CASCADE;
CREATE TABLE ai_coach_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session metadata
    goal_category goal_category NOT NULL,
    session_type VARCHAR(50) DEFAULT 'assessment',  -- 'assessment', 'follow_up', 'plan_review', 'diet_consultation'

    -- Conversation data
    messages JSONB DEFAULT '[]',              -- Array of {role, content, timestamp}
    extracted_insights JSONB DEFAULT '[]',    -- Array of insights extracted
    conversation_phase VARCHAR(50) DEFAULT 'opening',

    -- Status
    status ai_session_status DEFAULT 'active',
    message_count INTEGER DEFAULT 0,
    user_message_count INTEGER DEFAULT 0,

    -- Completion
    is_complete BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,

    -- Plan generated from this session
    generated_plan_id UUID REFERENCES user_plans(id) ON DELETE SET NULL,

    -- Summary for future context
    session_summary TEXT,
    key_takeaways JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_ai_coach_sessions_user ON ai_coach_sessions(user_id, created_at DESC);
CREATE INDEX idx_ai_coach_sessions_user_status ON ai_coach_sessions(user_id, status);
CREATE INDEX idx_ai_coach_sessions_user_goal ON ai_coach_sessions(user_id, goal_category);
CREATE INDEX idx_ai_coach_sessions_active ON ai_coach_sessions(user_id, status) WHERE status = 'active';
