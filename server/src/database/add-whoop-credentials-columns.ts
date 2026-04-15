import 'dotenv/config';
import { Pool } from 'pg';

async function addWhoopCredentialsColumns() {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('🔌 Connecting to database...');

    // Check if columns already exist
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_integrations'
      AND column_name IN ('client_id', 'client_secret')
    `);

    const existingColumns = checkColumns.rows.map(r => r.column_name);
    
    if (existingColumns.includes('client_id') && existingColumns.includes('client_secret')) {
      console.log('✅ client_id and client_secret columns already exist!');
      return;
    }

    console.log('📂 Adding client_id and client_secret columns...');

    // Add columns if they don't exist
    if (!existingColumns.includes('client_id')) {
      await pool.query('ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS client_id TEXT');
      console.log('  ✓ Added client_id column');
    }

    if (!existingColumns.includes('client_secret')) {
      await pool.query('ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS client_secret TEXT');
      console.log('  ✓ Added client_secret column');
    }

    // Create index for faster lookups
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_integrations_client_id 
        ON user_integrations(client_id) 
        WHERE client_id IS NOT NULL
      `);
      console.log('  ✓ Created index on client_id');
    } catch (err) {
      console.log('  ⚠ Index may already exist:', (err as Error).message);
    }

    console.log('\n✅ Columns added successfully!');

  } catch (error) {
    console.error('\n❌ Error adding columns:', error);
    throw error;
  } finally {
    try {
      if (pool && typeof pool.end === 'function') {
        await pool.end();
      }
    } catch (endError) {
      // Ignore errors when ending pool
      if (!(endError as Error).message.includes('Called end on pool more than once')) {
        console.error('Error ending pool:', endError);
      }
    }
  }
}

addWhoopCredentialsColumns();

