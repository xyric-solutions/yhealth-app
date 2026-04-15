-- ============================================
-- MIGRATION: Add activity_events table
-- ============================================
-- Core event ingestion table for workout, nutrition, wellbeing, and participation events
-- Supports multiple sources (manual, device integrations, camera sessions)

-- Ensure enum types exist (they should already exist from 01-enums.sql)
DO $$ BEGIN
  CREATE TYPE activity_event_type AS ENUM ('workout', 'nutrition', 'wellbeing', 'participation');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_event_source AS ENUM ('manual', 'whoop', 'apple_health', 'fitbit', 'garmin', 'oura', 'camera_session', 'integration');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Event type and source
  type activity_event_type NOT NULL,
  source activity_event_source NOT NULL,
  
  -- Timestamp (UTC, will be converted to user's local timezone for daily boundaries)
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Event-specific data (flexible JSONB structure)
  payload JSONB NOT NULL,
  
  -- Anti-cheat and confidence scoring
  confidence DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  flags JSONB DEFAULT '{}', -- {verified: bool, anomaly_detected: bool, requires_review: bool}
  
  -- Deduplication
  idempotency_key VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint for idempotency
  UNIQUE(user_id, idempotency_key)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_activity_events_user_date ON activity_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_type_date ON activity_events(type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_type_date ON activity_events(user_id, type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_timestamp ON activity_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_confidence ON activity_events(confidence) WHERE confidence < 0.8;
CREATE INDEX IF NOT EXISTS idx_activity_events_flags ON activity_events USING GIN (flags);

-- Comments
COMMENT ON TABLE activity_events IS 'Core event ingestion table for all activity types (workout, nutrition, wellbeing, participation)';
COMMENT ON COLUMN activity_events.type IS 'Type of activity event: workout, nutrition, wellbeing, participation';
COMMENT ON COLUMN activity_events.source IS 'Source of the event: manual, device integration, camera session, etc.';
COMMENT ON COLUMN activity_events.confidence IS 'Confidence score 0.0-1.0 for anti-cheat (manual: 0.8, device: 0.95, camera: 1.0)';
COMMENT ON COLUMN activity_events.flags IS 'JSONB flags: {verified: bool, anomaly_detected: bool, requires_review: bool}';
COMMENT ON COLUMN activity_events.idempotency_key IS 'Optional key for deduplication (user_id + timestamp + type + hash of payload)';

