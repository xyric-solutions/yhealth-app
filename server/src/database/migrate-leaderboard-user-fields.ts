/**
 * @file Migration: Add Leaderboard Fields to Users Table
 * @description Adds timezone, privacy flags, and cohorts for leaderboard system
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../database/pg.js';
import { logger } from '../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration(): Promise<void> {
  try {
    logger.info('[Migration] Starting leaderboard user fields migration...');

    // Read migration SQL file
    const migrationPath = join(__dirname, 'migrations', 'add-leaderboard-user-fields.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Execute migration
    await pool.query(migrationSQL);

    logger.info('[Migration] Leaderboard user fields migration completed successfully');
  } catch (error) {
    logger.error('[Migration] Failed to run leaderboard user fields migration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Migration] Migration failed', { error });
      process.exit(1);
    });
}

export default runMigration;

