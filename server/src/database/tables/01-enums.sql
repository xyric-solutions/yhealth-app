-- ============================================
-- CUSTOM TYPES (ENUMS)
-- ============================================
-- All enum types used across tables

-- Drop existing types if they exist (for clean migration)
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS gender CASCADE;
DROP TYPE IF EXISTS auth_provider CASCADE;
DROP TYPE IF EXISTS onboarding_status CASCADE;
DROP TYPE IF EXISTS consent_type CASCADE;
DROP TYPE IF EXISTS notification_channel CASCADE;
DROP TYPE IF EXISTS coaching_style CASCADE;
DROP TYPE IF EXISTS coaching_intensity CASCADE;
DROP TYPE IF EXISTS goal_category CASCADE;
DROP TYPE IF EXISTS health_pillar CASCADE;
DROP TYPE IF EXISTS goal_status CASCADE;
DROP TYPE IF EXISTS assessment_type CASCADE;
DROP TYPE IF EXISTS question_type CASCADE;
DROP TYPE IF EXISTS integration_provider CASCADE;
DROP TYPE IF EXISTS sync_status CASCADE;
DROP TYPE IF EXISTS data_type CASCADE;
DROP TYPE IF EXISTS plan_status CASCADE;
DROP TYPE IF EXISTS activity_type CASCADE;
DROP TYPE IF EXISTS day_of_week CASCADE;
DROP TYPE IF EXISTS activity_log_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS notification_priority CASCADE;
DROP TYPE IF EXISTS ai_session_status CASCADE;
DROP TYPE IF EXISTS call_status CASCADE;
DROP TYPE IF EXISTS call_channel CASCADE;
DROP TYPE IF EXISTS call_event_type CASCADE;
DROP TYPE IF EXISTS activity_status CASCADE;
DROP TYPE IF EXISTS emotion_category CASCADE;
DROP TYPE IF EXISTS stress_trigger CASCADE;
DROP TYPE IF EXISTS check_in_type CASCADE;
DROP TYPE IF EXISTS mood_emoji CASCADE;
DROP TYPE IF EXISTS emotion_tag CASCADE;
DROP TYPE IF EXISTS journal_prompt_category CASCADE;
DROP TYPE IF EXISTS habit_tracking_type CASCADE;
DROP TYPE IF EXISTS mindfulness_practice_category CASCADE;
DROP TYPE IF EXISTS plan_policy CASCADE;
DROP TYPE IF EXISTS blog_status CASCADE;
DROP TYPE IF EXISTS activity_event_type CASCADE;
DROP TYPE IF EXISTS activity_event_source CASCADE;
DROP TYPE IF EXISTS competition_type CASCADE;
DROP TYPE IF EXISTS competition_status CASCADE;
DROP TYPE IF EXISTS competition_entry_status CASCADE;
DROP TYPE IF EXISTS leaderboard_type CASCADE;

-- Create enum types
CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator', 'doctor', 'patient');
CREATE TYPE gender AS ENUM ('male', 'female', 'non_binary', 'prefer_not_to_say');
CREATE TYPE auth_provider AS ENUM ('local', 'google', 'apple', 'system');
CREATE TYPE onboarding_status AS ENUM ('registered', 'consent_pending', 'assessment_pending', 'goals_pending', 'integrations_pending', 'preferences_pending', 'plan_pending', 'completed');
CREATE TYPE consent_type AS ENUM ('terms_of_service', 'privacy_policy', 'email_marketing', 'whatsapp_coaching');
CREATE TYPE notification_channel AS ENUM ('push', 'email', 'whatsapp', 'sms');
CREATE TYPE coaching_style AS ENUM ('supportive', 'direct', 'analytical', 'motivational');
CREATE TYPE coaching_intensity AS ENUM ('light', 'moderate', 'intensive');
CREATE TYPE goal_category AS ENUM ('weight_loss', 'muscle_building', 'sleep_improvement', 'stress_wellness', 'energy_productivity', 'event_training', 'health_condition', 'habit_building', 'overall_optimization', 'custom');
CREATE TYPE health_pillar AS ENUM ('fitness', 'nutrition', 'wellbeing');
CREATE TYPE goal_status AS ENUM ('draft', 'active', 'in_progress', 'paused', 'completed', 'abandoned');
CREATE TYPE assessment_type AS ENUM ('quick', 'deep');
CREATE TYPE question_type AS ENUM ('single_select', 'multi_select', 'slider', 'emoji_scale', 'number_input', 'date_picker', 'text_input');
CREATE TYPE integration_provider AS ENUM ('whoop', 'apple_health', 'fitbit', 'garmin', 'oura', 'samsung_health', 'myfitnesspal', 'nutritionix', 'cronometer', 'strava', 'spotify');
CREATE TYPE sync_status AS ENUM ('active', 'paused', 'error', 'disconnected', 'pending');
CREATE TYPE data_type AS ENUM ('heart_rate', 'hrv', 'sleep', 'steps', 'workouts', 'calories', 'nutrition', 'strain', 'recovery', 'body_temp', 'vo2_max', 'training_load', 'gps_activities');
CREATE TYPE plan_status AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
CREATE TYPE activity_type AS ENUM ('workout', 'meal', 'sleep_routine', 'mindfulness', 'habit', 'check_in', 'reflection', 'learning');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE activity_log_status AS ENUM ('pending', 'completed', 'skipped', 'partial', 'missed');
CREATE TYPE notification_type AS ENUM (
    'achievement',
    'goal_progress',
    'goal_completed',
    'streak',
    'reminder',
    'plan_update',
    'system',
    'social',
    'integration',
    'coaching',
    'celebration',
    'warning',
    'tip'
);
CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE ai_session_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE call_status AS ENUM ('initiating', 'connecting', 'ringing', 'active', 'ended', 'failed', 'timeout', 'cancelled');
CREATE TYPE call_channel AS ENUM ('mobile_app', 'whatsapp', 'widget');
CREATE TYPE call_event_type AS ENUM ('initiated', 'signaling_started', 'ice_candidate_exchanged', 'connection_established', 'media_started', 'ai_response_started', 'ai_response_completed', 'user_spoke', 'call_ended', 'error_occurred');
CREATE TYPE activity_status AS ENUM ('working', 'sick', 'injury', 'rest', 'vacation', 'travel', 'stress', 'excellent', 'good', 'fair', 'poor');
CREATE TYPE emotion_category AS ENUM ('happy', 'sad', 'angry', 'anxious', 'calm', 'stressed', 'excited', 'tired', 'neutral', 'distressed');
CREATE TYPE stress_trigger AS ENUM ('Work', 'Relationships', 'Finances', 'Health', 'Family', 'Uncertainty', 'Time pressure', 'Conflict', 'Other');
CREATE TYPE check_in_type AS ENUM ('daily', 'on_demand');
CREATE TYPE mood_emoji AS ENUM ('😊', '😐', '😟', '😡', '😰', '😴');
CREATE TYPE emotion_tag AS ENUM ('grateful', 'frustrated', 'excited', 'anxious', 'content', 'overwhelmed', 'peaceful', 'irritated', 'hopeful', 'lonely', 'confident', 'sad', 'energized', 'calm');
CREATE TYPE journal_prompt_category AS ENUM ('gratitude', 'reflection', 'emotional_processing', 'goal_setting', 'stress_management', 'self_compassion', 'future_focus', 'identity', 'productivity', 'relationships', 'spirituality', 'anxiety', 'creativity', 'cbt_reflection', 'cross_pillar');
CREATE TYPE habit_tracking_type AS ENUM ('checkbox', 'counter', 'duration', 'rating');
CREATE TYPE mindfulness_practice_category AS ENUM ('breathing', 'meditation', 'movement', 'quick_reset', 'evening');
CREATE TYPE plan_policy AS ENUM ('SLIDE_FORWARD', 'FILL_GAPS', 'DROP_OR_COMPRESS');
CREATE TYPE blog_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE activity_event_type AS ENUM ('workout', 'nutrition', 'wellbeing', 'participation');
CREATE TYPE activity_event_source AS ENUM ('manual', 'whoop', 'apple_health', 'fitbit', 'garmin', 'oura', 'camera_session', 'integration');
CREATE TYPE competition_type AS ENUM ('ai_generated', 'admin_created');
CREATE TYPE competition_status AS ENUM ('draft', 'active', 'ended', 'cancelled');
CREATE TYPE competition_entry_status AS ENUM ('active', 'disqualified', 'completed', 'withdrawn');
CREATE TYPE leaderboard_type AS ENUM ('global', 'country', 'friends', 'competition');

-- Finance Module
DO $$ BEGIN CREATE TYPE finance_transaction_type AS ENUM ('income', 'expense'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE finance_category AS ENUM ('food', 'transport', 'bills', 'health', 'entertainment', 'shopping', 'subscriptions', 'savings', 'education', 'salary', 'freelance', 'investments', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE budget_status AS ENUM ('active', 'exceeded', 'healthy'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE saving_goal_status AS ENUM ('in_progress', 'achieved', 'paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ai_insight_type AS ENUM ('pattern', 'alert', 'suggestion', 'forecast'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE recurring_interval AS ENUM ('daily', 'weekly', 'monthly', 'yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
