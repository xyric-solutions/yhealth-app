-- ============================================
-- MIGRATION: Add 'missed' value to activity_log_status enum
-- ============================================
-- Adds 'missed' status to activity_log_status enum for workout reschedule system
-- This must be run in a separate transaction before creating tables that use it

-- Add 'missed' to activity_log_status enum
DO $$ BEGIN
    ALTER TYPE activity_log_status ADD VALUE IF NOT EXISTS 'missed';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

