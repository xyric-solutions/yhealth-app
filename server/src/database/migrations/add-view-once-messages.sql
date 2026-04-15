-- Add view-once support to messages table (WhatsApp-style disappearing media)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_view_once BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS view_once_opened_at TIMESTAMP;

-- Index for querying view-once messages
CREATE INDEX IF NOT EXISTS idx_messages_view_once ON messages(is_view_once) WHERE is_view_once = true;
