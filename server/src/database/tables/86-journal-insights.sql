-- ============================================
-- JOURNAL INSIGHTS TABLE
-- ============================================
-- AI-generated insights from journal entries (post-entry analysis)

DROP TABLE IF EXISTS journal_insights CASCADE;
CREATE TABLE journal_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- AI analysis results
    themes TEXT[] DEFAULT '{}',
    emotional_state JSONB, -- { primary: string, secondary: string, intensity: 1-10 }
    cognitive_patterns TEXT[] DEFAULT '{}', -- CBT patterns detected
    growth_signals TEXT[] DEFAULT '{}',
    risk_indicators TEXT[] DEFAULT '{}',
    coaching_suggestion TEXT,

    -- Enhanced sentiment (replaces keyword-based)
    sentiment_method VARCHAR(20), -- 'tensorflow', 'openai', 'keyword'
    sentiment_confidence FLOAT,

    -- Goal relevance
    detected_goal_links JSONB DEFAULT '[]', -- [{ goalId: string, confidence: number }]

    -- Analysis metadata
    analysis_model VARCHAR(50),
    analysis_tokens INTEGER,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_journal_insights_user ON journal_insights(user_id, analyzed_at DESC);
CREATE INDEX idx_journal_insights_entry ON journal_insights(journal_entry_id);

-- ============================================
-- JOURNAL PATTERNS TABLE
-- ============================================
-- Long-term behavioral patterns detected from journaling history

DROP TABLE IF EXISTS journal_patterns CASCADE;
CREATE TABLE journal_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Pattern identification
    pattern_type VARCHAR(50) NOT NULL, -- 'mood_workout', 'stress_sleep', 'social_happiness', 'burnout_risk', etc.
    pattern_description TEXT NOT NULL,

    -- Statistical data
    correlation_strength FLOAT, -- -1 to 1
    data_points INTEGER,
    confidence VARCHAR(10) CHECK (confidence IN ('high', 'medium', 'low')),
    evidence JSONB DEFAULT '{}', -- Supporting data points

    -- Timeframe
    window_days INTEGER NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Status
    is_active BOOLEAN DEFAULT true,
    dismissed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One active pattern per type per user
    UNIQUE(user_id, pattern_type)
);

-- Indexes
CREATE INDEX idx_journal_patterns_user_active ON journal_patterns(user_id, is_active) WHERE is_active = true;
