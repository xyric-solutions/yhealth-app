-- ============================================
-- PROACTIVE MESSAGES LOG
-- Tracks AI coach proactive messages sent to users
-- for deduplication and cooldown enforcement
-- ============================================

CREATE TABLE IF NOT EXISTS proactive_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL,
  message_id UUID NOT NULL,
  chat_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_proactive_msg_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_proactive_msg_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_proactive_messages_user_type_date
ON proactive_messages(user_id, message_type, created_at);
