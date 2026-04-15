-- ============================================
-- EMOTIONAL CHECK-IN SESSIONS TABLE
-- ============================================
-- Tracks screening sessions for emotional check-ins

DROP TABLE IF EXISTS emotional_checkin_sessions CASCADE;
CREATE TABLE emotional_checkin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Session metadata
    question_count INTEGER DEFAULT 0,
    screening_type VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (screening_type IN ('light', 'standard', 'deep')),
    
    -- Aggregated scores
    overall_anxiety_score DECIMAL(3,1) CHECK (overall_anxiety_score >= 0 AND overall_anxiety_score <= 10),
    overall_mood_score DECIMAL(3,1) CHECK (overall_mood_score >= 0 AND overall_mood_score <= 10),
    
    -- Risk assessment
    risk_level VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (risk_level IN ('none', 'low', 'moderate', 'high', 'critical')),
    crisis_detected BOOLEAN DEFAULT false,
    
    -- Generated insights and recommendations
    insights JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_emotional_checkin_sessions_user ON emotional_checkin_sessions(user_id, started_at DESC);
CREATE INDEX idx_emotional_checkin_sessions_completed ON emotional_checkin_sessions(user_id, completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_emotional_checkin_sessions_risk ON emotional_checkin_sessions(user_id, risk_level, started_at DESC);
CREATE INDEX idx_emotional_checkin_sessions_type ON emotional_checkin_sessions(user_id, screening_type, started_at DESC);

-- Trigger for updated_at (added to 99-triggers.sql)

