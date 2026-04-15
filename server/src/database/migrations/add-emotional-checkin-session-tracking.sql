-- ============================================
-- MIGRATION: Add session_id to wellbeing tables
-- ============================================
-- Links mood_logs, stress_logs, and energy_logs to emotional_checkin_sessions

-- Add session_id to mood_logs
ALTER TABLE mood_logs 
ADD COLUMN IF NOT EXISTS emotional_checkin_session_id UUID REFERENCES emotional_checkin_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mood_logs_checkin_session ON mood_logs(emotional_checkin_session_id) WHERE emotional_checkin_session_id IS NOT NULL;

-- Add session_id to stress_logs
ALTER TABLE stress_logs 
ADD COLUMN IF NOT EXISTS emotional_checkin_session_id UUID REFERENCES emotional_checkin_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stress_logs_checkin_session ON stress_logs(emotional_checkin_session_id) WHERE emotional_checkin_session_id IS NOT NULL;

-- Add session_id to energy_logs
ALTER TABLE energy_logs 
ADD COLUMN IF NOT EXISTS emotional_checkin_session_id UUID REFERENCES emotional_checkin_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_energy_logs_checkin_session ON energy_logs(emotional_checkin_session_id) WHERE emotional_checkin_session_id IS NOT NULL;

