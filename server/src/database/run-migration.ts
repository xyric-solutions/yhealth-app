/**
 * @file Run Migration Script
 * @description Script to run database migrations manually
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Match database.config.ts: prefer DATABASE_URL, fall back to individual vars
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'balencia',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
      }
);

async function runMigration() {
  const client = await pool.connect();
  
  try {
    const migrationName = process.argv[2] || 'add-sound-file-to-workout-alarms.sql';
    console.log(`Running migration: ${migrationName}`);
    
    const migrationPath = join(__dirname, 'migrations', migrationName);
    const migration = readFileSync(migrationPath, 'utf-8');
    
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');
    
    console.log('✓ Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

