-- ============================================
-- MIGRATION: Sync Missing Columns
-- ============================================
-- Adds columns that exist in table definitions but may be missing
-- from the actual database (tables created before columns were added,
-- or CASCADE drops from enum recreation).
--
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).
-- Date: 2026-03-04
-- ============================================

-- ============================================
-- 1. Ensure all enum types exist
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_status') THEN
    CREATE TYPE onboarding_status AS ENUM ('registered', 'consent_pending', 'assessment_pending', 'goals_pending', 'integrations_pending', 'preferences_pending', 'plan_pending', 'completed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coaching_style') THEN
    CREATE TYPE coaching_style AS ENUM ('supportive', 'direct', 'analytical', 'motivational');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coaching_intensity') THEN
    CREATE TYPE coaching_intensity AS ENUM ('light', 'moderate', 'intensive');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_category') THEN
    CREATE TYPE goal_category AS ENUM ('weight_loss', 'muscle_building', 'sleep_improvement', 'stress_wellness', 'energy_productivity', 'event_training', 'health_condition', 'habit_building', 'overall_optimization', 'custom');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_status') THEN
    CREATE TYPE goal_status AS ENUM ('draft', 'active', 'in_progress', 'paused', 'completed', 'abandoned');
  END IF;

  -- Add in_progress to existing goal_status enum if missing
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_progress' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'goal_status')) THEN
    ALTER TYPE goal_status ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_pillar') THEN
    CREATE TYPE health_pillar AS ENUM ('fitness', 'nutrition', 'wellbeing');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_status') THEN
    CREATE TYPE plan_status AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_log_status') THEN
    CREATE TYPE activity_log_status AS ENUM ('pending', 'completed', 'skipped', 'partial', 'missed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_status') THEN
    CREATE TYPE competition_status AS ENUM ('draft', 'active', 'ended', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_entry_status') THEN
    CREATE TYPE competition_entry_status AS ENUM ('active', 'disqualified', 'completed', 'withdrawn');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_type') THEN
    CREATE TYPE competition_type AS ENUM ('ai_generated', 'admin_created');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leaderboard_type') THEN
    CREATE TYPE leaderboard_type AS ENUM ('global', 'country', 'friends', 'competition');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM ('push', 'email', 'whatsapp', 'sms');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_provider') THEN
    CREATE TYPE auth_provider AS ENUM ('local', 'google', 'apple', 'system');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_status') THEN
    CREATE TYPE activity_status AS ENUM ('working', 'sick', 'injury', 'rest', 'vacation', 'travel', 'stress', 'excellent', 'good', 'fair', 'poor');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
    CREATE TYPE gender AS ENUM ('male', 'female', 'non_binary', 'prefer_not_to_say');
  END IF;
END $$;

-- ============================================
-- 2. users table — missing columns
-- ============================================
DO $$
BEGIN
  -- gender
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gender') THEN
    ALTER TABLE users ADD COLUMN gender gender;
  END IF;

  -- onboarding_status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'onboarding_status') THEN
    ALTER TABLE users ADD COLUMN onboarding_status onboarding_status DEFAULT 'registered';
  END IF;

  -- onboarding_completed_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'onboarding_completed_at') THEN
    ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMP;
  END IF;

  -- auth_provider
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'auth_provider') THEN
    ALTER TABLE users ADD COLUMN auth_provider auth_provider DEFAULT 'local';
  END IF;

  -- provider_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'provider_id') THEN
    ALTER TABLE users ADD COLUMN provider_id TEXT;
  END IF;

  -- current_activity_status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_activity_status') THEN
    ALTER TABLE users ADD COLUMN current_activity_status activity_status DEFAULT 'working';
  END IF;

  -- activity_status_updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'activity_status_updated_at') THEN
    ALTER TABLE users ADD COLUMN activity_status_updated_at TIMESTAMP;
  END IF;

  -- Gamification columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'total_xp') THEN
    ALTER TABLE users ADD COLUMN total_xp INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_level') THEN
    ALTER TABLE users ADD COLUMN current_level INTEGER DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_streak') THEN
    ALTER TABLE users ADD COLUMN current_streak INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'longest_streak') THEN
    ALTER TABLE users ADD COLUMN longest_streak INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_activity_date') THEN
    ALTER TABLE users ADD COLUMN last_activity_date DATE;
  END IF;

  -- Daily health columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'daily_sleep_hours') THEN
    ALTER TABLE users ADD COLUMN daily_sleep_hours DECIMAL(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'daily_recovery_score') THEN
    ALTER TABLE users ADD COLUMN daily_recovery_score INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'daily_strain_score') THEN
    ALTER TABLE users ADD COLUMN daily_strain_score DECIMAL(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'daily_cycle_day') THEN
    ALTER TABLE users ADD COLUMN daily_cycle_day INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'daily_health_updated_at') THEN
    ALTER TABLE users ADD COLUMN daily_health_updated_at TIMESTAMP;
  END IF;

  -- Stripe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
  END IF;

  -- Privacy flags
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'privacy_flags') THEN
    ALTER TABLE users ADD COLUMN privacy_flags JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- 3. user_preferences table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'coaching_style') THEN
    ALTER TABLE user_preferences ADD COLUMN coaching_style coaching_style DEFAULT 'supportive';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'coaching_intensity') THEN
    ALTER TABLE user_preferences ADD COLUMN coaching_intensity coaching_intensity DEFAULT 'moderate';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'preferred_channel') THEN
    ALTER TABLE user_preferences ADD COLUMN preferred_channel notification_channel DEFAULT 'push';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'preferred_check_in_time') THEN
    ALTER TABLE user_preferences ADD COLUMN preferred_check_in_time VARCHAR(5) DEFAULT '09:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'check_in_frequency') THEN
    ALTER TABLE user_preferences ADD COLUMN check_in_frequency VARCHAR(20) DEFAULT 'daily';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'ai_use_emojis') THEN
    ALTER TABLE user_preferences ADD COLUMN ai_use_emojis BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'ai_formality_level') THEN
    ALTER TABLE user_preferences ADD COLUMN ai_formality_level VARCHAR(20) DEFAULT 'balanced';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'ai_encouragement_level') THEN
    ALTER TABLE user_preferences ADD COLUMN ai_encouragement_level VARCHAR(20) DEFAULT 'medium';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'focus_areas') THEN
    ALTER TABLE user_preferences ADD COLUMN focus_areas TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'voice_assistant_avatar_url') THEN
    ALTER TABLE user_preferences ADD COLUMN voice_assistant_avatar_url VARCHAR(500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'emotion_logging_enabled') THEN
    ALTER TABLE user_preferences ADD COLUMN emotion_logging_enabled BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'emotion_data_retention_days') THEN
    ALTER TABLE user_preferences ADD COLUMN emotion_data_retention_days INTEGER DEFAULT 730;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'emotion_weight') THEN
    ALTER TABLE user_preferences ADD COLUMN emotion_weight DECIMAL(3,2) DEFAULT 0.15;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'schedule_automation_enabled') THEN
    ALTER TABLE user_preferences ADD COLUMN schedule_automation_enabled BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'schedule_reminder_minutes') THEN
    ALTER TABLE user_preferences ADD COLUMN schedule_reminder_minutes INTEGER DEFAULT 5;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'activity_automation_enabled') THEN
    ALTER TABLE user_preferences ADD COLUMN activity_automation_enabled BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'ai_message_style') THEN
    ALTER TABLE user_preferences ADD COLUMN ai_message_style VARCHAR(20) DEFAULT 'friendly';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'product_tour_completed') THEN
    ALTER TABLE user_preferences ADD COLUMN product_tour_completed BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'product_tour_completed_at') THEN
    ALTER TABLE user_preferences ADD COLUMN product_tour_completed_at TIMESTAMP;
  END IF;
END $$;

-- ============================================
-- 4. user_goals table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_goals' AND column_name = 'category') THEN
    ALTER TABLE user_goals ADD COLUMN category goal_category;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_goals' AND column_name = 'pillar') THEN
    ALTER TABLE user_goals ADD COLUMN pillar health_pillar;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_goals' AND column_name = 'status') THEN
    ALTER TABLE user_goals ADD COLUMN status goal_status DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_goals' AND column_name = 'is_primary') THEN
    ALTER TABLE user_goals ADD COLUMN is_primary BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_goals' AND column_name = 'progress') THEN
    ALTER TABLE user_goals ADD COLUMN progress FLOAT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_goals' AND column_name = 'plan_duration_weeks') THEN
    ALTER TABLE user_goals ADD COLUMN plan_duration_weeks INTEGER DEFAULT 4;
  END IF;
END $$;

-- ============================================
-- 5. activity_logs table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'status') THEN
    ALTER TABLE activity_logs ADD COLUMN status activity_log_status DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'reminder_sent_at') THEN
    ALTER TABLE activity_logs ADD COLUMN reminder_sent_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'start_message_sent_at') THEN
    ALTER TABLE activity_logs ADD COLUMN start_message_sent_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'followup_sent_at') THEN
    ALTER TABLE activity_logs ADD COLUMN followup_sent_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'automation_enabled') THEN
    ALTER TABLE activity_logs ADD COLUMN automation_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================
-- 6. diet_plans table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diet_plans' AND column_name = 'status') THEN
    ALTER TABLE diet_plans ADD COLUMN status plan_status DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diet_plans' AND column_name = 'goal_category') THEN
    ALTER TABLE diet_plans ADD COLUMN goal_category goal_category;
  END IF;
END $$;

-- ============================================
-- 7. competitions table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitions' AND column_name = 'status') THEN
    ALTER TABLE competitions ADD COLUMN status competition_status NOT NULL DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitions' AND column_name = 'type') THEN
    ALTER TABLE competitions ADD COLUMN type competition_type;
  END IF;
END $$;

-- ============================================
-- 8. competition_entries table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competition_entries' AND column_name = 'status') THEN
    ALTER TABLE competition_entries ADD COLUMN status competition_entry_status NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competition_entries' AND column_name = 'current_rank') THEN
    ALTER TABLE competition_entries ADD COLUMN current_rank INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competition_entries' AND column_name = 'current_score') THEN
    ALTER TABLE competition_entries ADD COLUMN current_score DECIMAL(10,2);
  END IF;
END $$;

-- ============================================
-- 9. user_plans table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_plans' AND column_name = 'status') THEN
    ALTER TABLE user_plans ADD COLUMN status plan_status DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_plans' AND column_name = 'goal_category') THEN
    ALTER TABLE user_plans ADD COLUMN goal_category goal_category;
  END IF;
END $$;

-- ============================================
-- 10. workout_logs table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_logs' AND column_name = 'status') THEN
    ALTER TABLE workout_logs ADD COLUMN status activity_log_status DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_logs' AND column_name = 'scheduled_day_of_week') THEN
    ALTER TABLE workout_logs ADD COLUMN scheduled_day_of_week day_of_week;
  END IF;
END $$;

-- ============================================
-- 11. workout_plans table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_plans' AND column_name = 'status') THEN
    ALTER TABLE workout_plans ADD COLUMN status plan_status DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_plans' AND column_name = 'goal_category') THEN
    ALTER TABLE workout_plans ADD COLUMN goal_category goal_category;
  END IF;
END $$;

-- ============================================
-- 12. ai_coach_sessions table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_coach_sessions' AND column_name = 'status') THEN
    ALTER TABLE ai_coach_sessions ADD COLUMN status ai_session_status DEFAULT 'active';
  END IF;
END $$;

-- ============================================
-- 13. notifications table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'type') THEN
    ALTER TABLE notifications ADD COLUMN type notification_type;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
    ALTER TABLE notifications ADD COLUMN priority notification_priority DEFAULT 'normal';
  END IF;
END $$;

-- ============================================
-- 14. voice_calls table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_calls' AND column_name = 'status') THEN
    ALTER TABLE voice_calls ADD COLUMN status call_status DEFAULT 'initiating';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_calls' AND column_name = 'channel') THEN
    ALTER TABLE voice_calls ADD COLUMN channel call_channel;
  END IF;
END $$;

-- ============================================
-- 15. voice_call_events table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_call_events' AND column_name = 'event_type') THEN
    ALTER TABLE voice_call_events ADD COLUMN event_type call_event_type;
  END IF;
END $$;

-- ============================================
-- 16. activity_events table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_events' AND column_name = 'type') THEN
    ALTER TABLE activity_events ADD COLUMN type activity_event_type;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_events' AND column_name = 'source') THEN
    ALTER TABLE activity_events ADD COLUMN source activity_event_source;
  END IF;
END $$;

-- ============================================
-- 17. user_integrations table — missing columns & constraints
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_integrations' AND column_name = 'provider') THEN
    ALTER TABLE user_integrations ADD COLUMN provider integration_provider;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_integrations' AND column_name = 'status') THEN
    ALTER TABLE user_integrations ADD COLUMN status sync_status DEFAULT 'pending';
  END IF;
END $$;

-- Add unique constraint required by ON CONFLICT (user_id, provider)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_integrations_user_id_provider_key'
      AND conrelid = 'user_integrations'::regclass
  ) THEN
    ALTER TABLE user_integrations
      ADD CONSTRAINT user_integrations_user_id_provider_key
      UNIQUE (user_id, provider);
  END IF;
END $$;

-- ============================================
-- 18. health_data_records table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_data_records' AND column_name = 'data_type') THEN
    ALTER TABLE health_data_records ADD COLUMN data_type data_type;
  END IF;
END $$;

-- ============================================
-- 19. assessment_responses table — missing columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_responses' AND column_name = 'assessment_type') THEN
    ALTER TABLE assessment_responses ADD COLUMN assessment_type assessment_type;
  END IF;
END $$;

-- ============================================
-- 20. activity_status_history table — missing columns
-- ============================================
DO $$
BEGIN
  -- Rename 'status' to 'activity_status' if old column name exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_status_history' AND column_name = 'status')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_status_history' AND column_name = 'activity_status') THEN
    ALTER TABLE activity_status_history RENAME COLUMN status TO activity_status;
  END IF;

  -- Add activity_status column if neither exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_status_history' AND column_name = 'activity_status') THEN
    ALTER TABLE activity_status_history ADD COLUMN activity_status activity_status;
  END IF;
END $$;

-- ============================================
-- 21. Create missing indexes (safe with IF NOT EXISTS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_onboarding_status ON users(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(auth_provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);
CREATE INDEX IF NOT EXISTS idx_competition_entries_status ON competition_entries(competition_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status);
CREATE INDEX IF NOT EXISTS idx_workout_logs_status ON workout_logs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workout_plans_status ON workout_plans(user_id, status);

-- ============================================
-- 22. LEADERBOARD SNAPSHOTS — board_type column
-- ============================================
-- The leaderboard_snapshots table may have been created before leaderboard_type enum existed,
-- resulting in a table without the board_type column.
DO $$
BEGIN
  -- Ensure leaderboard_type enum exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leaderboard_type') THEN
    CREATE TYPE leaderboard_type AS ENUM ('global', 'country', 'friends', 'competition');
  END IF;

  -- Add board_type column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_snapshots' AND column_name = 'board_type'
  ) THEN
    ALTER TABLE leaderboard_snapshots ADD COLUMN board_type leaderboard_type NOT NULL DEFAULT 'global';
  END IF;

  -- Add segment_key column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_snapshots' AND column_name = 'segment_key'
  ) THEN
    ALTER TABLE leaderboard_snapshots ADD COLUMN segment_key VARCHAR(100);
  END IF;

  -- Add metadata column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaderboard_snapshots' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE leaderboard_snapshots ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_date_type ON leaderboard_snapshots(date, board_type);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_type_segment ON leaderboard_snapshots(board_type, segment_key);

-- Add unique constraint required by ON CONFLICT (date, board_type, segment_key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leaderboard_snapshots_date_board_type_segment_key_key'
      AND conrelid = 'leaderboard_snapshots'::regclass
  ) THEN
    ALTER TABLE leaderboard_snapshots
      ADD CONSTRAINT leaderboard_snapshots_date_board_type_segment_key_key
      UNIQUE (date, board_type, segment_key);
  END IF;
END $$;

-- ============================================
-- 23. CONSENT RECORDS — type column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'consent_records' AND column_name = 'type') THEN
    ALTER TABLE consent_records ADD COLUMN type consent_type;
  END IF;
END $$;

-- ============================================
-- 24. ASSESSMENT QUESTIONS — type, pillar columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_questions' AND column_name = 'type') THEN
    ALTER TABLE assessment_questions ADD COLUMN type question_type;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_questions' AND column_name = 'pillar') THEN
    ALTER TABLE assessment_questions ADD COLUMN pillar health_pillar;
  END IF;
END $$;

-- ============================================
-- 25. ASSESSMENT RESPONSES — goal_category, switched_from_mode
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_responses' AND column_name = 'goal_category') THEN
    ALTER TABLE assessment_responses ADD COLUMN goal_category goal_category;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessment_responses' AND column_name = 'switched_from_mode') THEN
    ALTER TABLE assessment_responses ADD COLUMN switched_from_mode assessment_type;
  END IF;
END $$;

-- ============================================
-- 26. SYNC LOGS — provider column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sync_logs' AND column_name = 'provider') THEN
    ALTER TABLE sync_logs ADD COLUMN provider integration_provider;
  END IF;
END $$;

-- ============================================
-- 27. HEALTH DATA RECORDS — provider column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_data_records' AND column_name = 'provider') THEN
    ALTER TABLE health_data_records ADD COLUMN provider integration_provider;
  END IF;
END $$;

-- ============================================
-- 28. WORKOUT SCHEDULE TASKS — status column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workout_schedule_tasks' AND column_name = 'status') THEN
    ALTER TABLE workout_schedule_tasks ADD COLUMN status activity_log_status DEFAULT 'pending';
  END IF;
END $$;

-- ============================================
-- 29. EMOTION LOGS — emotion_category column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emotion_logs' AND column_name = 'emotion_category') THEN
    ALTER TABLE emotion_logs ADD COLUMN emotion_category emotion_category;
  END IF;
END $$;

-- ============================================
-- 30. MOOD LOGS — mood_emoji, emotion_tags columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mood_logs' AND column_name = 'mood_emoji') THEN
    ALTER TABLE mood_logs ADD COLUMN mood_emoji mood_emoji;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mood_logs' AND column_name = 'emotion_tags') THEN
    ALTER TABLE mood_logs ADD COLUMN emotion_tags emotion_tag[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- 31. STRESS LOGS — triggers, check_in_type columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stress_logs' AND column_name = 'triggers') THEN
    ALTER TABLE stress_logs ADD COLUMN triggers stress_trigger[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stress_logs' AND column_name = 'check_in_type') THEN
    ALTER TABLE stress_logs ADD COLUMN check_in_type check_in_type DEFAULT 'on_demand';
  END IF;
END $$;

-- ============================================
-- 32. JOURNAL ENTRIES — prompt_category column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'prompt_category') THEN
    ALTER TABLE journal_entries ADD COLUMN prompt_category journal_prompt_category;
  END IF;
END $$;

-- ============================================
-- 32b. JOURNAL ENTRIES — enhanced journaling columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'checkin_id') THEN
    ALTER TABLE journal_entries ADD COLUMN checkin_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'journaling_mode') THEN
    ALTER TABLE journal_entries ADD COLUMN journaling_mode VARCHAR(20) CHECK (journaling_mode IN ('quick_reflection', 'deep_dive', 'gratitude', 'life_perspective', 'free_write'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'ai_generated_prompt') THEN
    ALTER TABLE journal_entries ADD COLUMN ai_generated_prompt BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================
-- 33. HABITS — tracking_type, specific_days columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'tracking_type') THEN
    ALTER TABLE habits ADD COLUMN tracking_type habit_tracking_type DEFAULT 'checkbox';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'specific_days') THEN
    ALTER TABLE habits ADD COLUMN specific_days day_of_week[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- 34. WELLBEING ROUTINES — specific_days column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wellbeing_routines' AND column_name = 'specific_days') THEN
    ALTER TABLE wellbeing_routines ADD COLUMN specific_days day_of_week[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- 35. MINDFULNESS PRACTICES — practice_category column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mindfulness_practices' AND column_name = 'practice_category') THEN
    ALTER TABLE mindfulness_practices ADD COLUMN practice_category mindfulness_practice_category;
  END IF;
END $$;

-- ============================================
-- 36. SCHEDULED REMINDERS — notification_channels column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_reminders' AND column_name = 'notification_channels') THEN
    ALTER TABLE scheduled_reminders ADD COLUMN notification_channels notification_channel[] DEFAULT ARRAY['push']::notification_channel[];
  END IF;
END $$;

-- ============================================
-- 37. USER WORKOUT CONSTRAINTS — available_days, rest_days columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_workout_constraints' AND column_name = 'available_days') THEN
    ALTER TABLE user_workout_constraints ADD COLUMN available_days day_of_week[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday']::day_of_week[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_workout_constraints' AND column_name = 'rest_days') THEN
    ALTER TABLE user_workout_constraints ADD COLUMN rest_days day_of_week[] DEFAULT ARRAY['sunday']::day_of_week[];
  END IF;
END $$;

-- ============================================
-- 38. PLAN RESCHEDULE HISTORY — policy_used column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plan_reschedule_history' AND column_name = 'policy_used') THEN
    ALTER TABLE plan_reschedule_history ADD COLUMN policy_used plan_policy;
  END IF;
END $$;

-- ============================================
-- 39. BLOGS — status column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blogs' AND column_name = 'status') THEN
    ALTER TABLE blogs ADD COLUMN status blog_status DEFAULT 'draft';
  END IF;
END $$;

-- ============================================
-- 40. AI COACH SESSIONS — goal_category column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_coach_sessions' AND column_name = 'goal_category') THEN
    ALTER TABLE ai_coach_sessions ADD COLUMN goal_category goal_category;
  END IF;
END $$;

-- ============================================
-- 41. NOTIFICATIONS — channels column (array)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'channels') THEN
    ALTER TABLE notifications ADD COLUMN channels notification_channel[] DEFAULT ARRAY['push']::notification_channel[];
  END IF;
END $$;

-- ============================================
-- 42. USER INTEGRATIONS — is_primary_for_data_types (array)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_integrations' AND column_name = 'is_primary_for_data_types') THEN
    ALTER TABLE user_integrations ADD COLUMN is_primary_for_data_types data_type[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- 43. USER PLANS — pillar column
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_plans' AND column_name = 'pillar') THEN
    ALTER TABLE user_plans ADD COLUMN pillar health_pillar;
  END IF;
END $$;

-- ============================================
-- 44. MESSAGES — is_view_once, view_once_opened_at columns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_view_once') THEN
    ALTER TABLE messages ADD COLUMN is_view_once BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'view_once_opened_at') THEN
    ALTER TABLE messages ADD COLUMN view_once_opened_at TIMESTAMP;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_view_once ON messages(is_view_once) WHERE is_view_once = true;

-- ============================================
-- 45. USER COMMITMENTS table (used by commitment-tracker & proactive-messaging)
-- ============================================
CREATE TABLE IF NOT EXISTS user_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commitment_text TEXT NOT NULL,
  category VARCHAR(30) NOT NULL,
  extracted_action TEXT NOT NULL,
  commitment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  follow_up_date DATE NOT NULL,
  fulfilled BOOLEAN,
  followed_up BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uc_user_followup
  ON user_commitments(user_id, follow_up_date)
  WHERE followed_up = false;

-- ============================================
-- SECTION: user_coaching_profiles — additional columns + history table
-- ============================================
-- These were previously in ensureTable() runtime code, causing
-- redundant DDL on every generateProfile() call. Moved here to run once at startup.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_coaching_profiles') THEN
    EXECUTE 'ALTER TABLE user_coaching_profiles ADD COLUMN IF NOT EXISTS stable_traits JSONB';
    EXECUTE 'ALTER TABLE user_coaching_profiles ADD COLUMN IF NOT EXISTS recent_observations JSONB';
    EXECUTE 'ALTER TABLE user_coaching_profiles ADD COLUMN IF NOT EXISTS profile_version INTEGER DEFAULT 1';
    EXECUTE 'ALTER TABLE user_coaching_profiles ADD COLUMN IF NOT EXISTS stable_traits_updated_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE user_coaching_profiles ADD COLUMN IF NOT EXISTS personal_context JSONB DEFAULT ''{}''';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_coaching_profile_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_version INTEGER NOT NULL,
  profile_data JSONB NOT NULL,
  stable_traits JSONB,
  recent_observations JSONB,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_history_user ON user_coaching_profile_history(user_id, profile_version DESC);

-- 44. JOURNAL PATTERNS — category column for correlation/theme/behavioral
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_patterns' AND column_name = 'category') THEN
    ALTER TABLE journal_patterns ADD COLUMN category VARCHAR(20) DEFAULT 'correlation';
  END IF;
END $$;

-- 45. JOURNAL INSIGHTS — themes column for auto-theme detection
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_insights' AND column_name = 'themes') THEN
    ALTER TABLE journal_insights ADD COLUMN themes TEXT[];
  END IF;
END $$;

-- 46. daily_checkins — add missing columns for morning/evening check-in
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_checkins' AND column_name = 'checkin_type') THEN
    ALTER TABLE daily_checkins ADD COLUMN checkin_type VARCHAR(20) DEFAULT 'morning';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_checkins' AND column_name = 'predicted_mood') THEN
    ALTER TABLE daily_checkins ADD COLUMN predicted_mood INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_checkins' AND column_name = 'predicted_energy') THEN
    ALTER TABLE daily_checkins ADD COLUMN predicted_energy INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_checkins' AND column_name = 'known_stressors') THEN
    ALTER TABLE daily_checkins ADD COLUMN known_stressors TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_checkins' AND column_name = 'day_rating') THEN
    ALTER TABLE daily_checkins ADD COLUMN day_rating INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_checkins' AND column_name = 'went_well') THEN
    ALTER TABLE daily_checkins ADD COLUMN went_well TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_checkins' AND column_name = 'didnt_go_well') THEN
    ALTER TABLE daily_checkins ADD COLUMN didnt_go_well TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_checkins' AND column_name = 'evening_lessons') THEN
    ALTER TABLE daily_checkins ADD COLUMN evening_lessons TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_checkins' AND column_name = 'tomorrow_focus') THEN
    ALTER TABLE daily_checkins ADD COLUMN tomorrow_focus TEXT;
  END IF;
END $$;

-- Drop old unique constraint and recreate with checkin_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'daily_checkins'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE daily_checkins DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'daily_checkins'::regclass
        AND contype = 'u'
        AND array_length(conkey, 1) = 2
      LIMIT 1
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'daily_checkins'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 3
  ) THEN
    ALTER TABLE daily_checkins ADD CONSTRAINT daily_checkins_user_date_type_key UNIQUE(user_id, checkin_date, checkin_type);
  END IF;
END $$;

-- ============================================
-- Ensure enum values exist (ADD VALUE cannot run in anonymous code blocks)
-- ============================================
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'spotify';

-- ============================================
-- Life Goal Milestones & Check-ins (table 98)
-- ============================================
CREATE TABLE IF NOT EXISTS life_goal_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    life_goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    target_date DATE,
    target_value FLOAT,
    current_value FLOAT DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_life_goal_milestones_goal ON life_goal_milestones(life_goal_id);
CREATE INDEX IF NOT EXISTS idx_life_goal_milestones_user ON life_goal_milestones(user_id);

CREATE TABLE IF NOT EXISTS life_goal_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    life_goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    progress_value FLOAT,
    note TEXT,
    mood_about_goal INTEGER CHECK (mood_about_goal BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(life_goal_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS idx_life_goal_checkins_goal ON life_goal_checkins(life_goal_id);
CREATE INDEX IF NOT EXISTS idx_life_goal_checkins_user_date ON life_goal_checkins(user_id, checkin_date DESC);

-- ============================================
-- User Motivation Profiles (table 99)
-- ============================================
CREATE TABLE IF NOT EXISTS user_motivation_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  declared_tier VARCHAR(10) NOT NULL DEFAULT 'medium',
  computed_tier VARCHAR(10) NOT NULL DEFAULT 'medium',
  active_tier VARCHAR(10) NOT NULL DEFAULT 'medium',
  engagement_score DECIMAL(5,2) DEFAULT 50.0,
  login_frequency_score DECIMAL(5,2) DEFAULT 50.0,
  suggestion_accept_rate DECIMAL(5,2) DEFAULT 50.0,
  task_completion_rate DECIMAL(5,2) DEFAULT 50.0,
  session_depth_score DECIMAL(5,2) DEFAULT 50.0,
  streak_consistency_score DECIMAL(5,2) DEFAULT 50.0,
  last_computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  tier_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_motivation_profiles_user ON user_motivation_profiles(user_id);

-- Add motivation_level to life_goals if missing
ALTER TABLE life_goals ADD COLUMN IF NOT EXISTS motivation_level VARCHAR(10);

-- ============================================
-- Goal Actions & Responses (table 100)
-- ============================================
CREATE TABLE IF NOT EXISTS goal_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES life_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  pillar VARCHAR(20),
  frequency VARCHAR(20),
  is_ai_generated BOOLEAN DEFAULT true,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_goal_actions_goal ON goal_actions(goal_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_goal_actions_user ON goal_actions(user_id);

CREATE TABLE IF NOT EXISTS goal_action_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID NOT NULL REFERENCES goal_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_type VARCHAR(10) NOT NULL,
  edited_title VARCHAR(255),
  edited_description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_goal_action_responses_user ON goal_action_responses(user_id, created_at DESC);

-- ============================================
-- Expand life_goals category constraint
-- ============================================
ALTER TABLE life_goals DROP CONSTRAINT IF EXISTS life_goals_category_check;
ALTER TABLE life_goals ADD CONSTRAINT life_goals_category_check CHECK (category IN (
    'spiritual', 'social', 'productivity', 'happiness',
    'anxiety_management', 'creative', 'personal_growth',
    'financial', 'faith', 'relationships', 'education',
    'career', 'health_wellness', 'custom'
));

-- ============================================
-- Proactive messages log table
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

-- ============================================
-- 30. EMAIL ENGINE TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  template VARCHAR(100) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  recipient VARCHAR(320) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  provider VARCHAR(50) DEFAULT 'smtp',
  message_id VARCHAR(255),
  category VARCHAR(50) DEFAULT 'transactional',
  metadata JSONB DEFAULT '{}',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template);
CREATE INDEX IF NOT EXISTS idx_email_logs_category ON email_logs(category);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id) WHERE message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  frequency VARCHAR(20) DEFAULT 'immediate',
  unsubscribe_token VARCHAR(255) UNIQUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user ON email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_preferences_token ON email_preferences(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'sync-missing-columns migration completed successfully';
END $$;
