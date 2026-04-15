-- ============================================
-- Goal Actions: Add user_goal_id support + daily completions
-- ============================================

-- Allow goal_actions to reference user_goals (assessment goals) directly
ALTER TABLE goal_actions ADD COLUMN IF NOT EXISTS user_goal_id UUID REFERENCES user_goals(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_goal_actions_user_goal ON goal_actions(user_goal_id) WHERE user_goal_id IS NOT NULL;

-- Make goal_id nullable (actions can belong to either life_goals OR user_goals)
ALTER TABLE goal_actions ALTER COLUMN goal_id DROP NOT NULL;

-- Daily action completions — allows toggling tasks per day
-- (goal_actions.is_completed stays as a "permanent" complete flag for milestones)
CREATE TABLE IF NOT EXISTS goal_action_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID NOT NULL REFERENCES goal_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(action_id, completion_date)
);

CREATE INDEX IF NOT EXISTS idx_goal_action_completions_user_date
  ON goal_action_completions(user_id, completion_date);
CREATE INDEX IF NOT EXISTS idx_goal_action_completions_action
  ON goal_action_completions(action_id, completion_date);
