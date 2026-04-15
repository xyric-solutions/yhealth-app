-- ============================================
-- PLAN RESCHEDULE HISTORY TABLE
-- ============================================
-- Audit trail for all workout reschedule operations
-- Tracks auto-reschedules and conversation-driven reschedules

DROP TABLE IF EXISTS plan_reschedule_history CASCADE;
CREATE TABLE plan_reschedule_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES user_plans(id) ON DELETE SET NULL,
    workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
    
    -- Reschedule metadata
    reschedule_type VARCHAR(20) NOT NULL,  -- 'auto', 'conversation', 'manual'
    policy_used plan_policy NOT NULL,      -- 'SLIDE_FORWARD', 'FILL_GAPS', 'DROP_OR_COMPRESS'
    
    -- Input data
    missed_tasks JSONB NOT NULL DEFAULT '[]',  -- Array of missed task IDs and details
    valid_slots JSONB DEFAULT '[]',            -- Valid slots that were computed
    
    -- Reschedule actions (what was proposed and applied)
    reschedule_actions JSONB NOT NULL DEFAULT '[]',  -- [{ action: 'move', task_id: string, old_date: date, new_date: date, reason: string }, ...]
    
    -- Validation
    validation_errors JSONB DEFAULT '[]',  -- Any validation errors encountered
    validation_passes INTEGER DEFAULT 0,   -- Number of validation attempts before success
    
    -- LLM interaction
    llm_proposals JSONB DEFAULT '[]',      -- All LLM proposals (including rejected ones)
    final_proposal JSONB,                  -- Final accepted proposal
    
    -- User summary
    user_summary TEXT,                     -- LLM-generated summary for user
    user_notified BOOLEAN DEFAULT false,
    
    -- Status
    applied BOOLEAN DEFAULT false,         -- Whether changes were actually applied
    applied_at TIMESTAMP,
    error_message TEXT,                    -- If application failed
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_plan_reschedule_history_user ON plan_reschedule_history(user_id, created_at DESC);
CREATE INDEX idx_plan_reschedule_history_plan ON plan_reschedule_history(plan_id, created_at DESC);
CREATE INDEX idx_plan_reschedule_history_workout_plan ON plan_reschedule_history(workout_plan_id, created_at DESC);
CREATE INDEX idx_plan_reschedule_history_type ON plan_reschedule_history(reschedule_type, created_at DESC);
CREATE INDEX idx_plan_reschedule_history_applied ON plan_reschedule_history(user_id, applied, created_at DESC);

COMMENT ON TABLE plan_reschedule_history IS 'Audit trail for all workout reschedule operations';
COMMENT ON COLUMN plan_reschedule_history.missed_tasks IS 'Array of missed task details: [{ task_id, scheduled_date, workout_data, ... }]';
COMMENT ON COLUMN plan_reschedule_history.reschedule_actions IS 'Actions taken: [{ action: "move"|"drop"|"compress", task_id, old_date, new_date, reason }]';
COMMENT ON COLUMN plan_reschedule_history.llm_proposals IS 'All LLM proposals including rejected ones for debugging';
COMMENT ON COLUMN plan_reschedule_history.validation_passes IS 'Number of validation attempts before successful application';

