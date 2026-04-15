-- ============================================
-- WEBINARS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS webinars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  content TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed', 'archived')),
  host_name VARCHAR(255),
  host_title VARCHAR(255),
  host_avatar VARCHAR(500),
  featured_image VARCHAR(500),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  max_attendees INTEGER,
  meeting_url VARCHAR(500),
  recording_url VARCHAR(500),
  registration_count INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webinars_slug ON webinars(slug);
CREATE INDEX IF NOT EXISTS idx_webinars_status ON webinars(status);
CREATE INDEX IF NOT EXISTS idx_webinars_category ON webinars(category);
CREATE INDEX IF NOT EXISTS idx_webinars_scheduled_at ON webinars(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_webinars_featured ON webinars(is_featured) WHERE is_featured = TRUE;

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_webinars_search ON webinars USING gin(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(content, ''))
);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_webinars_updated_at
  BEFORE UPDATE ON webinars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- WEBINAR REGISTRATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS webinar_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webinar_id UUID NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  attended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(webinar_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_webinar ON webinar_registrations(webinar_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_user ON webinar_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_email ON webinar_registrations(email);
