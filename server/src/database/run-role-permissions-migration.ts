/**
 * Run Role-Permissions RBAC migration
 * Migrates users.role to users.role_id
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

    const filePath = join(__dirname, 'migrations', 'add-role-permissions-system.sql');
    const sql = readFileSync(filePath, 'utf-8');

    console.log('⚡ Running add-role-permissions-system.sql...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
