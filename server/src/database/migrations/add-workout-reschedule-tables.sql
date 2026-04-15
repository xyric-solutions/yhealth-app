-- ============================================
-- MIGRATION: Add Workout Reschedule System Tables
-- ============================================
-- Creates tables for workout schedule tracking and rescheduling
-- Run this after base tables exist (workout_plans, user_plans, users)
--
-- Dependencies:
-- - plan_policy enum (should exist in 01-enums.sql or added by add-plan-policy-to-user-plans.sql)
-- - activity_log_status enum with 'missed' value (added by add-missed-to-activity-log-status.sql)
-- - day_of_week enum (should exist in 01-enums.sql)
-- - workout_plans table
-- - user_plans table
-- - users table
-- - workout_logs table
-- ============================================

-- ============================================
-- 1. WORKOUT SCHEDULE TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workout_schedule_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
    
    -- Scheduling
    scheduled_date DATE NOT NULL,
    
    -- Workout data (full workout structure from plan)
    workout_data JSONB NOT NULL DEFAULT '{}',
    
    -- Status tracking
    status activity_log_status DEFAULT 'pending',  -- 'pending', 'completed', 'skipped', 'partial', 'missed'
    
    -- Workout metadata for constraint checking
    intensity VARCHAR(20) DEFAULT 'medium',  -- 'light', 'medium', 'hard'
    muscle_groups TEXT[] DEFAULT '{}',      -- Array of primary muscle groups targeted
    estimated_duration_minutes INTEGER,     -- Estimated workout duration
    
    -- Reschedule tracking
    original_scheduled_date DATE,           -- Original date before reschedule
    reschedule_count INTEGER DEFAULT 0,      -- How many times this task has been rescheduled
    last_rescheduled_at TIMESTAMP,
    
    -- Completion tracking
    completed_at TIMESTAMP,
    workout_log_id UUID REFERENCES workout_logs(id) ON DELETE SET NULL,
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one task per plan per date
    UNIQUE(workout_plan_id, scheduled_date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workout_schedule_tasks_user ON workout_schedule_tasks(user_id, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_schedule_tasks_plan ON workout_schedule_tasks(workout_plan_id, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_schedule_tasks_status ON workout_schedule_tasks(user_id, status, scheduled_date) WHERE status IN ('pending', 'missed');
CREATE INDEX IF NOT EXISTS idx_workout_schedule_tasks_missed ON workout_schedule_tasks(user_id, scheduled_date) WHERE status = 'missed';
-- Note: Partial index for future dates - CURRENT_DATE is not immutable, so we'll create a regular index instead
CREATE INDEX IF NOT EXISTS idx_workout_schedule_tasks_date_range ON workout_schedule_tasks(user_id, scheduled_date);

-- Trigger for updated_at
CREATE TRIGGER update_workout_schedule_tasks_updated_at
    BEFORE UPDATE ON workout_schedule_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE workout_schedule_tasks IS 'Individual scheduled workout tasks for tracking and rescheduling';
COMMENT ON COLUMN workout_schedule_tasks.workout_data IS 'Full workout structure including exercises, sets, reps, etc.';
COMMENT ON COLUMN workout_schedule_tasks.intensity IS 'Workout intensity level for constraint checking';
COMMENT ON COLUMN workout_schedule_tasks.muscle_groups IS 'Primary muscle groups targeted (e.g., ["legs", "chest", "back"])';
COMMENT ON COLUMN workout_schedule_tasks.original_scheduled_date IS 'Original date before any reschedules';
COMMENT ON COLUMN workout_schedule_tasks.reschedule_count IS 'Number of times this task has been rescheduled';

-- ============================================
-- 2. USER WORKOUT CONSTRAINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_workout_constraints (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session limits
    max_sessions_per_week INTEGER DEFAULT 5,
    max_hard_sessions_per_week INTEGER DEFAULT 2,
    max_sessions_per_day INTEGER DEFAULT 1,
    
    -- Availability
    available_days day_of_week[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']::day_of_week[],
    rest_days day_of_week[] DEFAULT ARRAY['sunday']::day_of_week[],
    
    -- Recovery rules
    min_rest_hours_between_sessions INTEGER DEFAULT 24,  -- Minimum hours between any sessions
    min_rest_hours_after_heavy_leg INTEGER DEFAULT 48,    -- Minimum hours after heavy leg workout
    
    -- Preferred times (stored as JSONB: { "monday": ["09:00", "18:00"], ... })
    preferred_workout_times JSONB DEFAULT '{}',
    
    -- Muscle group recovery rules (stored as JSONB: { "legs": 48, "chest": 24, ... })
    muscle_group_recovery_hours JSONB DEFAULT '{"legs": 48, "chest": 24, "back": 24, "shoulders": 24, "arms": 24}',
    
    -- Additional constraints
    avoid_consecutive_days BOOLEAN DEFAULT false,
    max_weekly_volume INTEGER,  -- Optional: max total volume per week
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_workout_constraints_user ON user_workout_constraints(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_workout_constraints_updated_at
    BEFORE UPDATE ON user_workout_constraints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_workout_constraints IS 'User-specific workout scheduling constraints for reschedule validation';
COMMENT ON COLUMN user_workout_constraints.available_days IS 'Days of week when user can workout';
COMMENT ON COLUMN user_workout_constraints.rest_days IS 'Days of week when user prefers rest';
COMMENT ON COLUMN user_workout_constraints.preferred_workout_times IS 'Preferred workout times by day: {"monday": ["09:00", "18:00"], ...}';
COMMENT ON COLUMN user_workout_constraints.muscle_group_recovery_hours IS 'Minimum recovery hours by muscle group: {"legs": 48, "chest": 24, ...}';

-- ============================================
-- 3. PLAN RESCHEDULE HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS plan_reschedule_history (
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
CREATE INDEX IF NOT EXISTS idx_plan_reschedule_history_user ON plan_reschedule_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_reschedule_history_plan ON plan_reschedule_history(plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_reschedule_history_workout_plan ON plan_reschedule_history(workout_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_reschedule_history_type ON plan_reschedule_history(reschedule_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_reschedule_history_applied ON plan_reschedule_history(user_id, applied, created_at DESC);

COMMENT ON TABLE plan_reschedule_history IS 'Audit trail for all workout reschedule operations';
COMMENT ON COLUMN plan_reschedule_history.missed_tasks IS 'Array of missed task details: [{ task_id, scheduled_date, workout_data, ... }]';
COMMENT ON COLUMN plan_reschedule_history.reschedule_actions IS 'Actions taken: [{ action: "move"|"drop"|"compress", task_id, old_date, new_date, reason }]';
COMMENT ON COLUMN plan_reschedule_history.llm_proposals IS 'All LLM proposals including rejected ones for debugging';
COMMENT ON COLUMN plan_reschedule_history.validation_passes IS 'Number of validation attempts before successful application';

