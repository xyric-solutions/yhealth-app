-- ============================================
-- ADD DAILY HEALTH METRICS MIGRATION
-- ============================================
-- Adds daily health metrics columns to users table and creates daily_health_metrics table
-- Run this migration to add WHOOP daily metrics tracking

-- ============================================
-- 1. ADD DAILY HEALTH METRICS COLUMNS TO USERS TABLE
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_sleep_hours DECIMAL(5,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_recovery_score INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_strain_score DECIMAL(5,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_cycle_day INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_health_updated_at TIMESTAMP;

-- Add check constraint for recovery score
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_daily_recovery_score_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_daily_recovery_score_check 
    CHECK (daily_recovery_score IS NULL OR (daily_recovery_score >= 0 AND daily_recovery_score <= 100));
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN users.daily_sleep_hours IS 'Daily sleep duration in hours (current snapshot)';
COMMENT ON COLUMN users.daily_recovery_score IS 'Daily recovery score 0-100 (current snapshot)';
COMMENT ON COLUMN users.daily_strain_score IS 'Daily strain score (current snapshot)';
COMMENT ON COLUMN users.daily_cycle_day IS 'Current physiological cycle day';
COMMENT ON COLUMN users.daily_health_updated_at IS 'Last update timestamp for daily health metrics';

-- ============================================
-- 2. CREATE DAILY HEALTH METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS daily_health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Date for the metrics
  metric_date DATE NOT NULL,
  
  -- Health metrics from WHOOP
  sleep_hours DECIMAL(5,2), -- Sleep duration in hours
  recovery_score INTEGER CHECK (recovery_score >= 0 AND recovery_score <= 100), -- Recovery score 0-100
  strain_score DECIMAL(5,2), -- Strain score
  cycle_day INTEGER, -- Current cycle day
  
  -- Additional metadata
  provider VARCHAR(50) DEFAULT 'whoop', -- Data source (whoop, manual, etc.)
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: one record per user per day
  UNIQUE(user_id, metric_date)
);

-- ============================================
-- 3. CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_daily_health_metrics_user_date 
  ON daily_health_metrics(user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_health_metrics_date_range 
  ON daily_health_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_daily_health_metrics_user_provider 
  ON daily_health_metrics(user_id, provider);

-- ============================================
-- 4. ADD COMMENTS
-- ============================================
COMMENT ON TABLE daily_health_metrics IS 'Historical daily health metrics from WHOOP and other sources';
COMMENT ON COLUMN daily_health_metrics.sleep_hours IS 'Total sleep duration in hours for the day';
COMMENT ON COLUMN daily_health_metrics.recovery_score IS 'Recovery score from 0-100';
COMMENT ON COLUMN daily_health_metrics.strain_score IS 'Strain score for the day';
COMMENT ON COLUMN daily_health_metrics.cycle_day IS 'Current physiological cycle day';

