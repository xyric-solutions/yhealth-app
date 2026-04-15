-- Force create workout reschedule tables
-- Run this if tables don't exist after migration

-- Check and create workout_schedule_tasks
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workout_schedule_tasks') THEN
        CREATE TABLE workout_schedule_tasks (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            workout_plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
            scheduled_date DATE NOT NULL,
            workout_data JSONB NOT NULL DEFAULT '{}',
            status activity_log_status DEFAULT 'pending',
            intensity VARCHAR(20) DEFAULT 'medium',
            muscle_groups TEXT[] DEFAULT '{}',
            estimated_duration_minutes INTEGER,
            original_scheduled_date DATE,
            reschedule_count INTEGER DEFAULT 0,
            last_rescheduled_at TIMESTAMP,
            completed_at TIMESTAMP,
            workout_log_id UUID REFERENCES workout_logs(id) ON DELETE SET NULL,
            notes TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(workout_plan_id, scheduled_date)
        );
        
        CREATE INDEX idx_workout_schedule_tasks_user ON workout_schedule_tasks(user_id, scheduled_date DESC);
        CREATE INDEX idx_workout_schedule_tasks_plan ON workout_schedule_tasks(workout_plan_id, scheduled_date DESC);
        CREATE INDEX idx_workout_schedule_tasks_status ON workout_schedule_tasks(user_id, status, scheduled_date) WHERE status IN ('pending', 'missed');
        CREATE INDEX idx_workout_schedule_tasks_missed ON workout_schedule_tasks(user_id, scheduled_date) WHERE status = 'missed';
        CREATE INDEX idx_workout_schedule_tasks_date_range ON workout_schedule_tasks(user_id, scheduled_date);
        
        CREATE TRIGGER update_workout_schedule_tasks_updated_at
            BEFORE UPDATE ON workout_schedule_tasks
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
            
        RAISE NOTICE 'Created workout_schedule_tasks table';
    ELSE
        RAISE NOTICE 'workout_schedule_tasks table already exists';
    END IF;
END $$;

-- Check and create user_workout_constraints
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_workout_constraints') THEN
        CREATE TABLE user_workout_constraints (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            max_sessions_per_week INTEGER DEFAULT 5,
            max_hard_sessions_per_week INTEGER DEFAULT 2,
            max_sessions_per_day INTEGER DEFAULT 1,
            available_days day_of_week[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']::day_of_week[],
            rest_days day_of_week[] DEFAULT ARRAY['sunday']::day_of_week[],
            min_rest_hours_between_sessions INTEGER DEFAULT 24,
            min_rest_hours_after_heavy_leg INTEGER DEFAULT 48,
            preferred_workout_times JSONB DEFAULT '{}',
            muscle_group_recovery_hours JSONB DEFAULT '{"legs": 48, "chest": 24, "back": 24, "shoulders": 24, "arms": 24}',
            avoid_consecutive_days BOOLEAN DEFAULT false,
            max_weekly_volume INTEGER,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_user_workout_constraints_user ON user_workout_constraints(user_id);
        
        CREATE TRIGGER update_user_workout_constraints_updated_at
            BEFORE UPDATE ON user_workout_constraints
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
            
        RAISE NOTICE 'Created user_workout_constraints table';
    ELSE
        RAISE NOTICE 'user_workout_constraints table already exists';
    END IF;
END $$;

-- Check and create plan_reschedule_history
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plan_reschedule_history') THEN
        CREATE TABLE plan_reschedule_history (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan_id UUID REFERENCES user_plans(id) ON DELETE SET NULL,
            workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
            reschedule_type VARCHAR(20) NOT NULL,
            policy_used plan_policy NOT NULL,
            missed_tasks JSONB NOT NULL DEFAULT '[]',
            valid_slots JSONB DEFAULT '[]',
            reschedule_actions JSONB NOT NULL DEFAULT '[]',
            validation_errors JSONB DEFAULT '[]',
            validation_passes INTEGER DEFAULT 0,
            llm_proposals JSONB DEFAULT '[]',
            final_proposal JSONB,
            user_summary TEXT,
            user_notified BOOLEAN DEFAULT false,
            applied BOOLEAN DEFAULT false,
            applied_at TIMESTAMP,
            error_message TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_plan_reschedule_history_user ON plan_reschedule_history(user_id, created_at DESC);
        CREATE INDEX idx_plan_reschedule_history_plan ON plan_reschedule_history(plan_id, created_at DESC);
        CREATE INDEX idx_plan_reschedule_history_workout_plan ON plan_reschedule_history(workout_plan_id, created_at DESC);
        CREATE INDEX idx_plan_reschedule_history_type ON plan_reschedule_history(reschedule_type, created_at DESC);
        CREATE INDEX idx_plan_reschedule_history_applied ON plan_reschedule_history(user_id, applied, created_at DESC);
        
        RAISE NOTICE 'Created plan_reschedule_history table';
    ELSE
        RAISE NOTICE 'plan_reschedule_history table already exists';
    END IF;
END $$;

