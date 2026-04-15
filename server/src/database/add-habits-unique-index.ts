/**
 * Add unique index for habits table (partial unique constraint)
 */

import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432', 10),
  database: process.env['DB_NAME'] || 'balencia',
  user: process.env['DB_USER'] || 'postgres',
  password: process.env['DB_PASSWORD'] || '',
});

async function addUniqueIndex() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Check if index already exists
    const checkResult = await pool.query(`
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_habits_unique_active'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('ℹ Unique index already exists, skipping');
      return;
    }
    
    // Create unique index
    await pool.query(`
      CREATE UNIQUE INDEX idx_habits_unique_active 
      ON habits(user_id, habit_name) 
      WHERE is_active = true AND is_archived = false;
    `);
    
    console.log('✅ Created unique index: idx_habits_unique_active');
    
  } catch (error: any) {
    console.error('❌ Error:', error?.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addUniqueIndex();

