-- ============================================
-- Migration: Add user_coaching_profiles table
-- ============================================
-- AI-generated coaching profiles with adherence scores, insights,
-- risk flags, predictions, and goal alignment analysis.

CREATE TABLE IF NOT EXISTS user_coaching_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL,
    adherence_scores JSONB,
    key_insights JSONB,
    risk_flags JSONB,
    predictions JSONB,
    next_best_actions JSONB,
    goal_alignment JSONB,
    data_gaps JSONB,
    coaching_tone VARCHAR(20) DEFAULT 'direct',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generation_model VARCHAR(50),
    generation_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_coaching_profiles_user_id ON user_coaching_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coaching_profiles_generated_at ON user_coaching_profiles(generated_at);
CREATE INDEX IF NOT EXISTS idx_user_coaching_profiles_tone ON user_coaching_profiles(coaching_tone);
