/**
 * Migration script for Wellbeing Pillar tables
 * Creates all wellbeing-related tables if they don't exist
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432', 10),
  database: process.env['DB_NAME'] || 'balencia',
  user: process.env['DB_USER'] || 'postgres',
  password: process.env['DB_PASSWORD'] || '',
});

const WELLBEING_TABLES = [
  '46-mood-logs.sql',
  '47-journal-entries.sql',
  '48-habits.sql',
  '49-habit-logs.sql',
  '50-energy-logs.sql',
  '51-wellbeing-routines.sql',
  '52-routine-completions.sql',
  '53-mindfulness-practices.sql',
];

async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `, [tableName]);
  return result.rows[0].exists;
}

async function migrateWellbeingTables() {
  try {
    console.log('🔌 Connecting to database...');
    
    const tablesDir = join(__dirname, 'tables');
    
    // First, ensure enum types exist
    console.log('\n📝 Ensuring enum types exist...');
    
    // Create enum types if they don't exist (PostgreSQL doesn't support CREATE TYPE IF NOT EXISTS)
    const enumTypes = [
      {
        name: 'mood_emoji',
        values: ['😊', '😐', '😟', '😡', '😰', '😴'],
      },
      {
        name: 'emotion_tag',
        values: ['grateful', 'frustrated', 'excited', 'anxious', 'content', 'overwhelmed', 'peaceful', 'irritated', 'hopeful', 'lonely', 'confident', 'sad', 'energized', 'calm', 'worried'],
      },
      {
        name: 'journal_prompt_category',
        values: ['gratitude', 'reflection', 'emotional_processing', 'stress_management', 'self_compassion', 'future_focus'],
      },
      {
        name: 'habit_tracking_type',
        values: ['checkbox', 'counter', 'duration', 'rating'],
      },
      {
        name: 'mindfulness_practice_category',
        values: ['breathing', 'meditation', 'movement', 'quick_reset', 'evening'],
      },
    ];

    for (const enumType of enumTypes) {
      try {
        // Check if type exists
        const checkResult = await pool.query(
          "SELECT 1 FROM pg_type WHERE typname = $1",
          [enumType.name]
        );
        
        if (checkResult.rows.length === 0) {
          // Create the enum type
          const valuesStr = enumType.values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
          await pool.query(`CREATE TYPE ${enumType.name} AS ENUM (${valuesStr});`);
          console.log(`  ✅ Created enum type: ${enumType.name}`);
        } else {
          console.log(`  ℹ Enum type already exists: ${enumType.name}`);
        }
      } catch (err: any) {
        if (err?.code === '42P07' || err?.message?.includes('already exists')) {
          console.log(`  ℹ Enum type already exists: ${enumType.name}`);
        } else {
          console.warn(`  ⚠ Warning creating ${enumType.name}: ${err?.message}`);
        }
      }
    }
    
    console.log('\n📊 Migrating wellbeing tables...');
    
    for (const tableFile of WELLBEING_TABLES) {
      const filePath = join(tablesDir, tableFile);
      const content = readFileSync(filePath, 'utf-8');
      
      // Extract table name from CREATE TABLE statement
      const tableMatch = content.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
      const tableName = tableMatch ? tableMatch[1] : null;
      
      if (!tableName) {
        console.log(`  ⚠ Could not extract table name from ${tableFile}, skipping`);
        continue;
      }

      const exists = await checkTableExists(tableName);
      
      if (exists) {
        console.log(`  ℹ Table ${tableName} already exists, skipping`);
        continue;
      }

      try {
        // Execute SQL file, replacing DROP TABLE with nothing and adding IF NOT EXISTS
        // Use a more robust approach: remove DROP TABLE line completely
        const lines = content.split('\n');
        const filteredLines = lines.filter(line => !line.match(/^\s*DROP TABLE/i));
        let sql = filteredLines.join('\n')
          .replace(/CREATE TABLE (\w+)/gi, 'CREATE TABLE IF NOT EXISTS $1')
          .replace(/CREATE INDEX (\w+)/gi, 'CREATE INDEX IF NOT EXISTS $1')
          // Fix DATE() function in indexes - remove it for now (use column directly)
          .replace(/,\s*DATE\(([^)]+)\)/g, ', $1')
          .replace(/\(DATE\(([^)]+)\)\)/g, '($1)');
        
        await pool.query(sql);
        console.log(`  ✅ Created table: ${tableName}`);
      } catch (err: any) {
        // If table already exists, that's OK
        if (err?.code === '42P07' || err?.code === '23505' || err?.message?.includes('already exists')) {
          console.log(`  ℹ Table ${tableName} already exists`);
        } else {
          console.error(`  ❌ Error creating table ${tableName}:`, err?.message);
          console.error(`  SQL error code: ${err?.code}`);
          // Show a bit of the SQL for debugging
          const sqlPreview = content.substring(0, 500).replace(/\n/g, ' ');
          console.error(`  SQL preview: ${sqlPreview}...`);
          throw err;
        }
      }
    }

    // Note: Triggers are already defined in 99-triggers.sql and will be applied by the main setup
    console.log('\n✅ Wellbeing tables migration complete!');
    
    // Verify tables
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'mood_logs', 'journal_entries', 'habits', 'habit_logs',
        'energy_logs', 'wellbeing_routines', 'routine_completions', 'mindfulness_practices'
      )
      ORDER BY table_name
    `);
    
    console.log(`\n📊 Wellbeing tables created: ${result.rows.length}/8`);
    result.rows.forEach(row => {
      console.log(`  • ${row.table_name}`);
    });

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error?.message || error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateWellbeingTables();

