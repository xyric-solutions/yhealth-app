-- ============================================
-- SCHEDULED REMINDERS TABLE
-- ============================================
-- Unified reminders for workouts, meals, water, and custom schedules

DROP TABLE IF EXISTS scheduled_reminders CASCADE;
CREATE TABLE scheduled_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Reminder type and source
    reminder_type VARCHAR(50) NOT NULL,    -- 'meal', 'workout', 'water', 'medication', 'custom'
    source_type VARCHAR(50),               -- 'diet_plan', 'workout_plan', 'manual'
    source_id UUID,                        -- Reference to diet_plan_id or workout_plan_id

    -- Content
    title VARCHAR(200) NOT NULL,
    message TEXT,
    icon VARCHAR(50),                      -- Icon name or emoji

    -- Schedule configuration
    reminder_time TIME NOT NULL,           -- Time of day (HH:MM:SS)
    days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],  -- 0=Sun, 1=Mon, ..., 6=Sat
    timezone VARCHAR(100) DEFAULT 'UTC',

    -- Notification settings
    notification_channels notification_channel[] DEFAULT ARRAY['push']::notification_channel[],
    advance_minutes INTEGER DEFAULT 0,     -- Minutes before the scheduled time to send
    repeat_if_missed BOOLEAN DEFAULT false,
    snooze_minutes INTEGER DEFAULT 10,

    -- Status
    is_enabled BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP,
    next_trigger_at TIMESTAMP,
    trigger_count INTEGER DEFAULT 0,

    -- Metadata for specific reminder types
    metadata JSONB DEFAULT '{}',           -- { mealType: 'breakfast', dietPlanId: '...' }

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_scheduled_reminders_user ON scheduled_reminders(user_id, is_enabled);
CREATE INDEX idx_scheduled_reminders_next_trigger ON scheduled_reminders(next_trigger_at) WHERE is_enabled = true;
CREATE INDEX idx_scheduled_reminders_type ON scheduled_reminders(user_id, reminder_type);
CREATE INDEX idx_scheduled_reminders_source ON scheduled_reminders(source_type, source_id) WHERE source_id IS NOT NULL;


-- ============================================
-- REMINDER LOGS TABLE
-- ============================================
-- Track when reminders were sent and user actions

DROP TABLE IF EXISTS reminder_logs CASCADE;
CREATE TABLE reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID NOT NULL REFERENCES scheduled_reminders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Trigger info
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_for TIMESTAMP NOT NULL,

    -- Delivery status
    delivery_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'snoozed', 'dismissed'
    channels_used notification_channel[],
    error_message TEXT,

    -- User action
    user_action VARCHAR(50),               -- 'acknowledged', 'snoozed', 'dismissed', 'completed'
    action_at TIMESTAMP,

    -- Created notification reference
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_reminder_logs_reminder ON reminder_logs(reminder_id, triggered_at DESC);
CREATE INDEX idx_reminder_logs_user ON reminder_logs(user_id, triggered_at DESC);
CREATE INDEX idx_reminder_logs_status ON reminder_logs(delivery_status) WHERE delivery_status = 'pending';
