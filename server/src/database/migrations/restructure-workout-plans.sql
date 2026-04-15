-- ============================================
-- WORKOUT PLANS RESTRUCTURE MIGRATION
-- ============================================
-- Adds week-by-week organization, progressive overload, and schedule days

-- Add schedule_days column (array of workout days)
ALTER TABLE workout_plans 
ADD COLUMN IF NOT EXISTS schedule_days TEXT[] DEFAULT '{}';

-- Add progressive_overload settings
ALTER TABLE workout_plans 
ADD COLUMN IF NOT EXISTS progressive_overload JSONB DEFAULT '{
  "enabled": true,
  "weight_increment_percent": 5,
  "reps_increment": 1,
  "deload_week": 4,
  "deload_multiplier": 0.85
}'::jsonb;

-- Add weeks JSONB column for week-by-week structure
-- Structure: { "week_1": { "monday": {...}, "tuesday": {...} }, "week_2": {...} }
ALTER TABLE workout_plans 
ADD COLUMN IF NOT EXISTS weeks JSONB DEFAULT '{}'::jsonb;

-- Add notes column for general plan notes
ALTER TABLE workout_plans 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add current_day tracking
ALTER TABLE workout_plans 
ADD COLUMN IF NOT EXISTS current_day VARCHAR(20);

-- Migrate existing weekly_schedule data to weeks.week_1 if weeks is empty
UPDATE workout_plans 
SET weeks = jsonb_build_object('week_1', weekly_schedule)
WHERE weekly_schedule IS NOT NULL 
  AND weekly_schedule != '{}'::jsonb 
  AND (weeks IS NULL OR weeks = '{}'::jsonb);

-- Create index for faster week queries
CREATE INDEX IF NOT EXISTS idx_workout_plans_weeks ON workout_plans USING GIN (weeks);

-- Create index for schedule_days
CREATE INDEX IF NOT EXISTS idx_workout_plans_schedule_days ON workout_plans USING GIN (schedule_days);

COMMENT ON COLUMN workout_plans.schedule_days IS 'Array of days when workouts are scheduled (e.g., monday, tuesday, thursday)';
COMMENT ON COLUMN workout_plans.progressive_overload IS 'Progressive overload settings including weight/rep increments per week';
COMMENT ON COLUMN workout_plans.weeks IS 'Week-by-week workout structure: { week_1: { monday: {...}, tuesday: {...} }, week_2: {...} }';
COMMENT ON COLUMN workout_plans.notes IS 'General notes for the workout plan';

