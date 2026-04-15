-- ============================================
-- YHealth Database Schema
-- PostgreSQL Tables (Raw SQL - No Prisma)
-- ============================================
--
-- This file loads all table definitions from the /tables folder.
-- Each table has its own file for easier management (like MongoDB collections).
--
-- To run: npm run db:setup
-- Or: psql -d yhealth -f src/database/schema.sql
--
-- Individual tables can be found in: src/database/tables/
-- ============================================

-- Load extensions
\i tables/00-extensions.sql

-- Load enum types
\i tables/01-enums.sql

-- Load RBAC tables (must be before users - users.role_id references roles)
\i tables/73-roles.sql
\i tables/74-permissions.sql
\i tables/75-role-permissions.sql

-- Load tables (order matters for foreign keys)
\i tables/02-users.sql
\i tables/03-consent-records.sql
\i tables/04-whatsapp-enrollments.sql
\i tables/05-user-preferences.sql
\i tables/06-user-goals.sql
\i tables/07-assessment-questions.sql
\i tables/08-assessment-responses.sql
\i tables/09-user-integrations.sql
\i tables/10-sync-logs.sql
\i tables/11-health-data-records.sql
\i tables/12-user-plans.sql
\i tables/13-activity-logs.sql
\i tables/14-notifications.sql
\i tables/15-ai-coach-sessions.sql
\i tables/16-diet-plans.sql
\i tables/17-meal-logs.sql
\i tables/31-voice-calls.sql
\i tables/32-voice-call-events.sql
\i tables/33-activity-status-history.sql
\i tables/44-daily-health-metrics.sql

-- Wellbeing Pillar tables (Epic 07)
\i tables/45-stress-logs.sql
\i tables/46-mood-logs.sql
\i tables/47-journal-entries.sql
\i tables/48-habits.sql
\i tables/49-habit-logs.sql
\i tables/50-energy-logs.sql
\i tables/51-wellbeing-routines.sql
\i tables/52-routine-completions.sql
\i tables/53-mindfulness-practices.sql
\i tables/54-daily-schedules.sql

-- Workout reschedule system tables
\i tables/55-workout-schedule-tasks.sql
\i tables/56-user-workout-constraints.sql
\i tables/57-plan-reschedule-history.sql

-- Goal daily tracking table
\i tables/58-goal-daily-tracking.sql

-- Wellbeing breathing tests table
\i tables/59-breathing-tests.sql

-- Emotional check-in sessions table
\i tables/60-emotional-checkin-sessions.sql

-- Blogs table
\i tables/55-blogs.sql

-- New table
\i tables/67-new-table.sql

-- Nutrition analysis tables (order matters: 61 before 62 due to foreign key)
\i tables/61-nutrition-daily-analysis.sql
\i tables/62-nutrition-calorie-adjustments.sql
\i tables/63-nutrition-adherence-patterns.sql
\i tables/64-nutrition-user-preferences.sql

-- Blog reactions
\i tables/68-blog-reactions.sql

-- Contact form submissions
\i tables/69-contact-submissions.sql

-- Leaderboard & Competitions tables
\i tables/68-daily-user-scores.sql
\i tables/69-leaderboard-snapshots.sql
\i tables/70-competitions.sql
\i tables/71-competition-entries.sql

-- Help center, community, webinars
\i tables/70-help-articles.sql
\i tables/71-community-posts.sql
\i tables/72-webinars.sql

-- Load triggers
\i tables/99-triggers.sql

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ YHealth database schema created successfully!';
    RAISE NOTICE '📊 Tables: users, consent_records, whatsapp_enrollments, user_preferences,';
    RAISE NOTICE '          user_goals, assessment_questions, assessment_responses,';
    RAISE NOTICE '          user_integrations, sync_logs, health_data_records,';
    RAISE NOTICE '          user_plans, activity_logs, notifications,';
    RAISE NOTICE '          ai_coach_sessions, diet_plans, meal_logs,';
    RAISE NOTICE '          voice_calls, voice_call_events,';
    RAISE NOTICE '          activity_status_history,';
    RAISE NOTICE '          stress_logs, mood_logs, journal_entries,';
    RAISE NOTICE '          habits, habit_logs, energy_logs,';
    RAISE NOTICE '          wellbeing_routines, routine_completions, mindfulness_practices,';
    RAISE NOTICE '          daily_schedules, schedule_items, schedule_links, schedule_templates';
END $$;
