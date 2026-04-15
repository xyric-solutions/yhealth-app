-- ============================================
-- DIET PLANS TABLE
-- ============================================
-- AI-generated nutrition plans with meal schedules

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

-- Indexes
CREATE INDEX idx_diet_plans_user ON diet_plans(user_id, status);
CREATE INDEX idx_diet_plans_user_active ON diet_plans(user_id) WHERE status = 'active';
