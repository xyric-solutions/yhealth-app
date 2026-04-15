-- Migration: Add user_life_history table for complete life history with Gemini 768-dim embeddings
-- Safe to re-run (all statements use IF NOT EXISTS)

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table
CREATE TABLE IF NOT EXISTS user_life_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_time TIMESTAMPTZ DEFAULT NOW(),
  entry_type VARCHAR(30) NOT NULL,
  category VARCHAR(30) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  source_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one daily digest per user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_life_history_daily_digest_unique
  ON user_life_history (user_id, event_date)
  WHERE entry_type = 'daily_digest';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_life_history_user_date
  ON user_life_history (user_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_life_history_user_category_date
  ON user_life_history (user_id, category, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_life_history_user_type_date
  ON user_life_history (user_id, entry_type, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_life_history_metadata
  ON user_life_history USING GIN (metadata);
