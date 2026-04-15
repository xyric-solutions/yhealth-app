-- ============================================
-- CALENDAR CONNECTIONS TABLE
-- ============================================
-- Stores OAuth tokens for external calendar providers (Google, Outlook).
-- Part of AI Calendar Intelligence feature.

CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL DEFAULT 'google',
    client_id TEXT,
    client_secret TEXT,
    redirect_uri TEXT DEFAULT 'http://localhost:9090/api/calendar/callback',
    access_token TEXT DEFAULT '',
    refresh_token TEXT DEFAULT '',
    token_expires_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    calendar_ids JSONB DEFAULT '[]',
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sync_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_sync ON calendar_connections(sync_enabled, sync_status);
