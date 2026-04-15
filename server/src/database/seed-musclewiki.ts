/**
 * @file MuscleWiki Seed Script
 * CLI script to fetch and seed exercises from MuscleWiki RapidAPI.
 * Fetches exercises with video demonstrations (mp4) and thumbnails.
 *
 * Usage:
 *   npx tsx src/database/seed-musclewiki.ts
 *   npx tsx src/database/seed-musclewiki.ts --dry-run
 *   npx tsx src/database/seed-musclewiki.ts --limit 50
 *   npx tsx src/database/seed-musclewiki.ts --offset 100 --limit 200
 *   npx tsx src/database/seed-musclewiki.ts --batch-size 200
 */

import 'dotenv/config';
import { pool } from './pg.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  ingestFromMuscleWiki,
  populateLookupTables,
} from '../services/exercise-ingestion.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// CLI ARGUMENT PARSING
// ============================================

function parseArgs(): {
  dryRun: boolean;
  batchSize: number;
  limit?: number;
  offset: number;
} {
  const args = process.argv.slice(2);
  let dryRun = false;
  let batchSize = 500;
  let limit: number | undefined;
  let offset = 0;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        dryRun = true;
        break;
      case '--batch-size':
        batchSize = parseInt(args[++i], 10);
        break;
      case '--limit':
        limit = parseInt(args[++i], 10);
        break;
      case '--offset':
        offset = parseInt(args[++i], 10);
        break;
      case '--help':
        console.log(`
Usage: npx tsx src/database/seed-musclewiki.ts [options]

Options:
  --dry-run                Preview without writing to database
  --batch-size <number>    Batch size for database inserts (default: 500)
  --limit <number>         Max exercises to fetch
  --offset <number>        Start from exercise ID (default: 0)
  --help                   Show this help message

Examples:
  npx tsx src/database/seed-musclewiki.ts                    # Fetch all ~1734 exercises
  npx tsx src/database/seed-musclewiki.ts --limit 100        # Fetch first 100
  npx tsx src/database/seed-musclewiki.ts --offset 500 --limit 200  # Fetch 200 starting at ID 500
  npx tsx src/database/seed-musclewiki.ts --dry-run          # Preview only
        `);
        process.exit(0);
    }
  }

  return { dryRun, batchSize, limit, offset };
}

// ============================================
// ENSURE TABLES EXIST
// ============================================

async function ensureTablesExist(): Promise<void> {
  console.log('\n📦 Ensuring exercise tables exist...');

  // Run migration if exists
  const migrationPath = join(__dirname, 'migrations', 'add-exercise-ingestion-columns.sql');
  if (existsSync(migrationPath)) {
    const migration = readFileSync(migrationPath, 'utf-8');

    // Split by semicolons handling dollar-quoted strings
    const statements: string[] = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';

    for (let i = 0; i < migration.length; i++) {
      const char = migration[i];

      if (char === '$' && !inDollarQuote) {
        let tagEnd = i + 1;
        while (tagEnd < migration.length && migration[tagEnd] !== '$') tagEnd++;
        if (tagEnd < migration.length) {
          dollarTag = migration.substring(i, tagEnd + 1);
          inDollarQuote = true;
          current += dollarTag;
          i = tagEnd;
          continue;
        }
      }

      if (inDollarQuote && char === '$') {
        const potentialEnd = migration.substring(i, i + dollarTag.length);
        if (potentialEnd === dollarTag) {
          inDollarQuote = false;
          current += dollarTag;
          i += dollarTag.length - 1;
          dollarTag = '';
          continue;
        }
      }

      current += char;

      if (char === ';' && !inDollarQuote) {
        const trimmed = current.trim();
        if (trimmed.length > 0 && !trimmed.startsWith('--')) {
          statements.push(trimmed);
        }
        current = '';
      }
    }

    if (current.trim().length > 0 && !current.trim().startsWith('--')) {
      statements.push(current.trim());
    }

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        if (err?.code === '42701' || err?.message?.includes('already exists') || err?.code === '42P07') {
          continue;
        }
        console.warn(`  Warning: ${err.message?.substring(0, 100)}`);
      }
    }
    console.log('  ✓ Migration applied');
  }

  // Create lookup tables
  const lookupPath = join(__dirname, 'tables', '80-exercise-lookup-tables.sql');
  if (existsSync(lookupPath)) {
    const lookupSql = readFileSync(lookupPath, 'utf-8');
    const lookupStatements = lookupSql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const withoutComments = s.replace(/^(--[^\n]*\n\s*)*/g, '').trim();
        return withoutComments.length > 0;
      });

    for (const stmt of lookupStatements) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        if (err?.code === '42P07' || err?.message?.includes('already exists')) continue;
        console.warn(`  Warning: ${err.message?.substring(0, 100)}`);
      }
    }
    console.log('  ✓ Lookup tables ready');
  }
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  const { dryRun, batchSize, limit, offset } = parseArgs();

  console.log('='.repeat(60));
  console.log(' MuscleWiki Exercise Seed Script');
  console.log('='.repeat(60));
  console.log(`  Source:     MuscleWiki RapidAPI`);
  console.log(`  Dry Run:    ${dryRun}`);
  console.log(`  Batch Size: ${batchSize}`);
  console.log(`  Offset:     ${offset}`);
  console.log(`  Limit:      ${limit || 'all (~1734 exercises)'}`);
  console.log(`  API Host:   musclewiki-api.p.rapidapi.com`);
  console.log('='.repeat(60));

  // Verify API key is set
  if (!process.env['MUSCLEWIKI_RAPIDAPI_KEY']) {
    console.error('\n❌ MUSCLEWIKI_RAPIDAPI_KEY is not set in .env');
    console.error('   Add: MUSCLEWIKI_RAPIDAPI_KEY=your_key_here');
    process.exit(1);
  }

  try {
    // Step 1: Ensure tables exist
    if (!dryRun) {
      await ensureTablesExist();
    }

    // Step 2: Ingest exercises from MuscleWiki
    console.log('\n🔄 Fetching exercises from MuscleWiki...');
    console.log('   (Each exercise is fetched individually for full data + videos)');
    console.log('   This may take several minutes for all exercises.\n');

    const result = await ingestFromMuscleWiki({ dryRun, batchSize, limit, offset });

    // Step 3: Populate lookup tables
    if (!dryRun && result.inserted > 0) {
      console.log('\n📊 Populating lookup tables...');
      const lookupResult = await populateLookupTables();
      console.log(`  Muscles:    ${lookupResult.muscles}`);
      console.log(`  Equipment:  ${lookupResult.equipment}`);
      console.log(`  Body Parts: ${lookupResult.bodyParts}`);
    }

    // Step 4: Report
    console.log('\n' + '='.repeat(60));
    console.log(' MuscleWiki Ingestion Report');
    console.log('='.repeat(60));
    console.log(`  Source:        ${result.source}`);
    console.log(`  Total Fetched: ${result.totalFetched}`);
    console.log(`  Inserted:      ${result.inserted}`);
    console.log(`  Updated:       ${result.updated}`);
    console.log(`  Skipped:       ${result.skipped}`);
    console.log(`  Failed:        ${result.failed}`);
    console.log(`  Duration:      ${(result.durationMs / 1000).toFixed(1)}s`);

    if (result.errors.length > 0) {
      console.log(`\n  Errors (first 10):`);
      result.errors.slice(0, 10).forEach(e => {
        console.log(`    - ${e.exerciseName}: ${e.error}`);
      });
    }

    console.log('='.repeat(60));

    if (result.totalFetched > 0) {
      const videoCount = result.totalFetched; // All MuscleWiki exercises have videos
      console.log(`\n🎬 ${videoCount} exercises with video demos imported!`);
    }

    console.log(result.failed === 0 ? '\n✅ MuscleWiki seed completed successfully!' : '\n⚠️  Seed completed with errors');
  } catch (error) {
    console.error('\n❌ Seed failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
