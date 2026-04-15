-- ============================================
-- ACTIVITY LOGS TABLE
-- ============================================
-- Daily activity tracking and completion

DROP TABLE IF EXISTS activity_logs CASCADE;
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES user_plans(id) ON DELETE CASCADE,
    activity_id VARCHAR(100) NOT NULL,

    -- When
    scheduled_date DATE NOT NULL,
    completed_at TIMESTAMP,

    -- Status
    status activity_log_status DEFAULT 'pending',

    -- Tracking data
    actual_value FLOAT,
    target_value FLOAT,
    duration INTEGER,

    -- Notes
    user_notes TEXT,
    mood SMALLINT,

    -- AI feedback
    ai_feedback TEXT,

    -- Automation tracking
    reminder_sent_at TIMESTAMP,
    start_message_sent_at TIMESTAMP,
    followup_sent_at TIMESTAMP,
    automation_enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_activity_logs_user_scheduled ON activity_logs(user_id, scheduled_date DESC);
CREATE INDEX idx_activity_logs_user_plan_scheduled ON activity_logs(user_id, plan_id, scheduled_date DESC);
CREATE INDEX idx_activity_logs_plan_activity_scheduled ON activity_logs(plan_id, activity_id, scheduled_date);
CREATE INDEX idx_activity_logs_automation_enabled ON activity_logs(user_id, scheduled_date) WHERE automation_enabled = true;
CREATE INDEX idx_activity_logs_reminder_sent ON activity_logs(user_id, scheduled_date) WHERE reminder_sent_at IS NULL AND automation_enabled = true;
