-- Migration: Social Accountability System
-- Date: 2026-04-13

-- Run the table creation file
-- Tables: accountability_contacts, accountability_groups, accountability_group_members,
--         accountability_consent, accountability_contact_consent, accountability_triggers,
--         accountability_trigger_logs, accountability_consent_audit

-- Note: Tables are defined in /tables/112-accountability-system.sql
-- This migration ensures they exist in production databases

-- 1. Accountability Contacts
CREATE TABLE IF NOT EXISTS accountability_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(100),
  role VARCHAR(30) DEFAULT 'friend',
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMP DEFAULT NOW(),
  removed_at TIMESTAMP,
  UNIQUE(user_id, contact_user_id)
);
CREATE INDEX IF NOT EXISTS idx_accountability_contacts_user ON accountability_contacts (user_id) WHERE is_active = true;

-- 2. Accountability Groups
CREATE TABLE IF NOT EXISTS accountability_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accountability_groups_user ON accountability_groups (user_id) WHERE is_active = true;

-- 3. Group Members
CREATE TABLE IF NOT EXISTS accountability_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES accountability_contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, contact_id)
);

-- 4. Consent Settings
CREATE TABLE IF NOT EXISTS accountability_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  allow_motivation_reminders BOOLEAN DEFAULT true,
  allow_failure_alerts BOOLEAN DEFAULT false,
  allow_sos_alerts BOOLEAN DEFAULT false,
  sos_inactivity_days INTEGER DEFAULT 7,
  sos_message TEXT DEFAULT 'This is an automated check-in. I have not been active for a while. Please reach out.',
  ai_intervene_first BOOLEAN DEFAULT true,
  global_cooldown_hours INTEGER DEFAULT 24,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Per-Contact Consent
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

-- 6. Accountability Triggers
CREATE TABLE IF NOT EXISTS accountability_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  condition_type VARCHAR(50) NOT NULL,
  condition_metric VARCHAR(100),
  condition_operator VARCHAR(10),
  condition_value NUMERIC,
  condition_window_days INTEGER DEFAULT 3,
  target_type VARCHAR(20) NOT NULL,
  target_contact_id UUID REFERENCES accountability_contacts(id) ON DELETE CASCADE,
  target_group_id UUID REFERENCES accountability_groups(id) ON DELETE CASCADE,
  message_type VARCHAR(30) DEFAULT 'motivation',
  message_template TEXT,
  cooldown_hours INTEGER DEFAULT 48,
  is_active BOOLEAN DEFAULT true,
  ai_intervene_first BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accountability_triggers_user ON accountability_triggers (user_id) WHERE is_active = true;

-- 7. Trigger Execution Log
CREATE TABLE IF NOT EXISTS accountability_trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID REFERENCES accountability_triggers(id) ON DELETE CASCADE,  -- NULL for SOS system triggers
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condition_snapshot JSONB,
  result VARCHAR(20) NOT NULL,
  message_sent BOOLEAN DEFAULT false,
  message_id UUID,
  chat_id UUID REFERENCES chats(id),
  target_user_ids UUID[],
  ai_intervention_attempted BOOLEAN DEFAULT false,
  ai_intervention_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accountability_trigger_logs_trigger ON accountability_trigger_logs (trigger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accountability_trigger_logs_user ON accountability_trigger_logs (user_id, created_at DESC);

-- 8. Consent Audit Log
CREATE TABLE IF NOT EXISTS accountability_consent_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accountability_consent_audit_user ON accountability_consent_audit (user_id, created_at DESC);
