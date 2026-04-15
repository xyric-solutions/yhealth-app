-- ============================================
-- Migration: Add WHOOP Credentials Columns
-- ============================================
-- Adds client_id, client_secret, webhook_url, and webhook_secret columns
-- to user_integrations table for per-user OAuth credentials

-- Add client_id column (user's WHOOP OAuth client ID)
ALTER TABLE user_integrations 
ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Add client_secret column (encrypted user's WHOOP OAuth client secret)
ALTER TABLE user_integrations 
ADD COLUMN IF NOT EXISTS client_secret TEXT;

-- Add webhook_url column (registered webhook URL for real-time updates)
ALTER TABLE user_integrations 
ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Add webhook_secret column (for webhook signature verification)
ALTER TABLE user_integrations 
ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Add index for faster lookups by client_id
CREATE INDEX IF NOT EXISTS idx_user_integrations_client_id 
ON user_integrations(client_id) 
WHERE client_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_integrations.client_id IS 'User-provided WHOOP OAuth client ID';
COMMENT ON COLUMN user_integrations.client_secret IS 'User-provided WHOOP OAuth client secret (encrypted)';
COMMENT ON COLUMN user_integrations.webhook_url IS 'Registered webhook URL for real-time WHOOP data updates';
COMMENT ON COLUMN user_integrations.webhook_secret IS 'Secret for verifying webhook signatures from WHOOP';

