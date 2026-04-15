/**
 * Migration: Create Help Center, Community, and Webinars tables
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Split SQL into statements, handling trigger/function blocks properly
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip pure comment lines
    if (trimmed.startsWith('--') && !current.trim()) continue;

    current += line + '\n';

    if (trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt && !stmt.startsWith('--')) {
        statements.push(stmt);
      }
      current = '';
    }
  }

  if (current.trim() && !current.trim().startsWith('--')) {
    statements.push(current.trim());
  }

  return statements;
}

async function runMigration() {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('Connecting to database...');
    await pool.query('SELECT 1');
    console.log('Connected to database\n');

    const tableFiles = [
      '70-help-articles.sql',
      '71-community-posts.sql',
      '72-webinars.sql',
    ];

    const tablesDir = join(__dirname, 'tables');

    for (const file of tableFiles) {
      const filePath = join(tablesDir, file);
      const sql = readFileSync(filePath, 'utf-8');

      console.log(`Running ${file}...`);

      const statements = splitStatements(sql);
      let success = 0;
      let skipped = 0;

      for (const stmt of statements) {
        try {
          await pool.query(stmt);
          success++;

          if (stmt.toUpperCase().includes('CREATE TABLE')) {
            const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
            if (match) console.log(`  + Created table: ${match[1]}`);
          }
        } catch (err: any) {
          if (err?.code === '42P07' || err?.code === '42710' || err?.message?.includes('already exists')) {
            skipped++;
          } else if (err?.message?.includes('does not exist') && stmt.toUpperCase().includes('TRIGGER')) {
            // update_updated_at_column() might not exist yet - skip trigger
            console.log(`  ~ Skipping trigger (function not available)`);
            skipped++;
          } else {
            console.error(`  ! Error: ${err.message}`);
            console.error(`    Statement: ${stmt.substring(0, 100)}...`);
          }
        }
      }

      console.log(`  Done (${success} applied, ${skipped} skipped)\n`);
    }

    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('help_articles', 'community_posts', 'community_replies', 'webinars', 'webinar_registrations')
      ORDER BY table_name
    `);

    console.log(`Verification - Tables found: ${result.rows.length}/5`);
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

    if (result.rows.length === 5) {
      console.log('\nAll tables created successfully!');
    } else {
      const found = result.rows.map(r => r.table_name);
      const expected = ['help_articles', 'community_posts', 'community_replies', 'webinars', 'webinar_registrations'];
      const missing = expected.filter(t => !found.includes(t));
      console.log(`\nMissing tables: ${missing.join(', ')}`);
    }

  } catch (error) {
    console.error('\nError:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
