/**
 * Migration: Increase featured_image column size in blogs table
 * Cloudflare R2 presigned URLs can be longer than 500 characters
 */

import { query, closePool } from './pg.js';
import { logger } from '../services/logger.service.js';

async function migrate() {
  logger.info('Starting migration: Increase featured_image column size...');

  try {
    // Alter column to support longer URLs (presigned URLs can be 1000+ characters)
    await query(`
      ALTER TABLE blogs 
      ALTER COLUMN featured_image TYPE VARCHAR(2000)
    `);
    
    logger.info('✅ Successfully increased featured_image column size to 2000 characters');
    logger.info('🎉 Migration completed successfully!');
  } catch (error) {
    logger.error('❌ Migration failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  } finally {
    await closePool();
  }
}

migrate().catch((error) => {
  logger.error('Fatal error during migration:', error);
  process.exit(1);
});

