import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateBreathingTests() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...');
    
    const sqlPath = join(__dirname, 'tables', '59-breathing-tests.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    console.log('📝 Running migration: 59-breathing-tests.sql');
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify table was created
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'breathing_tests'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('✅ Table breathing_tests exists');
    } else {
      console.log('⚠️  Table breathing_tests was not created');
    }
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Table already exists, skipping...');
    } else {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

migrateBreathingTests();

