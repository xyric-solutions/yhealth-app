-- Insight Feedback table
-- Tracks user feedback on intelligence insights (useful/not useful)
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
