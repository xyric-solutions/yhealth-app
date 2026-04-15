-- ============================================
-- MIGRATION: Add plan_policy and audit fields to user_plans
-- ============================================
-- Adds rescheduling policy and audit tracking to user_plans table

-- Create plan_policy enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE plan_policy AS ENUM ('SLIDE_FORWARD', 'FILL_GAPS', 'DROP_OR_COMPRESS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add plan_policy column (requires plan_policy enum to exist)
ALTER TABLE user_plans 
ADD COLUMN IF NOT EXISTS plan_policy plan_policy DEFAULT 'FILL_GAPS';

-- Add audit tracking columns
ALTER TABLE user_plans 
ADD COLUMN IF NOT EXISTS last_audit_date DATE;

ALTER TABLE user_plans 
ADD COLUMN IF NOT EXISTS auto_reschedule_enabled BOOLEAN DEFAULT true;

-- Add comments
COMMENT ON COLUMN user_plans.plan_policy IS 'Rescheduling policy: SLIDE_FORWARD, FILL_GAPS, or DROP_OR_COMPRESS';
COMMENT ON COLUMN user_plans.last_audit_date IS 'Last date when workout progress was audited';
COMMENT ON COLUMN user_plans.auto_reschedule_enabled IS 'Whether automatic rescheduling is enabled for this plan';

