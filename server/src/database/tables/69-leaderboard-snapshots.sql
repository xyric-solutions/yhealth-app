-- ============================================
-- LEADERBOARD SNAPSHOTS TABLE
-- ============================================
-- Precomputed leaderboard snapshots for fast queries
-- Stores top N rankings per board type (global, country, friends, competition)

DROP TABLE IF EXISTS leaderboard_snapshots CASCADE;
CREATE TABLE leaderboard_snapshots (
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

-- Indexes for efficient queries
CREATE INDEX idx_leaderboard_snapshots_date_type ON leaderboard_snapshots(date, board_type);
CREATE INDEX idx_leaderboard_snapshots_type_segment ON leaderboard_snapshots(board_type, segment_key);
CREATE INDEX idx_leaderboard_snapshots_date_desc ON leaderboard_snapshots(date DESC);

-- Comments
COMMENT ON TABLE leaderboard_snapshots IS 'Precomputed leaderboard snapshots for fast queries (global, country, friends, competition)';
COMMENT ON COLUMN leaderboard_snapshots.board_type IS 'Type of leaderboard: global, country, friends, competition';
COMMENT ON COLUMN leaderboard_snapshots.segment_key IS 'Segment identifier (country code, competition ID, etc.)';
COMMENT ON COLUMN leaderboard_snapshots.ranks IS 'JSONB array of top N users: [{user_id, rank, score, component_scores, user: {name, avatar}}]';
COMMENT ON COLUMN leaderboard_snapshots.metadata IS 'JSONB: {total_users, last_updated, computed_at, top_n_count}';

