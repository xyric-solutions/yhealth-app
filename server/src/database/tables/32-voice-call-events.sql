-- ============================================
-- VOICE CALL EVENTS TABLE
-- ============================================
-- Detailed event tracking for voice calls (analytics)

DROP TABLE IF EXISTS voice_call_events CASCADE;
CREATE TABLE voice_call_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
  event_type call_event_type NOT NULL,
  event_data JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_call_events_call ON voice_call_events(call_id, timestamp);
CREATE INDEX idx_call_events_type ON voice_call_events(event_type, timestamp);

