-- ============================================
-- MIGRATION: AI Wellness Journaling System
-- ============================================
-- Creates new tables and enhances existing ones for the holistic journaling system.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).

-- ============================================
-- 1. DAILY CHECK-INS
-- ============================================
CREATE TABLE IF NOT EXISTS daily_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    energy_score INTEGER CHECK (energy_score >= 1 AND energy_score <= 10),
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
    stress_score INTEGER CHECK (stress_score >= 1 AND stress_score <= 10),
    tags TEXT[] DEFAULT '{}',
    day_summary TEXT CHECK (char_length(day_summary) <= 500),
    mood_log_id UUID REFERENCES mood_logs(id) ON DELETE SET NULL,
    energy_log_id UUID REFERENCES energy_logs(id) ON DELETE SET NULL,
    stress_log_id UUID REFERENCES stress_logs(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON daily_checkins(user_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_logged ON daily_checkins(user_id, logged_at DESC);

-- ============================================
-- 2. LIFE GOALS
-- ============================================
CREATE TABLE IF NOT EXISTS life_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL CHECK (category IN (
        'spiritual', 'social', 'productivity', 'happiness',
        'anxiety_management', 'creative', 'personal_growth', 'custom'
    )),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    motivation TEXT,
    tracking_method VARCHAR(20) NOT NULL DEFAULT 'journal_mentions' CHECK (tracking_method IN (
        'daily_checkin', 'journal_mentions', 'manual', 'hybrid'
    )),
    target_value FLOAT,
    target_unit VARCHAR(50),
    current_value FLOAT DEFAULT 0,
    status goal_status DEFAULT 'active',
    progress FLOAT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    journal_mention_count INTEGER DEFAULT 0,
    avg_sentiment_when_mentioned FLOAT,
    last_mentioned_at TIMESTAMPTZ,
    ai_detected_patterns JSONB DEFAULT '[]',
    detection_keywords TEXT[] DEFAULT '{}',
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_life_goals_user_status ON life_goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_life_goals_user_category ON life_goals(user_id, category);

-- ============================================
-- 3. DAILY INTENTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS daily_intentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intention_date DATE NOT NULL,
    intention_text TEXT NOT NULL CHECK (char_length(intention_text) > 0),
    checkin_id UUID REFERENCES daily_checkins(id) ON DELETE SET NULL,
    fulfilled BOOLEAN,
    reflection TEXT CHECK (char_length(reflection) <= 500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, intention_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_intentions_user_date ON daily_intentions(user_id, intention_date DESC);

-- ============================================
-- 4. JOURNAL-GOAL LINKS
-- ============================================
CREATE TABLE IF NOT EXISTS journal_goal_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    life_goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,
    link_type VARCHAR(20) NOT NULL CHECK (link_type IN ('ai_detected', 'user_confirmed', 'user_tagged')),
    confidence FLOAT,
    relevant_excerpt TEXT,
    sentiment_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(journal_entry_id, life_goal_id)
);
CREATE INDEX IF NOT EXISTS idx_journal_goal_links_goal ON journal_goal_links(life_goal_id);
CREATE INDEX IF NOT EXISTS idx_journal_goal_links_entry ON journal_goal_links(journal_entry_id);

-- ============================================
-- 5. JOURNAL INSIGHTS
-- ============================================
CREATE TABLE IF NOT EXISTS journal_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    themes TEXT[] DEFAULT '{}',
    emotional_state JSONB,
    cognitive_patterns TEXT[] DEFAULT '{}',
    growth_signals TEXT[] DEFAULT '{}',
    risk_indicators TEXT[] DEFAULT '{}',
    coaching_suggestion TEXT,
    sentiment_method VARCHAR(20),
    sentiment_confidence FLOAT,
    detected_goal_links JSONB DEFAULT '[]',
    analysis_model VARCHAR(50),
    analysis_tokens INTEGER,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_journal_insights_user ON journal_insights(user_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_insights_entry ON journal_insights(journal_entry_id);

-- ============================================
-- 6. JOURNAL PATTERNS
-- ============================================
CREATE TABLE IF NOT EXISTS journal_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL,
    pattern_description TEXT NOT NULL,
    correlation_strength FLOAT,
    data_points INTEGER,
    confidence VARCHAR(10) CHECK (confidence IN ('high', 'medium', 'low')),
    evidence JSONB DEFAULT '{}',
    window_days INTEGER NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, pattern_type)
);
CREATE INDEX IF NOT EXISTS idx_journal_patterns_user_active ON journal_patterns(user_id, is_active) WHERE is_active = true;

-- ============================================
-- 7. ENHANCE EXISTING journal_entries TABLE
-- ============================================
-- Add new columns for the enhanced journaling system

DO $$
BEGIN
    -- Link to daily check-in
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'checkin_id') THEN
        ALTER TABLE journal_entries ADD COLUMN checkin_id UUID REFERENCES daily_checkins(id) ON DELETE SET NULL;
    END IF;

    -- Journaling mode
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'journaling_mode') THEN
        ALTER TABLE journal_entries ADD COLUMN journaling_mode VARCHAR(20)
            CHECK (journaling_mode IN ('quick_reflection', 'deep_dive', 'gratitude', 'life_perspective', 'free_write'));
    END IF;

    -- AI-generated prompt flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'ai_generated_prompt') THEN
        ALTER TABLE journal_entries ADD COLUMN ai_generated_prompt BOOLEAN DEFAULT false;
    END IF;

    -- Coach reflection
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'coach_reflection') THEN
        ALTER TABLE journal_entries ADD COLUMN coach_reflection TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'coach_reflection_at') THEN
        ALTER TABLE journal_entries ADD COLUMN coach_reflection_at TIMESTAMPTZ;
    END IF;

    -- Voice journaling enhancements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'voice_audio_url') THEN
        ALTER TABLE journal_entries ADD COLUMN voice_audio_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'voice_duration_ms') THEN
        ALTER TABLE journal_entries ADD COLUMN voice_duration_ms INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'voice_emotion_analysis') THEN
        ALTER TABLE journal_entries ADD COLUMN voice_emotion_analysis JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'transcription_status') THEN
        ALTER TABLE journal_entries ADD COLUMN transcription_status VARCHAR(20)
            CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed'));
    END IF;
END $$;

-- ============================================
-- 8. EXPAND journal_prompt_category ENUM
-- ============================================
-- Add new prompt categories for the expanded journaling system

DO $$
BEGIN
    -- Check if enum exists before trying to add values
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journal_prompt_category') THEN
        BEGIN ALTER TYPE journal_prompt_category ADD VALUE IF NOT EXISTS 'identity'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE journal_prompt_category ADD VALUE IF NOT EXISTS 'productivity'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE journal_prompt_category ADD VALUE IF NOT EXISTS 'relationships'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE journal_prompt_category ADD VALUE IF NOT EXISTS 'spirituality'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE journal_prompt_category ADD VALUE IF NOT EXISTS 'anxiety'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE journal_prompt_category ADD VALUE IF NOT EXISTS 'creativity'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE journal_prompt_category ADD VALUE IF NOT EXISTS 'cbt_reflection'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE journal_prompt_category ADD VALUE IF NOT EXISTS 'cross_pillar'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
END $$;

-- ============================================
-- 9. ADD updated_at TRIGGERS for new tables
-- ============================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['daily_checkins', 'life_goals', 'daily_intentions', 'journal_patterns']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'set_' || tbl || '_updated_at'
            AND tgrelid = tbl::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
                tbl, tbl
            );
        END IF;
    END LOOP;
END $$;
