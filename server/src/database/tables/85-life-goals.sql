-- ============================================
-- LIFE GOALS TABLE
-- ============================================
-- Non-fitness life goals tracked through journaling
-- Separate from user_goals (which is locked to health_pillar enum)

DROP TABLE IF EXISTS journal_goal_links CASCADE;
DROP TABLE IF EXISTS daily_intentions CASCADE;
DROP TABLE IF EXISTS life_goals CASCADE;

CREATE TABLE life_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Goal definition
    category VARCHAR(30) NOT NULL CHECK (category IN (
        'spiritual', 'social', 'productivity', 'happiness',
        'anxiety_management', 'creative', 'personal_growth',
        'financial', 'faith', 'relationships', 'education',
        'career', 'health_wellness', 'custom'
    )),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    motivation TEXT, -- "Why this matters to me"

    -- Tracking configuration
    tracking_method VARCHAR(20) NOT NULL DEFAULT 'journal_mentions' CHECK (tracking_method IN (
        'daily_checkin', 'journal_mentions', 'manual', 'hybrid'
    )),
    target_value FLOAT, -- optional numeric target (e.g., 5 for "pray 5 times")
    target_unit VARCHAR(50), -- e.g., "times per day", "times per week"
    current_value FLOAT DEFAULT 0,

    -- Status & progress
    status goal_status DEFAULT 'active',
    progress FLOAT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- AI-derived metrics (updated by insight engine)
    journal_mention_count INTEGER DEFAULT 0,
    avg_sentiment_when_mentioned FLOAT, -- -1 to 1
    last_mentioned_at TIMESTAMPTZ,
    ai_detected_patterns JSONB DEFAULT '[]',

    -- Keywords for auto-detection in journal entries
    detection_keywords TEXT[] DEFAULT '{}',

    -- Flags
    is_primary BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_life_goals_user_status ON life_goals(user_id, status);
CREATE INDEX idx_life_goals_user_category ON life_goals(user_id, category);
CREATE INDEX idx_life_goals_user_primary ON life_goals(user_id, is_primary) WHERE is_primary = true;

-- ============================================
-- DAILY INTENTIONS TABLE
-- ============================================
-- Morning intention setting linked to daily check-ins

CREATE TABLE daily_intentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intention_date DATE NOT NULL,

    -- Intention content
    intention_text TEXT NOT NULL CHECK (char_length(intention_text) > 0),

    -- Link to check-in
    checkin_id UUID REFERENCES daily_checkins(id) ON DELETE SET NULL,

    -- End-of-day reflection
    fulfilled BOOLEAN,
    reflection TEXT CHECK (char_length(reflection) <= 500),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One intention per day per user
    UNIQUE(user_id, intention_date)
);

-- Indexes
CREATE INDEX idx_daily_intentions_user_date ON daily_intentions(user_id, intention_date DESC);

-- ============================================
-- JOURNAL-GOAL LINKS TABLE
-- ============================================
-- Links journal entries to life goals (AI-detected or user-tagged)

CREATE TABLE journal_goal_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    life_goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,

    -- Link metadata
    link_type VARCHAR(20) NOT NULL CHECK (link_type IN ('ai_detected', 'user_confirmed', 'user_tagged')),
    confidence FLOAT, -- AI confidence score (0-1) for ai_detected links
    relevant_excerpt TEXT, -- Portion of text that triggered the link
    sentiment_score FLOAT, -- Sentiment of the relevant section (-1 to 1)

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One link per entry-goal pair
    UNIQUE(journal_entry_id, life_goal_id)
);

-- Indexes
CREATE INDEX idx_journal_goal_links_goal ON journal_goal_links(life_goal_id);
CREATE INDEX idx_journal_goal_links_entry ON journal_goal_links(journal_entry_id);

-- Trigger for updated_at (added to 99-triggers.sql)
