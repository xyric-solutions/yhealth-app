/**
 * @file Run Daily Health Metrics Migration
 * @description Executes the migration to add daily health metrics columns and table
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT 1'); // Test connection
    console.log('✅ Connected to database\n');

    const migrationPath = join(__dirname, 'migrations', 'add-daily-health-metrics.sql');
    console.log('📂 Reading migration file...');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration file loaded\n');

    console.log('🚀 Running migration: add-daily-health-metrics.sql\n');
    console.log('This will:');
    console.log('  1. Add daily health metrics columns to users table');
    console.log('  2. Create daily_health_metrics table');
    console.log('  3. Add indexes and constraints\n');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Changes applied:');
    console.log('  ✓ Added columns to users table:');
    console.log('    - daily_sleep_hours');
    console.log('    - daily_recovery_score');
    console.log('    - daily_strain_score');
    console.log('    - daily_cycle_day');
    console.log('    - daily_health_updated_at');
    console.log('  ✓ Created daily_health_metrics table');
    console.log('  ✓ Added indexes for performance');
    console.log('  ✓ Added constraints and comments\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

