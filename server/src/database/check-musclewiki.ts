import 'dotenv/config';
import { pool } from './pg.js';

async function check() {
  // Check MuscleWiki exercises
  const exercises = await pool.query(
    `SELECT name, category, difficulty_level, primary_muscle_group, animation_url, thumbnail_url, source
     FROM exercises WHERE source = 'musclewiki' LIMIT 5`
  );
  console.log('\n=== MuscleWiki Exercises (first 5) ===');
  for (const e of exercises.rows) {
    console.log(`  ${e.name} | ${e.category} | ${e.difficulty_level} | ${e.primary_muscle_group}`);
    console.log(`    video: ${(e.animation_url || 'none').substring(0, 90)}`);
    console.log(`    thumb: ${(e.thumbnail_url || 'none').substring(0, 90)}`);
  }

  // Check media records
  const media = await pool.query(
    `SELECT em.type, em.url, em.is_primary, em.source
     FROM exercise_media em JOIN exercises e ON em.exercise_id = e.id
     WHERE e.source = 'musclewiki' LIMIT 8`
  );
  console.log('\n=== MuscleWiki Media Records (first 8) ===');
  for (const m of media.rows) {
    console.log(`  [${m.type}] primary=${m.is_primary} | ${m.url.substring(0, 90)}`);
  }

  // Total counts
  const counts = await pool.query(`SELECT source, count(*) as cnt FROM exercises GROUP BY source ORDER BY cnt DESC`);
  console.log('\n=== Exercise Counts by Source ===');
  for (const c of counts.rows) {
    console.log(`  ${c.source}: ${c.cnt}`);
  }

  await pool.end();
}
check();
