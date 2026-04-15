-- ============================================
-- HABITS TABLE
-- ============================================
-- User-defined habits with customizable tracking

DROP TABLE IF EXISTS habits CASCADE;
CREATE TABLE habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Habit details
    habit_name VARCHAR(200) NOT NULL CHECK (char_length(habit_name) > 0),
    category VARCHAR(100), -- Optional category (Mindfulness, Social, Health, etc.)
    
    -- Tracking configuration
    tracking_type habit_tracking_type NOT NULL DEFAULT 'checkbox',
    frequency VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'custom')),
    specific_days day_of_week[] DEFAULT '{}', -- For 'custom' frequency
    
    -- Optional metadata
    description TEXT CHECK (char_length(description) <= 500),
    target_value INTEGER, -- For counter/duration/rating types
    unit VARCHAR(50), -- 'minutes', 'glasses', 'times', etc.
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    
    -- Reminder settings
    reminder_enabled BOOLEAN DEFAULT false,
    reminder_time TIME, -- Time of day for reminder
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_habits_user_active ON habits(user_id, is_active, is_archived);
CREATE INDEX idx_habits_user_category ON habits(user_id, category) WHERE is_active = true;
CREATE INDEX idx_habits_tracking_type ON habits(user_id, tracking_type) WHERE is_active = true;

-- Unique index for partial unique constraint (one active habit per name per user)
CREATE UNIQUE INDEX idx_habits_unique_active ON habits(user_id, habit_name) 
    WHERE is_active = true AND is_archived = false;

-- Trigger for updated_at (added to 99-triggers.sql)

