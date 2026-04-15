/**
 * Migration script for contact_submissions table
 * Creates the table and all necessary indexes if they don't exist
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from './pg.js';
import { logger } from '../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateContactSubmissions(): Promise<void> {
  try {
    logger.info('Starting contact_submissions table migration...');

    // Read the SQL file
    const sqlFile = join(__dirname, 'tables', '69-contact-submissions.sql');
    const sql = readFileSync(sqlFile, 'utf-8');

    // Execute the SQL
    await query(sql);

    logger.info('✅ contact_submissions table migration completed successfully');

    // Verify the table was created
    const checkResult = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'contact_submissions'
      )`
    );

    if (checkResult.rows[0]?.exists) {
      logger.info('✅ Verified: contact_submissions table exists');

      // Check row count
      const countResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM contact_submissions'
      );
      const rowCount = parseInt(countResult.rows[0]?.count || '0');
      logger.info(`📊 Current row count: ${rowCount}`);
    } else {
      logger.error('❌ Table verification failed: contact_submissions table does not exist');
      process.exit(1);
    }
  } catch (error: any) {
    logger.error('❌ Migration failed', {
      error: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    process.exit(1);
  }
}

// Run migration
migrateContactSubmissions()
  .then(() => {
    logger.info('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Fatal error in migration script', { error });
    process.exit(1);
  });
