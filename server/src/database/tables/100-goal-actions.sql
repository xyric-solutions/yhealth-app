-- ============================================
-- GOAL ACTIONS (AI-decomposed steps for life goals)
-- Phase 2: Goal Decomposition Service
-- ============================================

CREATE TABLE IF NOT EXISTS goal_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  pillar VARCHAR(20),
  frequency VARCHAR(20),
  is_ai_generated BOOLEAN DEFAULT true,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goal_actions_goal ON goal_actions(goal_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_goal_actions_user ON goal_actions(user_id);

-- ============================================
-- GOAL ACTION RESPONSES (accept/edit/skip tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS goal_action_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID NOT NULL REFERENCES goal_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_type VARCHAR(10) NOT NULL,
  edited_title VARCHAR(255),
  edited_description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goal_action_responses_user ON goal_action_responses(user_id, created_at DESC);
