-- ============================================
-- NEW TABLE
-- ============================================
-- Description: [Add table description here]

DROP TABLE IF EXISTS new_table CASCADE;
CREATE TABLE new_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Field 1
    field1 VARCHAR(255) NOT NULL,
    
    -- Field 2
    field2 TEXT,
    
    -- Field 3
    field3 INTEGER DEFAULT 0,
    
    -- Field 4
    field4 BOOLEAN DEFAULT false,
    
    -- Field 5
    field5 TIMESTAMP,
    
    -- Field 6
    field6 UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Field 7
    field7 JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_new_table_field1 ON new_table(field1);
CREATE INDEX idx_new_table_field6 ON new_table(field6);
CREATE INDEX idx_new_table_created_at ON new_table(created_at DESC);

