-- ============================================
-- MINDFULNESS PRACTICES TABLE
-- ============================================
-- Practice library and user practice logs

DROP TABLE IF EXISTS mindfulness_practices CASCADE;
CREATE TABLE mindfulness_practices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- NULL for system/library practices, user_id for user logs
    
    -- Practice details (for library practices)
    practice_name VARCHAR(200) NOT NULL CHECK (char_length(practice_name) > 0),
    practice_category mindfulness_practice_category NOT NULL,
    
    -- Instructions (stored as JSONB array of steps)
    instructions JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"step": 1, "instruction": "..."}, ...]
    
    -- Practice metadata
    duration_minutes INTEGER, -- Typical duration (1, 3, 5, 10, 20)
    when_to_use TEXT CHECK (char_length(when_to_use) <= 500),
    why_it_helps TEXT CHECK (char_length(why_it_helps) <= 500),
    
    -- System practice flag
    is_system_practice BOOLEAN DEFAULT false,
    
    -- For user practice logs: completion data
    completed_at TIMESTAMPTZ, -- When practice was completed (for logs)
    actual_duration_minutes INTEGER, -- Actual duration user spent
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 10),
    context VARCHAR(100), -- Context when practice was done (e.g., 'high_stress', 'low_energy')
    note TEXT CHECK (char_length(note) <= 500),
    
    -- Recommendation tracking
    recommended_at TIMESTAMPTZ, -- When AI recommended this practice
    accepted BOOLEAN, -- Whether user accepted recommendation
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Check: if user_id is NULL, must be system practice
    CONSTRAINT mindfulness_practice_check CHECK (
        (is_system_practice = true AND user_id IS NULL) OR
        (is_system_practice = false AND user_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_mindfulness_system_practices ON mindfulness_practices(is_system_practice, practice_category) WHERE is_system_practice = true;
CREATE INDEX idx_mindfulness_user_logs ON mindfulness_practices(user_id, completed_at DESC) WHERE user_id IS NOT NULL AND completed_at IS NOT NULL;
CREATE INDEX idx_mindfulness_category ON mindfulness_practices(practice_category) WHERE is_system_practice = true;
CREATE INDEX idx_mindfulness_recommendations ON mindfulness_practices(user_id, recommended_at DESC) WHERE recommended_at IS NOT NULL;

-- Trigger for updated_at (added to 99-triggers.sql)

