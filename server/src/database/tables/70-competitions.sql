-- ============================================
-- COMPETITIONS TABLE
-- ============================================
-- Competition definitions (AI-generated and admin-created)
-- Includes rules engine, eligibility criteria, and anti-cheat policies

DROP TABLE IF EXISTS competitions CASCADE;
CREATE TABLE competitions (
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

-- Indexes for efficient queries
CREATE INDEX idx_competitions_active ON competitions(status, start_date, end_date);
CREATE INDEX idx_competitions_type ON competitions(type);
CREATE INDEX idx_competitions_dates ON competitions(start_date, end_date);
CREATE INDEX idx_competitions_status ON competitions(status);
CREATE INDEX idx_competitions_rules ON competitions USING GIN (rules);
CREATE INDEX idx_competitions_eligibility ON competitions USING GIN (eligibility);

-- Comments
COMMENT ON TABLE competitions IS 'Competition definitions (AI-generated and admin-created) with rules engine and eligibility';
COMMENT ON COLUMN competitions.type IS 'Type: ai_generated or admin_created';
COMMENT ON COLUMN competitions.rules IS 'JSONB rules: {metric: workout|nutrition|wellbeing|participation, aggregation: streak|total|average, target: value, min_days: number}';
COMMENT ON COLUMN competitions.eligibility IS 'JSONB: {regions: [], subscription_tiers: [], age_brackets: [], groups: []}';
COMMENT ON COLUMN competitions.scoring_weights IS 'JSONB: {workout: 0-1, nutrition: 0-1, wellbeing: 0-1, participation: 0-1} (must sum to 1.0)';
COMMENT ON COLUMN competitions.anti_cheat_policy IS 'JSONB: {min_confidence: 0-1, max_daily_cap: number, require_verification: bool}';

