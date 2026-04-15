-- Add Spotify integration support
-- Adds 'spotify' to integration_provider enum and creates cached playlists table

-- Add 'spotify' to integration_provider enum
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a DO $$ block or transaction
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'spotify';

-- Cached Spotify playlists (populated via Client Credentials flow)
CREATE TABLE IF NOT EXISTS spotify_cached_playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL,
  spotify_playlist_id VARCHAR(255) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  image_url TEXT,
  track_count INTEGER DEFAULT 0,
  cached_tracks JSONB,
  last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, spotify_playlist_id)
);

CREATE INDEX IF NOT EXISTS idx_spotify_cached_cat ON spotify_cached_playlists(category);
