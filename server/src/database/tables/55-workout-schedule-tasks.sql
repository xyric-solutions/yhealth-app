-- ============================================
-- WORKOUT SCHEDULE TASKS TABLE
-- ============================================
-- Individual scheduled workout tasks derived from workout_plans
-- Used for tracking and rescheduling missed workouts

DROP TABLE IF EXISTS workout_schedule_tasks CASCADE;
CREATE TABLE workout_schedule_tasks (
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
CREATE INDEX idx_workout_schedule_tasks_user ON workout_schedule_tasks(user_id, scheduled_date DESC);
CREATE INDEX idx_workout_schedule_tasks_plan ON workout_schedule_tasks(workout_plan_id, scheduled_date DESC);
CREATE INDEX idx_workout_schedule_tasks_status ON workout_schedule_tasks(user_id, status, scheduled_date) WHERE status IN ('pending', 'missed');
CREATE INDEX idx_workout_schedule_tasks_missed ON workout_schedule_tasks(user_id, scheduled_date) WHERE status = 'missed';
CREATE INDEX idx_workout_schedule_tasks_date_range ON workout_schedule_tasks(user_id, scheduled_date);

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

