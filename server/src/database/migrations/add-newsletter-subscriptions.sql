-- ============================================
-- NEWSLETTER SUBSCRIPTIONS TABLE
-- ============================================
-- Stores email signups from footer / lead magnet (Get AI-Powered Health Tips)

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    interests TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'footer',
    created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'utc'),
    CONSTRAINT newsletter_subscriptions_email_unique UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_created_at
  ON newsletter_subscriptions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_source
  ON newsletter_subscriptions (source);
