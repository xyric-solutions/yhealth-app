-- Action Items Table
-- Stores action items extracted from call summaries

CREATE TABLE IF NOT EXISTS action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_id UUID NOT NULL REFERENCES call_summaries(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'follow_up',
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    reminder_set BOOLEAN DEFAULT FALSE,
    reminder_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_action_items_summary_id ON action_items(summary_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_due_date ON action_items(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_priority ON action_items(priority);
CREATE INDEX IF NOT EXISTS idx_action_items_category ON action_items(category);

-- Get pending action items for a user
CREATE INDEX IF NOT EXISTS idx_action_items_pending_by_user ON action_items(summary_id, status) 
    WHERE status IN ('pending', 'in_progress');

-- Comments
COMMENT ON TABLE action_items IS 'Action items extracted from voice coaching call summaries';
COMMENT ON COLUMN action_items.category IS 'Category: fitness, nutrition, sleep, stress, wellness, goal, habit, follow_up';
COMMENT ON COLUMN action_items.priority IS 'Priority level: high, medium, low';
COMMENT ON COLUMN action_items.status IS 'Status: pending, in_progress, completed, dismissed';
COMMENT ON COLUMN action_items.reminder_set IS 'Whether a reminder has been scheduled';

