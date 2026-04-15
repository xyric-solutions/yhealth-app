-- ============================================
-- Migration: User Interventions Table
-- ============================================
-- Description: Stores AI-generated interventions from the Intelligent Intervention
-- Framework (10 decision trees). Tracks auto-adjustments to user plans,
-- user responses (accepted/dismissed), and expiration.

CREATE TABLE IF NOT EXISTS user_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contradiction_id UUID,
    intervention_type VARCHAR(50) NOT NULL,
    decision_tree VARCHAR(50) NOT NULL,
    original_value JSONB,
    adjusted_value JSONB,
    reasoning TEXT NOT NULL,
    user_notified BOOLEAN DEFAULT false,
    user_accepted BOOLEAN,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ui_user_date ON user_interventions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ui_user_pending ON user_interventions(user_id, user_accepted) WHERE user_accepted IS NULL;
CREATE INDEX IF NOT EXISTS idx_ui_decision_tree ON user_interventions(decision_tree);
