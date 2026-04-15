-- ============================================
-- CALENDAR EVENTS TABLE
-- ============================================
-- Synced events from external calendars (Google Calendar).
-- Used by schedule-context.service.ts for AI awareness.

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
    external_id VARCHAR(500) NOT NULL,
    calendar_id VARCHAR(500),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN NOT NULL DEFAULT false,
    location TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    busy_status VARCHAR(20) NOT NULL DEFAULT 'busy',
    recurrence_rule TEXT,
    metadata JSONB DEFAULT '{}',
    synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connection_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON calendar_events(user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection ON calendar_events(connection_id);
