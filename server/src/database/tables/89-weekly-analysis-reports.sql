-- Weekly Analysis Reports table
-- Aggregates 7 daily reports into weekly summaries with LLM narrative
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
