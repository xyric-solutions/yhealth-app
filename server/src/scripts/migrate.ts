#!/usr/bin/env node
/**
 * Database Migration Script
 * Run this to check and create any missing database tables
 *
 * Usage:
 *   npm run db:migrate        # Check and create missing tables
 *   npm run db:migrate:verify   # Verify schema without making changes
 *   npm run db:migrate:full     # Force full schema rebuild (DANGER: drops data)
 */

import { autoMigrate, verifySchema } from '../database/auto-migrate.js';
import { database } from '../config/database.config.js';
import { logger } from '../services/logger.service.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';

  try {
    // Connect to database
    logger.info('Connecting to database...');
    await database.connect();
    logger.info('Database connected successfully');

    switch (command) {
      case 'verify':
        logger.info('Verifying database schema (no changes will be made)...');
        const verification = await verifySchema();
        
        if (verification.isValid) {
          logger.info('✅ Database schema is complete and valid');
          console.log('\n✅ All tables exist');
          process.exit(0);
        } else {
          logger.warn('❌ Database schema has missing objects', {
            missingTables: verification.missingTables,
            missingTypes: verification.missingTypes,
          });
          console.log('\n❌ Missing Tables:');
          verification.missingTables.forEach(t => console.log(`   - ${t}`));
          console.log('\n❌ Missing Types:');
          verification.missingTypes.forEach(t => console.log(`   - ${t}`));
          process.exit(1);
        }
        break;

      case 'migrate':
      default:
        logger.info('Starting database migration...');
        const result = await autoMigrate();

        if (result.success) {
          if (result.tablesCreated.length === 0) {
            logger.info('✅ Database is up to date. No tables needed to be created.');
            console.log('\n✅ All tables exist');
            console.log(`   Total tables: ${result.existingTables.length}`);
          } else {
            logger.info('✅ Migration completed successfully', {
              tablesCreated: result.tablesCreated,
              totalTables: result.existingTables.length,
            });
            console.log('\n✅ Migration completed successfully');
            console.log(`   Tables created: ${result.tablesCreated.length}`);
            result.tablesCreated.forEach(t => console.log(`   - ${t}`));
            console.log(`   Total tables: ${result.existingTables.length}`);
          }
          process.exit(0);
        } else {
          logger.error('❌ Migration failed');
          console.log('\n❌ Migration failed');
          process.exit(1);
        }
        break;
    }
  } catch (error) {
    logger.error('Migration script failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await database.disconnect();
  }
}

main();
