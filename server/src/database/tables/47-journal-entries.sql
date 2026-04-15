-- ============================================
-- JOURNAL ENTRIES TABLE
-- ============================================
-- Daily journaling with prompts and AI personalization

DROP TABLE IF EXISTS journal_entries CASCADE;
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Prompt information
    prompt TEXT NOT NULL,
    prompt_category journal_prompt_category,
    prompt_id UUID, -- Reference to prompt library if applicable
    
    -- Entry content
    entry_text TEXT NOT NULL CHECK (char_length(entry_text) > 0),
    word_count INTEGER NOT NULL DEFAULT 0,
    
    -- Mode: 'light' or 'deep'
    mode VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (mode IN ('light', 'deep')),
    
    -- Voice entry flag
    voice_entry BOOLEAN DEFAULT false,
    duration_seconds INTEGER, -- Time taken to write entry
    
    -- Sentiment analysis (for stress detection)
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0 (negative to positive)
    sentiment_label VARCHAR(20), -- 'positive', 'negative', 'neutral'
    
    -- Streak tracking
    streak_day INTEGER, -- Day number in current streak

    -- Enhanced journaling fields
    checkin_id UUID, -- Link to daily check-in
    journaling_mode VARCHAR(20) CHECK (journaling_mode IN ('quick_reflection', 'deep_dive', 'gratitude', 'life_perspective', 'free_write')),
    ai_generated_prompt BOOLEAN DEFAULT false,

    -- Timestamp (UTC)
    logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_journal_entries_user_logged ON journal_entries(user_id, logged_at DESC);
-- Note: DATE index removed (TIMESTAMPTZ->date cast is not IMMUTABLE); use logged_at range queries instead
CREATE INDEX idx_journal_entries_category ON journal_entries(user_id, prompt_category, logged_at DESC);
CREATE INDEX idx_journal_entries_sentiment ON journal_entries(user_id, sentiment_label, logged_at DESC);

-- Trigger for updated_at (added to 99-triggers.sql)

