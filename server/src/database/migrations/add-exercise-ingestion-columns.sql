-- ============================================
-- EXERCISE INGESTION COLUMNS MIGRATION
-- ============================================
-- Adds columns to the existing exercises table for:
-- - External data source tracking (ExerciseDB, RapidAPI)
-- - Deduplication via source + source_id
-- - Full-text search via tsvector
-- - Soft delete and version tracking

-- Source tracking
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);

-- Body part classification (from ExerciseDB)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS body_part VARCHAR(100);

-- Target muscles from external APIs
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS target_muscles TEXT[] DEFAULT '{}';

-- Soft delete
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Version tracking for incremental sync
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Flexible metadata from external sources
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS external_metadata JSONB DEFAULT '{}';

-- Full-text search vector
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ============================================
-- INDEXES
-- ============================================

-- Full-text search GIN index
CREATE INDEX IF NOT EXISTS idx_exercises_search_vector ON exercises USING GIN(search_vector);

-- Deduplication: unique per source
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_source_source_id ON exercises(source, source_id) WHERE source_id IS NOT NULL;

-- Active exercises by source
CREATE INDEX IF NOT EXISTS idx_exercises_active_source ON exercises(source, is_active) WHERE is_active = true AND deleted_at IS NULL;

-- Body part filter
CREATE INDEX IF NOT EXISTS idx_exercises_body_part ON exercises(body_part) WHERE body_part IS NOT NULL;

-- Soft delete filter
CREATE INDEX IF NOT EXISTS idx_exercises_not_deleted ON exercises(id) WHERE deleted_at IS NULL;

-- Target muscles GIN index for array containment queries
CREATE INDEX IF NOT EXISTS idx_exercises_target_muscles ON exercises USING GIN(target_muscles);

-- ============================================
-- SEARCH VECTOR TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION exercises_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.primary_muscle_group, '') || ' ' ||
    coalesce(NEW.category, '') || ' ' ||
    coalesce(NEW.body_part, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.target_muscles, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.secondary_muscle_groups, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.equipment_required, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exercises_search_vector_trigger ON exercises;
CREATE TRIGGER exercises_search_vector_trigger
  BEFORE INSERT OR UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION exercises_search_vector_update();

-- ============================================
-- BACKFILL EXISTING DATA
-- ============================================

-- Set source to 'manual' for existing exercises
UPDATE exercises SET source = 'manual' WHERE source IS NULL;

-- Generate search vectors for existing exercises
UPDATE exercises SET search_vector = to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(primary_muscle_group, '') || ' ' ||
  coalesce(category, '') || ' ' ||
  coalesce(array_to_string(tags, ' '), '') || ' ' ||
  coalesce(array_to_string(secondary_muscle_groups, ' '), '') || ' ' ||
  coalesce(array_to_string(equipment_required, ' '), '')
) WHERE search_vector IS NULL;
