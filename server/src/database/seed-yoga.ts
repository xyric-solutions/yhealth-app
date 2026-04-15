/**
 * Seed yoga poses and template sessions
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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

async function main() {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*) as count FROM yoga_poses');
    const count = parseInt(existing.rows[0].count);

    if (count > 0) {
      console.log(`yoga_poses already has ${count} rows — skipping seed.`);
    } else {
      console.log('Seeding yoga data...');
      const sql = readFileSync(join(__dirname, 'seeds', 'yoga-seed.sql'), 'utf-8');
      await client.query(sql);
      console.log('Seed SQL executed successfully.');
    }

    // Seed joint targets for AI pose coaching (idempotent — always runs UPDATE)
    const jointTargetsCheck = await client.query(
      "SELECT COUNT(*) as count FROM yoga_poses WHERE joint_targets IS NOT NULL"
    );
    if (parseInt(jointTargetsCheck.rows[0].count) === 0) {
      console.log('Seeding yoga joint targets for AI coach...');
      const jtSql = readFileSync(join(__dirname, 'seeds', 'yoga-joint-targets.sql'), 'utf-8');
      await client.query(jtSql);
      console.log('Joint targets seeded for 5 poses.');
    } else {
      console.log(`Joint targets already set for ${jointTargetsCheck.rows[0].count} pose(s) — skipping.`);
    }

    const poses = await client.query('SELECT COUNT(*) as count FROM yoga_poses');
    const templates = await client.query("SELECT COUNT(*) as count FROM yoga_sessions WHERE is_template = true");
    const logs = await client.query('SELECT COUNT(*) as count FROM yoga_session_logs');
    const timers = await client.query('SELECT COUNT(*) as count FROM meditation_timers');
    const streaks = await client.query('SELECT COUNT(*) as count FROM yoga_streaks');

    console.log('\n=== Yoga Tables ===');
    console.log(`  yoga_poses:        ${poses.rows[0].count}`);
    console.log(`  yoga_sessions:     ${templates.rows[0].count} templates`);
    console.log(`  yoga_session_logs: ${logs.rows[0].count}`);
    console.log(`  meditation_timers: ${timers.rows[0].count}`);
    console.log(`  yoga_streaks:      ${streaks.rows[0].count}`);
  } catch (err: any) {
    console.error('Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
