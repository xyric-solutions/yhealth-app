import 'dotenv/config';
import { pool } from './pg.js';

async function cleanupColumns() {
  try {
    // Drop duplicate columns if they exist
    await pool.query('ALTER TABLE blogs DROP COLUMN IF EXISTS read_time_minutes');
    await pool.query('ALTER TABLE blogs DROP COLUMN IF EXISTS view_count');
    console.log('✅ Cleaned up duplicate columns (read_time_minutes, view_count)');
    
    // Verify final structure
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'blogs' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Final blogs table structure:');
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

cleanupColumns();

