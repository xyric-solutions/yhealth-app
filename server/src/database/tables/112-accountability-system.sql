-- ============================================================================
-- Social Accountability System Tables
-- ============================================================================

-- 1. Accountability Contacts — trusted people the user has added
CREATE TABLE IF NOT EXISTS accountability_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100),
  role VARCHAR(30) DEFAULT 'friend',  -- friend, spouse, family, coach, mentor
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,  -- existing chat for messaging
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMP DEFAULT NOW(),
  removed_at TIMESTAMP,
  UNIQUE(user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_accountability_contacts_user
  ON accountability_contacts (user_id) WHERE is_active = true;

-- 2. Accountability Groups — named collections of contacts
CREATE TABLE IF NOT EXISTS accountability_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,  -- group chat for messaging
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accountability_groups_user
  ON accountability_groups (user_id) WHERE is_active = true;

-- 3. Group Members — many-to-many between groups and contacts
CREATE TABLE IF NOT EXISTS accountability_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES accountability_contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, contact_id)
);

-- 4. Consent Settings — master consent per user (default OFF)
CREATE TABLE IF NOT EXISTS accountability_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  allow_motivation_reminders BOOLEAN DEFAULT true,
  allow_failure_alerts BOOLEAN DEFAULT false,
  allow_sos_alerts BOOLEAN DEFAULT false,
  sos_inactivity_days INTEGER DEFAULT 7,
  sos_message TEXT DEFAULT 'This is an automated check-in. I haven''t been active for a while. Please reach out.',
  ai_intervene_first BOOLEAN DEFAULT true,    -- AI coach tries first before social alert
  global_cooldown_hours INTEGER DEFAULT 24,   -- minimum hours between messages to same contact
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Per-Contact Consent — granular permissions per contact
CREATE TABLE IF NOT EXISTS accountability_contact_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES accountability_contacts(id) ON DELETE CASCADE,
  allow_motivation BOOLEAN DEFAULT true,
  allow_failure BOOLEAN DEFAULT false,
  allow_sos BOOLEAN DEFAULT true,
  is_emergency_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

-- 6. Accountability Triggers — user-defined rules
CREATE TABLE IF NOT EXISTS accountability_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  -- Condition
  condition_type VARCHAR(50) NOT NULL,     -- 'inactivity', 'metric_threshold', 'streak_break', 'login_gap', 'custom'
  condition_metric VARCHAR(100),           -- 'gym_sessions', 'calories', 'steps', 'sleep_hours', 'login', 'water_intake', 'workout_completion'
  condition_operator VARCHAR(10),          -- 'lt', 'gt', 'eq', 'gte', 'lte', 'missed'
  condition_value NUMERIC,                 -- threshold value
  condition_window_days INTEGER DEFAULT 3, -- evaluation window in days
  -- Target
  target_type VARCHAR(20) NOT NULL,        -- 'contact', 'group', 'emergency'
  target_contact_id UUID REFERENCES accountability_contacts(id) ON DELETE CASCADE,
  target_group_id UUID REFERENCES accountability_groups(id) ON DELETE CASCADE,
  -- Message
  message_type VARCHAR(30) DEFAULT 'motivation',  -- 'motivation', 'failure', 'sos'
  message_template TEXT,                   -- user-editable message
  -- Controls
  cooldown_hours INTEGER DEFAULT 48,
  is_active BOOLEAN DEFAULT true,
  ai_intervene_first BOOLEAN DEFAULT true, -- try AI coach before sending
  last_triggered_at TIMESTAMP,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accountability_triggers_user
  ON accountability_triggers (user_id) WHERE is_active = true;

-- 7. Trigger Execution Log — audit trail
CREATE TABLE IF NOT EXISTS accountability_trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID REFERENCES accountability_triggers(id) ON DELETE CASCADE,  -- NULL for SOS system triggers
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Execution details
  condition_snapshot JSONB,                -- what was evaluated
  result VARCHAR(20) NOT NULL,            -- 'fired', 'blocked_consent', 'blocked_cooldown', 'ai_intervened', 'cancelled'
  message_sent BOOLEAN DEFAULT false,
  message_id UUID,                         -- references messages.id if sent
  chat_id UUID REFERENCES chats(id),
  target_user_ids UUID[],                  -- who was notified
  -- Metadata
  ai_intervention_attempted BOOLEAN DEFAULT false,
  ai_intervention_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accountability_trigger_logs_trigger
  ON accountability_trigger_logs (trigger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accountability_trigger_logs_user
  ON accountability_trigger_logs (user_id, created_at DESC);

-- 8. Consent Audit Log — tracks all consent changes
CREATE TABLE IF NOT EXISTS accountability_consent_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,             -- 'enabled', 'disabled', 'contact_added', 'contact_removed', 'trigger_created', 'consent_changed', 'sos_enabled', 'revoke_all'
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accountability_consent_audit_user
  ON accountability_consent_audit (user_id, created_at DESC);

-- Comments
COMMENT ON TABLE accountability_contacts IS 'Trusted people the user has added for social accountability';
COMMENT ON TABLE accountability_groups IS 'Named groups of accountability contacts';
COMMENT ON TABLE accountability_consent IS 'Master consent settings per user (default OFF)';
COMMENT ON TABLE accountability_triggers IS 'User-defined accountability rules with conditions and targets';
COMMENT ON TABLE accountability_trigger_logs IS 'Audit trail of trigger evaluations and message deliveries';
COMMENT ON TABLE accountability_consent_audit IS 'Audit log of all consent setting changes';
