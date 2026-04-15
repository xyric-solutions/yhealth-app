-- ============================================================================
-- User Follow / Buddy Relationship System
-- ============================================================================

-- 1. Follow relationships with match metadata
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, accepted, rejected, blocked
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  match_reason TEXT,
  match_score NUMERIC(3,2),
  requester_message TEXT,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id),
  CHECK(requester_id != recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_uf_requester ON user_follows(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_uf_recipient ON user_follows(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_uf_pending ON user_follows(status) WHERE status = 'pending';

-- 2. Buddy discovery consent (opt-in)
CREATE TABLE IF NOT EXISTS buddy_discovery_consent (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  allow_suggestions BOOLEAN DEFAULT false,
  allow_goal_sharing BOOLEAN DEFAULT false,
  allow_activity_sharing BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Precomputed buddy suggestions cache
CREATE TABLE IF NOT EXISTS buddy_suggestions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggested_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_score NUMERIC(3,2) NOT NULL,
  match_reason TEXT NOT NULL,
  goal_overlap JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT false,
  UNIQUE(user_id, suggested_user_id)
);

CREATE INDEX IF NOT EXISTS idx_bsc_user ON buddy_suggestions_cache(user_id, dismissed, match_score DESC);
