-- ============================================
-- JOURNALING INSPIRATION FEATURES MIGRATION
-- ============================================
-- Features: Day Plan/Review Loop, Expanded Emotional State Model,
--           Mood Arc Tracking, Lessons Learned Extraction
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards)

-- ============================================
-- 1A. Expand mood_emoji enum (Feature 2: Expanded Emotional State)
-- ============================================
-- Add 7 new emotional states to existing 6-emoji enum
-- PG enums can only ADD values, never remove — old values stay for backward compat

DO $$ BEGIN
    ALTER TYPE mood_emoji ADD VALUE IF NOT EXISTS '😌'; -- Calm
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE mood_emoji ADD VALUE IF NOT EXISTS '😎'; -- Confident
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE mood_emoji ADD VALUE IF NOT EXISTS '🎯'; -- Focused
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE mood_emoji ADD VALUE IF NOT EXISTS '🤩'; -- Euphoric
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE mood_emoji ADD VALUE IF NOT EXISTS '🤔'; -- Distracted
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE mood_emoji ADD VALUE IF NOT EXISTS '😨'; -- Fearful
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE mood_emoji ADD VALUE IF NOT EXISTS '😤'; -- Frustrated
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 1B. Add mood transition fields (Feature 3: Mood Arc Tracking)
-- ============================================

ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS transition_trigger VARCHAR(100);

-- trigger_category needs a check constraint — use DO block for safety
DO $$ BEGIN
    ALTER TABLE mood_logs ADD COLUMN trigger_category VARCHAR(30);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE mood_logs ADD CONSTRAINT mood_logs_trigger_category_check
        CHECK (trigger_category IN ('work','exercise','social','food','sleep','meditation','conflict','news','weather','other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE mood_logs ADD COLUMN previous_mood_log_id UUID REFERENCES mood_logs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================
-- 1C. Alter daily_checkins for morning/evening (Feature 1: Day Plan/Review)
-- ============================================

-- Add check-in type to distinguish morning vs evening
DO $$ BEGIN
    ALTER TABLE daily_checkins ADD COLUMN checkin_type VARCHAR(10) DEFAULT 'morning';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE daily_checkins ADD CONSTRAINT daily_checkins_checkin_type_check
        CHECK (checkin_type IN ('morning', 'evening'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Morning-specific: predictions
DO $$ BEGIN
    ALTER TABLE daily_checkins ADD COLUMN predicted_mood INTEGER CHECK (predicted_mood >= 1 AND predicted_mood <= 10);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE daily_checkins ADD COLUMN predicted_energy INTEGER CHECK (predicted_energy >= 1 AND predicted_energy <= 10);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS known_stressors TEXT[];

-- Evening-specific: review
DO $$ BEGIN
    ALTER TABLE daily_checkins ADD COLUMN day_rating INTEGER CHECK (day_rating >= 1 AND day_rating <= 10);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS went_well TEXT[];
ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS didnt_go_well TEXT[];
ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS evening_lessons TEXT[];
ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS tomorrow_focus TEXT;

-- Replace unique constraint: allow morning + evening per day
ALTER TABLE daily_checkins DROP CONSTRAINT IF EXISTS daily_checkins_user_id_checkin_date_key;

DO $$ BEGIN
    ALTER TABLE daily_checkins ADD CONSTRAINT daily_checkins_user_date_type_key
        UNIQUE(user_id, checkin_date, checkin_type);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 1D. Allow multiple daily intentions (Feature 1)
-- ============================================

-- Remove 1-per-day constraint to allow up to 3 intentions per day (enforced at app level)
ALTER TABLE daily_intentions DROP CONSTRAINT IF EXISTS daily_intentions_user_id_intention_date_key;

DO $$ BEGIN
    ALTER TABLE daily_intentions ADD COLUMN sort_order INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE daily_intentions ADD COLUMN domain VARCHAR(30);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================
-- 1E. Create mood_behavioral_patterns table (Feature 2)
-- ============================================

CREATE TABLE IF NOT EXISTS mood_behavioral_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_key VARCHAR(50) NOT NULL,
    pattern_description TEXT NOT NULL,
    detection_data JSONB DEFAULT '{}',
    severity VARCHAR(10) CHECK (severity IN ('info', 'warning', 'alert')),
    first_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_mood_behavioral_patterns_user
    ON mood_behavioral_patterns(user_id, is_active);

-- ============================================
-- 1F. Create lessons_learned table (Feature 4)
-- ============================================

CREATE TABLE IF NOT EXISTS lessons_learned (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    checkin_id UUID REFERENCES daily_checkins(id) ON DELETE SET NULL,
    lesson_text TEXT NOT NULL,
    domain VARCHAR(30) NOT NULL CHECK (domain IN (
        'health', 'work', 'relationships', 'personal',
        'spiritual', 'productivity', 'other'
    )),
    source VARCHAR(20) NOT NULL DEFAULT 'ai_extracted' CHECK (source IN (
        'ai_extracted', 'user_entered', 'evening_review'
    )),
    is_confirmed BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    mention_count INTEGER DEFAULT 1,
    last_reminded_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lessons_learned_user
    ON lessons_learned(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lessons_learned_domain
    ON lessons_learned(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_lessons_learned_confirmed
    ON lessons_learned(user_id, is_confirmed) WHERE is_confirmed = true;
