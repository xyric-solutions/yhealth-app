-- ============================================
-- YOGA SESSIONS TABLE
-- ============================================
-- Session templates (system & user) and AI-generated sessions
-- Part of Wellbeing module (F7.9)

DROP TABLE IF EXISTS yoga_sessions CASCADE;
CREATE TABLE yoga_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL for system templates

    -- Session Identity
    title VARCHAR(300) NOT NULL,
    description TEXT,
    session_type VARCHAR(50) NOT NULL,  -- recovery_flow, morning_flow, evening_flow, power_yoga, gentle_stretch, hip_opener_flow, balance_flow, sleep_prep, custom, ai_generated
    meditation_mode VARCHAR(50),        -- guided, yoga_nidra, breathwork_only, silent_timer, nature_sounds, mantra (NULL for yoga flows)
    difficulty VARCHAR(20) NOT NULL DEFAULT 'beginner',
    duration_minutes INTEGER NOT NULL,

    -- Template vs User
    is_template BOOLEAN DEFAULT false,
    is_ai_generated BOOLEAN DEFAULT false,

    -- Session Content
    phases JSONB NOT NULL DEFAULT '[]',
    -- Format: [{
    --   phaseType: "warmup" | "flow" | "peak" | "cooldown" | "savasana" | "breathwork" | "meditation" | "transition",
    --   name: "Sun Salutation A",
    --   durationSeconds: 300,
    --   poses: [{ poseSlug: "downward-dog", holdSeconds: 30, repetitions: 1, side: "both" | "left" | "right" }],
    --   breathingPattern: "natural" | "ujjayi" | "4-7-8" | "box" | "coherent",
    --   narrationScript: "Let's begin with a gentle warm-up...",
    --   musicTag: "relaxing+acoustic"
    -- }]

    -- AI Generation Context
    generation_prompt TEXT,
    whoop_context JSONB,                 -- Snapshot of Whoop data at generation time
    workout_context JSONB,               -- If recovery: which workout triggered it

    -- Ambient & Music
    ambient_theme VARCHAR(50) DEFAULT 'forest',  -- forest, ocean, mountain, night, sunrise, space
    background_music_tag VARCHAR(100),

    -- Metadata
    tags TEXT[],

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_yoga_sessions_user ON yoga_sessions(user_id);
CREATE INDEX idx_yoga_sessions_type ON yoga_sessions(session_type);
CREATE INDEX idx_yoga_sessions_template ON yoga_sessions(is_template) WHERE is_template = true;
CREATE INDEX idx_yoga_sessions_ai ON yoga_sessions(is_ai_generated) WHERE is_ai_generated = true;
CREATE INDEX idx_yoga_sessions_user_created ON yoga_sessions(user_id, created_at DESC);
