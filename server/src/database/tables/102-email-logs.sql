-- ============================================
-- EMAIL LOGS TABLE
-- ============================================
-- Tracks all outbound emails for analytics, debugging, and delivery tracking.

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  template VARCHAR(100) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  recipient VARCHAR(320) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',  -- queued, sent, delivered, bounced, failed
  provider VARCHAR(50) DEFAULT 'smtp',
  message_id VARCHAR(255),                        -- SMTP Message-ID for tracking
  category VARCHAR(50) DEFAULT 'transactional',   -- transactional, engagement, digest, coaching, marketing
  metadata JSONB DEFAULT '{}',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template);
CREATE INDEX IF NOT EXISTS idx_email_logs_category ON email_logs(category);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id) WHERE message_id IS NOT NULL;

-- Trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_email_logs_updated_at'
  ) THEN
    CREATE TRIGGER set_email_logs_updated_at
      BEFORE UPDATE ON email_logs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
