-- ============================================
-- EXERCISES TABLE
-- ============================================
-- Exercise library for workout plans

DROP TABLE IF EXISTS exercises CASCADE;
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Exercise details
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,                 -- 'strength', 'cardio', 'flexibility', 'balance', 'plyometric'

    -- Muscle groups
    primary_muscle_group VARCHAR(50),              -- 'chest', 'back', 'shoulders', 'legs', 'arms', 'core'
    secondary_muscle_groups TEXT[] DEFAULT '{}',

    -- Equipment & difficulty
    equipment_required TEXT[] DEFAULT '{}',        -- ['barbell', 'dumbbell', 'none', etc.]
    difficulty_level VARCHAR(20) DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'

    -- Instructions
    instructions JSONB DEFAULT '[]',               -- Step by step instructions
    tips JSONB DEFAULT '[]',                       -- Pro tips
    common_mistakes JSONB DEFAULT '[]',

    -- Media
    video_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    animation_url VARCHAR(500),

    -- Defaults
    default_sets INTEGER DEFAULT 3,
    default_reps INTEGER DEFAULT 10,
    default_duration_seconds INTEGER,              -- For timed exercises
    default_rest_seconds INTEGER DEFAULT 60,

    -- Metadata
    is_system BOOLEAN DEFAULT true,                -- System-defined vs user-created
    is_active BOOLEAN DEFAULT true,
    calories_per_minute FLOAT,
    met_value FLOAT,                               -- Metabolic equivalent

    -- Search
    tags TEXT[] DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_exercises_category ON exercises(category);
CREATE INDEX idx_exercises_muscle ON exercises(primary_muscle_group);
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty_level);
CREATE INDEX idx_exercises_active ON exercises(is_active) WHERE is_active = true;
CREATE INDEX idx_exercises_tags ON exercises USING GIN(tags);
