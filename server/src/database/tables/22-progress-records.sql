-- ============================================
-- PROGRESS RECORDS TABLE
-- ============================================
-- Tracks weight, measurements, and progress photos over time

DROP TABLE IF EXISTS progress_records CASCADE;
CREATE TABLE progress_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Record details
    record_date DATE NOT NULL,
    record_type VARCHAR(50) NOT NULL,              -- 'weight', 'measurement', 'photo', 'body_composition'

    -- Values (flexible based on record_type)
    value JSONB NOT NULL,
    -- Examples:
    -- weight: {"value": 75.5, "unit": "kg"}
    -- measurement: {"chest": 100, "waist": 80, "hips": 95, "arms": 35, "thighs": 55, "unit": "cm"}
    -- body_composition: {"body_fat_pct": 18.5, "muscle_mass_kg": 35, "water_pct": 55}

    -- Photos
    photo_keys TEXT[] DEFAULT '{}',               -- Array of R2 storage keys

    -- Source
    source VARCHAR(50) DEFAULT 'manual',           -- 'manual', 'smart_scale', 'integration', 'ai_analysis'
    source_device VARCHAR(100),

    -- Notes
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint for one record per type per day
    CONSTRAINT unique_progress_record UNIQUE (user_id, record_date, record_type)
);

-- Indexes
CREATE INDEX idx_progress_records_user ON progress_records(user_id, record_date DESC);
CREATE INDEX idx_progress_records_type ON progress_records(user_id, record_type, record_date DESC);
CREATE INDEX idx_progress_records_date ON progress_records(record_date);
