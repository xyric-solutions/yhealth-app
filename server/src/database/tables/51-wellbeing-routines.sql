-- ============================================
-- WELLBEING ROUTINES TABLE
-- ============================================
-- Routine templates and user-defined routines

DROP TABLE IF EXISTS wellbeing_routines CASCADE;
CREATE TABLE wellbeing_routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Routine details
    routine_name VARCHAR(200) NOT NULL CHECK (char_length(routine_name) > 0),
    routine_type VARCHAR(20) NOT NULL CHECK (routine_type IN ('morning', 'evening', 'custom')),
    
    -- Template flag
    is_template BOOLEAN DEFAULT false,
    template_id UUID, -- Reference to template if based on one
    
    -- Routine steps (stored as JSONB for flexibility)
    steps JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"step": "Gratitude", "duration_min": 1, "order": 1, "instructions": "..."}, ...]
    
    -- Frequency
    frequency VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'weekends', 'custom')),
    specific_days day_of_week[] DEFAULT '{}', -- For 'custom' frequency
    
    -- Time-based trigger
    trigger_time TIME, -- Time to start routine (optional)
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_routines_user_active ON wellbeing_routines(user_id, is_active, is_archived);
CREATE INDEX idx_routines_type ON wellbeing_routines(user_id, routine_type) WHERE is_active = true;
CREATE INDEX idx_routines_template ON wellbeing_routines(template_id) WHERE is_template = false;

-- Trigger for updated_at (added to 99-triggers.sql)

