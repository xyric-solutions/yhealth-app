-- ============================================
-- SYNC LOGS TABLE
-- ============================================
-- Integration sync history and results

DROP TABLE IF EXISTS sync_logs CASCADE;
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
    provider integration_provider NOT NULL,

    -- Sync details
    sync_type VARCHAR(20) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,

    -- Results
    status VARCHAR(20) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,

    -- Errors
    sync_errors JSONB,

    -- Date range synced
    date_range_start TIMESTAMP,
    date_range_end TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_sync_logs_user_created ON sync_logs(user_id, created_at DESC);
CREATE INDEX idx_sync_logs_integration_created ON sync_logs(integration_id, created_at DESC);
