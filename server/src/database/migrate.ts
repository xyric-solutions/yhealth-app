/**
 * @file Database Migration Runner
 *
 * A sequential, transaction-safe migration runner for PostgreSQL.
 *
 * Reads SQL files from the migrations/ directory matching the naming
 * convention YYYYMMDDHHMMSS_description.sql, compares them against
 * the schema_migrations table, and applies any unapplied migrations
 * in version order. Each migration runs inside its own transaction.
 *
 * Usage:
 *   npx tsx src/database/migrate.ts
 *   node dist/server/src/database/migrate.ts
 *   npm run db:migrate
 *
 * Environment:
 *   DATABASE_URL  - Full connection string (preferred)
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD - Individual params
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Only files matching this pattern are treated as versioned migrations.
 * Legacy ad-hoc migration files (e.g. add-some-table.sql) are ignored.
 */
const MIGRATION_FILE_PATTERN = /^(\d{14})_(.+)\.sql$/;

// ---------------------------------------------------------------------------
// Connection helpers (mirrors setup.ts / pg.ts)
// ---------------------------------------------------------------------------

function parseConnectionString(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.slice(1),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

function buildPoolConfig() {
  if (process.env['DATABASE_URL']) {
    return parseConnectionString(process.env['DATABASE_URL']);
  }
  return {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MigrationFile {
  /** 14-digit version string, e.g. "20260101000000" */
  version: string;
  /** Human-readable name derived from filename */
  name: string;
  /** Full filename on disk */
  filename: string;
  /** Absolute path to the SQL file */
  filepath: string;
}

interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/** Compute SHA-256 hex digest of a string. */
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/** Discover migration files on disk, sorted by version ascending. */
function discoverMigrations(): MigrationFile[] {
  let entries: string[];
  try {
    entries = readdirSync(MIGRATIONS_DIR);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      console.error(`[migrate] Migrations directory not found: ${MIGRATIONS_DIR}`);
      process.exit(1);
    }
    throw err;
  }

  const migrations: MigrationFile[] = [];

  for (const entry of entries) {
    const match = MIGRATION_FILE_PATTERN.exec(entry);
    if (!match) {
      // Skip legacy ad-hoc files that do not follow the versioned naming
      continue;
    }
    const version = match[1] as string;
    const slug = match[2] as string;
    migrations.push({
      version,
      name: slug.replace(/-/g, ' '),
      filename: entry,
      filepath: join(MIGRATIONS_DIR, entry),
    });
  }

  // Sort by version string (lexicographic sort on 14-digit timestamps is correct)
  migrations.sort((a, b) => a.version.localeCompare(b.version));

  return migrations;
}

/** Ensure the schema_migrations tracking table exists. */
async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(14) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      checksum VARCHAR(64)
    );
  `);
}

/** Fetch all previously applied migrations from the database. */
async function getAppliedMigrations(pool: Pool): Promise<Map<string, AppliedMigration>> {
  const result = await pool.query<AppliedMigration>(
    'SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC'
  );
  const map = new Map<string, AppliedMigration>();
  for (const row of result.rows) {
    map.set(row.version, row);
  }
  return map;
}

/** Run the migration process. */
async function migrate(): Promise<void> {
  const pool = new Pool(buildPoolConfig());

  try {
    // 1. Verify connectivity
    console.log('[migrate] Connecting to database...');
    const connResult = await pool.query('SELECT current_database() AS db');
    const dbName = connResult.rows[0]?.db as string;
    console.log(`[migrate] Connected to database: ${dbName}`);

    // 2. Ensure tracking table
    await ensureMigrationsTable(pool);
    console.log('[migrate] schema_migrations table ready');

    // 3. Discover files on disk
    const allMigrations = discoverMigrations();
    console.log(`[migrate] Found ${allMigrations.length} migration file(s) on disk`);

    if (allMigrations.length === 0) {
      console.log('[migrate] No migration files found. Nothing to do.');
      return;
    }

    // 4. Determine which have already been applied
    const applied = await getAppliedMigrations(pool);
    console.log(`[migrate] ${applied.size} migration(s) already applied`);

    // 5. Validate checksums of previously applied migrations
    for (const migration of allMigrations) {
      const record = applied.get(migration.version);
      if (!record) continue;

      const content = readFileSync(migration.filepath, 'utf-8');
      const currentChecksum = sha256(content);

      if (record.checksum && record.checksum !== currentChecksum) {
        console.error(
          `[migrate] CHECKSUM MISMATCH for migration ${migration.version} (${migration.filename})\n` +
          `  Expected: ${record.checksum}\n` +
          `  Got:      ${currentChecksum}\n` +
          `  A previously applied migration file has been modified. ` +
          `This is not allowed. Revert the file or create a new migration instead.`
        );
        process.exit(1);
      }
    }

    // 6. Filter to pending migrations
    const pending = allMigrations.filter((m) => !applied.has(m.version));

    if (pending.length === 0) {
      console.log('[migrate] Database is up to date. No pending migrations.');
      return;
    }

    console.log(`[migrate] ${pending.length} pending migration(s) to apply:\n`);

    // 7. Apply each pending migration in a transaction
    let appliedCount = 0;

    for (const migration of pending) {
      const sql = readFileSync(migration.filepath, 'utf-8');
      const checksum = sha256(sql);

      console.log(`  -> Applying ${migration.version} (${migration.filename})...`);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, checksum]
        );
        await client.query('COMMIT');
        appliedCount++;
        console.log(`     Applied successfully.`);
      } catch (err: unknown) {
        await client.query('ROLLBACK');
        const message = err instanceof Error ? err.message : String(err);
        console.error(`     FAILED: ${message}`);
        console.error(`[migrate] Aborting. ${appliedCount} migration(s) applied before failure.`);
        process.exit(1);
      } finally {
        client.release();
      }
    }

    console.log(`\n[migrate] Done. ${appliedCount} migration(s) applied successfully.`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[migrate] Fatal error: ${message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

migrate();
