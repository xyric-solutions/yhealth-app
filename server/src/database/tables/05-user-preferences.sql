-- ============================================
-- USER PREFERENCES TABLE
-- ============================================
-- Notification, coaching, display, privacy settings

DROP TABLE IF EXISTS user_preferences CASCADE;
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification Preferences
    notification_channels JSONB DEFAULT '{"push": true, "email": true, "whatsapp": false, "sms": false}',
    notification_types JSONB DEFAULT '{}',
    quiet_hours_enabled BOOLEAN DEFAULT true,
    quiet_hours_start VARCHAR(5) DEFAULT '22:00',
    quiet_hours_end VARCHAR(5) DEFAULT '07:00',
    timezone VARCHAR(50) DEFAULT 'UTC',
    max_notifications_day INTEGER DEFAULT 10,
    max_notifications_week INTEGER DEFAULT 50,

    -- Coaching Preferences
    coaching_style coaching_style DEFAULT 'supportive',
    coaching_intensity coaching_intensity DEFAULT 'moderate',
    preferred_channel notification_channel DEFAULT 'push',
    check_in_frequency VARCHAR(20) DEFAULT 'daily',
    preferred_check_in_time VARCHAR(5) DEFAULT '09:00',

    -- AI Personality
    ai_use_emojis BOOLEAN DEFAULT true,
    ai_formality_level VARCHAR(20) DEFAULT 'balanced',
    ai_encouragement_level VARCHAR(20) DEFAULT 'medium',
    focus_areas TEXT[] DEFAULT '{}',

    -- Display Preferences
    weight_unit VARCHAR(10) DEFAULT 'kg',
    height_unit VARCHAR(10) DEFAULT 'cm',
    distance_unit VARCHAR(10) DEFAULT 'km',
    temperature_unit VARCHAR(15) DEFAULT 'celsius',
    date_format VARCHAR(15) DEFAULT 'YYYY-MM-DD',
    time_format VARCHAR(5) DEFAULT '24h',
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(10) DEFAULT 'system',

    -- Privacy Preferences
    share_progress_with_coach BOOLEAN DEFAULT true,
    allow_anonymous_data_research BOOLEAN DEFAULT false,
    show_in_leaderboards BOOLEAN DEFAULT false,
    profile_visibility VARCHAR(10) DEFAULT 'private',

    -- Integration Preferences
    auto_sync_enabled BOOLEAN DEFAULT true,
    sync_on_wifi_only BOOLEAN DEFAULT false,
    background_sync_enabled BOOLEAN DEFAULT true,
    data_retention_days INTEGER DEFAULT 365,

    -- Voice Assistant Preferences
    voice_assistant_avatar_url VARCHAR(500),
    
    -- Emotion Logging Preferences
    emotion_logging_enabled BOOLEAN DEFAULT true,  -- Opt-in for emotion logging
    emotion_data_retention_days INTEGER DEFAULT 730,  -- 24 months (730 days)
    emotion_weight DECIMAL(3,2) DEFAULT 0.15 CHECK (emotion_weight >= 0 AND emotion_weight <= 1),  -- Weight for emotion in recovery score (0-1, default 15%)
    
    -- Emergency Support Preferences
    emergency_resources_configured JSONB DEFAULT '{}',  -- Crisis hotline config: {country: string, hotlines: [{name, number, type}]}
    safety_team_notification BOOLEAN DEFAULT false,  -- Opt-in for safety team alerts

    -- Schedule Automation Preferences (AI Coach auto-messaging)
    schedule_automation_enabled BOOLEAN DEFAULT true,  -- Enable/disable AI schedule reminders
    schedule_reminder_minutes INTEGER DEFAULT 5,  -- Minutes before activity to send reminder (user configurable)
    
    -- Activity Automation Preferences (for activity logs from user plans)
    activity_automation_enabled BOOLEAN DEFAULT true,  -- Enable/disable AI automation messages for activity logs
    ai_message_style VARCHAR(20) DEFAULT 'friendly' CHECK (ai_message_style IN ('friendly', 'professional', 'motivational')),  -- Style of AI messages

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
