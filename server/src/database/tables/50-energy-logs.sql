-- ============================================
-- ENERGY LOGS TABLE
-- ============================================
-- Energy level tracking throughout the day

DROP TABLE IF EXISTS energy_logs CASCADE;
CREATE TABLE energy_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Energy rating (1-10 scale)
    energy_rating INTEGER NOT NULL CHECK (energy_rating >= 1 AND energy_rating <= 10),
    
    -- Context tagging
    context_tag VARCHAR(50), -- 'post-meal', 'post-workout', 'during-work', 'after-sleep', 'after-caffeine', 'after-social-activity'
    
    -- Optional context note
    context_note TEXT CHECK (char_length(context_note) <= 300),
    
    -- Timestamp (UTC)
    logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_energy_logs_user_logged ON energy_logs(user_id, logged_at DESC);
-- Note: DATE index removed (TIMESTAMPTZ->date cast is not IMMUTABLE); use logged_at range queries instead
CREATE INDEX idx_energy_logs_context ON energy_logs(user_id, context_tag, logged_at DESC);
CREATE INDEX idx_energy_logs_rating ON energy_logs(user_id, energy_rating, logged_at DESC);

-- Trigger for updated_at (added to 99-triggers.sql)

