-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
-- Push notifications, alerts, reminders

DROP TABLE IF EXISTS notifications CASCADE;
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification content
    type notification_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    -- Rich content
    icon VARCHAR(50),                    -- Icon name or emoji
    image_url VARCHAR(500),              -- Optional image
    action_url VARCHAR(500),             -- Deep link URL
    action_label VARCHAR(100),           -- CTA button text

    -- Categorization
    category VARCHAR(50),                -- Custom category for filtering
    priority notification_priority DEFAULT 'normal',

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP,

    -- Delivery
    channels notification_channel[] DEFAULT ARRAY['push']::notification_channel[],
    sent_via JSONB DEFAULT '{}',         -- Track which channels were used

    -- Related entities
    related_entity_type VARCHAR(50),     -- 'goal', 'plan', 'achievement', etc.
    related_entity_id UUID,              -- ID of the related entity

    -- Metadata
    metadata JSONB DEFAULT '{}',         -- Additional data

    -- Expiration
    expires_at TIMESTAMP,                -- Auto-expire notification

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_type ON notifications(user_id, type);
CREATE INDEX idx_notifications_user_archived ON notifications(user_id, is_archived);
CREATE INDEX idx_notifications_user_priority ON notifications(user_id, priority, created_at DESC);
CREATE INDEX idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;
