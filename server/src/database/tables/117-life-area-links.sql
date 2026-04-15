-- ============================================================================
-- Life Area Links — associates existing entities (goals, schedules, contracts,
-- reminders) with a life area. One entity can belong to at most one area.
-- ============================================================================

CREATE TABLE IF NOT EXISTS life_area_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  life_area_id UUID NOT NULL REFERENCES life_areas(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT life_area_links_entity_type_check
    CHECK (entity_type IN ('goal', 'schedule', 'contract', 'reminder')),
  CONSTRAINT life_area_links_entity_unique UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_life_area_links_area
  ON life_area_links (life_area_id);

CREATE INDEX IF NOT EXISTS idx_life_area_links_entity
  ON life_area_links (entity_type, entity_id);
