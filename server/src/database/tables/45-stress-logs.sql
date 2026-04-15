-- ============================================
-- STRESS LOGS TABLE
-- ============================================
-- Multi-signal stress detection and logging (F7.5)

DROP TABLE IF EXISTS stress_logs CASCADE;
CREATE TABLE stress_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Self-reported stress rating (1-10)
    stress_rating INTEGER NOT NULL CHECK (stress_rating >= 1 AND stress_rating <= 10),
    
    -- Stress triggers (array of enum values)
    triggers stress_trigger[] DEFAULT '{}',
    other_trigger VARCHAR(100) CHECK (char_length(other_trigger) <= 100),
    
    -- Optional note
    note TEXT CHECK (char_length(note) <= 500),
    
    -- Check-in type
    check_in_type check_in_type NOT NULL DEFAULT 'on_demand',
    
    -- Idempotency: client request ID to prevent duplicate logs
    client_request_id VARCHAR(255) NOT NULL,
    
    -- Multi-signal stress scores (for F7.5 multi-signal detection)
    biometric_stress_score DECIMAL(3,1), -- Calculated from HRV, RHR if available
    sentiment_stress_score DECIMAL(3,1), -- Calculated from journaling sentiment
    behavioral_stress_score DECIMAL(3,1), -- Calculated from app usage patterns
    final_stress_score DECIMAL(3,1), -- Aggregated multi-signal score
    
    -- Timestamp (UTC)
    logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint for idempotency
    CONSTRAINT unique_client_request UNIQUE (user_id, client_request_id)
);

-- Indexes
CREATE INDEX idx_stress_logs_user_logged ON stress_logs(user_id, logged_at DESC);
-- Note: DATE index removed (TIMESTAMPTZ->date cast is not IMMUTABLE); use logged_at range queries instead
CREATE INDEX idx_stress_logs_rating ON stress_logs(user_id, stress_rating, logged_at DESC);
CREATE INDEX idx_stress_logs_final_score ON stress_logs(user_id, final_stress_score, logged_at DESC) WHERE final_stress_score IS NOT NULL;
CREATE INDEX idx_stress_logs_check_in_type ON stress_logs(user_id, check_in_type, logged_at DESC);

-- Trigger for updated_at (added to 99-triggers.sql)

