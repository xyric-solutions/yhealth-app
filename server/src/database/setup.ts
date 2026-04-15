import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Table files in order (for foreign key dependencies)
const TABLE_FILES = [
  '00-extensions.sql',
  '01-enums.sql',
  // RBAC tables must come before users (users.role_id references roles)
  '73-roles.sql',
  '74-permissions.sql',
  '75-role-permissions.sql',
  '02-users.sql',
  '03-consent-records.sql',
  '04-whatsapp-enrollments.sql',
  '05-user-preferences.sql',
  '06-user-goals.sql',
  '07-assessment-questions.sql',
  '08-assessment-responses.sql',
  '09-user-integrations.sql',
  '10-sync-logs.sql',
  '11-health-data-records.sql',
  '12-user-plans.sql',
  '13-activity-logs.sql',
  '14-notifications.sql',
  '15-ai-coach-sessions.sql',
  '16-diet-plans.sql',
  '17-meal-logs.sql',
  // Health tracking & gamification tables
  '18-body-images.sql',
  '19-exercises.sql',
  '20-workout-plans.sql',
  '21-workout-logs.sql',
  '22-progress-records.sql',
  '23-water-intake.sql',
  '24-xp-transactions.sql',
  '25-shopping-list.sql',
  '26-workout-alarms.sql',
  '27-recipes.sql',
  '27-user-videos.sql',
  '28-scheduled-reminders.sql',
  '29-user-tasks.sql',
  '30-vector-extension.sql',
  '31-voice-calls.sql',
  '32-voice-call-events.sql',
  '33-activity-status-history.sql',
  '34-emotion-logs.sql',
  '35-mental-recovery-scores.sql',
  '36-call-summaries.sql',
  '37-action-items.sql',
  // Chat and messaging tables
  '38-chats.sql',
  '39-messages.sql',
  '40-chat-participants.sql',
  '41-message-reactions.sql',
  '42-message-reads.sql',
  '43-starred-messages.sql',
  '44-daily-health-metrics.sql',
  // Wellbeing Pillar tables (Epic 07)
  '45-stress-logs.sql',
  '46-mood-logs.sql',
  '47-journal-entries.sql',
  '48-habits.sql',
  '49-habit-logs.sql',
  '50-energy-logs.sql',
  '51-wellbeing-routines.sql',
  '52-routine-completions.sql',
  '53-mindfulness-practices.sql',
  '54-daily-schedules.sql',
  // Workout reschedule system tables
  '55-workout-schedule-tasks.sql',
  '56-user-workout-constraints.sql',
  '57-plan-reschedule-history.sql',
  // Wellbeing breathing tests table
  '59-breathing-tests.sql',
  // Emotional check-in sessions table
  '60-emotional-checkin-sessions.sql',
  // Nutrition analysis tables (order matters: 61 before 62 due to foreign key)
  '61-nutrition-daily-analysis.sql',
  '62-nutrition-calorie-adjustments.sql',
  '63-nutrition-adherence-patterns.sql',
  '64-nutrition-user-preferences.sql',
  '65-schedule-automation-logs.sql',
  '66-activity-automation-logs.sql',
  // Activity events table (for daily scoring)
  '67-activity-events.sql',
  // Blogs & blog reactions
  '55-blogs.sql',
  '68-blog-reactions.sql',
  // Contact form submissions
  '69-contact-submissions.sql',
  // Leaderboard & Competitions tables
  '68-daily-user-scores.sql',
  '69-leaderboard-snapshots.sql',
  '70-competitions.sql',
  '71-competition-entries.sql',
  // Help center, community, webinars
  '70-help-articles.sql',
  '71-community-posts.sql',
  '72-webinars.sql',
  // Note: 73-roles, 74-permissions, 75-role-permissions moved before 02-users
  // Exercise lookup tables (muscle groups, equipment, etc.)
  '80-exercise-lookup-tables.sql',
  // Testimonials
  '82-testimonials.sql',
  // AI Coach coaching profiles
  '83-user-coaching-profiles.sql',
  // Newsletter subscriptions
  '76-newsletter-subscriptions.sql',
  // User roles (many-to-many join table)
  '77-user-roles.sql',
  // Journaling & wellbeing system tables
  '84-daily-checkins.sql',
  '85-life-goals.sql',
  '86-journal-insights.sql',
  '87-lessons-learned.sql',
  '88-insight-feedback.sql',
  '88-voice-journal-sessions.sql',
  // Intelligence & analytics tables
  '89-weekly-analysis-reports.sql',
  '90-prediction-accuracy.sql',
  // Spotify integration
  '91-spotify-cached-playlists.sql',
  // Yoga system tables
  '92-yoga-poses.sql',
  '93-yoga-sessions.sql',
  '94-yoga-session-logs.sql',
  '95-meditation-timers.sql',
  '96-yoga-streaks.sql',
  // Life history
  '97-user-life-history.sql',
  // Life goal milestones, motivation & goal actions
  '98-life-goal-milestones-checkins.sql',
  '99-user-motivation-profiles.sql',
  '100-goal-actions.sql',
  // Proactive messaging log
  '101-proactive-messages.sql',
  // Email engine tables
  '102-email-logs.sql',
  '103-email-preferences.sql',
  // Vision testing tables
  '104-vision-test-sessions.sql',
  '105-vision-test-responses.sql',
  '106-vision-streaks.sql',
  // Finance
  '107-finance.sql',
  // Streak system
  '108-user-streaks.sql',
  '109-streak-activity-log.sql',
  '110-streak-freeze-log.sql',
  '111-streak-rewards.sql',
  // Accountability system
  '112-accountability-system.sql',
  // Accountability contracts
  '113-accountability-contracts.sql',
  // Follow / Buddy system
  '115-user-follows.sql',
  // Calendar integration
  '113-calendar-connections.sql',
  '114-calendar-events.sql',
  // Obstacle diagnosis
  '116-goal-obstacles.sql',
  // Goal reconnection (DKA prevention)
  '117-goal-reconnections.sql',
  // Triggers (must be last)
  '99-triggers.sql',
];

function loadSchemaFiles(skipVector: boolean = false): string {
  const tablesDir = join(__dirname, 'tables');
  const schemas: string[] = [];

  for (const file of TABLE_FILES) {
    // When pgvector is not available, swap vector-extension for the no-pgvector fallback
    if (skipVector && file === '30-vector-extension.sql') {
      const fallbackFile = '30-vector-extension-no-pgvector.sql';
      const fallbackPath = join(tablesDir, fallbackFile);
      try {
        const content = readFileSync(fallbackPath, 'utf-8');
        schemas.push(`-- ========== ${fallbackFile} ==========\n${content}`);
        console.log(`  ⚠ Using fallback ${fallbackFile} (pgvector not available)`);
      } catch {
        console.log(`  ⚠ Skipped ${file} (pgvector not available, no fallback found)`);
      }
      continue;
    }

    const filePath = join(tablesDir, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      schemas.push(`-- ========== ${file} ==========\n${content}`);
      console.log(`  ✓ Loaded ${file}`);
    } catch (err) {
      // Skip vector extension file if it doesn't exist (optional)
      if (file.includes('vector-extension') && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`  ⚠ Skipped ${file} (not found, using fallback)`);
        continue;
      }
      console.error(`  ✗ Failed to load ${file}:`, err);
      throw err;
    }
  }

  return schemas.join('\n\n');
}

// Parse DATABASE_URL into individual connection params
function parseConnectionString(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.slice(1),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

async function setupDatabase() {
  const poolConfig = process.env['DATABASE_URL']
    ? parseConnectionString(process.env['DATABASE_URL'])
    : {
        host: process.env['DB_HOST'] || 'localhost',
        port: parseInt(process.env['DB_PORT'] || '5432', 10),
        database: process.env['DB_NAME'] || 'balencia',
        user: process.env['DB_USER'] || 'postgres',
        password: process.env['DB_PASSWORD'] || '',
      };
  const pool = new Pool(poolConfig);

  try {
    console.log('🔌 Connecting to database...');
    console.log('\n📂 Loading schema files from /tables:');

    // First, try to check if pgvector extension is available or can be created
    let skipVector = false;
    try {
      // Try to create the extension (will succeed if available, fail if not)
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
      // Check if it actually exists now
      const extCheck = await pool.query('SELECT 1 FROM pg_extension WHERE extname = \'vector\'');
      if (extCheck.rows.length > 0) {
        console.log('  ✓ pgvector extension is available');
      } else {
        throw new Error('Extension creation succeeded but extension not found');
      }
    } catch (_extErr: any) {
      // Extension not available or insufficient privileges
      console.log('  ⚠ pgvector extension not available, skipping vector tables');
      skipVector = true;
    }

    // Create the updated_at trigger function early (needed by several table files)
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('  ✓ Created update_updated_at_column() trigger function');

    // Load all schema files from /tables folder
    const schema = loadSchemaFiles(skipVector);

    console.log('\n⚡ Applying database schema...');
    
    try {
      await pool.query(schema);
      console.log('\n✅ Database schema applied successfully!');
    } catch (err: any) {
      // If error is about vector type and we didn't skip it, retry without vector
      if (!skipVector && (err?.message?.includes('type "vector" does not exist') || err?.code === '42704')) {
        console.log('\n⚠ Retrying without vector tables...');
        const schemaWithoutVector = loadSchemaFiles(true);
        await pool.query(schemaWithoutVector);
        console.log('\n✅ Database schema applied successfully (without pgvector)!');
      } else {
        throw err;
      }
    }

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`\n📊 Created ${result.rows.length} tables:`);
    result.rows.forEach(row => {
      console.log(`  • ${row.table_name}`);
    });

    console.log('\n🎉 Database setup complete!');

  } catch (error) {
    console.error('\n❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
