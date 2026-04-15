-- ============================================
-- MOOD LOGS TABLE
-- ============================================
-- Track mood check-ins with emoji and detailed ratings

DROP TABLE IF EXISTS mood_logs CASCADE;
CREATE TABLE mood_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Mood emoji (Light mode)
    mood_emoji mood_emoji,
    
    -- One-word descriptor (Light mode, optional)
    descriptor VARCHAR(50),
    
    -- Detailed ratings (Deep mode, 1-10 scale)
    happiness_rating INTEGER CHECK (happiness_rating >= 1 AND happiness_rating <= 10),
    energy_rating INTEGER CHECK (energy_rating >= 1 AND energy_rating <= 10),
    stress_rating INTEGER CHECK (stress_rating >= 1 AND stress_rating <= 10),
    anxiety_rating INTEGER CHECK (anxiety_rating >= 1 AND anxiety_rating <= 10),
    
    -- Emotion tags (array)
    emotion_tags emotion_tag[] DEFAULT '{}',
    
    -- Context note (optional)
    context_note TEXT CHECK (char_length(context_note) <= 500),
    
    -- Mode: 'light' or 'deep'
    mode VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (mode IN ('light', 'deep')),
    
    -- Timestamp (UTC)
    logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure either emoji (light) or ratings (deep) are provided
    CONSTRAINT mood_log_check CHECK (
        (mode = 'light' AND mood_emoji IS NOT NULL) OR
        (mode = 'deep' AND (
            happiness_rating IS NOT NULL OR
            energy_rating IS NOT NULL OR
            stress_rating IS NOT NULL OR
            anxiety_rating IS NOT NULL
        ))
    )
);

-- Indexes
CREATE INDEX idx_mood_logs_user_logged ON mood_logs(user_id, logged_at DESC);
-- Note: DATE index removed (TIMESTAMPTZ->date cast is not IMMUTABLE); use logged_at range queries instead
CREATE INDEX idx_mood_logs_mode ON mood_logs(user_id, mode, logged_at DESC);
CREATE INDEX idx_mood_logs_emoji ON mood_logs(user_id, mood_emoji, logged_at DESC);

-- Trigger for updated_at (added to 99-triggers.sql)

