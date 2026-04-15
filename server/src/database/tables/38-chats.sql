-- ============================================
-- CHATS TABLE
-- ============================================
-- Stores chat conversations (one-on-one and group chats)

CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_name VARCHAR(255) NOT NULL,
    is_group_chat BOOLEAN DEFAULT false,
    is_community BOOLEAN DEFAULT false,  -- Special flag for community groups
    avatar TEXT,  -- Avatar URL
    group_admin UUID REFERENCES users(id) ON DELETE SET NULL,
    latest_message_id UUID,  -- Will reference messages table (FK added after messages table is created)
    
    -- Group join code (6-digit code)
    join_code VARCHAR(6) UNIQUE,
    join_code_expires_at TIMESTAMP,
    
    -- Group creator (for permission checks)
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Message permissions
    message_permission_mode VARCHAR(20) DEFAULT 'all',  -- 'all' or 'restricted'
    allowed_sender_ids UUID[] DEFAULT '{}',  -- Array of user IDs who can send (when mode is 'restricted')
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chats_latest_message ON chats(latest_message_id);
CREATE INDEX IF NOT EXISTS idx_chats_is_community ON chats(is_community) WHERE is_community = true;
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_join_code ON chats(join_code) WHERE join_code IS NOT NULL;

-- Foreign key constraint for latest_message_id will be added in messages.sql after messages table is created

