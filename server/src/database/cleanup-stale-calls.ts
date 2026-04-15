import 'dotenv/config';
import { Pool } from 'pg';

async function cleanupStaleCalls() {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('🔌 Connecting to database...');
    
    // Cancel all initiating/connecting calls older than 1 minute
    const result = await pool.query(`
      UPDATE voice_calls 
      SET status = 'cancelled', 
          ended_at = CURRENT_TIMESTAMP,
          error_message = 'Stale call cleanup'
      WHERE status IN ('initiating', 'connecting', 'ringing')
        AND initiated_at < NOW() - INTERVAL '1 minute'
      RETURNING id, user_id, status, initiated_at
    `);

    console.log(`\n✅ Cleaned up ${result.rowCount} stale calls:`);
    result.rows.forEach(row => {
      console.log(`  • ${row.id} (user: ${row.user_id}, was: ${row.status}, initiated: ${row.initiated_at})`);
    });

    // Also clean up any "active" calls that are very old (> 2 hours - likely stuck)
    const activeResult = await pool.query(`
      UPDATE voice_calls 
      SET status = 'ended', 
          ended_at = CURRENT_TIMESTAMP,
          error_message = 'Stale active call cleanup'
      WHERE status = 'active'
        AND initiated_at < NOW() - INTERVAL '2 hours'
      RETURNING id, user_id, initiated_at
    `);

    if (activeResult.rowCount && activeResult.rowCount > 0) {
      console.log(`\n✅ Ended ${activeResult.rowCount} stale active calls:`);
      activeResult.rows.forEach(row => {
        console.log(`  • ${row.id} (user: ${row.user_id}, initiated: ${row.initiated_at})`);
      });
    }

    console.log('\n🎉 Cleanup complete!');

  } catch (error) {
    console.error('\n❌ Error cleaning up calls:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanupStaleCalls();

