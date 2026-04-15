/**
 * @file Verify Workout Reschedule Tables
 * Quick script to check if tables exist
 */

import 'dotenv/config';
import { Pool } from 'pg';

async function verifyTables() {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected\n');

    const tables = [
      'workout_schedule_tasks',
      'user_workout_constraints',
      'plan_reschedule_history',
    ];

    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);

      const exists = result.rows[0].exists;
      console.log(`${exists ? '✅' : '❌'} ${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
    }

    // Check if plan_policy column exists in user_plans
    const planPolicyCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_plans' 
      AND column_name = 'plan_policy';
    `);
    console.log(`${planPolicyCheck.rows.length > 0 ? '✅' : '❌'} user_plans.plan_policy: ${planPolicyCheck.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);

    // Check if 'missed' exists in activity_log_status enum
    const enumCheck = await pool.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'activity_log_status')
      AND enumlabel = 'missed';
    `);
    console.log(`${enumCheck.rows.length > 0 ? '✅' : '❌'} activity_log_status 'missed': ${enumCheck.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyTables();

