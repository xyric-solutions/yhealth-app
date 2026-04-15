-- ============================================
-- MIGRATION: Goal Obstacles (Obstacle Diagnosis feature)
-- Date: 2026-04-16
-- ============================================
-- Adds the goal_obstacles table + two ENUMs used to store AI-diagnosed
-- obstacles when a user repeatedly misses a goal.
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS on the table and
-- DO $$ ... $$ blocks on the ENUMs.

-- ---- ENUMs -----------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE obstacle_category AS ENUM (
        'time', 'location', 'energy', 'motivation',
        'skill', 'social', 'health', 'environment', 'unclear'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE goal_ref_type AS ENUM ('life_goal', 'user_goal', 'daily_intention');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Table -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS goal_obstacles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Which goal this obstacle relates to
    goal_ref_type goal_ref_type NOT NULL,
    goal_ref_id UUID NOT NULL,
    goal_title VARCHAR(300) NOT NULL,

    -- Miss-pattern snapshot at trigger time
    miss_count_last_7d INTEGER NOT NULL,

    -- AI diagnosis (nullable until coach session completes)
    category obstacle_category,
    ai_notes TEXT,

    -- Proposed adjustment: { kind, payload }
    -- kinds: reschedule | reduce_frequency | change_location | add_preparation_intention | no_change
    suggested_adjustment JSONB,

    -- User response to the suggested adjustment
    user_response VARCHAR(20) CHECK (user_response IN ('accepted','modified','declined','no_response')),

    -- Chat session driving the diagnosis (optional — present if tied to an ai_coach_sessions row)
    coach_session_id UUID REFERENCES ai_coach_sessions(id) ON DELETE SET NULL,

    -- Lifecycle
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---- Indexes ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_goal_obstacles_user_goal
    ON goal_obstacles(user_id, goal_ref_type, goal_ref_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_obstacles_user_open
    ON goal_obstacles(user_id, resolved_at)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_goal_obstacles_session
    ON goal_obstacles(coach_session_id)
    WHERE coach_session_id IS NOT NULL;

-- ---- updated_at trigger ---------------------------------------------

DO $$ BEGIN
    CREATE TRIGGER trg_goal_obstacles_updated_at
        BEFORE UPDATE ON goal_obstacles
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_function THEN
        -- update_updated_at_column() may not exist in some environments;
        -- the triggers file (99-triggers.sql) will register it during full setup.
        RAISE NOTICE 'update_updated_at_column() not found; skipping trigger registration.';
END $$;
