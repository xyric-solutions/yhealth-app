-- ============================================
-- Migration: Remove WHOOP Per-User Credentials
-- ============================================
-- Removes client_id and client_secret columns from user_integrations table
-- These should be application-level environment variables, not per-user data
-- Access tokens and refresh tokens remain (these are correctly per-user)

-- Remove client_id column
ALTER TABLE user_integrations 
DROP COLUMN IF EXISTS client_id;

-- Remove client_secret column
ALTER TABLE user_integrations 
DROP COLUMN IF EXISTS client_secret;

-- Drop index if it exists
DROP INDEX IF EXISTS idx_user_integrations_client_id;

-- Note: access_token and refresh_token columns remain as they are per-user OAuth tokens

