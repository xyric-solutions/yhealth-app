-- Add screen time tracking to daily check-ins
-- Phase 5: Screen Time Integration
ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS screen_time_minutes INTEGER;
ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS screen_time_source VARCHAR(20) DEFAULT 'manual';
