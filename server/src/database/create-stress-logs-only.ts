import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createStressLogsTable() {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('🔌 Connecting to database...');

    // Check if table exists
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'stress_logs'
      );
    `);

    if (checkTable.rows[0].exists) {
      console.log('✅ stress_logs table already exists!');
      return; // Let finally block handle pool cleanup
    }

    console.log('📂 Creating stress_logs table...');

    // Read the table file
    const tableFile = join(__dirname, 'tables', '45-stress-logs.sql');
    const tableSQL = readFileSync(tableFile, 'utf-8');

    // Extract just the enum creation parts we need
    const stressTriggerEnum = "CREATE TYPE stress_trigger AS ENUM ('Work', 'Relationships', 'Finances', 'Health', 'Family', 'Uncertainty', 'Time pressure', 'Conflict', 'Other');";
    const checkInTypeEnum = "CREATE TYPE check_in_type AS ENUM ('daily', 'on_demand');";

    // Check if enums exist, create if not
    try {
      await pool.query(`DO $$ BEGIN ${stressTriggerEnum} EXCEPTION WHEN duplicate_object THEN null; END $$;`);
      await pool.query(`DO $$ BEGIN ${checkInTypeEnum} EXCEPTION WHEN duplicate_object THEN null; END $$;`);
      console.log('  ✓ Ensured enums exist');
    } catch (err) {
      console.log('  ⚠ Error creating enums (may already exist):', err);
    }

    // Create the table
    await pool.query(tableSQL);
    console.log('  ✓ Created stress_logs table');

    // Create trigger
    const triggersFile = join(__dirname, 'tables', '99-triggers.sql');
    const triggersSQL = readFileSync(triggersFile, 'utf-8');
    
    // Extract just the stress_logs trigger
    const triggerMatch = triggersSQL.match(/CREATE TRIGGER update_stress_logs_updated_at[^;]+;/s);
    if (triggerMatch) {
      // First ensure the function exists
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      await pool.query(triggerMatch[0]);
      console.log('  ✓ Created updated_at trigger');
    }

    console.log('\n✅ stress_logs table created successfully!');

  } catch (error) {
    console.error('\n❌ Error creating stress_logs table:', error);
    throw error;
  } finally {
    try {
      if (pool && typeof pool.end === 'function') {
        await pool.end();
      }
    } catch (endError) {
      // Ignore errors when ending pool (may already be ended)
      if (!(endError as Error).message.includes('Called end on pool more than once')) {
        console.error('Error ending pool:', endError);
      }
    }
  }
}

createStressLogsTable();

