-- ============================================
-- Table: user_life_history
-- Purpose: Complete user life history with Gemini 768-dim embeddings
--          for temporal + semantic search across all health pillars
-- ============================================

CREATE TABLE IF NOT EXISTS user_life_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_time TIMESTAMPTZ DEFAULT NOW(),

  -- Entry classification
  entry_type VARCHAR(30) NOT NULL,  -- 'daily_digest'|'journal'|'voice_session'|'emotional_checkin'|'coaching_conversation'|'lesson'|'goal_milestone'|'health_alert'|'daily_checkin'
  category VARCHAR(30) NOT NULL,    -- 'all'|'fitness'|'nutrition'|'sleep'|'wellbeing'|'habits'|'goals'|'coaching'

  -- Content + embedding
  content TEXT NOT NULL,
  embedding vector(768),            -- Gemini text-embedding-004 (768 dimensions)

  -- Structured metadata for SQL-level filtering
  metadata JSONB DEFAULT '{}',      -- {daily_score, mood, energy, stress, recovery, sleep_hours, calories, streak, weight_kg, ...}

  -- Source traceability
  source_ids UUID[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Constraints
-- ============================================

-- Only one daily digest per user per day (enables safe upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_life_history_daily_digest_unique
  ON user_life_history (user_id, event_date)
  WHERE entry_type = 'daily_digest';

-- ============================================
-- Indexes
-- ============================================

-- Primary lookup: user + date (descending for recent-first)
CREATE INDEX IF NOT EXISTS idx_user_life_history_user_date
  ON user_life_history (user_id, event_date DESC);

-- Category-filtered temporal queries
CREATE INDEX IF NOT EXISTS idx_user_life_history_user_category_date
  ON user_life_history (user_id, category, event_date DESC);

-- Entry type filtering
CREATE INDEX IF NOT EXISTS idx_user_life_history_user_type_date
  ON user_life_history (user_id, entry_type, event_date DESC);

-- JSONB metadata for numeric filtering (e.g., WHERE metadata->>'mood' > '5')
CREATE INDEX IF NOT EXISTS idx_user_life_history_metadata
  ON user_life_history USING GIN (metadata);

-- Vector similarity search (IVFFlat with cosine distance)
-- Note: IVFFlat requires data to be present for training. Run after initial data load:
-- CREATE INDEX idx_user_life_history_embedding ON user_life_history USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
