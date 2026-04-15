-- ============================================
-- YOGA POSES TABLE
-- ============================================
-- Pose library for yoga sessions
-- Part of Wellbeing module (F7.9)

DROP TABLE IF EXISTS yoga_poses CASCADE;
CREATE TABLE yoga_poses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    english_name VARCHAR(200) NOT NULL,
    sanskrit_name VARCHAR(200),
    slug VARCHAR(200) UNIQUE NOT NULL,

    -- Classification
    category VARCHAR(50) NOT NULL,  -- standing, seated, supine, prone, inversion, balance, twist, backbend, forward_fold, hip_opener, restorative
    difficulty VARCHAR(20) NOT NULL DEFAULT 'beginner',  -- beginner, intermediate, advanced
    description TEXT,

    -- Health & Training Data
    benefits TEXT[],                     -- e.g., ['improves balance', 'strengthens core']
    muscle_groups TEXT[],                -- e.g., ['hamstrings', 'core', 'shoulders']
    contraindications TEXT[],           -- Safety warnings, e.g., ['avoid with knee injury']

    -- Instruction
    cues JSONB NOT NULL DEFAULT '[]',   -- [{step: 1, instruction: "...", breathDirection: "inhale"/"exhale"/"natural"}]
    breathing_cue VARCHAR(255),         -- Quick breathing note, e.g., "Breathe deeply through nose"
    hold_seconds_default INTEGER DEFAULT 30,

    -- Visuals
    svg_key VARCHAR(255),               -- Reference to pose SVG illustration asset

    -- Recovery Mapping
    is_recovery_pose BOOLEAN DEFAULT false,
    recovery_targets TEXT[],            -- legs, back, shoulders, hips, core, chest, neck

    -- AI Pose Coaching
    joint_targets JSONB DEFAULT NULL,   -- Target joint angles: { "left_knee": { "angle": 90, "tolerance": 15 } }

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_yoga_poses_category ON yoga_poses(category);
CREATE INDEX idx_yoga_poses_difficulty ON yoga_poses(difficulty);
CREATE INDEX idx_yoga_poses_slug ON yoga_poses(slug);
CREATE INDEX idx_yoga_poses_recovery ON yoga_poses(is_recovery_pose) WHERE is_recovery_pose = true;
CREATE INDEX idx_yoga_poses_muscles ON yoga_poses USING GIN(muscle_groups);
CREATE INDEX idx_yoga_poses_benefits ON yoga_poses USING GIN(benefits);
