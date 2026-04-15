-- ============================================
-- HEALTH DATA RECORDS TABLE
-- ============================================
-- Synced health data from integrations

DROP TABLE IF EXISTS health_data_records CASCADE;
CREATE TABLE health_data_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
    provider integration_provider NOT NULL,
    data_type data_type NOT NULL,

    -- Timestamp
    recorded_at TIMESTAMP NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Value
    value JSONB NOT NULL,
    unit VARCHAR(50) NOT NULL,

    -- Source priority
    source_priority INTEGER DEFAULT 0,
    is_golden_source BOOLEAN DEFAULT false,

    -- Raw data reference
    raw_data_id VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_health_data_user_type_recorded ON health_data_records(user_id, data_type, recorded_at DESC);
CREATE INDEX idx_health_data_user_recorded ON health_data_records(user_id, recorded_at DESC);
CREATE INDEX idx_health_data_user_type_golden ON health_data_records(user_id, data_type, is_golden_source);

-- Deduplication constraint: prevents duplicate records from the same integration source
-- Partial index (WHERE raw_data_id IS NOT NULL) allows legacy rows without source IDs
CREATE UNIQUE INDEX idx_health_data_records_dedup
  ON health_data_records(user_id, provider, data_type, raw_data_id)
  WHERE raw_data_id IS NOT NULL;
