-- ============================================
-- Workout Alarms / Reminders Table
-- Stores user-configured workout reminders
-- ============================================

CREATE TABLE IF NOT EXISTS workout_alarms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,

    -- Alarm settings
    title VARCHAR(200) NOT NULL DEFAULT 'Workout Reminder',
    message TEXT,
    alarm_time TIME NOT NULL,  -- Time of day for the alarm
    days_of_week INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',  -- 0=Sun, 1=Mon, ..., 6=Sat

    -- Status
    is_enabled BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP,
    next_trigger_at TIMESTAMP,

    -- Notification preferences
    notification_type VARCHAR(50) DEFAULT 'push',  -- 'push', 'email', 'sms', 'all'
    sound_enabled BOOLEAN DEFAULT true,
    sound_file VARCHAR(50) DEFAULT 'alarm.wav',  -- Sound file name: alarm.wav, azan1.mp3, azan2.mp3, azan3.mp3
    vibration_enabled BOOLEAN DEFAULT true,
    snooze_minutes INTEGER DEFAULT 10,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_workout_alarms_user_id ON workout_alarms(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_alarms_enabled ON workout_alarms(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_workout_alarms_next_trigger ON workout_alarms(next_trigger_at) WHERE is_enabled = true;

-- ============================================
-- Motivational Videos Table
-- Caches recommended YouTube videos per goal
-- ============================================

CREATE TABLE IF NOT EXISTS motivational_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Video info
    youtube_video_id VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    channel_name VARCHAR(200),
    thumbnail_url VARCHAR(500),
    duration_seconds INTEGER,
    view_count BIGINT,

    -- Categorization
    goal_category VARCHAR(50) NOT NULL,  -- weight_loss, muscle_building, etc.
    content_type VARCHAR(50) DEFAULT 'motivation',  -- motivation, workout, nutrition, tips
    tags TEXT[],

    -- Quality metrics
    is_featured BOOLEAN DEFAULT false,
    relevance_score FLOAT DEFAULT 0.5,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_motivational_videos_goal ON motivational_videos(goal_category);
CREATE INDEX IF NOT EXISTS idx_motivational_videos_featured ON motivational_videos(is_featured) WHERE is_featured = true;

-- ============================================
-- User Video Interactions Table
-- Tracks which videos users have watched/liked
-- ============================================

CREATE TABLE IF NOT EXISTS user_video_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES motivational_videos(id) ON DELETE CASCADE,

    -- Interaction data
    watched BOOLEAN DEFAULT false,
    liked BOOLEAN DEFAULT false,
    saved BOOLEAN DEFAULT false,
    watch_count INTEGER DEFAULT 0,
    last_watched_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_user_video_interactions_user ON user_video_interactions(user_id);
