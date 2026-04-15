/**
 * Quick migration script for vision testing tables.
 * Run: npx tsx src/database/migrate-vision.ts
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/balencia?schema=public';

async function migrate() {
  const parsed = new URL(DATABASE_URL);
  const client = new pg.Client({
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.slice(1),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  });

  await client.connect();
  console.log('Connected to database');

  const files = [
    '104-vision-test-sessions.sql',
    '105-vision-test-responses.sql',
    '106-vision-streaks.sql',
  ];

  for (const file of files) {
    const filePath = join(__dirname, 'tables', file);
    const sql = readFileSync(filePath, 'utf-8');
    try {
      await client.query(sql);
      console.log(`✅ Migrated: ${file}`);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log(`⏭️  Already exists: ${file}`);
      } else {
        console.error(`❌ Failed: ${file}`, err.message);
      }
    }
  }

  await client.end();
  console.log('Migration complete');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
