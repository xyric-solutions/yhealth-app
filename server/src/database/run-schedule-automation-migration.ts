/**
 * @file Run Schedule Automation Migration
 * Creates schedule_automation_logs table if it doesn't exist
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runScheduleAutomationMigration() {
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
      // Check if table already exists
      const tableCheck = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'schedule_automation_logs'
      `);

      if (tableCheck.rows.length > 0) {
        console.log('✅ schedule_automation_logs table already exists\n');
      } else {
        // Create schedule_automation_logs table
        console.log('📂 Creating schedule_automation_logs table\n');
        const tableFile = join(__dirname, 'tables', '65-schedule-automation-logs.sql');
        
        try {
          const sql = readFileSync(tableFile, 'utf-8');
          console.log('  ⚡ Executing schedule_automation_logs table creation...');

          await client.query('BEGIN');
          try {
            await client.query(sql);
            await client.query('COMMIT');
            console.log('  ✅ Schedule automation logs table created successfully\n');
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
      }

    } finally {
      client.release();
    }

    // Verify the migration
    console.log('🔍 Verifying migration...\n');

    // Check schedule_automation_logs table
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'schedule_automation_logs'
    `);

    if (tableCheck.rows.length > 0) {
      console.log('  ✅ Schedule automation logs table exists');

      // Check columns
      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'schedule_automation_logs'
        ORDER BY ordinal_position
      `);

      if (columns.rows.length > 0) {
        console.log('  ✅ Columns:');
        columns.rows.forEach((row) => {
          console.log(`     - ${row.column_name} (${row.data_type})`);
        });
      }

      // Check indexes
      const indexes = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'schedule_automation_logs'
        ORDER BY indexname
      `);

      if (indexes.rows.length > 0) {
        console.log('  ✅ Indexes created:', indexes.rows.length);
        indexes.rows.forEach((row) => {
          console.log(`     - ${row.indexname}`);
        });
      }
    } else {
      console.log('  ⚠ Schedule automation logs table not found');
    }

    console.log('\n🎉 Migration process completed!');

  } catch (error) {
    console.error('\n❌ Error running migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runScheduleAutomationMigration();
