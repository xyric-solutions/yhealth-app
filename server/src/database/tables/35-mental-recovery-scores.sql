-- ============================================
-- MENTAL RECOVERY SCORES TABLE
-- ============================================
-- Store calculated mental recovery scores incorporating emotion data

DROP TABLE IF EXISTS mental_recovery_scores CASCADE;
CREATE TABLE mental_recovery_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Score data
    score_date DATE NOT NULL,
    recovery_score DECIMAL(5,2) NOT NULL CHECK (recovery_score >= 0 AND recovery_score <= 100),
    
    -- Score components (stored as JSONB for flexibility)
    components JSONB DEFAULT '{}',  -- {sleep: number, stress: number, mood: number, emotion: number, activity: number}
    
    -- Emotion contribution
    emotion_contribution FLOAT DEFAULT 0.0,  -- Percentage contribution of emotion data (default 15%)
    emotion_weight FLOAT DEFAULT 0.15,  -- Weight used for emotion in calculation
    
    -- Contributing factors
    factors JSONB DEFAULT '{}',  -- {sleepHours: number, stressLevel: number, moodScore: number, avgEmotionScore: number, activityLevel: number}
    
    -- Trend indicators
    trend VARCHAR(20),  -- 'improving', 'stable', 'declining'
    previous_score DECIMAL(5,2),  -- Previous day's score for comparison
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one score per user per day
    UNIQUE(user_id, score_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recovery_scores_user_date ON mental_recovery_scores(user_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_scores_user_trend ON mental_recovery_scores(user_id, trend, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_scores_date_range ON mental_recovery_scores(score_date DESC);

-- Trigger is created in 99-triggers.sql

