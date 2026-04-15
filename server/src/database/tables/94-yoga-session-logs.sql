-- ============================================
-- YOGA SESSION LOGS TABLE
-- ============================================
-- Records every completed (or attempted) yoga/meditation session
-- Part of Wellbeing module (F7.9)

DROP TABLE IF EXISTS yoga_session_logs CASCADE;
CREATE TABLE yoga_session_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES yoga_sessions(id) ON DELETE SET NULL,

    -- Session Classification
    session_type VARCHAR(50) NOT NULL,
    meditation_mode VARCHAR(50),

    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    actual_duration_seconds INTEGER,

    -- Completion
    completion_rate DECIMAL(5,2),        -- 0.00 - 100.00
    phases_completed INTEGER DEFAULT 0,
    phases_total INTEGER DEFAULT 0,

    -- User Feedback
    mood_before SMALLINT CHECK (mood_before >= 1 AND mood_before <= 10),
    mood_after SMALLINT CHECK (mood_after >= 1 AND mood_after <= 10),
    difficulty_rating SMALLINT CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
    effectiveness_rating SMALLINT CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 10),
    notes TEXT,

    -- Feature Usage
    voice_guide_used BOOLEAN DEFAULT false,
    music_played BOOLEAN DEFAULT false,
    pose_correction_used BOOLEAN DEFAULT false,

    -- Health Data Snapshot
    pre_session_hrv DECIMAL(6,2),
    recovery_score_at_time DECIMAL(5,2),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_yoga_logs_user_date ON yoga_session_logs(user_id, completed_at DESC);
CREATE INDEX idx_yoga_logs_type ON yoga_session_logs(session_type);
CREATE INDEX idx_yoga_logs_user_started ON yoga_session_logs(user_id, started_at DESC);
CREATE INDEX idx_yoga_logs_completed ON yoga_session_logs(user_id, completed_at DESC) WHERE completed_at IS NOT NULL;
