-- ============================================
-- ACTIVITY AUTOMATION LOGS TABLE
-- ============================================
-- Tracks AI messages sent based on activity logs from user plans
-- Prevents duplicate notifications for the same activity log/type

DROP TABLE IF EXISTS activity_automation_logs CASCADE;
CREATE TABLE activity_automation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_log_id UUID NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,

    -- Message type: reminder (before), start (at time), followup (after), completion_check
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('reminder', 'start', 'followup', 'completion_check')),

    -- Reference to the sent message
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,

    -- AI-generated message content
    message_content TEXT,

    -- Timing info
    scheduled_time TIMESTAMP WITH TIME ZONE,  -- When the activity was scheduled
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate notifications for same activity log and type
    UNIQUE(activity_log_id, message_type)
);

-- Indexes for efficient querying
CREATE INDEX idx_activity_automation_logs_user ON activity_automation_logs(user_id);
CREATE INDEX idx_activity_automation_logs_activity_log ON activity_automation_logs(activity_log_id);
CREATE INDEX idx_activity_automation_logs_sent_at ON activity_automation_logs(sent_at);
CREATE INDEX idx_activity_automation_logs_type ON activity_automation_logs(user_id, message_type);

-- Comments
COMMENT ON TABLE activity_automation_logs IS 'Tracks AI-generated activity reminder messages to prevent duplicates';
COMMENT ON COLUMN activity_automation_logs.message_type IS 'Type of automation message: reminder (before activity), start (at activity time), followup (after activity), completion_check (check if completed)';

