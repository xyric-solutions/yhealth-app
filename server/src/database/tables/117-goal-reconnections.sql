-- ============================================
-- GOAL RECONNECTIONS TABLE
-- ============================================
-- Stores prompts asking the user to re-engage with a life_goal that has
-- been silent for a tiered duration (21 / 42 / 70 days).
-- Feature: Goal Reconnection (DKA Prevention) — prevent goals from
-- silently dying by surfacing a reflective "is this still yours?" moment.

CREATE TABLE IF NOT EXISTS goal_reconnections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    life_goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,
    goal_title VARCHAR(300) NOT NULL,

    -- Snapshot at trigger time
    days_silent INTEGER NOT NULL,
    tier SMALLINT NOT NULL CHECK (tier IN (1, 2, 3)),    -- 1=21d 2=42d 3=70d

    -- User response
    user_response VARCHAR(20) CHECK (
        user_response IN ('committed','paused','archived','snoozed','no_response')
    ),
    snoozed_until DATE,                 -- set when user_response='snoozed'
    checkin_note TEXT,                  -- optional, when committed
    mood_about_goal INTEGER CHECK (mood_about_goal BETWEEN 1 AND 5),

    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Each tier fires at most once per goal (ON CONFLICT guard)
    UNIQUE (life_goal_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_goal_reconnections_user_open
    ON goal_reconnections(user_id, resolved_at)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_goal_reconnections_goal
    ON goal_reconnections(life_goal_id, created_at DESC);
