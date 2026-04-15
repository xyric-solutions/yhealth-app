-- ============================================
-- STARRED MESSAGES TABLE
-- ============================================
-- Stores user-starred messages (favorites)

CREATE TABLE IF NOT EXISTS starred_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: user can only star a message once
    UNIQUE(message_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_starred_messages_user ON starred_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_starred_messages_message ON starred_messages(message_id);

