-- Migration: Add scheduled_time column to workout_plans
-- This allows users to set preferred workout time for their plans

ALTER TABLE workout_plans
ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(10) DEFAULT NULL;

-- Comment: Time format is HH:MM (24-hour), e.g., '07:00', '18:30'
COMMENT ON COLUMN workout_plans.scheduled_time IS 'Preferred workout time in HH:MM format';
