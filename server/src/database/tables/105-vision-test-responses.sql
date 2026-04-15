-- ============================================
-- VISION TEST RESPONSES TABLE
-- ============================================
-- Stores individual plate responses within a vision test session

CREATE TABLE IF NOT EXISTS vision_test_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vision_test_sessions(id) ON DELETE CASCADE,

    -- Plate Data
    plate_index INTEGER NOT NULL,             -- 0-based plate order
    plate_type VARCHAR(20) NOT NULL,          -- 'protan', 'deutan', 'tritan', 'control'
    correct_answer VARCHAR(10) NOT NULL,      -- the embedded character/number

    -- User Response
    user_answer VARCHAR(10),                  -- what the user selected (null if timeout)
    is_correct BOOLEAN DEFAULT false,
    response_time_ms INTEGER,                 -- ms from plate display to answer
    timed_out BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vision_responses_session ON vision_test_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_vision_responses_plate_type ON vision_test_responses(plate_type);
