-- ============================================
-- WORKOUT LOGS TABLE
-- ============================================
-- Logs individual workout sessions and exercise completions

DROP TABLE IF EXISTS workout_logs CASCADE;
CREATE TABLE workout_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,

    -- Scheduling
    scheduled_date DATE NOT NULL,
    scheduled_day_of_week day_of_week,
    workout_name VARCHAR(200),

    -- Completion
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_minutes INTEGER,
    status activity_log_status DEFAULT 'pending',

    -- Exercises completed
    exercises_completed JSONB DEFAULT '[]',       -- [{exercise_id, sets: [{reps, weight, completed}], notes}]
    total_sets INTEGER DEFAULT 0,
    total_reps INTEGER DEFAULT 0,
    total_volume FLOAT DEFAULT 0,                  -- Weight * reps for strength tracking

    -- User feedback
    difficulty_rating INTEGER,                     -- 1-5 (too easy to too hard)
    energy_level INTEGER,                          -- 1-5
    mood_after INTEGER,                            -- 1-5
    notes TEXT,

    -- Progress photo (optional)
    progress_photo_key VARCHAR(500),

    -- Gamification
    xp_earned INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_workout_logs_user ON workout_logs(user_id, scheduled_date DESC);
CREATE INDEX idx_workout_logs_plan ON workout_logs(workout_plan_id, scheduled_date);
CREATE INDEX idx_workout_logs_status ON workout_logs(user_id, status);
CREATE INDEX idx_workout_logs_date ON workout_logs(scheduled_date);
