-- Migration: Add Status Follow-Up Enhancements
-- Date: 2026-04-13

-- Track when a status was auto-reset by the follow-up job
ALTER TABLE activity_status_history
  ADD COLUMN IF NOT EXISTS auto_reset_at TIMESTAMP DEFAULT NULL;

COMMENT ON COLUMN activity_status_history.auto_reset_at IS 'When status was auto-reset to working by the follow-up job';
