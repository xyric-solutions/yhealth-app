-- ============================================
-- EMAIL PREFERENCES TABLE
-- ============================================
-- Per-user email category opt-in/out with unsubscribe token support.

CREATE TABLE IF NOT EXISTS email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,        -- transactional, engagement, digest, coaching, marketing
  enabled BOOLEAN DEFAULT true,
  frequency VARCHAR(20) DEFAULT 'immediate',  -- immediate, daily, weekly, never
  unsubscribe_token VARCHAR(255) UNIQUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user ON email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_preferences_token ON email_preferences(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

-- Trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_email_preferences_updated_at'
  ) THEN
    CREATE TRIGGER set_email_preferences_updated_at
      BEFORE UPDATE ON email_preferences
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
