-- ============================================
-- USER WORKOUT CONSTRAINTS TABLE
-- ============================================
-- User-specific workout scheduling constraints
-- Used for validating reschedule proposals

DROP TABLE IF EXISTS user_workout_constraints CASCADE;
CREATE TABLE user_workout_constraints (
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
CREATE INDEX idx_user_workout_constraints_user ON user_workout_constraints(user_id);

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

