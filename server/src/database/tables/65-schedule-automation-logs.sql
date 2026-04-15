-- ============================================
-- SCHEDULE AUTOMATION LOGS TABLE
-- ============================================
-- Tracks AI messages sent based on schedule items
-- Prevents duplicate notifications for the same item/type

DROP TABLE IF EXISTS schedule_automation_logs CASCADE;
CREATE TABLE schedule_automation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_item_id UUID NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,

    -- Message type: reminder (before), start (at time), followup (after)
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('reminder', 'start', 'followup')),

    -- Reference to the sent message
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,

    -- AI-generated message content
    message_content TEXT,

    -- Timing info
    scheduled_time TIMESTAMP WITH TIME ZONE,  -- When the activity was scheduled
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate notifications for same item and type
    UNIQUE(schedule_item_id, message_type)
);

-- Indexes for efficient querying
CREATE INDEX idx_schedule_automation_logs_user ON schedule_automation_logs(user_id);
CREATE INDEX idx_schedule_automation_logs_item ON schedule_automation_logs(schedule_item_id);
CREATE INDEX idx_schedule_automation_logs_sent_at ON schedule_automation_logs(sent_at);

-- Comments
COMMENT ON TABLE schedule_automation_logs IS 'Tracks AI-generated schedule reminder messages to prevent duplicates';
COMMENT ON COLUMN schedule_automation_logs.message_type IS 'Type of automation message: reminder (before activity), start (at activity time), followup (after activity)';
