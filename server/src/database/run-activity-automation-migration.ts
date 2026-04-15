/**
 * @file Run Activity Automation Migration
 * Adds automation tracking columns and tables for activity automation
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runActivityAutomationMigration() {
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
    console.log('✅ Connected to database\n');

    const client = await pool.connect();

    try {
      // Migration 1: Add columns to activity_logs
      console.log('📂 Running migration: add-activity-automation-columns.sql\n');
      const migration1File = join(__dirname, 'migrations', 'add-activity-automation-columns.sql');
      
      try {
        const sql1 = readFileSync(migration1File, 'utf-8');
        console.log('  ⚡ Executing activity_logs columns migration...');

        await client.query('BEGIN');
        try {
          await client.query(sql1);
          await client.query('COMMIT');
          console.log('  ✅ Activity logs columns migration completed successfully\n');
        } catch (err: any) {
          await client.query('ROLLBACK');

          if (
            err?.message?.includes('already exists') ||
            err?.code === '42P07' ||
            err?.code === '42710' ||
            err?.message?.includes('duplicate')
          ) {
            console.log('  ⚠ Migration skipped (columns already exist)\n');
          } else {
            console.error('  ❌ Migration failed:', err.message);
            throw err;
          }
        }
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          console.log('  ⚠ Migration file not found, skipping\n');
        } else {
          throw err;
        }
      }

      // Migration 2: Add columns to user_preferences
      console.log('📂 Running migration: add-activity-automation-prefs.sql\n');
      const migration2File = join(__dirname, 'migrations', 'add-activity-automation-prefs.sql');
      
      try {
        const sql2 = readFileSync(migration2File, 'utf-8');
        console.log('  ⚡ Executing user_preferences columns migration...');

        await client.query('BEGIN');
        try {
          await client.query(sql2);
          await client.query('COMMIT');
          console.log('  ✅ User preferences columns migration completed successfully\n');
        } catch (err: any) {
          await client.query('ROLLBACK');

          if (
            err?.message?.includes('already exists') ||
            err?.code === '42P07' ||
            err?.code === '42710' ||
            err?.message?.includes('duplicate')
          ) {
            console.log('  ⚠ Migration skipped (columns already exist)\n');
          } else {
            console.error('  ❌ Migration failed:', err.message);
            throw err;
          }
        }
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          console.log('  ⚠ Migration file not found, skipping\n');
        } else {
          throw err;
        }
      }

      // Migration 3: Create activity_automation_logs table
      console.log('📂 Running migration: Create activity_automation_logs table\n');
      const tableFile = join(__dirname, 'tables', '66-activity-automation-logs.sql');
      
      try {
        const sql3 = readFileSync(tableFile, 'utf-8');
        console.log('  ⚡ Executing activity_automation_logs table creation...');

        await client.query('BEGIN');
        try {
          await client.query(sql3);
          await client.query('COMMIT');
          console.log('  ✅ Activity automation logs table created successfully\n');
        } catch (err: any) {
          await client.query('ROLLBACK');

          if (
            err?.message?.includes('already exists') ||
            err?.code === '42P07' ||
            err?.code === '42710' ||
            err?.message?.includes('duplicate')
          ) {
            console.log('  ⚠ Migration skipped (table already exists)\n');
          } else {
            console.error('  ❌ Migration failed:', err.message);
            throw err;
          }
        }
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          console.log('  ⚠ Table file not found, skipping\n');
        } else {
          throw err;
        }
      }

    } finally {
      client.release();
    }

    // Verify the migrations
    console.log('🔍 Verifying migrations...\n');

    // Check activity_logs columns
    const activityLogsColumns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'activity_logs'
      AND column_name IN ('reminder_sent_at', 'start_message_sent_at', 'followup_sent_at', 'automation_enabled')
      ORDER BY column_name
    `);

    if (activityLogsColumns.rows.length > 0) {
      console.log('  ✅ Activity logs automation columns:');
      activityLogsColumns.rows.forEach((row) => {
        console.log(`     - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('  ⚠ Activity logs automation columns not found');
    }

    // Check user_preferences columns
    const userPrefsColumns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_preferences'
      AND column_name IN ('activity_automation_enabled', 'ai_message_style')
      ORDER BY column_name
    `);

    if (userPrefsColumns.rows.length > 0) {
      console.log('\n  ✅ User preferences automation columns:');
      userPrefsColumns.rows.forEach((row) => {
        console.log(`     - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('\n  ⚠ User preferences automation columns not found');
    }

    // Check activity_automation_logs table
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'activity_automation_logs'
    `);

    if (tableCheck.rows.length > 0) {
      console.log('\n  ✅ Activity automation logs table exists');

      // Check indexes
      const indexes = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'activity_automation_logs'
        ORDER BY indexname
      `);

      if (indexes.rows.length > 0) {
        console.log('  ✅ Indexes created:', indexes.rows.length);
        indexes.rows.forEach((row) => {
          console.log(`     - ${row.indexname}`);
        });
      }
    } else {
      console.log('\n  ⚠ Activity automation logs table not found');
    }

    console.log('\n🎉 Migration process completed!');

  } catch (error) {
    console.error('\n❌ Error running migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runActivityAutomationMigration();

