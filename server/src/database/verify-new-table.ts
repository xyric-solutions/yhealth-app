import 'dotenv/config';
import { pool } from './pg.js';

async function verifyTable() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'new_table' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Table "new_table" exists with columns:');
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    console.log(`\n✅ Total columns: ${result.rows.length}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyTable();

