-- ============================================
-- Migration: Add WHOOP Per-User Credentials
-- ============================================
-- Adds client_id and client_secret columns to user_integrations table
-- to support per-user WHOOP OAuth credentials

ALTER TABLE user_integrations
ADD COLUMN IF NOT EXISTS client_id TEXT,
ADD COLUMN IF NOT EXISTS client_secret TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_client_id 
ON user_integrations(client_id) 
WHERE client_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN user_integrations.client_id IS 'WHOOP OAuth client ID (per-user)';
COMMENT ON COLUMN user_integrations.client_secret IS 'WHOOP OAuth client secret (per-user, encrypted)';

