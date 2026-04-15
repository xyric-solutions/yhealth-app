import 'dotenv/config';
import { Pool } from 'pg';

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

async function main() {
  const c = await pool.connect();
  try {
    const cols = await c.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'goal_reconnections'
        ORDER BY ordinal_position`
    );
    console.log('goal_reconnections columns:');
    cols.rows.forEach((r) =>
      console.log(`  - ${r.column_name} :: ${r.data_type}${r.is_nullable === 'YES' ? ' (nullable)' : ''}`)
    );
    const idx = await c.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'goal_reconnections' ORDER BY indexname"
    );
    console.log('indexes:', idx.rows.map((r) => r.indexname).join(', '));
    const uniq = await c.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'goal_reconnections'::regclass AND contype = 'u'`
    );
    console.log('unique constraints:', uniq.rows.map((r) => r.conname).join(', '));
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
