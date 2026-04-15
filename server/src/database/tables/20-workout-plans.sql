-- ============================================
-- WORKOUT PLANS TABLE
-- ============================================
-- AI-generated workout plans with adaptive difficulty

DROP TABLE IF EXISTS workout_plans CASCADE;
CREATE TABLE workout_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES user_plans(id) ON DELETE SET NULL,  -- Associated main plan

    -- Workout plan details
    name VARCHAR(200) NOT NULL,
    description TEXT,
    goal_category goal_category NOT NULL,

    -- Difficulty & adaptation
    initial_difficulty_level VARCHAR(20) DEFAULT 'beginner',  -- 'beginner', 'intermediate', 'advanced'
    current_difficulty_multiplier FLOAT DEFAULT 1.0,          -- Adaptive multiplier (0.5 - 2.0)
    difficulty_adjustment_reason TEXT,                        -- Last adjustment reason

    -- Schedule
    duration_weeks INTEGER NOT NULL DEFAULT 4,
    workouts_per_week INTEGER DEFAULT 3,
    weekly_schedule JSONB DEFAULT '{}',                       -- Day -> workout structure

    -- Equipment available (user specified)
    available_equipment TEXT[] DEFAULT '{}',
    workout_location VARCHAR(50) DEFAULT 'gym',               -- 'gym', 'home', 'outdoor'

    -- Progress
    total_workouts_completed INTEGER DEFAULT 0,
    current_week INTEGER DEFAULT 1,
    overall_completion_rate FLOAT DEFAULT 0,

    -- Status
    status plan_status DEFAULT 'active',
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    paused_at TIMESTAMP,

    -- AI generation metadata
    ai_generated BOOLEAN DEFAULT true,
    ai_model VARCHAR(50),
    generation_params JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_workout_plans_user ON workout_plans(user_id, status);
CREATE INDEX idx_workout_plans_user_active ON workout_plans(user_id) WHERE status = 'active';
CREATE INDEX idx_workout_plans_plan ON workout_plans(plan_id);
