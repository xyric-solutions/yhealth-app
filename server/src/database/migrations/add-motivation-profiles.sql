-- ============================================
-- MIGRATION: Add Motivation Profiles
-- Phase 1 of the Motivation Tier System
-- ============================================

CREATE TABLE IF NOT EXISTS user_motivation_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  declared_tier VARCHAR(10) NOT NULL DEFAULT 'medium',
  computed_tier VARCHAR(10) NOT NULL DEFAULT 'medium',
  active_tier VARCHAR(10) NOT NULL DEFAULT 'medium',
  engagement_score DECIMAL(5,2) DEFAULT 50.0,
  login_frequency_score DECIMAL(5,2) DEFAULT 50.0,
  suggestion_accept_rate DECIMAL(5,2) DEFAULT 50.0,
  task_completion_rate DECIMAL(5,2) DEFAULT 50.0,
  session_depth_score DECIMAL(5,2) DEFAULT 50.0,
  streak_consistency_score DECIMAL(5,2) DEFAULT 50.0,
  last_computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tier_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_motivation_profiles_user ON user_motivation_profiles(user_id);

-- Add motivation_level column to life_goals for per-goal tier override
ALTER TABLE life_goals ADD COLUMN IF NOT EXISTS motivation_level VARCHAR(10);
