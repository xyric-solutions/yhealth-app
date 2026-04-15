-- ============================================
-- WATER INTAKE LOGS TABLE
-- ============================================
-- Daily water consumption tracking

DROP TABLE IF EXISTS water_intake_logs CASCADE;
CREATE TABLE water_intake_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Daily tracking
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Consumption
    glasses_consumed INTEGER DEFAULT 0,            -- Standard glasses (250ml each)
    target_glasses INTEGER DEFAULT 8,              -- Daily target
    ml_consumed INTEGER DEFAULT 0,                 -- Total milliliters (for precise tracking)
    target_ml INTEGER DEFAULT 2000,                -- Target in ml

    -- Individual entries for timeline
    entries JSONB DEFAULT '[]',                    -- [{time: "09:00", amount_ml: 250, type: "water"}]

    -- Goal status
    goal_achieved BOOLEAN DEFAULT false,
    achieved_at TIMESTAMP,

    -- Gamification
    xp_earned INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One record per user per day
    CONSTRAINT unique_water_log UNIQUE (user_id, log_date)
);

-- Indexes
CREATE INDEX idx_water_intake_user ON water_intake_logs(user_id, log_date DESC);
CREATE INDEX idx_water_intake_date ON water_intake_logs(log_date);
