-- ============================================
-- MESSAGES TABLE
-- ============================================
-- Stores chat messages with support for media, reactions, and advanced features

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message content
    content TEXT,
    content_type VARCHAR(50) DEFAULT 'text',  -- 'text', 'image', 'video', 'audio', 'document', 'deleted'
    
    -- Media files (stored in R2)
    media_url TEXT,  -- R2 URL for media files
    media_thumbnail TEXT,  -- Thumbnail URL for images/videos
    media_size BIGINT,  -- File size in bytes
    media_duration INTEGER,  -- Duration in seconds (for audio/video)
    
    -- Edit tracking
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMP,
    
    -- Delete tracking (soft delete)
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Pin tracking
    is_pinned BOOLEAN DEFAULT false,
    pinned_at TIMESTAMP,
    pinned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Reply thread
    replied_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    -- Forward tracking
    forwarded_from_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    forwarded_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- View-once (disappearing media)
    is_view_once BOOLEAN DEFAULT false,
    view_once_opened_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_replied_to ON messages(replied_to_id) WHERE replied_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_forwarded_from ON messages(forwarded_from_id) WHERE forwarded_from_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(chat_id, is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(chat_id, is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_messages_content_type ON messages(content_type);

-- Add foreign key constraint for chats.latest_message_id (only if chats table exists and constraint doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chats') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_chats_latest_message' 
            AND table_name = 'chats'
        ) THEN
            ALTER TABLE chats ADD CONSTRAINT fk_chats_latest_message 
                FOREIGN KEY (latest_message_id) REFERENCES messages(id) ON DELETE SET NULL;
        END IF;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Constraint already exists, ignore
END $$;

