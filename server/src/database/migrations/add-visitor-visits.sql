-- Migration: Add Visitor Visits Table
-- Tracks unique visitors per day for admin analytics; country from server-side IP lookup

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- VISITOR_VISITS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS visitor_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visited_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    visitor_key VARCHAR(64) NOT NULL,
    country_code VARCHAR(2),
    country_name VARCHAR(100),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- Index for date-range queries and daily unique counts
CREATE INDEX IF NOT EXISTS idx_visitor_visits_visited_at ON visitor_visits(visited_at);

-- Index for country breakdown
CREATE INDEX IF NOT EXISTS idx_visitor_visits_country ON visitor_visits(country_code);

SELECT 'Visitor visits table created successfully!' AS status;
