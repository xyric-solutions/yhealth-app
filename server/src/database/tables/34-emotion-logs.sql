-- ============================================
-- EMOTION LOGS TABLE
-- ============================================
-- Store detected emotions from voice calls and integrate with wellbeing data

DROP TABLE IF EXISTS emotion_logs CASCADE;
CREATE TABLE emotion_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Call/Session reference
    call_id UUID REFERENCES voice_calls(id) ON DELETE SET NULL,
    conversation_id UUID,  -- FK to rag_conversations omitted: table may not exist if pgvector is unavailable
    
    -- Emotion data
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    emotion_category emotion_category NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    -- Source tracking
    source VARCHAR(20) NOT NULL DEFAULT 'voice', -- 'voice', 'text'
    
    -- Raw data from detection service
    raw_data JSONB DEFAULT '{}',
    
    -- Integration with wellbeing
    linked_to_mood_log BOOLEAN DEFAULT false,
    mood_log_id UUID, -- Reference to activity_status_history if linked
    
    -- Privacy and retention
    retention_until TIMESTAMP, -- 24 months from timestamp
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_timestamp ON emotion_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_call ON emotion_logs(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emotion_logs_conversation ON emotion_logs(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emotion_logs_category ON emotion_logs(user_id, emotion_category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_retention ON emotion_logs(retention_until) WHERE retention_until IS NOT NULL;

-- Auto-set retention_until on insert (24 months)
CREATE OR REPLACE FUNCTION set_emotion_log_retention()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.retention_until IS NULL THEN
        NEW.retention_until = NEW.timestamp + INTERVAL '24 months';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_emotion_log_retention ON emotion_logs;
CREATE TRIGGER trigger_set_emotion_log_retention
    BEFORE INSERT ON emotion_logs
    FOR EACH ROW EXECUTE FUNCTION set_emotion_log_retention();

-- Trigger for updated_at (will be added to 99-triggers.sql)

