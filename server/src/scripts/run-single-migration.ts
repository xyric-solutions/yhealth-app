#!/usr/bin/env node
/**
 * Run a single migration file with verbose output
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: tsx run-single-migration.ts <migration-file.sql>');
  process.exit(1);
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
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to database\n');

    const filePath = join(__dirname, '..', 'database', 'migrations', migrationFile);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`⚡ Running ${migrationFile}...\n`);
    
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      if (stmt.trim().length > 0) {
        console.log(`Executing: ${stmt.substring(0, 80)}...`);
        try {
          await pool.query(stmt);
          console.log('✅ Success\n');
        } catch (err: any) {
          if (err?.code === '42P07' || err?.message?.includes('already exists')) {
            console.log('⚠️  Already exists (skipping)\n');
          } else {
            console.error('❌ Error:', err.message);
            throw err;
          }
        }
      }
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
