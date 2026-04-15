-- ============================================
-- USER INTEGRATIONS TABLE
-- ============================================
-- Connected health app integrations (Whoop, Fitbit, etc.)

DROP TABLE IF EXISTS user_integrations CASCADE;
CREATE TABLE user_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider integration_provider NOT NULL,

    -- OAuth tokens
    -- access_token is nullable to allow storing credentials before OAuth completion
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    scopes TEXT[] DEFAULT '{}',
    
    -- Per-user OAuth credentials (for WHOOP and other providers that support it)
    client_id TEXT,
    client_secret TEXT,

    -- Connection status
    status sync_status DEFAULT 'pending',
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP,

    -- Sync tracking
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(20),
    last_sync_error TEXT,
    sync_retry_count INTEGER DEFAULT 0,
    next_sync_at TIMESTAMP,

    -- Initial sync progress
    initial_sync_complete BOOLEAN DEFAULT false,
    initial_sync_progress JSONB,

    -- User preferences for this integration
    is_primary_for_data_types data_type[] DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,

    -- Device info
    device_info JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX idx_user_integrations_user_status ON user_integrations(user_id, status);
CREATE INDEX idx_user_integrations_status_next_sync ON user_integrations(status, next_sync_at);
