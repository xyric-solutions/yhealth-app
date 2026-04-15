-- ============================================
-- ADD DEDUP UNIQUE CONSTRAINT TO HEALTH_DATA_RECORDS
-- ============================================
-- Enables proper UPSERT (ON CONFLICT DO UPDATE) for WHOOP and other integrations.
-- Uses a partial unique index (WHERE raw_data_id IS NOT NULL) to avoid issues
-- with legacy rows that have NULL raw_data_id.

-- Step 1: Remove duplicate rows (keep the most recently created per natural key)
DELETE FROM health_data_records a
USING health_data_records b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.provider = b.provider
  AND a.data_type = b.data_type
  AND a.raw_data_id = b.raw_data_id
  AND a.raw_data_id IS NOT NULL;

-- Step 2: Create partial unique index for deduplication
-- CONCURRENTLY avoids locking the table during index creation
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_data_records_dedup
  ON health_data_records(user_id, provider, data_type, raw_data_id)
  WHERE raw_data_id IS NOT NULL;
