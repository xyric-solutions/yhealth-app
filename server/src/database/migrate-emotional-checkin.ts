import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateEmotionalCheckIn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...');
    
    // Step 1: Create the emotional_checkin_sessions table
    console.log('📝 Step 1: Creating emotional_checkin_sessions table...');
    const tablePath = join(__dirname, 'tables', '60-emotional-checkin-sessions.sql');
    const tableSql = readFileSync(tablePath, 'utf-8');
    await pool.query(tableSql);
    console.log('✅ Created emotional_checkin_sessions table');
    
    // Step 2: Add session_id columns to existing tables
    console.log('📝 Step 2: Adding session_id columns to mood_logs, stress_logs, and energy_logs...');
    const migrationPath = join(__dirname, 'migrations', 'add-emotional-checkin-session-tracking.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    await pool.query(migrationSql);
    console.log('✅ Added session_id columns to wellbeing tables');
    
    // Step 3: Add trigger for updated_at
    console.log('📝 Step 3: Adding trigger for emotional_checkin_sessions...');
    await pool.query(`
      DROP TRIGGER IF EXISTS update_emotional_checkin_sessions_updated_at ON emotional_checkin_sessions;
      CREATE TRIGGER update_emotional_checkin_sessions_updated_at
      BEFORE UPDATE ON emotional_checkin_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Added trigger for emotional_checkin_sessions');

    // Step 4: Create emotional_checkin_responses table and add new session columns
    console.log('📝 Step 4: Creating emotional_checkin_responses table and adding session columns...');
    const responsesPath = join(__dirname, 'migrations', 'add-emotional-checkin-responses.sql');
    const responsesSql = readFileSync(responsesPath, 'utf-8');
    await pool.query(responsesSql);
    console.log('✅ Created emotional_checkin_responses table and added session columns');

    // Verify tables and columns
    console.log('\n🔍 Verifying migration...');
    
    // Check if emotional_checkin_sessions table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'emotional_checkin_sessions'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Table emotional_checkin_sessions exists');
    } else {
      console.log('⚠️  Table emotional_checkin_sessions was not created');
    }
    
    // Check if session_id columns exist
    const columnsCheck = await pool.query(`
      SELECT
        table_name,
        column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name IN ('mood_logs', 'stress_logs', 'energy_logs')
      AND column_name = 'emotional_checkin_session_id';
    `);

    console.log(`✅ Found ${columnsCheck.rows.length} session_id columns:`);
    columnsCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}.${row.column_name}`);
    });

    // Check if emotional_checkin_responses table exists
    const responsesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'emotional_checkin_responses'
      );
    `);

    if (responsesCheck.rows[0].exists) {
      console.log('✅ Table emotional_checkin_responses exists');
    } else {
      console.log('⚠️  Table emotional_checkin_responses was not created');
    }

    // Check for new session columns (camera_analysis, last_activity_at, expired_at)
    const newColumnsCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'emotional_checkin_sessions'
      AND column_name IN ('camera_analysis', 'last_activity_at', 'expired_at', 'overall_energy_score', 'overall_stress_score');
    `);

    console.log(`✅ Found ${newColumnsCheck.rows.length} new session columns:`);
    newColumnsCheck.rows.forEach(row => {
      console.log(`   - emotional_checkin_sessions.${row.column_name}`);
    });

    console.log('\n✅ Migration completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Table already exists, skipping...');
    } else if (error.code === '42703') {
      console.log('ℹ️  Column might already exist, continuing...');
    } else {
      console.error('Full error:', error);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

migrateEmotionalCheckIn();

