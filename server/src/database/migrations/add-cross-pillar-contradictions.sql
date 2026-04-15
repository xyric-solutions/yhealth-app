-- ============================================
-- Migration: Cross-Pillar Contradictions Table
-- ============================================
-- Description: Stores detected contradictions between health pillars
-- (exercise, nutrition, sleep, hydration, mental health, recovery).
-- Used by the Cross-Pillar Intelligence Engine (22 rules).

CREATE TABLE IF NOT EXISTS cross_pillar_contradictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Rule identification
    rule_id VARCHAR(50) NOT NULL,
    pillar_a VARCHAR(30) NOT NULL,
    pillar_b VARCHAR(30) NOT NULL,

    -- Severity and evidence
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    evidence JSONB NOT NULL,
    ai_correction TEXT,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'detected' CHECK (status IN ('detected', 'notified', 'resolved', 'dismissed')),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cpc_user_date ON cross_pillar_contradictions(user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpc_status ON cross_pillar_contradictions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cpc_rule_id ON cross_pillar_contradictions(rule_id);
