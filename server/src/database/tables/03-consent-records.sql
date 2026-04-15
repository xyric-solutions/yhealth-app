-- ============================================
-- CONSENT RECORDS TABLE
-- ============================================
-- Tracks user consent for terms, privacy, marketing

DROP TABLE IF EXISTS consent_records CASCADE;
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type consent_type NOT NULL,
    version VARCHAR(20) NOT NULL,
    consented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(45),

    UNIQUE(user_id, type)
);

-- Indexes
CREATE INDEX idx_consent_records_user_id ON consent_records(user_id);
