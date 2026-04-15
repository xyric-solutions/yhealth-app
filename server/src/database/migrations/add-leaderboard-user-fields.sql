-- ============================================
-- MIGRATION: Add Leaderboard Fields to Users Table
-- ============================================
-- Adds timezone, privacy flags, and cohorts for leaderboard system

-- Add timezone column (defaults to UTC)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Add privacy flags (JSONB)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_flags JSONB DEFAULT '{"hide_from_global": false, "friends_only": false, "anonymous": false}';

-- Add cohorts for segmentation (TEXT array)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS cohorts TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add index on timezone for efficient timezone-aware queries
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);

-- Add index on privacy flags for filtering
CREATE INDEX IF NOT EXISTS idx_users_privacy_flags ON users USING GIN (privacy_flags);

-- Add index on cohorts for segmentation
CREATE INDEX IF NOT EXISTS idx_users_cohorts ON users USING GIN (cohorts);

-- Comments
COMMENT ON COLUMN users.timezone IS 'User timezone (e.g., America/New_York, Europe/London) for timezone-aware daily scoring';
COMMENT ON COLUMN users.privacy_flags IS 'JSONB: {hide_from_global: bool, friends_only: bool, anonymous: bool}';
COMMENT ON COLUMN users.cohorts IS 'Array of segmentation tags for A/B testing and personalization';

