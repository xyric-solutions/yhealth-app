/**
 * Quick migration script to make access_token nullable
 * Run with: tsx src/database/run-access-token-migration.ts
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
    console.log('📂 Running migration: make-access-token-nullable.sql\n');
    
    const migrationPath = join(__dirname, 'migrations', 'make-access-token-nullable.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    console.log('   access_token column is now nullable in user_integrations table');
  } catch (error: any) {
    await client.query('ROLLBACK');
    
    // Check if column is already nullable (migration already applied)
    if (error?.code === '42703' || error?.message?.includes('does not exist')) {
      console.log('⚠️  Migration may have already been applied or column does not exist');
      console.log('   Error:', error.message);
    } else if (error?.message?.includes('already')) {
      console.log('✅ Migration already applied (column is already nullable)');
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
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

