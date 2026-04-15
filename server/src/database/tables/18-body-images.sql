-- ============================================
-- USER BODY IMAGES TABLE
-- ============================================
-- Stores body photos for analysis and progress tracking

DROP TABLE IF EXISTS user_body_images CASCADE;
CREATE TABLE user_body_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Image metadata
    image_type VARCHAR(50) NOT NULL,              -- 'face', 'front', 'side', 'back'
    image_key VARCHAR(500) NOT NULL,              -- R2 storage key
    capture_context VARCHAR(50) NOT NULL,         -- 'onboarding', 'progress', 'weekly_checkin'

    -- AI analysis results (async populated)
    analysis_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    analysis_result JSONB,                         -- AI body composition analysis
    analyzed_at TIMESTAMP,

    -- Privacy
    is_encrypted BOOLEAN DEFAULT false,

    -- Timestamps
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_body_images_user ON user_body_images(user_id, capture_context);
CREATE INDEX idx_body_images_user_type ON user_body_images(user_id, image_type);
CREATE INDEX idx_body_images_captured ON user_body_images(user_id, captured_at DESC);
