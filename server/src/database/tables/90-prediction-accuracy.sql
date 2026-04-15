-- Prediction Accuracy Tracking table
-- Compares yesterday's predictions with today's actual metrics
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
