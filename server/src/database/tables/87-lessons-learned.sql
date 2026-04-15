-- ============================================
-- LESSONS LEARNED TABLE
-- ============================================
-- Structured insights extracted from journal entries and evening reviews
-- AI-extracted lessons are confirmed by users; user-entered lessons come from evening reviews

DROP TABLE IF EXISTS lessons_learned CASCADE;
CREATE TABLE lessons_learned (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Source references
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    checkin_id UUID REFERENCES daily_checkins(id) ON DELETE SET NULL,

    -- Lesson content
    lesson_text TEXT NOT NULL,
    domain VARCHAR(30) NOT NULL CHECK (domain IN (
        'health', 'work', 'relationships', 'personal',
        'spiritual', 'productivity', 'other'
    )),
    source VARCHAR(20) NOT NULL DEFAULT 'ai_extracted' CHECK (source IN (
        'ai_extracted', 'user_entered', 'evening_review'
    )),

    -- User confirmation
    is_confirmed BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,

    -- Tracking
    mention_count INTEGER DEFAULT 1,
    last_reminded_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_lessons_learned_user ON lessons_learned(user_id, created_at DESC);
CREATE INDEX idx_lessons_learned_domain ON lessons_learned(user_id, domain);
CREATE INDEX idx_lessons_learned_confirmed ON lessons_learned(user_id, is_confirmed) WHERE is_confirmed = true;

-- Trigger for updated_at (added to 99-triggers.sql)
