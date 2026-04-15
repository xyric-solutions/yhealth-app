-- ============================================
-- PGVECTOR EXTENSION SETUP
-- ============================================
-- Enables vector similarity search for RAG chatbot

-- Enable pgvector extension (requires superuser or extension privileges)
-- Gracefully handle if extension is not available
DO $$
BEGIN
    -- Try to create extension, but don't fail if it's not available
    BEGIN
        CREATE EXTENSION IF NOT EXISTS vector;
        RAISE NOTICE 'pgvector extension enabled successfully';
    EXCEPTION WHEN OTHERS THEN
        -- Extension not available or insufficient privileges
        -- System will use text search fallback
        RAISE NOTICE 'pgvector extension not available, using text search fallback';
    END;
END $$;

-- ============================================
-- VECTOR EMBEDDINGS TABLE
-- ============================================
-- Stores embeddings for conversation history and knowledge base

DROP TABLE IF EXISTS vector_embeddings CASCADE;
CREATE TABLE vector_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source reference
    source_type VARCHAR(50) NOT NULL,  -- 'conversation', 'knowledge', 'user_profile', 'health_data'
    source_id UUID NOT NULL,           -- Reference to source record
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,             -- Original text content
    content_type VARCHAR(50) DEFAULT 'message', -- 'message', 'summary', 'insight', 'document'

    -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
    embedding vector(1536),

    -- Metadata for filtering
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for vector similarity search
CREATE INDEX idx_vector_embeddings_embedding ON vector_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_vector_embeddings_user ON vector_embeddings(user_id);
CREATE INDEX idx_vector_embeddings_source ON vector_embeddings(source_type, source_id);
CREATE INDEX idx_vector_embeddings_type ON vector_embeddings(source_type, content_type);
CREATE INDEX idx_vector_embeddings_metadata ON vector_embeddings USING gin(metadata);

-- ============================================
-- CONVERSATION MEMORY TABLE
-- ============================================
-- Stores conversation sessions with vector-indexed messages

DROP TABLE IF EXISTS rag_conversations CASCADE;
CREATE TABLE rag_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session info
    title VARCHAR(255),
    session_type VARCHAR(50) DEFAULT 'health_coach', -- 'quick_checkin', 'coaching_session', 'emergency_support', 'goal_review', 'health_coach', 'nutrition', 'fitness', 'wellness'

    -- Conversation state
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'completed', 'archived'
    message_count INTEGER DEFAULT 0,
    
    -- Session management
    session_duration INTEGER, -- Actual duration in seconds
    session_phase VARCHAR(50), -- Current phase of session
    target_duration INTEGER, -- Expected session length in seconds
    emergency_triggered BOOLEAN DEFAULT false, -- Flag for crisis sessions
    goal_id UUID REFERENCES user_goals(id) ON DELETE SET NULL, -- For goal review sessions
    upgraded_from UUID REFERENCES rag_conversations(id) ON DELETE SET NULL, -- Reference to original session if upgraded

    -- Summary for quick context loading
    summary TEXT,
    summary_embedding vector(1536),

    -- Key topics discussed (for filtering)
    topics TEXT[] DEFAULT '{}',

    -- LangGraph state checkpoint
    langgraph_checkpoint JSONB,

    -- Timestamps
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rag_conversations_user ON rag_conversations(user_id, created_at DESC);
CREATE INDEX idx_rag_conversations_status ON rag_conversations(user_id, status);
CREATE INDEX idx_rag_conversations_summary ON rag_conversations
    USING ivfflat (summary_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_rag_conversations_topics ON rag_conversations USING gin(topics);

-- ============================================
-- CONVERSATION MESSAGES TABLE
-- ============================================
-- Individual messages with embeddings for retrieval

DROP TABLE IF EXISTS rag_messages CASCADE;
CREATE TABLE rag_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Message content
    role VARCHAR(20) NOT NULL,  -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,

    -- Vector embedding for retrieval
    embedding vector(1536),

    -- Message metadata
    metadata JSONB DEFAULT '{}',  -- tokens, model, tool_calls, etc.

    -- For tool/function calls
    tool_calls JSONB,
    tool_call_id VARCHAR(100),

    -- Extracted entities/insights
    extracted_entities JSONB DEFAULT '[]',

    -- Sequence in conversation
    sequence_number INTEGER NOT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rag_messages_conversation ON rag_messages(conversation_id, sequence_number);
CREATE INDEX idx_rag_messages_user ON rag_messages(user_id, created_at DESC);
CREATE INDEX idx_rag_messages_embedding ON rag_messages
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_rag_messages_role ON rag_messages(conversation_id, role);

-- ============================================
-- HEALTH KNOWLEDGE BASE TABLE
-- ============================================
-- Stores health & fitness knowledge for RAG retrieval

DROP TABLE IF EXISTS health_knowledge_base CASCADE;
CREATE TABLE health_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Content categorization
    category VARCHAR(100) NOT NULL,  -- 'nutrition', 'exercise', 'sleep', 'mental_health', 'medical'
    subcategory VARCHAR(100),

    -- Content
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,

    -- Vector embedding
    embedding vector(1536),

    -- Source tracking
    source VARCHAR(255),
    source_url TEXT,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Quality/trust score
    trust_score DECIMAL(3,2) DEFAULT 1.00,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_health_kb_embedding ON health_knowledge_base
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_health_kb_category ON health_knowledge_base(category, subcategory);
CREATE INDEX idx_health_kb_tags ON health_knowledge_base USING gin(tags);
CREATE INDEX idx_health_kb_active ON health_knowledge_base(is_active) WHERE is_active = true;

-- ============================================
-- USER HEALTH PROFILE EMBEDDINGS
-- ============================================
-- Stores vectorized user health data for personalized retrieval

DROP TABLE IF EXISTS user_health_embeddings CASCADE;
CREATE TABLE user_health_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Profile section
    section VARCHAR(100) NOT NULL,  -- 'goals', 'conditions', 'preferences', 'history', 'metrics'

    -- Content
    content TEXT NOT NULL,

    -- Vector embedding
    embedding vector(1536),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Validity
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    is_current BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_health_embeddings_user ON user_health_embeddings(user_id, section);
CREATE INDEX idx_user_health_embeddings_embedding ON user_health_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_user_health_embeddings_current ON user_health_embeddings(user_id, is_current)
    WHERE is_current = true;

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_vector_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vector_embeddings_updated_at ON vector_embeddings;
CREATE TRIGGER trigger_vector_embeddings_updated_at
    BEFORE UPDATE ON vector_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_vector_tables_updated_at();

DROP TRIGGER IF EXISTS trigger_rag_conversations_updated_at ON rag_conversations;
CREATE TRIGGER trigger_rag_conversations_updated_at
    BEFORE UPDATE ON rag_conversations
    FOR EACH ROW EXECUTE FUNCTION update_vector_tables_updated_at();

DROP TRIGGER IF EXISTS trigger_health_kb_updated_at ON health_knowledge_base;
CREATE TRIGGER trigger_health_kb_updated_at
    BEFORE UPDATE ON health_knowledge_base
    FOR EACH ROW EXECUTE FUNCTION update_vector_tables_updated_at();

DROP TRIGGER IF EXISTS trigger_user_health_embeddings_updated_at ON user_health_embeddings;
CREATE TRIGGER trigger_user_health_embeddings_updated_at
    BEFORE UPDATE ON user_health_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_vector_tables_updated_at();
