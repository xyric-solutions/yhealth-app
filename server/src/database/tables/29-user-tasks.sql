-- ============================================
-- USER TASKS TABLE
-- ============================================
-- Personal tasks with scheduling and notifications

DROP TABLE IF EXISTS user_tasks CASCADE;
CREATE TABLE user_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Task details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',  -- 'health', 'fitness', 'nutrition', 'work', 'personal', 'general'
    priority VARCHAR(20) DEFAULT 'medium',    -- 'low', 'medium', 'high', 'urgent'

    -- Scheduling
    scheduled_at TIMESTAMP NOT NULL,          -- When the task should be done
    reminder_minutes_before INTEGER DEFAULT 15,  -- Minutes before to send reminder
    reminder_sent_at TIMESTAMP,               -- When reminder was sent

    -- Notifications settings
    notify_push BOOLEAN DEFAULT true,
    notify_email BOOLEAN DEFAULT true,
    notify_sms BOOLEAN DEFAULT false,

    -- Status
    status VARCHAR(20) DEFAULT 'pending',     -- 'pending', 'in_progress', 'completed', 'cancelled'
    completed_at TIMESTAMP,

    -- Recurrence (optional)
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50),           -- 'daily', 'weekly', 'monthly', 'yearly', 'custom'
    recurrence_days INTEGER[],                -- For weekly: [0,1,2,3,4,5,6] (Sun-Sat)
    recurrence_end_date DATE,

    -- Metadata
    color VARCHAR(20),                        -- Color coding for UI
    icon VARCHAR(50),                         -- Icon name
    tags TEXT[],                              -- Array of tags
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_user_tasks_user ON user_tasks(user_id, status);
CREATE INDEX idx_user_tasks_scheduled ON user_tasks(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_user_tasks_reminder ON user_tasks(scheduled_at, reminder_minutes_before, reminder_sent_at)
    WHERE status = 'pending' AND reminder_sent_at IS NULL;
CREATE INDEX idx_user_tasks_category ON user_tasks(user_id, category);
CREATE INDEX idx_user_tasks_recurring ON user_tasks(user_id, is_recurring) WHERE is_recurring = true;

-- ============================================
-- TASK REMINDERS LOG TABLE
-- ============================================
-- Track task reminder notifications

DROP TABLE IF EXISTS task_reminder_logs CASCADE;
CREATE TABLE task_reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification details
    channel VARCHAR(20) NOT NULL,             -- 'push', 'email', 'sms'
    status VARCHAR(20) DEFAULT 'sent',        -- 'sent', 'failed', 'delivered', 'read'
    error_message TEXT,

    -- References
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,

    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_task_reminder_logs_task ON task_reminder_logs(task_id);
CREATE INDEX idx_task_reminder_logs_user ON task_reminder_logs(user_id, sent_at DESC);
