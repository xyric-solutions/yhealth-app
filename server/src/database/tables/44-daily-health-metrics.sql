-- ============================================
-- DAILY HEALTH METRICS TABLE
-- ============================================
-- Historical daily health metrics from WHOOP (sleep, recovery, strain, cycle)
-- Users table stores current snapshot, this table stores historical records

DROP TABLE IF EXISTS daily_health_metrics CASCADE;
CREATE TABLE daily_health_metrics (
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

-- Indexes for efficient queries
CREATE INDEX idx_daily_health_metrics_user_date ON daily_health_metrics(user_id, metric_date DESC);
CREATE INDEX idx_daily_health_metrics_date_range ON daily_health_metrics(metric_date);
CREATE INDEX idx_daily_health_metrics_user_provider ON daily_health_metrics(user_id, provider);

-- Comments
COMMENT ON TABLE daily_health_metrics IS 'Historical daily health metrics from WHOOP and other sources';
COMMENT ON COLUMN daily_health_metrics.sleep_hours IS 'Total sleep duration in hours for the day';
COMMENT ON COLUMN daily_health_metrics.recovery_score IS 'Recovery score from 0-100';
COMMENT ON COLUMN daily_health_metrics.strain_score IS 'Strain score for the day';
COMMENT ON COLUMN daily_health_metrics.cycle_day IS 'Current physiological cycle day';

