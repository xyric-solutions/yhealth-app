-- ============================================
-- COMPETITION ENTRIES TABLE
-- ============================================
-- User competition participation and current standings

DROP TABLE IF EXISTS competition_entries CASCADE;
CREATE TABLE competition_entries (
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

-- Indexes for efficient queries
CREATE INDEX idx_competition_entries_comp_user ON competition_entries(competition_id, user_id);
CREATE INDEX idx_competition_entries_comp_rank ON competition_entries(competition_id, current_rank) WHERE current_rank IS NOT NULL;
CREATE INDEX idx_competition_entries_user ON competition_entries(user_id);
CREATE INDEX idx_competition_entries_status ON competition_entries(competition_id, status);
CREATE INDEX idx_competition_entries_comp_score ON competition_entries(competition_id, current_score DESC) WHERE current_score IS NOT NULL;

-- Comments
COMMENT ON TABLE competition_entries IS 'User competition participation and current standings';
COMMENT ON COLUMN competition_entries.status IS 'Entry status: active, disqualified, completed, withdrawn';
COMMENT ON COLUMN competition_entries.current_rank IS 'Current rank in competition (updated during active competition)';
COMMENT ON COLUMN competition_entries.current_score IS 'Current competition-specific score';

