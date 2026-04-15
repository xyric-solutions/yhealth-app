-- ============================================================================
-- Life Areas — domain-tagged containers linking existing goals/schedules
-- ============================================================================

CREATE TABLE IF NOT EXISTS life_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  domain_type TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  is_flagship BOOLEAN DEFAULT false,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT life_areas_status_check CHECK (status IN ('active', 'paused', 'archived')),
  CONSTRAINT life_areas_user_slug_unique UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_life_areas_user_status
  ON life_areas (user_id, status);

CREATE INDEX IF NOT EXISTS idx_life_areas_user_domain
  ON life_areas (user_id, domain_type) WHERE status = 'active';

CREATE OR REPLACE FUNCTION set_life_areas_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS life_areas_updated_at ON life_areas;
CREATE TRIGGER life_areas_updated_at
  BEFORE UPDATE ON life_areas
  FOR EACH ROW EXECUTE FUNCTION set_life_areas_updated_at();
