-- ============================================
-- ACTIVITY STATUS HISTORY TABLE
-- ============================================
-- Track daily user activity statuses (working, sick, injury, etc.)

DROP TABLE IF EXISTS activity_status_history CASCADE;
CREATE TABLE activity_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Date and status
  status_date DATE NOT NULL,
  activity_status activity_status NOT NULL,
  
  -- Mood (1-5 scale, optional)
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'auto', 'integration'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: one status per user per day
  UNIQUE(user_id, status_date)
);

-- Indexes
CREATE INDEX idx_activity_status_user_date ON activity_status_history(user_id, status_date DESC);
CREATE INDEX idx_activity_status_user_status ON activity_status_history(user_id, activity_status);
CREATE INDEX idx_activity_status_date_range ON activity_status_history(status_date);

