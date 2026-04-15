-- ============================================
-- HEALTH TRACKING ENHANCEMENT MIGRATION
-- ============================================
-- Adds gamification, workout, progress tracking tables
-- Run this migration after base tables exist

-- ============================================
-- 1. ADD GAMIFICATION COLUMNS TO USERS
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_date DATE;

-- Index for leaderboards
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(total_xp DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_level ON users(current_level DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_streak ON users(current_streak DESC) WHERE is_active = true;

-- ============================================
-- 2. ADD DURATION TO USER GOALS
-- ============================================
ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS plan_duration_weeks INTEGER DEFAULT 4;

-- ============================================
-- 3. ADD WORKOUT/DIET PLAN LINKS TO USER_PLANS
-- ============================================
-- Note: These will be added when workout_plans and diet_plans tables exist
-- ALTER TABLE user_plans ADD COLUMN IF NOT EXISTS workout_plan_id UUID REFERENCES workout_plans(id);
-- Already has reference: plan_id in diet_plans table

-- ============================================
-- 4. USER BODY IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_body_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_type VARCHAR(50) NOT NULL,
    image_key VARCHAR(500) NOT NULL,
    capture_context VARCHAR(50) NOT NULL,
    analysis_status VARCHAR(20) DEFAULT 'pending',
    analysis_result JSONB,
    analyzed_at TIMESTAMP,
    is_encrypted BOOLEAN DEFAULT false,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_body_images_user ON user_body_images(user_id, capture_context);
CREATE INDEX IF NOT EXISTS idx_body_images_user_type ON user_body_images(user_id, image_type);
CREATE INDEX IF NOT EXISTS idx_body_images_captured ON user_body_images(user_id, captured_at DESC);

-- ============================================
-- 5. EXERCISES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    primary_muscle_group VARCHAR(50),
    secondary_muscle_groups TEXT[] DEFAULT '{}',
    equipment_required TEXT[] DEFAULT '{}',
    difficulty_level VARCHAR(20) DEFAULT 'beginner',
    instructions JSONB DEFAULT '[]',
    tips JSONB DEFAULT '[]',
    common_mistakes JSONB DEFAULT '[]',
    video_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    animation_url VARCHAR(500),
    default_sets INTEGER DEFAULT 3,
    default_reps INTEGER DEFAULT 10,
    default_duration_seconds INTEGER,
    default_rest_seconds INTEGER DEFAULT 60,
    is_system BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    calories_per_minute FLOAT,
    met_value FLOAT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle ON exercises(primary_muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_exercises_active ON exercises(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_exercises_tags ON exercises USING GIN(tags);

-- ============================================
-- 6. WORKOUT PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workout_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES user_plans(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    goal_category goal_category NOT NULL,
    initial_difficulty_level VARCHAR(20) DEFAULT 'beginner',
    current_difficulty_multiplier FLOAT DEFAULT 1.0,
    difficulty_adjustment_reason TEXT,
    duration_weeks INTEGER NOT NULL DEFAULT 4,
    workouts_per_week INTEGER DEFAULT 3,
    weekly_schedule JSONB DEFAULT '{}',
    available_equipment TEXT[] DEFAULT '{}',
    workout_location VARCHAR(50) DEFAULT 'gym',
    total_workouts_completed INTEGER DEFAULT 0,
    current_week INTEGER DEFAULT 1,
    overall_completion_rate FLOAT DEFAULT 0,
    status plan_status DEFAULT 'active',
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    paused_at TIMESTAMP,
    ai_generated BOOLEAN DEFAULT true,
    ai_model VARCHAR(50),
    generation_params JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workout_plans_user ON workout_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workout_plans_user_active ON workout_plans(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_workout_plans_plan ON workout_plans(plan_id);

-- ============================================
-- 7. WORKOUT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workout_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL,
    scheduled_day_of_week day_of_week,
    workout_name VARCHAR(200),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_minutes INTEGER,
    status activity_log_status DEFAULT 'pending',
    exercises_completed JSONB DEFAULT '[]',
    total_sets INTEGER DEFAULT 0,
    total_reps INTEGER DEFAULT 0,
    total_volume FLOAT DEFAULT 0,
    difficulty_rating INTEGER,
    energy_level INTEGER,
    mood_after INTEGER,
    notes TEXT,
    progress_photo_key VARCHAR(500),
    xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_user ON workout_logs(user_id, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_plan ON workout_logs(workout_plan_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_workout_logs_status ON workout_logs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workout_logs_date ON workout_logs(scheduled_date);

-- ============================================
-- 8. PROGRESS RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS progress_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    record_type VARCHAR(50) NOT NULL,
    value JSONB NOT NULL,
    photo_keys TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'manual',
    source_device VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_progress_record UNIQUE (user_id, record_date, record_type)
);

CREATE INDEX IF NOT EXISTS idx_progress_records_user ON progress_records(user_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_records_type ON progress_records(user_id, record_type, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_records_date ON progress_records(record_date);

-- ============================================
-- 9. WATER INTAKE LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS water_intake_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    glasses_consumed INTEGER DEFAULT 0,
    target_glasses INTEGER DEFAULT 8,
    ml_consumed INTEGER DEFAULT 0,
    target_ml INTEGER DEFAULT 2000,
    entries JSONB DEFAULT '[]',
    goal_achieved BOOLEAN DEFAULT false,
    achieved_at TIMESTAMP,
    xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_water_log UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_water_intake_user ON water_intake_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_water_intake_date ON water_intake_logs(log_date);

-- ============================================
-- 10. USER XP TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_xp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    xp_amount INTEGER NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(100),
    streak_day INTEGER,
    multiplier FLOAT DEFAULT 1.0,
    base_xp INTEGER,
    description VARCHAR(200),
    total_after INTEGER,
    level_after INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON user_xp_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_source ON user_xp_transactions(user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_date ON user_xp_transactions(created_at DESC);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
