/**
 * @file Historical Data Migration for Vector Embeddings
 * @description Migrates all existing user data to create vector embeddings
 * Run with: npm run migrate:embeddings OR tsx src/database/migrate-embeddings.ts
 */

import { embeddingQueueService } from '../services/embedding-queue.service.js';
import { query } from './pg.js';
import { logger } from '../services/logger.service.js';
import { JobPriorities } from '../config/queue.config.js';

// ============================================================================
// Types
// ============================================================================

interface TableMigrationConfig {
  table: string;
  sourceType: string;
  priority: number;
  batchSize: number;
}

// ============================================================================
// Migration Configuration
// ============================================================================

const TABLES_TO_MIGRATE: TableMigrationConfig[] = [
  // Critical priority (5) - Goals & Plans
  { table: 'user_goals', sourceType: 'user_goal', priority: JobPriorities.CRITICAL, batchSize: 100 },
  { table: 'user_plans', sourceType: 'user_plan', priority: JobPriorities.CRITICAL, batchSize: 100 },
  { table: 'diet_plans', sourceType: 'diet_plan', priority: JobPriorities.CRITICAL, batchSize: 100 },
  { table: 'workout_plans', sourceType: 'workout_plan', priority: JobPriorities.CRITICAL, batchSize: 100 },

  // High priority (4) - Tasks
  { table: 'user_tasks', sourceType: 'user_task', priority: JobPriorities.HIGH, batchSize: 200 },

  // Medium priority (3) - Activity Logs
  { table: 'meal_logs', sourceType: 'meal_log', priority: JobPriorities.MEDIUM, batchSize: 500 },
  { table: 'workout_logs', sourceType: 'workout_log', priority: JobPriorities.MEDIUM, batchSize: 500 },
  { table: 'progress_records', sourceType: 'progress_record', priority: JobPriorities.MEDIUM, batchSize: 300 },

  // Low priority (2) - Preferences
  { table: 'user_preferences', sourceType: 'user_preferences', priority: JobPriorities.LOW, batchSize: 100 },
];

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrate a single table
 */
async function migrateTable(config: TableMigrationConfig): Promise<number> {
  const { table, sourceType, priority, batchSize } = config;

  logger.info(`[Migration] Starting migration for ${table}`, { batchSize });

  // Get total count
  const countResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM ${table}`);
  const totalRecords = parseInt(countResult.rows[0].count, 10);

  if (totalRecords === 0) {
    logger.info(`[Migration] No records to migrate in ${table}`);
    return 0;
  }

  logger.info(`[Migration] Found ${totalRecords} records in ${table}`);

  let processed = 0;
  let offset = 0;

  while (offset < totalRecords) {
    // Fetch batch
    const result = await query(
      `SELECT id, user_id FROM ${table} ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
      [batchSize, offset]
    );

    // Enqueue batch
    const enqueuePromises = result.rows.map((row) =>
      embeddingQueueService.enqueueEmbedding({
        userId: row.user_id,
        sourceType,
        sourceId: row.id,
        operation: 'create',
        priority,
      })
    );

    await Promise.all(enqueuePromises);
    processed += result.rows.length;
    offset += batchSize;

    const progressPercent = Math.round((processed / totalRecords) * 100);
    logger.info(`[Migration] Enqueued ${processed}/${totalRecords} records from ${table} (${progressPercent}%)`);

    // Small delay to avoid overwhelming the queue
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logger.info(`[Migration] Completed migration for ${table}`, { processed });
  return processed;
}

/**
 * Migrate all tables
 */
async function migrateAllTables(): Promise<void> {
  logger.info('[Migration] Starting historical data migration');

  const startTime = Date.now();
  let totalProcessed = 0;
  const results: { table: string; processed: number; status: 'success' | 'failed'; error?: string }[] = [];

  for (const config of TABLES_TO_MIGRATE) {
    try {
      const count = await migrateTable(config);
      totalProcessed += count;
      results.push({ table: config.table, processed: count, status: 'success' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Migration] Failed to migrate ${config.table}`, { error: errorMessage });
      results.push({ table: config.table, processed: 0, status: 'failed', error: errorMessage });
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  logger.info('[Migration] Historical data migration completed', {
    totalProcessed,
    durationSeconds: duration,
  });

  // Print summary
  console.log('\n=== Migration Summary ===');
  console.table(results);
  console.log(`\nTotal records enqueued: ${totalProcessed}`);
  console.log(`Duration: ${duration} seconds`);
  console.log('\nNote: Jobs are now in the queue. Monitor worker logs to see processing progress.');
}

/**
 * Get migration status (check what's already embedded)
 */
async function getMigrationStatus(): Promise<void> {
  logger.info('[Migration] Checking migration status...');

  const status: { table: string; total: number; embedded: number; coverage: string; missing: number }[] = [];

  for (const config of TABLES_TO_MIGRATE) {
    const totalResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM ${config.table}`);
    const total = parseInt(totalResult.rows[0].count, 10);

    const embeddedResult = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT source_id) as count
       FROM vector_embeddings
       WHERE source_type = $1`,
      [config.sourceType]
    );
    const embedded = parseInt(embeddedResult.rows[0].count, 10);

    const coveragePercent = total > 0 ? ((embedded / total) * 100).toFixed(2) : '100.00';
    const missing = total - embedded;

    status.push({
      table: config.table,
      total,
      embedded,
      coverage: `${coveragePercent}%`,
      missing,
    });
  }

  console.log('\n=== Migration Status ===');
  console.table(status);

  const totalRecords = status.reduce((sum, s) => sum + s.total, 0);
  const totalEmbedded = status.reduce((sum, s) => sum + s.embedded, 0);
  const overallCoverage = totalRecords > 0 ? ((totalEmbedded / totalRecords) * 100).toFixed(2) : '100.00';

  console.log(`\nOverall Coverage: ${overallCoverage}% (${totalEmbedded}/${totalRecords})`);
}

/**
 * Retry failed embeddings
 */
async function retryFailed(limit: number = 50): Promise<void> {
  logger.info('[Migration] Retrying failed embedding jobs...', { limit });

  const failedJobs = await embeddingQueueService.getFailedJobs(limit);

  if (failedJobs.length === 0) {
    logger.info('[Migration] No failed jobs found');
    return;
  }

  logger.info(`[Migration] Found ${failedJobs.length} failed jobs. Retrying...`);

  let retried = 0;
  for (const job of failedJobs) {
    const success = await embeddingQueueService.retryFailedJob(job.id);
    if (success) retried++;
  }

  logger.info(`[Migration] Retry completed`, { retried, total: failedJobs.length });
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';

  try {
    switch (command) {
      case 'migrate':
        await migrateAllTables();
        break;

      case 'status':
        await getMigrationStatus();
        break;

      case 'retry':
        const limit = parseInt(args[1]) || 50;
        await retryFailed(limit);
        break;

      case 'help':
        console.log(`
Usage: npm run migrate:embeddings [command]

Commands:
  migrate       Migrate all historical data (default)
  status        Check migration status and coverage
  retry [limit] Retry failed jobs (default limit: 50)
  help          Show this help message

Examples:
  npm run migrate:embeddings
  npm run migrate:embeddings status
  npm run migrate:embeddings retry 100
        `);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "npm run migrate:embeddings help" for usage information');
        process.exit(1);
    }

    logger.info('[Migration] Script finished successfully');
    process.exit(0);
  } catch (error) {
    logger.error('[Migration] Script failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export functions for programmatic use
export { migrateAllTables, migrateTable, getMigrationStatus, retryFailed };
