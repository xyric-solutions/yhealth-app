-- ============================================
-- HABIT LOGS TABLE
-- ============================================
-- Daily habit completion tracking

DROP TABLE IF EXISTS habit_logs CASCADE;
CREATE TABLE habit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    
    -- Completion data
    completed BOOLEAN NOT NULL DEFAULT false,
    
    -- Value based on tracking type
    value INTEGER, -- For counter/duration/rating types
    note TEXT CHECK (char_length(note) <= 500),
    
    -- Date of completion
    log_date DATE NOT NULL,
    
    -- Timestamp of logging
    logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one log per habit per day
    CONSTRAINT unique_habit_log_date UNIQUE (user_id, habit_id, log_date)
);

-- Indexes
CREATE INDEX idx_habit_logs_user_date ON habit_logs(user_id, log_date DESC);
CREATE INDEX idx_habit_logs_habit_date ON habit_logs(habit_id, log_date DESC);
CREATE INDEX idx_habit_logs_completed ON habit_logs(user_id, habit_id, completed, log_date DESC);
CREATE INDEX idx_habit_logs_user_habit ON habit_logs(user_id, habit_id, log_date DESC);

-- Trigger for updated_at (added to 99-triggers.sql)

