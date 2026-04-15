-- Migration: Add Intelligence tables (Epic 08 - Cross-Domain Intelligence)
-- Tables: insight_feedback, weekly_analysis_reports, prediction_accuracy_tracking

-- 1. Insight Feedback
CREATE TABLE IF NOT EXISTS insight_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_id VARCHAR(100) NOT NULL,
  report_date DATE NOT NULL,
  useful BOOLEAN NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE insight_feedback DROP CONSTRAINT IF EXISTS uq_insight_feedback_user_insight;
ALTER TABLE insight_feedback ADD CONSTRAINT uq_insight_feedback_user_insight
  UNIQUE(user_id, insight_id, report_date);

CREATE INDEX IF NOT EXISTS idx_insight_feedback_user
  ON insight_feedback(user_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_insight_feedback_insight
  ON insight_feedback(insight_id);

-- 2. Weekly Analysis Reports
CREATE TABLE IF NOT EXISTS weekly_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_end_date DATE NOT NULL,
  daily_report_ids JSONB DEFAULT '[]',
  summary JSONB NOT NULL,
  narrative TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_end_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_date
  ON weekly_analysis_reports(user_id, week_end_date DESC);

-- 3. Prediction Accuracy Tracking
CREATE TABLE IF NOT EXISTS prediction_accuracy_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL,
  prediction_type VARCHAR(50) NOT NULL,
  predicted_value NUMERIC(5,2),
  actual_value NUMERIC(5,2),
  accuracy_pct NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prediction_accuracy_tracking DROP CONSTRAINT IF EXISTS uq_prediction_accuracy_user_date_type;
ALTER TABLE prediction_accuracy_tracking ADD CONSTRAINT uq_prediction_accuracy_user_date_type
  UNIQUE(user_id, prediction_date, prediction_type);

CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_user_date
  ON prediction_accuracy_tracking(user_id, prediction_date DESC);
