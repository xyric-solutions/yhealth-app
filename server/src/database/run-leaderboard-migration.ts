/**
 * @file Run Leaderboard & Competitions Migration
 * @description Script to run the leaderboard and competitions tables migration
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'balencia',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connecting to database...');
    await client.query('SELECT 1');
    console.log('✅ Connected to database\n');
    
    const migrationName = 'add-leaderboard-competitions-tables.sql';
    console.log(`📄 Running migration: ${migrationName}`);
    
    const migrationPath = join(__dirname, 'migrations', migrationName);
    const migration = readFileSync(migrationPath, 'utf-8');
    
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully\n');
    
    // Verify tables exist
    const tables = ['competitions', 'competition_entries', 'daily_user_scores', 'leaderboard_snapshots'];
    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      if (result.rows[0].exists) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' NOT found`);
      }
    }
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '42P07' || error?.message?.includes('already exists')) {
      console.log('⚠️  Migration already applied or objects exist');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n🎉 Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

