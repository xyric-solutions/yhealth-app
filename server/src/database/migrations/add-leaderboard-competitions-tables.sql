-- ============================================
-- MIGRATION: Add Leaderboard & Competitions Tables
-- ============================================
-- Adds leaderboard and competitions system tables
-- Run this migration for existing databases
--
-- Date: 2026-02-16
-- Description: Adds daily_user_scores, leaderboard_snapshots, competitions, and competition_entries tables
-- ============================================

-- Ensure enum types exist (they should already exist from 01-enums.sql)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leaderboard_type') THEN
    CREATE TYPE leaderboard_type AS ENUM ('global', 'country', 'friends', 'competition');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_type') THEN
    CREATE TYPE competition_type AS ENUM ('ai_generated', 'admin_created');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_status') THEN
    CREATE TYPE competition_status AS ENUM ('draft', 'active', 'ended', 'cancelled');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_entry_status') THEN
    CREATE TYPE competition_entry_status AS ENUM ('active', 'disqualified', 'completed', 'withdrawn');
  END IF;
END $$;

-- ============================================
-- 1. DAILY USER SCORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS daily_user_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Date (user's local date, timezone-aware)
  date DATE NOT NULL,
  
  -- Total score (weighted sum of component scores)
  total_score DECIMAL(10,2) NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
  
  -- Component scores (0-100 each)
  component_scores JSONB NOT NULL DEFAULT '{}', -- {workout: 85, nutrition: 72, wellbeing: 90, participation: 65}
  
  -- AI-generated explanation
  explanation TEXT,
  
  -- Anti-cheat flags
  flags JSONB DEFAULT '{}', -- {anomaly_detected: bool, low_confidence: bool, requires_review: bool}
  
  -- Rankings (updated after leaderboard materialization)
  rank_global INTEGER,
  rank_country INTEGER,
  rank_friends INTEGER,
  
  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: one score per user per day
  UNIQUE(user_id, date)
);

-- Indexes for daily_user_scores
CREATE INDEX IF NOT EXISTS idx_daily_scores_date_total ON daily_user_scores(date, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_daily_scores_user_date ON daily_user_scores(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_scores_user_total ON daily_user_scores(user_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_daily_scores_rank_global ON daily_user_scores(date, rank_global) WHERE rank_global IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_scores_rank_country ON daily_user_scores(date, rank_country) WHERE rank_country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_scores_flags ON daily_user_scores USING GIN (flags);

-- Comments
COMMENT ON TABLE daily_user_scores IS 'Daily fitness scores per user (timezone-aware) with component breakdowns and rankings';
COMMENT ON COLUMN daily_user_scores.date IS 'User local date (timezone-aware)';
COMMENT ON COLUMN daily_user_scores.component_scores IS 'JSONB: {workout: 0-100, nutrition: 0-100, wellbeing: 0-100, participation: 0-100}';
COMMENT ON COLUMN daily_user_scores.explanation IS 'AI-generated explanation of the score';
COMMENT ON COLUMN daily_user_scores.rank_global IS 'Global rank (updated after leaderboard materialization)';
COMMENT ON COLUMN daily_user_scores.rank_country IS 'Country-specific rank';
COMMENT ON COLUMN daily_user_scores.rank_friends IS 'Friends-only rank';

-- ============================================
-- 2. LEADERBOARD SNAPSHOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Date for the leaderboard
  date DATE NOT NULL,
  
  -- Board type and segment
  board_type leaderboard_type NOT NULL,
  segment_key VARCHAR(100), -- For filtering (country code, group ID, competition ID, etc.)
  
  -- Precomputed top N ranks
  ranks JSONB NOT NULL DEFAULT '[]', -- [{user_id, rank, score, component_scores, user: {name, avatar}}]
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- {total_users, last_updated, computed_at, top_n_count}
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: one snapshot per board type/segment/date
  UNIQUE(date, board_type, segment_key)
);

-- Indexes for leaderboard_snapshots
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_date_type ON leaderboard_snapshots(date, board_type);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_type_segment ON leaderboard_snapshots(board_type, segment_key);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_date_desc ON leaderboard_snapshots(date DESC);

-- Comments
COMMENT ON TABLE leaderboard_snapshots IS 'Precomputed leaderboard snapshots for fast queries (global, country, friends, competition)';
COMMENT ON COLUMN leaderboard_snapshots.board_type IS 'Type of leaderboard: global, country, friends, competition';
COMMENT ON COLUMN leaderboard_snapshots.segment_key IS 'Segment identifier (country code, competition ID, etc.)';
COMMENT ON COLUMN leaderboard_snapshots.ranks IS 'JSONB array of top N users: [{user_id, rank, score, component_scores, user: {name, avatar}}]';
COMMENT ON COLUMN leaderboard_snapshots.metadata IS 'JSONB: {total_users, last_updated, computed_at, top_n_count}';

-- ============================================
-- 3. COMPETITIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  type competition_type NOT NULL,
  description TEXT,
  
  -- Schedule
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  
  -- Rules engine (JSONB for flexibility)
  rules JSONB NOT NULL DEFAULT '{}', -- {metric, aggregation, target, min_days, etc.}
  
  -- Eligibility criteria
  eligibility JSONB DEFAULT '{}', -- {regions: [], subscription_tiers: [], age_brackets: [], groups: []}
  
  -- Scoring weights (for competition-specific scoring)
  scoring_weights JSONB DEFAULT '{}', -- {workout: 0.4, nutrition: 0.3, wellbeing: 0.2, participation: 0.1}
  
  -- Anti-cheat policy
  anti_cheat_policy JSONB DEFAULT '{}', -- {min_confidence: 0.7, max_daily_cap: 100, require_verification: bool}
  
  -- Prizes and rewards
  prize_metadata JSONB DEFAULT '{}', -- {badges: [], rewards: [], top_n: 10}
  
  -- Status
  status competition_status NOT NULL DEFAULT 'draft',
  
  -- Creator (admin or AI)
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for competitions
CREATE INDEX IF NOT EXISTS idx_competitions_active ON competitions(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_competitions_type ON competitions(type);
CREATE INDEX IF NOT EXISTS idx_competitions_dates ON competitions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);
CREATE INDEX IF NOT EXISTS idx_competitions_rules ON competitions USING GIN (rules);
CREATE INDEX IF NOT EXISTS idx_competitions_eligibility ON competitions USING GIN (eligibility);

-- Comments
COMMENT ON TABLE competitions IS 'Competition definitions (AI-generated and admin-created) with rules engine and eligibility';
COMMENT ON COLUMN competitions.type IS 'Type: ai_generated or admin_created';
COMMENT ON COLUMN competitions.rules IS 'JSONB rules: {metric: workout|nutrition|wellbeing|participation, aggregation: streak|total|average, target: value, min_days: number}';
COMMENT ON COLUMN competitions.eligibility IS 'JSONB: {regions: [], subscription_tiers: [], age_brackets: [], groups: []}';
COMMENT ON COLUMN competitions.scoring_weights IS 'JSONB: {workout: 0-1, nutrition: 0-1, wellbeing: 0-1, participation: 0-1} (must sum to 1.0)';
COMMENT ON COLUMN competitions.anti_cheat_policy IS 'JSONB: {min_confidence: 0-1, max_daily_cap: number, require_verification: bool}';

-- ============================================
-- 4. COMPETITION ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS competition_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Competition and user
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Enrollment
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Status
  status competition_entry_status NOT NULL DEFAULT 'active',
  
  -- Current standings (updated during competition)
  current_rank INTEGER,
  current_score DECIMAL(10,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- {disqualification_reason, notes, etc.}
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: one entry per user per competition
  UNIQUE(competition_id, user_id)
);

-- Indexes for competition_entries
CREATE INDEX IF NOT EXISTS idx_competition_entries_comp_user ON competition_entries(competition_id, user_id);
CREATE INDEX IF NOT EXISTS idx_competition_entries_comp_rank ON competition_entries(competition_id, current_rank) WHERE current_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competition_entries_user ON competition_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_entries_status ON competition_entries(competition_id, status);
CREATE INDEX IF NOT EXISTS idx_competition_entries_comp_score ON competition_entries(competition_id, current_score DESC) WHERE current_score IS NOT NULL;

-- Comments
COMMENT ON TABLE competition_entries IS 'User competition participation and current standings';
COMMENT ON COLUMN competition_entries.status IS 'Entry status: active, disqualified, completed, withdrawn';
COMMENT ON COLUMN competition_entries.current_rank IS 'Current rank in competition (updated during active competition)';
COMMENT ON COLUMN competition_entries.current_score IS 'Current competition-specific score';

-- ============================================
-- 5. ADD TRIGGERS FOR UPDATED_AT
-- ============================================
-- Ensure the trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers
DROP TRIGGER IF EXISTS update_daily_user_scores_updated_at ON daily_user_scores;
CREATE TRIGGER update_daily_user_scores_updated_at BEFORE UPDATE ON daily_user_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leaderboard_snapshots_updated_at ON leaderboard_snapshots;
CREATE TRIGGER update_leaderboard_snapshots_updated_at BEFORE UPDATE ON leaderboard_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_competitions_updated_at ON competitions;
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_competition_entries_updated_at ON competition_entries;
CREATE TRIGGER update_competition_entries_updated_at BEFORE UPDATE ON competition_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Leaderboard & Competitions tables migration completed successfully!';
    RAISE NOTICE '📊 Tables created: daily_user_scores, leaderboard_snapshots, competitions, competition_entries';
END $$;

