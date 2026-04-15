-- Migration: Add Activity Status Awareness Fields
-- Date: 2026-04-08

-- 1. Extend activity_status_history with lifecycle fields
ALTER TABLE activity_status_history
  ADD COLUMN IF NOT EXISTS expected_end_date DATE,
  ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS detected_from VARCHAR(20) DEFAULT 'manual';

-- 2. Index for lifecycle cron queries (find non-working statuses needing follow-up)
CREATE INDEX IF NOT EXISTS idx_activity_status_lifecycle
  ON activity_status_history (user_id, activity_status, follow_up_sent)
  WHERE activity_status NOT IN ('working', 'excellent', 'good');

-- 2b. Composite index for pattern analyzer day-of-week and post-event queries (prevents 56M row scans)
CREATE INDEX IF NOT EXISTS idx_activity_status_user_date_status
  ON activity_status_history (user_id, status_date, activity_status);

-- 2c. Proactive messaging freshness boost query index
CREATE INDEX IF NOT EXISTS idx_proactive_messages_user_created
  ON proactive_messages (user_id, created_at)
  WHERE created_at >= NOW() - INTERVAL '7 days';

-- 3. Add status patterns to coaching profiles
ALTER TABLE user_coaching_profiles
  ADD COLUMN IF NOT EXISTS status_patterns JSONB DEFAULT '[]';

-- 4. Add plan status overrides
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS status_overrides JSONB DEFAULT NULL;

-- 5. Documentation comments
COMMENT ON COLUMN activity_status_history.expected_end_date IS 'When status is expected to end (from user input or AI extraction)';
COMMENT ON COLUMN activity_status_history.detected_from IS 'How status was set: manual, chat_explicit, chat_inferred';
COMMENT ON COLUMN activity_status_history.follow_up_sent IS 'Whether a follow-up message has been sent for this status day';
COMMENT ON COLUMN user_plans.status_overrides IS 'Temporary plan modifications due to activity status. Cleared when status returns to normal.';
COMMENT ON COLUMN user_coaching_profiles.status_patterns IS 'Recurring behavioral patterns detected from activity status history.';

-- 6. Data integrity constraints
DO $$ BEGIN
  ALTER TABLE activity_status_history
    ADD CONSTRAINT check_detected_from
    CHECK (detected_from IN ('manual', 'chat_explicit', 'chat_inferred'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE activity_status_history
    ADD CONSTRAINT check_end_date_after_status
    CHECK (expected_end_date IS NULL OR expected_end_date >= status_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
