-- ============================================
-- DAILY USER SCORES TABLE
-- ============================================
-- Stores daily fitness scores per user (timezone-aware)
-- Component scores: workout, nutrition, wellbeing, participation
-- Includes rankings and AI-generated explanations

DROP TABLE IF EXISTS daily_user_scores CASCADE;
CREATE TABLE daily_user_scores (
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

-- Indexes for efficient queries
CREATE INDEX idx_daily_scores_date_total ON daily_user_scores(date, total_score DESC);
CREATE INDEX idx_daily_scores_user_date ON daily_user_scores(user_id, date DESC);
CREATE INDEX idx_daily_scores_user_total ON daily_user_scores(user_id, total_score DESC);
CREATE INDEX idx_daily_scores_rank_global ON daily_user_scores(date, rank_global) WHERE rank_global IS NOT NULL;
CREATE INDEX idx_daily_scores_rank_country ON daily_user_scores(date, rank_country) WHERE rank_country IS NOT NULL;
CREATE INDEX idx_daily_scores_flags ON daily_user_scores USING GIN (flags);

-- Comments
COMMENT ON TABLE daily_user_scores IS 'Daily fitness scores per user (timezone-aware) with component breakdowns and rankings';
COMMENT ON COLUMN daily_user_scores.date IS 'User local date (timezone-aware)';
COMMENT ON COLUMN daily_user_scores.component_scores IS 'JSONB: {workout: 0-100, nutrition: 0-100, wellbeing: 0-100, participation: 0-100}';
COMMENT ON COLUMN daily_user_scores.explanation IS 'AI-generated explanation of the score';
COMMENT ON COLUMN daily_user_scores.rank_global IS 'Global rank (updated after leaderboard materialization)';
COMMENT ON COLUMN daily_user_scores.rank_country IS 'Country-specific rank';
COMMENT ON COLUMN daily_user_scores.rank_friends IS 'Friends-only rank';

