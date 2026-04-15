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
    const t = await c.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_name IN ('goal_obstacles','goal_reconnections')
        ORDER BY table_name`
    );
    console.log('Tables present:', t.rows.map((r) => r.table_name).join(', '));

    const e = await c.query(
      `SELECT typname FROM pg_type
        WHERE typname IN ('obstacle_category','goal_ref_type')
        ORDER BY typname`
    );
    console.log('Enums present:', e.rows.map((r) => r.typname).join(', '));

    const uniq = await c.query(
      `SELECT conrelid::regclass::text AS table, conname
         FROM pg_constraint
        WHERE conrelid IN ('goal_obstacles'::regclass,'goal_reconnections'::regclass)
          AND contype = 'u'
        ORDER BY conname`
    );
    console.log('Unique constraints:');
    uniq.rows.forEach((r) => console.log(`  - ${r.table}: ${r.conname}`));

    const counts = await c.query(
      `SELECT 'goal_obstacles' AS t, COUNT(*)::int AS n FROM goal_obstacles
        UNION ALL
       SELECT 'goal_reconnections' AS t, COUNT(*)::int AS n FROM goal_reconnections`
    );
    console.log('Row counts:');
    counts.rows.forEach((r) => console.log(`  - ${r.t}: ${r.n}`));
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
