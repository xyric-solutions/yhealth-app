-- ============================================
-- Migration: Make access_token nullable in user_integrations
-- ============================================
-- Allows storing credentials before OAuth completion
-- access_token will be set when OAuth flow completes

-- Make access_token nullable
ALTER TABLE user_integrations 
ALTER COLUMN access_token DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN user_integrations.access_token IS 'OAuth access token (nullable - set after OAuth completion)';

