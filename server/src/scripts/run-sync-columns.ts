#!/usr/bin/env node
/**
 * Quick script to run ONLY the sync-missing-columns migration.
 * Much faster than full auto-migrate when tables already exist.
 */
import { pool } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  try {
    logger.info('Connecting to database...');
    // Test connection
    const res = await pool.query('SELECT NOW()');
    logger.info('Connected', { now: res.rows[0].now });

    // Read the migration file
    const migrationPath = join(__dirname, '..', 'database', 'migrations', 'sync-missing-columns.sql');
    const migration = readFileSync(migrationPath, 'utf-8');

    // Split into individual DO blocks and regular SQL statements
    const blocks: string[] = [];
    const doBlockRegex = /DO\s*\$\$[\s\S]*?END\s*\$\$\s*;/g;
    let lastIndex = 0;
    let match;

    while ((match = doBlockRegex.exec(migration)) !== null) {
      const between = migration.substring(lastIndex, match.index).trim();
      if (between) {
        between.split(';').forEach(s => {
          const trimmed = s.trim();
          if (trimmed && !trimmed.startsWith('--')) {
            blocks.push(trimmed + ';');
          }
        });
      }
      blocks.push(match[0]);
      lastIndex = match.index + match[0].length;
    }

    const afterLastBlock = migration.substring(lastIndex).trim();
    if (afterLastBlock) {
      afterLastBlock.split(';').forEach(s => {
        const trimmed = s.trim();
        if (trimmed && !trimmed.startsWith('--')) {
          blocks.push(trimmed + ';');
        }
      });
    }

    logger.info(`Found ${blocks.length} blocks to execute`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const label = block.substring(0, 80).replace(/\n/g, ' ');
      try {
        await pool.query(block);
        successCount++;
        logger.info(`[${i + 1}/${blocks.length}] OK: ${label}...`);
      } catch (error: any) {
        if (error?.code === '42P07' || error?.code === '42710' || error?.code === '42701' ||
            error?.message?.includes('already exists') || error?.message?.includes('duplicate')) {
          skipCount++;
          logger.info(`[${i + 1}/${blocks.length}] SKIP (already exists): ${label}...`);
        } else {
          errorCount++;
          logger.error(`[${i + 1}/${blocks.length}] ERROR: ${error?.message}`, { block: label });
        }
      }
    }

    console.log(`\n=== Sync Complete ===`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Skipped: ${skipCount}`);
    console.log(`  Errors:  ${errorCount}`);

    // Verify key columns exist
    const checks = [
      { table: 'users', column: 'onboarding_status' },
      { table: 'users', column: 'auth_provider' },
      { table: 'activity_logs', column: 'status' },
      { table: 'diet_plans', column: 'status' },
      { table: 'user_plans', column: 'status' },
      { table: 'competition_entries', column: 'status' },
      { table: 'competitions', column: 'status' },
      { table: 'user_goals', column: 'status' },
      { table: 'user_goals', column: 'category' },
      { table: 'leaderboard_snapshots', column: 'board_type' },
      { table: 'messages', column: 'is_view_once' },
    ];

    console.log(`\n=== Column Verification ===`);
    for (const { table, column } of checks) {
      const result = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column]
      );
      const exists = result.rows.length > 0;
      console.log(`  ${exists ? '✅' : '❌'} ${table}.${column}`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
