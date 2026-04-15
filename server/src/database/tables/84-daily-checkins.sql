-- ============================================
-- DAILY CHECK-INS TABLE
-- ============================================
-- Quick structured daily check-in capturing mood, energy, sleep, stress, and tags
-- Hub of the journaling system - connects to mood_logs, energy_logs, stress_logs

DROP TABLE IF EXISTS daily_checkins CASCADE;
CREATE TABLE daily_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,

    -- Core metrics
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    energy_score INTEGER CHECK (energy_score >= 1 AND energy_score <= 10),
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
    stress_score INTEGER CHECK (stress_score >= 1 AND stress_score <= 10),

    -- Quick tags (multi-select)
    tags TEXT[] DEFAULT '{}',

    -- Brief day narrative
    day_summary TEXT CHECK (char_length(day_summary) <= 500),

    -- Cross-references to wellbeing logs (auto-created)
    mood_log_id UUID REFERENCES mood_logs(id) ON DELETE SET NULL,
    energy_log_id UUID REFERENCES energy_logs(id) ON DELETE SET NULL,
    stress_log_id UUID REFERENCES stress_logs(id) ON DELETE SET NULL,

    -- Completion tracking
    completed_at TIMESTAMPTZ,

    -- Timestamp (UTC)
    logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One check-in per day per user
    UNIQUE(user_id, checkin_date)
);

-- Indexes
CREATE INDEX idx_daily_checkins_user_date ON daily_checkins(user_id, checkin_date DESC);
CREATE INDEX idx_daily_checkins_user_logged ON daily_checkins(user_id, logged_at DESC);

-- Trigger for updated_at (added to 99-triggers.sql)
