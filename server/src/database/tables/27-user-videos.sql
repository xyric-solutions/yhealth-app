-- User Private Videos
-- Allows users to add their own YouTube videos to the motivational widget

CREATE TABLE IF NOT EXISTS user_private_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    youtube_video_id VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    channel_name VARCHAR(255),
    thumbnail_url TEXT,
    goal_category VARCHAR(50) DEFAULT 'overall_optimization',
    content_type VARCHAR(20) DEFAULT 'motivation' CHECK (content_type IN ('motivation', 'workout', 'nutrition', 'tips')),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    notes TEXT,
    is_favorite BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, youtube_video_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_private_videos_user_id ON user_private_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_private_videos_goal_category ON user_private_videos(goal_category);
CREATE INDEX IF NOT EXISTS idx_user_private_videos_is_favorite ON user_private_videos(is_favorite);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_private_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_user_private_videos_updated_at ON user_private_videos;
CREATE TRIGGER trigger_user_private_videos_updated_at
    BEFORE UPDATE ON user_private_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_user_private_videos_updated_at();

-- Comments
COMMENT ON TABLE user_private_videos IS 'User-added private YouTube videos for motivation';
COMMENT ON COLUMN user_private_videos.youtube_video_id IS 'YouTube video ID (e.g., dQw4w9WgXcQ)';
COMMENT ON COLUMN user_private_videos.goal_category IS 'Weight loss, muscle building, etc.';
COMMENT ON COLUMN user_private_videos.content_type IS 'Type of content: motivation, workout, nutrition, tips';
COMMENT ON COLUMN user_private_videos.notes IS 'User notes about why they saved this video';
COMMENT ON COLUMN user_private_videos.sort_order IS 'Custom sort order for display';
