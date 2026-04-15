-- ============================================
-- EXERCISE LOOKUP & MEDIA TABLES
-- ============================================
-- Canonical reference tables for exercises.
-- These serve as the source of truth for valid values
-- and power filter dropdowns in the UI.

-- ============================================
-- MUSCLES LOOKUP TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS muscles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    body_region VARCHAR(50),           -- 'upper_body', 'lower_body', 'core', 'full_body'
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_muscles_slug ON muscles(slug);
CREATE INDEX IF NOT EXISTS idx_muscles_body_region ON muscles(body_region);

-- ============================================
-- EQUIPMENT LOOKUP TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50),              -- 'free_weights', 'machines', 'bodyweight', 'bands', 'cardio', 'accessories'
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_slug ON equipment(slug);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);

-- ============================================
-- BODY PARTS LOOKUP TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS body_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_body_parts_slug ON body_parts(slug);

-- ============================================
-- EXERCISE MEDIA ASSETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS exercise_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,         -- 'image', 'gif', 'video', 'animation', 'thumbnail'
    url VARCHAR(1000) NOT NULL,
    r2_key VARCHAR(500),               -- Optional: cached in Cloudflare R2
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    mime_type VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    source VARCHAR(50),                -- 'exercisedb', 'rapidapi', 'manual', 'r2_cache'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exercise_media_exercise_id ON exercise_media(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_media_exercise_type ON exercise_media(exercise_id, type);
CREATE INDEX IF NOT EXISTS idx_exercise_media_primary ON exercise_media(exercise_id, is_primary) WHERE is_primary = true;
