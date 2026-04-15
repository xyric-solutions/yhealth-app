-- ============================================
-- TRIGGERS
-- ============================================
-- Auto-update timestamps on record changes

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
-- Drop existing triggers first to handle re-runs gracefully
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_goals_updated_at ON user_goals;
CREATE TRIGGER update_user_goals_updated_at BEFORE UPDATE ON user_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_questions_updated_at ON assessment_questions;
CREATE TRIGGER update_assessment_questions_updated_at BEFORE UPDATE ON assessment_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessment_responses_updated_at ON assessment_responses;
CREATE TRIGGER update_assessment_responses_updated_at BEFORE UPDATE ON assessment_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_integrations_updated_at ON user_integrations;
CREATE TRIGGER update_user_integrations_updated_at BEFORE UPDATE ON user_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_health_data_records_updated_at ON health_data_records;
CREATE TRIGGER update_health_data_records_updated_at BEFORE UPDATE ON health_data_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_plans_updated_at ON user_plans;
CREATE TRIGGER update_user_plans_updated_at BEFORE UPDATE ON user_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_activity_logs_updated_at ON activity_logs;
CREATE TRIGGER update_activity_logs_updated_at BEFORE UPDATE ON activity_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_coach_sessions_updated_at ON ai_coach_sessions;
CREATE TRIGGER update_ai_coach_sessions_updated_at BEFORE UPDATE ON ai_coach_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_diet_plans_updated_at ON diet_plans;
CREATE TRIGGER update_diet_plans_updated_at BEFORE UPDATE ON diet_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_body_images_updated_at ON user_body_images;
CREATE TRIGGER update_user_body_images_updated_at BEFORE UPDATE ON user_body_images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meal_logs_updated_at ON meal_logs;
CREATE TRIGGER update_meal_logs_updated_at BEFORE UPDATE ON meal_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_voice_calls_updated_at ON voice_calls;
CREATE TRIGGER update_voice_calls_updated_at BEFORE UPDATE ON voice_calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_activity_status_history_updated_at ON activity_status_history;
CREATE TRIGGER update_activity_status_history_updated_at BEFORE UPDATE ON activity_status_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_emotion_logs_updated_at ON emotion_logs;
CREATE TRIGGER update_emotion_logs_updated_at BEFORE UPDATE ON emotion_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mental_recovery_scores_updated_at ON mental_recovery_scores;
CREATE TRIGGER update_mental_recovery_scores_updated_at BEFORE UPDATE ON mental_recovery_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Wellbeing Pillar triggers (Epic 07)
DROP TRIGGER IF EXISTS update_mood_logs_updated_at ON mood_logs;
CREATE TRIGGER update_mood_logs_updated_at BEFORE UPDATE ON mood_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_habits_updated_at ON habits;
CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON habits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_habit_logs_updated_at ON habit_logs;
CREATE TRIGGER update_habit_logs_updated_at BEFORE UPDATE ON habit_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_energy_logs_updated_at ON energy_logs;
CREATE TRIGGER update_energy_logs_updated_at BEFORE UPDATE ON energy_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wellbeing_routines_updated_at ON wellbeing_routines;
CREATE TRIGGER update_wellbeing_routines_updated_at BEFORE UPDATE ON wellbeing_routines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_routine_completions_updated_at ON routine_completions;
CREATE TRIGGER update_routine_completions_updated_at BEFORE UPDATE ON routine_completions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mindfulness_practices_updated_at ON mindfulness_practices;
CREATE TRIGGER update_mindfulness_practices_updated_at BEFORE UPDATE ON mindfulness_practices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stress_logs_updated_at ON stress_logs;
CREATE TRIGGER update_stress_logs_updated_at BEFORE UPDATE ON stress_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Schedule tables triggers
DROP TRIGGER IF EXISTS update_schedule_templates_updated_at ON schedule_templates;
CREATE TRIGGER update_schedule_templates_updated_at BEFORE UPDATE ON schedule_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_schedules_updated_at ON daily_schedules;
CREATE TRIGGER update_daily_schedules_updated_at BEFORE UPDATE ON daily_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_items_updated_at ON schedule_items;
CREATE TRIGGER update_schedule_items_updated_at BEFORE UPDATE ON schedule_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Emotional Check-In Sessions trigger
DROP TRIGGER IF EXISTS update_emotional_checkin_sessions_updated_at ON emotional_checkin_sessions;
CREATE TRIGGER update_emotional_checkin_sessions_updated_at BEFORE UPDATE ON emotional_checkin_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Blogs trigger
DROP TRIGGER IF EXISTS update_blogs_updated_at ON blogs;
CREATE TRIGGER update_blogs_updated_at BEFORE UPDATE ON blogs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Leaderboard & Competitions triggers
DROP TRIGGER IF EXISTS update_daily_user_scores_updated_at ON daily_user_scores;
CREATE TRIGGER update_daily_user_scores_updated_at BEFORE UPDATE ON daily_user_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leaderboard_snapshots_updated_at ON leaderboard_snapshots;
CREATE TRIGGER update_leaderboard_snapshots_updated_at BEFORE UPDATE ON leaderboard_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_competitions_updated_at ON competitions;
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_competition_entries_updated_at ON competition_entries;
CREATE TRIGGER update_competition_entries_updated_at BEFORE UPDATE ON competition_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: new_table trigger removed (67-new-table.sql is a placeholder template)