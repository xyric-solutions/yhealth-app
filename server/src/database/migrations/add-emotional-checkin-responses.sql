-- Migration: Add emotional_checkin_responses table for explicit response tracking
-- Created: 2024-01-29
-- Purpose: Store individual responses for audit trail, analytics, and pattern analysis

-- ============================================
-- RESPONSES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS emotional_checkin_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES emotional_checkin_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Question data
  question_index INTEGER NOT NULL,
  question_id VARCHAR(100) NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('scale', 'frequency', 'text')),
  question_category VARCHAR(50), -- anxiety, mood, energy, sleep, focus, etc.

  -- Response data
  response_value DECIMAL(5,2), -- For scale/frequency (0-10 or mapped value)
  response_text TEXT, -- For text questions or additional context
  response_raw VARCHAR(255), -- Original response (e.g., "often", "7")

  -- Analysis
  sentiment_score DECIMAL(3,2), -- -1 to 1 (negative to positive)
  crisis_flag BOOLEAN DEFAULT FALSE,
  crisis_severity VARCHAR(20), -- low, medium, high, critical

  -- Timestamps
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(session_id, question_index)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_checkin_responses_session
  ON emotional_checkin_responses(session_id);

CREATE INDEX IF NOT EXISTS idx_checkin_responses_user
  ON emotional_checkin_responses(user_id, responded_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkin_responses_category
  ON emotional_checkin_responses(user_id, question_category, responded_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkin_responses_crisis
  ON emotional_checkin_responses(user_id, crisis_flag)
  WHERE crisis_flag = TRUE;

-- ============================================
-- ADD COLUMNS TO SESSIONS TABLE
-- ============================================

-- Add camera analysis data column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emotional_checkin_sessions'
    AND column_name = 'camera_analysis'
  ) THEN
    ALTER TABLE emotional_checkin_sessions
    ADD COLUMN camera_analysis JSONB;
  END IF;
END $$;

-- Add session recovery columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emotional_checkin_sessions'
    AND column_name = 'expired_at'
  ) THEN
    ALTER TABLE emotional_checkin_sessions
    ADD COLUMN expired_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emotional_checkin_sessions'
    AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE emotional_checkin_sessions
    ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add overall scores columns if not exist (for energy, stress, sleep, focus)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emotional_checkin_sessions'
    AND column_name = 'overall_energy_score'
  ) THEN
    ALTER TABLE emotional_checkin_sessions
    ADD COLUMN overall_energy_score DECIMAL(3,1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emotional_checkin_sessions'
    AND column_name = 'overall_stress_score'
  ) THEN
    ALTER TABLE emotional_checkin_sessions
    ADD COLUMN overall_stress_score DECIMAL(3,1);
  END IF;
END $$;

-- Index for session recovery (find incomplete sessions)
CREATE INDEX IF NOT EXISTS idx_checkin_sessions_incomplete
  ON emotional_checkin_sessions(user_id, started_at DESC)
  WHERE completed_at IS NULL AND expired_at IS NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE emotional_checkin_responses IS 'Stores individual responses from emotional check-in sessions for audit trail and analytics';
COMMENT ON COLUMN emotional_checkin_responses.question_category IS 'Category of question: anxiety, mood, energy, sleep, focus, irritability, overwhelm, panic, interest';
COMMENT ON COLUMN emotional_checkin_responses.sentiment_score IS 'Sentiment analysis score from -1 (very negative) to 1 (very positive)';
COMMENT ON COLUMN emotional_checkin_responses.crisis_flag IS 'Whether this response triggered crisis detection';
