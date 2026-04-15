-- ============================================
-- VOICE JOURNAL SESSIONS TABLE
-- ============================================
-- Conversational voice journaling sessions (3-5 turn exchanges)
-- Transcript stored as JSONB array, summary generated after conversation

DROP TABLE IF EXISTS voice_journal_sessions CASCADE;
CREATE TABLE voice_journal_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'summarizing', 'review', 'completed', 'abandoned')),
    exchange_count INTEGER NOT NULL DEFAULT 0,

    -- Full conversation transcript
    transcript JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- AI-generated summary (populated after conversation)
    summary_mood VARCHAR(50),
    summary_themes TEXT[] DEFAULT '{}',
    summary_lessons TEXT[] DEFAULT '{}',
    summary_action_items TEXT[] DEFAULT '{}',
    summary_text TEXT,

    -- Link to created journal entry (after approval)
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,

    -- Duration tracking
    total_duration_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_voice_journal_sessions_user_id ON voice_journal_sessions(user_id);
CREATE INDEX idx_voice_journal_sessions_status ON voice_journal_sessions(user_id, status);
CREATE INDEX idx_voice_journal_sessions_created ON voice_journal_sessions(user_id, created_at DESC);

-- Updated_at trigger
CREATE TRIGGER set_voice_journal_sessions_updated_at
    BEFORE UPDATE ON voice_journal_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add category column to journal_patterns for correlation/theme classification
ALTER TABLE journal_patterns ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'correlation';
