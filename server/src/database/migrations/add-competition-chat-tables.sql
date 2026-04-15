-- ============================================
-- MIGRATION: Add Competition Chat Tables
-- ============================================
-- Adds persistent storage for competition live chat messages and reactions.
-- Replaces the in-memory Map-based implementation so messages survive
-- server restarts.
--
-- Date: 2026-02-17
-- Description: Adds competition_chat_messages and competition_chat_reactions tables
-- ============================================

-- ============================================
-- 1. COMPETITION CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS competition_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign keys
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Message content
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),

  -- Reply threading
  reply_to_id UUID REFERENCES competition_chat_messages(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_competition_created
  ON competition_chat_messages(competition_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON competition_chat_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to
  ON competition_chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Comments
COMMENT ON TABLE competition_chat_messages IS 'Live chat messages within competition rooms';
COMMENT ON COLUMN competition_chat_messages.content IS 'Message text (1-1000 chars)';
COMMENT ON COLUMN competition_chat_messages.reply_to_id IS 'Optional parent message for reply threading';

-- ============================================
-- 2. COMPETITION CHAT REACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS competition_chat_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign keys
  message_id UUID NOT NULL REFERENCES competition_chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Reaction emoji
  emoji VARCHAR(32) NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- One reaction per emoji per user per message
  UNIQUE(message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message
  ON competition_chat_reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_user
  ON competition_chat_reactions(user_id);

-- Comments
COMMENT ON TABLE competition_chat_reactions IS 'Emoji reactions on competition chat messages';
COMMENT ON COLUMN competition_chat_reactions.emoji IS 'Emoji string (e.g. thumbsup, heart)';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Competition Chat tables migration completed successfully!';
    RAISE NOTICE '💬 Tables created: competition_chat_messages, competition_chat_reactions';
END $$;
