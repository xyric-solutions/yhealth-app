-- ============================================
-- CHAT PARTICIPANTS TABLE
-- ============================================
-- Many-to-many relationship between users and chats

CREATE TABLE IF NOT EXISTS chat_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Participation tracking
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,  -- NULL if still in chat
    
    -- Blocking (for community/group chats)
    is_blocked BOOLEAN DEFAULT false,
    
    -- Unread tracking
    unread_count INTEGER DEFAULT 0,
    last_read_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: user can only be in a chat once
    UNIQUE(chat_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id, left_at);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON chat_participants(chat_id, left_at);
CREATE INDEX IF NOT EXISTS idx_chat_participants_active ON chat_participants(chat_id, user_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_participants_unread ON chat_participants(user_id, unread_count) WHERE unread_count > 0 AND left_at IS NULL;

