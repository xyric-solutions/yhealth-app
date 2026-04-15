-- Call Summaries Table
-- Stores generated summaries for voice calls

CREATE TABLE IF NOT EXISTS call_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL,
    depth_mode VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (depth_mode IN ('light', 'deep')),
    summary TEXT NOT NULL,
    key_insights JSONB DEFAULT '[]'::JSONB,
    emotional_trend VARCHAR(50),
    duration INTEGER NOT NULL DEFAULT 0, -- in seconds
    delivery_status JSONB DEFAULT '{"app": false, "whatsapp": false, "push": false}'::JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_call_summary UNIQUE (call_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_summaries_user_id ON call_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_call_summaries_call_id ON call_summaries(call_id);
CREATE INDEX IF NOT EXISTS idx_call_summaries_generated_at ON call_summaries(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_summaries_session_type ON call_summaries(session_type);

-- Comments
COMMENT ON TABLE call_summaries IS 'Stores AI-generated summaries for voice coaching calls';
COMMENT ON COLUMN call_summaries.depth_mode IS 'Summary depth: light (brief) or deep (comprehensive)';
COMMENT ON COLUMN call_summaries.key_insights IS 'JSON array of key insights from the session';
COMMENT ON COLUMN call_summaries.emotional_trend IS 'Dominant emotion detected during the call';
COMMENT ON COLUMN call_summaries.delivery_status IS 'Tracks delivery to different channels';

