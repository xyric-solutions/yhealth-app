-- ============================================
-- ADD SESSION TYPE TO VOICE CALLS
-- ============================================
-- Migration to add session_type and related columns to voice_calls table

-- Add session_type column
ALTER TABLE voice_calls 
ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'health_coach';

-- Add emergency_triggered column
ALTER TABLE voice_calls 
ADD COLUMN IF NOT EXISTS emergency_triggered BOOLEAN DEFAULT false;

-- Add conversation_id column (if not exists)
ALTER TABLE voice_calls 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES rag_conversations(id) ON DELETE SET NULL;

-- Add emotion_summary column
ALTER TABLE voice_calls 
ADD COLUMN IF NOT EXISTS emotion_summary JSONB DEFAULT '{}';

-- Create index for session_type
CREATE INDEX IF NOT EXISTS idx_voice_calls_session_type ON voice_calls(session_type);

-- Create index for emergency_triggered
CREATE INDEX IF NOT EXISTS idx_voice_calls_emergency ON voice_calls(emergency_triggered) WHERE emergency_triggered = true;

-- Add call_purpose column
ALTER TABLE voice_calls 
ADD COLUMN IF NOT EXISTS call_purpose VARCHAR(50);

-- Create index for call_purpose
CREATE INDEX IF NOT EXISTS idx_voice_calls_purpose ON voice_calls(call_purpose) WHERE call_purpose IS NOT NULL;

