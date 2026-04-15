-- ============================================
-- ROUTINE COMPLETIONS TABLE
-- ============================================
-- Track routine and step completions

DROP TABLE IF EXISTS routine_completions CASCADE;
CREATE TABLE routine_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_id UUID NOT NULL REFERENCES wellbeing_routines(id) ON DELETE CASCADE,
    
    -- Completion date
    completion_date DATE NOT NULL,
    
    -- Steps completed (JSONB array matching routine steps)
    steps_completed JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"step": "Gratitude", "completed": true, "completed_at": "..."}, ...]
    
    -- Completion metrics
    completion_rate DECIMAL(5,2), -- Percentage of steps completed (0-100)
    total_steps INTEGER NOT NULL DEFAULT 0,
    completed_steps INTEGER NOT NULL DEFAULT 0,
    
    -- Duration tracking
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one completion per routine per day
    CONSTRAINT unique_routine_completion_date UNIQUE (user_id, routine_id, completion_date)
);

-- Indexes
CREATE INDEX idx_routine_completions_user_date ON routine_completions(user_id, completion_date DESC);
CREATE INDEX idx_routine_completions_routine_date ON routine_completions(routine_id, completion_date DESC);
CREATE INDEX idx_routine_completions_user_routine ON routine_completions(user_id, routine_id, completion_date DESC);

-- Trigger for updated_at (added to 99-triggers.sql)

