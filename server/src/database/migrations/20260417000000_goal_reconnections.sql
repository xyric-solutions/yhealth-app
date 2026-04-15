-- ============================================
-- MIGRATION: Goal Reconnections (DKA Prevention feature)
-- Date: 2026-04-17
-- ============================================
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS goal_reconnections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    life_goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,
    goal_title VARCHAR(300) NOT NULL,

    days_silent INTEGER NOT NULL,
    tier SMALLINT NOT NULL CHECK (tier IN (1, 2, 3)),

    user_response VARCHAR(20) CHECK (
        user_response IN ('committed','paused','archived','snoozed','no_response')
    ),
    snoozed_until DATE,
    checkin_note TEXT,
    mood_about_goal INTEGER CHECK (mood_about_goal BETWEEN 1 AND 5),

    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (life_goal_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_goal_reconnections_user_open
    ON goal_reconnections(user_id, resolved_at)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_goal_reconnections_goal
    ON goal_reconnections(life_goal_id, created_at DESC);

-- updated_at trigger (reuse existing helper if present)
DO $$ BEGIN
    CREATE TRIGGER trg_goal_reconnections_updated_at
        BEFORE UPDATE ON goal_reconnections
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_function THEN
        RAISE NOTICE 'update_updated_at_column() not found; skipping trigger.';
END $$;
