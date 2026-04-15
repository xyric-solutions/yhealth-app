-- ============================================
-- MEDITATION TIMERS TABLE
-- ============================================
-- Tracks silent timer and nature sounds sessions
-- Part of Wellbeing module (F7.9)

DROP TABLE IF EXISTS meditation_timers CASCADE;
CREATE TABLE meditation_timers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Timer Config
    mode VARCHAR(50) NOT NULL,           -- silent_timer, nature_sounds, mantra
    duration_minutes INTEGER NOT NULL,
    ambient_sound VARCHAR(100),          -- rain, ocean, forest, fire, birds, silence
    interval_bell_seconds INTEGER DEFAULT 0,  -- 0 = no interval bells

    -- Completion
    completed BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_meditation_timers_user ON meditation_timers(user_id, created_at DESC);
CREATE INDEX idx_meditation_timers_completed ON meditation_timers(user_id) WHERE completed = true;
