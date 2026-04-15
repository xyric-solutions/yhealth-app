/**
 * @file Migrate Schedule Tables
 * @description Migration script to add schedule tables to existing database
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateScheduleTables() {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('🔌 Connecting to database...');
    console.log('\n📂 Loading schedule table files...');

    const tablesDir = join(__dirname, 'tables');
    
    // Load schedule tables
    const scheduleTables = [
      '54-daily-schedules.sql',
    ];

    // Load triggers for schedule tables
    const triggersFile = join(tablesDir, '99-triggers.sql');
    let triggersContent = '';
    try {
      triggersContent = readFileSync(triggersFile, 'utf-8');
      // Extract only schedule-related triggers
      const scheduleTriggers = triggersContent
        .split('-- Schedule tables triggers')
        .pop()
        ?.split('--')[0] || '';
      triggersContent = scheduleTriggers;
    } catch (_err) {
      console.log('  ⚠ Could not load triggers file, continuing without triggers');
    }

    for (const file of scheduleTables) {
      const filePath = join(tablesDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        console.log(`  ✓ Loaded ${file}`);

        console.log(`\n⚡ Applying ${file}...`);
        await pool.query(content);
        console.log(`  ✅ Applied ${file} successfully`);
      } catch (err: any) {
        // Check if table already exists
        if (err?.message?.includes('already exists') || err?.code === '42P07') {
          console.log(`  ⚠ Table from ${file} already exists, skipping...`);
        } else {
          console.error(`  ✗ Failed to apply ${file}:`, err.message);
          throw err;
        }
      }
    }

    // Apply triggers if available
    if (triggersContent) {
      console.log('\n⚡ Applying schedule table triggers...');
      try {
        await pool.query(triggersContent);
        console.log('  ✅ Applied schedule triggers successfully');
      } catch (err: any) {
        if (err?.message?.includes('already exists') || err?.code === '42710') {
          console.log('  ⚠ Triggers already exist, skipping...');
        } else {
          console.error('  ✗ Failed to apply triggers:', err.message);
          // Don't throw - triggers are optional
        }
      }
    }

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('schedule_templates', 'daily_schedules', 'schedule_items', 'schedule_links')
      ORDER BY table_name
    `);

    console.log(`\n📊 Schedule tables status:`);
    const expectedTables = ['schedule_templates', 'daily_schedules', 'schedule_items', 'schedule_links'];
    expectedTables.forEach(tableName => {
      const exists = result.rows.some(row => row.table_name === tableName);
      console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
    });

    if (result.rows.length === expectedTables.length) {
      console.log('\n🎉 Schedule tables migration complete!');
    } else {
      console.log('\n⚠️  Some tables may be missing. Please check the output above.');
    }

  } catch (error) {
    console.error('\n❌ Error migrating schedule tables:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateScheduleTables();


