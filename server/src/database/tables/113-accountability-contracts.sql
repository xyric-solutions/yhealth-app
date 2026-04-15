-- ============================================================================
-- Accountability Contracts System Tables
-- Self-imposed commitment contracts with real consequences
-- ============================================================================

-- 1. Core contract entity
CREATE TABLE IF NOT EXISTS accountability_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,

  -- Condition (what triggers violation)
  condition_type VARCHAR(30) NOT NULL,       -- missed_activity, calorie_exceeded, streak_break, missed_goal, sleep_deficit, custom
  condition_metric VARCHAR(50),              -- gym_sessions, calories, steps, sleep_hours, water_intake, workout_completion
  condition_operator VARCHAR(10),            -- lt, gt, eq, gte, lte, missed
  condition_value NUMERIC,                   -- threshold value
  condition_window_days INTEGER DEFAULT 1,   -- evaluation window in days
  condition_details JSONB DEFAULT '{}',      -- flexible extra condition data

  -- Penalty (what happens on violation)
  penalty_type VARCHAR(30) NOT NULL,         -- donation, xp_loss, social_alert, streak_freeze_loss, custom
  penalty_amount NUMERIC,                    -- donation amount or XP amount
  penalty_currency VARCHAR(10) DEFAULT 'PKR',
  penalty_details JSONB DEFAULT '{}',        -- charity name, recipient, custom config

  -- Lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, active, at_risk, violated, completed, cancelled, paused
  signed_at TIMESTAMPTZ,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  pause_count INTEGER DEFAULT 0,             -- max 2 pauses allowed
  paused_at TIMESTAMPTZ,

  -- Verification
  verification_method VARCHAR(20) DEFAULT 'auto',  -- auto, ai_verified, manual
  grace_period_hours INTEGER DEFAULT 0,
  confidence_threshold NUMERIC(3,2) DEFAULT 0.80,

  -- AI metadata
  ai_suggested BOOLEAN DEFAULT false,
  ai_suggestion_reason TEXT,

  -- Social enforcers (references accountability_contacts)
  social_enforcer_ids UUID[] DEFAULT '{}',

  -- Tracking
  violation_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  total_checks INTEGER DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  last_violation_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_ac_user_status
  ON accountability_contracts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_ac_active
  ON accountability_contracts (status, start_date, end_date)
  WHERE status IN ('active', 'at_risk');

-- 2. Violation records with evidence
CREATE TABLE IF NOT EXISTS accountability_contract_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES accountability_contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Violation details
  violation_type VARCHAR(30) NOT NULL,
  confidence_score NUMERIC(3,2) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}',

  -- Penalty execution
  penalty_status VARCHAR(20) DEFAULT 'pending',  -- pending, executed, waived, disputed
  penalty_executed_at TIMESTAMPTZ,
  penalty_execution_details JSONB DEFAULT '{}',

  -- Grace period
  grace_expires_at TIMESTAMPTZ,
  grace_used BOOLEAN DEFAULT false,

  -- AI intervention
  ai_intervened BOOLEAN DEFAULT false,
  ai_intervention_message TEXT,

  -- Notification
  user_notified BOOLEAN DEFAULT false,
  enforcers_notified BOOLEAN DEFAULT false,

  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acv_contract
  ON accountability_contract_violations (contract_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_acv_user
  ON accountability_contract_violations (user_id, detected_at DESC);

-- 3. Check records (pass/fail/skip) for analytics
CREATE TABLE IF NOT EXISTS accountability_contract_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES accountability_contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  result VARCHAR(10) NOT NULL,  -- pass, fail, skip
  confidence_score NUMERIC(3,2),
  snapshot JSONB DEFAULT '{}',

  UNIQUE(contract_id, (checked_at::date))
);

CREATE INDEX IF NOT EXISTS idx_acc_contract
  ON accountability_contract_checks (contract_id, checked_at DESC);
