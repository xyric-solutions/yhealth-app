/**
 * @file ExerciseDB Seed Script
 * CLI script to fetch and seed exercises from ExerciseDB open-source API.
 *
 * Usage:
 *   npx tsx src/database/seed-exercisedb.ts
 *   npx tsx src/database/seed-exercisedb.ts --dry-run
 *   npx tsx src/database/seed-exercisedb.ts --source rapidapi
 *   npx tsx src/database/seed-exercisedb.ts --batch-size 200
 *   npx tsx src/database/seed-exercisedb.ts --limit 100
 */

import 'dotenv/config';
import { pool } from './pg.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  ingestFromExerciseDB,
  ingestFromRapidAPI,
  populateLookupTables,
} from '../services/exercise-ingestion.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// CLI ARGUMENT PARSING
// ============================================

function parseArgs(): {
  source: 'exercisedb' | 'rapidapi';
  dryRun: boolean;
  batchSize: number;
  limit?: number;
} {
  const args = process.argv.slice(2);
  let source: 'exercisedb' | 'rapidapi' = 'exercisedb';
  let dryRun = false;
  let batchSize = 500;
  let limit: number | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
        source = args[++i] as 'exercisedb' | 'rapidapi';
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--batch-size':
        batchSize = parseInt(args[++i], 10);
        break;
      case '--limit':
        limit = parseInt(args[++i], 10);
        break;
      case '--help':
        console.log(`
Usage: npx tsx src/database/seed-exercisedb.ts [options]

Options:
  --source <exercisedb|rapidapi>  Data source (default: exercisedb)
  --dry-run                       Preview without writing to database
  --batch-size <number>           Batch size for database inserts (default: 500)
  --limit <number>                Max exercises to fetch
  --help                          Show this help message
        `);
        process.exit(0);
    }
  }

  return { source, dryRun, batchSize, limit };
}

// ============================================
// RUN MIGRATION
// ============================================

async function runMigration(): Promise<void> {
  console.log('\n📦 Running exercise ingestion migration...');

  const migrationPath = join(__dirname, 'migrations', 'add-exercise-ingestion-columns.sql');
  if (!existsSync(migrationPath)) {
    console.log('  Migration file not found, skipping');
    return;
  }

  const migration = readFileSync(migrationPath, 'utf-8');

  // Split by semicolons but handle dollar-quoted strings (for trigger function)
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
        // Column/object already exists, safe to skip
        continue;
      }
      console.warn(`  Warning: ${err.message?.substring(0, 100)}`);
    }
  }

  console.log('  Migration applied successfully');

  // Create lookup tables
  const lookupPath = join(__dirname, 'tables', '80-exercise-lookup-tables.sql');
  if (existsSync(lookupPath)) {
    const lookupSql = readFileSync(lookupPath, 'utf-8');
    const lookupStatements = lookupSql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Strip leading comment lines to get actual SQL content
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
    console.log('  Lookup tables created');
  }
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  const { source, dryRun, batchSize, limit } = parseArgs();

  console.log('='.repeat(60));
  console.log(' ExerciseDB Seed Script');
  console.log('='.repeat(60));
  console.log(`  Source:     ${source}`);
  console.log(`  Dry Run:    ${dryRun}`);
  console.log(`  Batch Size: ${batchSize}`);
  console.log(`  Limit:      ${limit || 'all'}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Run migration
    if (!dryRun) {
      await runMigration();
    }

    // Step 2: Ingest exercises
    console.log(`\n🔄 Fetching exercises from ${source}...`);

    let result;
    if (source === 'exercisedb') {
      result = await ingestFromExerciseDB({ dryRun, batchSize, limit });
    } else if (source === 'rapidapi') {
      result = await ingestFromRapidAPI({ dryRun, batchSize, limit });
    } else {
      throw new Error(`Unknown source: ${source}`);
    }

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
    console.log(' Ingestion Report');
    console.log('='.repeat(60));
    console.log(`  Source:       ${result.source}`);
    console.log(`  Total Fetched: ${result.totalFetched}`);
    console.log(`  Inserted:     ${result.inserted}`);
    console.log(`  Updated:      ${result.updated}`);
    console.log(`  Skipped:      ${result.skipped}`);
    console.log(`  Failed:       ${result.failed}`);
    console.log(`  Duration:     ${(result.durationMs / 1000).toFixed(1)}s`);

    if (result.errors.length > 0) {
      console.log(`\n  Errors (first 10):`);
      result.errors.slice(0, 10).forEach(e => {
        console.log(`    - ${e.exerciseName}: ${e.error}`);
      });
    }

    console.log('='.repeat(60));
    console.log(result.failed === 0 ? '\n✅ Seed completed successfully!' : '\n⚠️  Seed completed with errors');
  } catch (error) {
    console.error('\n❌ Seed failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
