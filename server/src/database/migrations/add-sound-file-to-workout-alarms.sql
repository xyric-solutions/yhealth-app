-- Migration: Add sound_file column to workout_alarms
-- This allows users to select which sound to play when alarm triggers

ALTER TABLE workout_alarms
ADD COLUMN IF NOT EXISTS sound_file VARCHAR(50) DEFAULT 'alarm.wav';

-- Comment: Available sounds: alarm.wav, azan1.mp3, azan2.mp3, azan3.mp3
COMMENT ON COLUMN workout_alarms.sound_file IS 'Sound file name to play when alarm triggers (alarm.wav, azan1.mp3, azan2.mp3, azan3.mp3)';

-- Update existing alarms to have default sound if they don't have one
UPDATE workout_alarms
SET sound_file = 'alarm.wav'
WHERE sound_file IS NULL;

