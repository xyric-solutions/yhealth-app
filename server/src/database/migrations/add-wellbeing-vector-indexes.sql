-- Add database indexes for efficient wellbeing vector searches
-- This migration adds indexes to the vector_embeddings table for wellbeing-specific queries

-- Index for filtering by wellbeing type
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_wellbeing_type 
ON vector_embeddings ((metadata->>'wellbeing_type'))
WHERE source_type = 'wellbeing';

-- Index for user-specific wellbeing queries
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_user_wellbeing 
ON vector_embeddings (user_id, source_type)
WHERE source_type = 'wellbeing';

-- Index for date-based filtering in wellbeing metadata
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_wellbeing_date 
ON vector_embeddings ((metadata->>'date'))
WHERE source_type = 'wellbeing' AND metadata->>'date' IS NOT NULL;

-- Composite index for user + wellbeing type + date queries
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_user_wellbeing_date 
ON vector_embeddings (user_id, (metadata->>'wellbeing_type'), (metadata->>'date'))
WHERE source_type = 'wellbeing';

-- Index for content search (text search fallback)
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_wellbeing_content 
ON vector_embeddings USING gin (to_tsvector('english', content))
WHERE source_type = 'wellbeing';

