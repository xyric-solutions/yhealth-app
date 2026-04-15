/**
 * Add missing columns to exercises table for ExerciseDB ingestion.
 * Runs each ALTER separately (no transaction wrapper) to avoid locks.
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

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

const statements = [
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual'`,
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source_id VARCHAR(100)`,
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS body_part VARCHAR(100)`,
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS target_muscles TEXT[] DEFAULT '{}'`,
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1`,
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS external_metadata JSONB DEFAULT '{}'`,
  `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS search_vector tsvector`,
  `CREATE INDEX IF NOT EXISTS idx_exercises_search_vector ON exercises USING GIN(search_vector)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_source_source_id ON exercises(source, source_id) WHERE source_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_exercises_active_source ON exercises(source, is_active) WHERE is_active = true AND deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_exercises_body_part ON exercises(body_part) WHERE body_part IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_exercises_not_deleted ON exercises(id) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_exercises_target_muscles ON exercises USING GIN(target_muscles)`,
  `UPDATE exercises SET source = 'manual' WHERE source IS NULL`,
];

async function main() {
  for (const sql of statements) {
    try {
      await pool.query(sql);
      console.log('OK:', sql.substring(0, 80));
    } catch (err: any) {
      console.error('FAIL:', sql.substring(0, 80), '-', err.message);
    }
  }

  // Verify
  const res = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'exercises' ORDER BY ordinal_position`
  );
  console.log('\nExercises table columns:');
  res.rows.forEach((r: any) => console.log(`  ${r.column_name} (${r.data_type})`));

  await pool.end();
}

main();
