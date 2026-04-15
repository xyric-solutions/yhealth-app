/**
 * @file Run Workout Reschedule Migrations
 * Script to run migrations for workout reschedule system
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
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

    const migrationsDir = join(__dirname, 'migrations');
    
    // Migration files in order
    const migrationFiles = [
      'add-plan-policy-to-user-plans.sql',
      'add-missed-to-activity-log-status.sql',
      'add-workout-reschedule-tables.sql',
      'add-whoop-credentials.sql', // webhook_url, webhook_secret for WHOOP status
      'force-create-tables.sql', // Force create if tables don't exist
    ];

    console.log('📂 Running migrations:\n');

    const client = await pool.connect();
    
    try {
      for (const file of migrationFiles) {
        const filePath = join(migrationsDir, file);
        try {
          const sql = readFileSync(filePath, 'utf-8');
          console.log(`  ⚡ Running ${file}...`);
          
          // Run each migration in its own transaction
          await client.query('BEGIN');
          
          try {
            await client.query(sql);
            await client.query('COMMIT');
            console.log(`  ✅ ${file} completed\n`);
          } catch (err: any) {
            await client.query('ROLLBACK');
            
            if (err?.message?.includes('already exists') || err?.code === '42P07' || err?.code === '42710') {
              console.log(`  ⚠ ${file} skipped (already applied)\n`);
            } else {
              console.error(`  ❌ ${file} failed:`, err.message);
              console.error(`  Details:`, err);
              throw err;
            }
          }
        } catch (err: any) {
          if (err?.message?.includes('already exists') || err?.code === '42P07') {
            console.log(`  ⚠ ${file} skipped (already applied)\n`);
          } else {
            console.error(`  ❌ ${file} failed:`, err.message);
            throw err;
          }
        }
      }
    } finally {
      client.release();
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('\n❌ Error running migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
