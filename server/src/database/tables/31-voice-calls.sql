-- ============================================
-- VOICE CALLS TABLE
-- ============================================
-- Track user-initiated voice calls with AI coach

DROP TABLE IF EXISTS voice_calls CASCADE;
CREATE TABLE voice_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Call metadata
  channel call_channel NOT NULL,
  status call_status DEFAULT 'initiating',
  session_id UUID,  -- Links to ai_coach_sessions if conversation started
  conversation_id UUID,  -- Links to rag_conversations (FK omitted: table may not exist if pgvector is unavailable)
  
  -- Session type
  session_type VARCHAR(50) DEFAULT 'health_coach', -- 'quick_checkin', 'coaching_session', 'emergency_support', 'goal_review', 'health_coach', 'nutrition', 'fitness', 'wellness'
  emergency_triggered BOOLEAN DEFAULT false, -- Flag for emergency sessions
  
  -- Timing
  initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  connected_at TIMESTAMP,
  ended_at TIMESTAMP,
  connection_duration INTEGER,  -- Seconds to connect
  call_duration INTEGER,         -- Total call duration in seconds
  
  -- Connection details
  webrtc_session_id VARCHAR(255),
  signaling_url TEXT,
  ice_servers JSONB,
  
  -- Error tracking
  error_code VARCHAR(50),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Context
  pre_call_context TEXT,  -- User's stated reason for call
  call_purpose VARCHAR(50),  -- Purpose category: 'workout', 'nutrition', 'meal', 'emotion', 'emergency', 'sleep', 'stress', 'goal_review', 'general_health', 'fitness', 'wellness', 'recovery'
  call_summary TEXT,       -- AI-generated summary after call
  
  -- Emotion tracking
  emotion_summary JSONB DEFAULT '{}',  -- Aggregated emotions for the call: {emotions: [{category, count, avgConfidence}], dominant: string}
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_voice_calls_user ON voice_calls(user_id, initiated_at DESC);
CREATE INDEX idx_voice_calls_status ON voice_calls(status) WHERE status IN ('initiating', 'connecting', 'active');
CREATE INDEX idx_voice_calls_channel ON voice_calls(channel, initiated_at DESC);
CREATE INDEX idx_voice_calls_webrtc_session ON voice_calls(webrtc_session_id) WHERE webrtc_session_id IS NOT NULL;
CREATE INDEX idx_voice_calls_purpose ON voice_calls(call_purpose) WHERE call_purpose IS NOT NULL;

