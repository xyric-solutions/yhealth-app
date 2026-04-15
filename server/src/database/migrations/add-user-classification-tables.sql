-- ============================================
-- Migration: User Classification + Intensity Prescriptions + Personality Mode Events
-- ============================================
-- Description: Supports the User Classification Service (5-tier behavioral analysis),
-- Recovery-to-Intensity Mapping, and Dynamic Personality System (5 modes).

-- User Classification (5-tier behavioral classification)
CREATE TABLE IF NOT EXISTS user_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(30) NOT NULL CHECK (tier IN ('elite_performer', 'improving', 'plateau', 'declining', 'at_risk_dropout')),
    score NUMERIC(5,2) NOT NULL,
    factors JSONB NOT NULL,
    previous_tier VARCHAR(30),
    tier_changed_at TIMESTAMPTZ,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_uc_user ON user_classifications(user_id);
CREATE INDEX IF NOT EXISTS idx_uc_tier ON user_classifications(tier);

-- Intensity Prescriptions (WHOOP recovery-to-training intensity mapping)
CREATE TABLE IF NOT EXISTS intensity_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    recovery_score INTEGER,
    hrv_rmssd NUMERIC(6,2),
    resting_hr INTEGER,
    sleep_hours NUMERIC(4,2),
    prescribed_intensity VARCHAR(20) NOT NULL CHECK (prescribed_intensity IN ('rest', 'light', 'moderate', 'hard', 'peak')),
    max_hr_zone INTEGER CHECK (max_hr_zone BETWEEN 1 AND 5),
    recommended_duration_min INTEGER,
    reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ip_user_date ON intensity_prescriptions(user_id, date DESC);

-- Personality Mode Events (tracking AI personality mode selections)
CREATE TABLE IF NOT EXISTS personality_mode_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(40) NOT NULL,
    trigger_reason TEXT NOT NULL,
    score NUMERIC(5,2),
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pme_user_date ON personality_mode_events(user_id, created_at DESC);
