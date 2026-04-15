-- AI Coach Sessions Table
-- Stores chat history for personalized coaching and diagnosis

-- Session status enum
DROP TYPE IF EXISTS ai_session_status CASCADE;
CREATE TYPE ai_session_status AS ENUM ('active', 'completed', 'abandoned');

-- AI Coach Sessions table
DROP TABLE IF EXISTS ai_coach_sessions CASCADE;
CREATE TABLE ai_coach_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session metadata
    goal_category goal_category NOT NULL,
    session_type VARCHAR(50) DEFAULT 'assessment',  -- 'assessment', 'follow_up', 'plan_review', 'diet_consultation'

    -- Conversation data
    messages JSONB DEFAULT '[]',              -- Array of {role, content, timestamp}
    extracted_insights JSONB DEFAULT '[]',    -- Array of insights extracted
    conversation_phase VARCHAR(50) DEFAULT 'opening',

    -- Status
    status ai_session_status DEFAULT 'active',
    message_count INTEGER DEFAULT 0,
    user_message_count INTEGER DEFAULT 0,

    -- Completion
    is_complete BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,

    -- Plan generated from this session
    generated_plan_id UUID REFERENCES user_plans(id) ON DELETE SET NULL,

    -- Summary for future context
    session_summary TEXT,
    key_takeaways JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_ai_coach_sessions_user ON ai_coach_sessions(user_id, created_at DESC);
CREATE INDEX idx_ai_coach_sessions_user_status ON ai_coach_sessions(user_id, status);
CREATE INDEX idx_ai_coach_sessions_user_goal ON ai_coach_sessions(user_id, goal_category);
CREATE INDEX idx_ai_coach_sessions_active ON ai_coach_sessions(user_id, status) WHERE status = 'active';

-- Trigger for updated_at
CREATE TRIGGER update_ai_coach_sessions_updated_at
    BEFORE UPDATE ON ai_coach_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Diet Plans Table (extends from user_plans concept but specialized for nutrition)
DROP TABLE IF EXISTS diet_plans CASCADE;
CREATE TABLE diet_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES user_plans(id) ON DELETE SET NULL,  -- Associated main plan
    ai_session_id UUID REFERENCES ai_coach_sessions(id) ON DELETE SET NULL,

    -- Diet plan details
    name VARCHAR(200) NOT NULL,
    description TEXT,
    goal_category goal_category NOT NULL,

    -- Calorie & macro targets
    daily_calories INTEGER,
    protein_grams INTEGER,
    carbs_grams INTEGER,
    fat_grams INTEGER,
    fiber_grams INTEGER,

    -- Dietary preferences & restrictions
    dietary_preferences JSONB DEFAULT '[]',   -- ['vegetarian', 'low-carb', etc.]
    allergies JSONB DEFAULT '[]',
    excluded_foods JSONB DEFAULT '[]',

    -- Meal structure
    meals_per_day INTEGER DEFAULT 3,
    snacks_per_day INTEGER DEFAULT 2,
    meal_times JSONB DEFAULT '{}',            -- {'breakfast': '07:00', 'lunch': '12:00', etc.}

    -- Weekly meal plan
    weekly_meals JSONB DEFAULT '{}',          -- Day -> meals structure

    -- Recipes & suggestions
    suggested_recipes JSONB DEFAULT '[]',
    shopping_list JSONB DEFAULT '[]',

    -- Progress tracking
    adherence_rate FLOAT DEFAULT 0,

    -- Status
    status plan_status DEFAULT 'active',
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,

    -- AI generation metadata
    ai_generated BOOLEAN DEFAULT true,
    ai_model VARCHAR(50),
    generation_params JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for diet_plans
CREATE INDEX idx_diet_plans_user ON diet_plans(user_id, status);
CREATE INDEX idx_diet_plans_user_active ON diet_plans(user_id) WHERE status = 'active';

-- Trigger for updated_at
CREATE TRIGGER update_diet_plans_updated_at
    BEFORE UPDATE ON diet_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Meal Logs Table (track actual meals eaten)
DROP TABLE IF EXISTS meal_logs CASCADE;
CREATE TABLE meal_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diet_plan_id UUID REFERENCES diet_plans(id) ON DELETE SET NULL,

    -- Meal details
    meal_type VARCHAR(50) NOT NULL,           -- 'breakfast', 'lunch', 'dinner', 'snack'
    meal_name VARCHAR(200),
    description TEXT,

    -- Nutrition info
    calories INTEGER,
    protein_grams FLOAT,
    carbs_grams FLOAT,
    fat_grams FLOAT,
    fiber_grams FLOAT,

    -- Foods eaten
    foods JSONB DEFAULT '[]',                 -- [{name, portion, calories, etc.}]

    -- Photo (optional)
    photo_url VARCHAR(500),

    -- Time
    eaten_at TIMESTAMP NOT NULL,

    -- Mood & notes
    hunger_before INTEGER,                    -- 1-5 scale
    satisfaction_after INTEGER,               -- 1-5 scale
    notes TEXT,

    -- AI analysis
    ai_feedback TEXT,
    health_score INTEGER,                     -- 1-100

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for meal_logs
CREATE INDEX idx_meal_logs_user_date ON meal_logs(user_id, eaten_at DESC);
CREATE INDEX idx_meal_logs_user_type ON meal_logs(user_id, meal_type);

-- Trigger for updated_at
CREATE TRIGGER update_meal_logs_updated_at
    BEFORE UPDATE ON meal_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
