/**
 * @file Schedule Automation Job
 * Background job that processes schedule-based AI chat messages
 *
 * Architecture:
 * Schedule Items → Automation Service → AI Coach Chat → User
 *
 * Similar to n8n workflow automation - sends:
 * - Reminder messages (X minutes before activity)
 * - Start messages (when activity begins)
 * - Follow-up messages (after activity ends)
 */

import { scheduleAutomationService } from '../services/schedule-automation.service.js';
import { logger } from '../services/logger.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 60 * 1000; // Check every minute (same as reminder processor)
// Configuration constants (may be used in future optimizations)
// const BATCH_SIZE = parseInt(process.env.SCHEDULE_AUTOMATION_BATCH_SIZE || '50', 10);
// const RATE_LIMIT_PER_MINUTE = parseInt(process.env.SCHEDULE_AUTOMATION_RATE_LIMIT || '10', 10);

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let metrics = {
  totalProcessed: 0,
  totalErrors: 0,
  lastRunTime: null as Date | null,
  averageProcessingTime: 0,
};

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process schedule automation messages
 * This function is called periodically to check for and send AI messages
 * Optimized with batch processing, rate limiting, and metrics
 */
async function processScheduleAutomation(): Promise<void> {
  if (isRunning) {
    logger.warn('[ScheduleAutomationJob] Already running, skipping this cycle');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const processed = await scheduleAutomationService.processScheduleAutomation();

    // Update metrics
    const processingTime = Date.now() - startTime;
    metrics.totalProcessed += processed;
    metrics.lastRunTime = new Date();
    metrics.averageProcessingTime = 
      (metrics.averageProcessingTime + processingTime) / 2;

    if (processed > 0) {
      logger.info('[ScheduleAutomationJob] Processed messages', {
        count: processed,
        processingTimeMs: processingTime,
        totalProcessed: metrics.totalProcessed,
      });
    }
  } catch (error) {
    metrics.totalErrors++;
    logger.error('[ScheduleAutomationJob] Failed to process automation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      totalErrors: metrics.totalErrors,
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB LIFECYCLE
// ============================================

/**
 * Start the schedule automation job
 */
export function startScheduleAutomationJob(): void {
  if (intervalId) {
    logger.warn('[ScheduleAutomationJob] Already running');
    return;
  }

  logger.info('[ScheduleAutomationJob] Starting schedule automation processor', {
    intervalMs: JOB_INTERVAL_MS,
  });

  // Run immediately on start
  processScheduleAutomation();

  // Then run on interval
  intervalId = setInterval(processScheduleAutomation, JOB_INTERVAL_MS);
}

/**
 * Stop the schedule automation job
 */
export function stopScheduleAutomationJob(): void {
  if (!intervalId) {
    logger.warn('[ScheduleAutomationJob] Not running');
    return;
  }

  clearInterval(intervalId);
  intervalId = null;

  logger.info('[ScheduleAutomationJob] Stopped schedule automation processor');
}

/**
 * Check if the job is running
 */
export function isScheduleAutomationJobRunning(): boolean {
  return intervalId !== null;
}

/**
 * Manually trigger processing (for testing)
 */
export async function processNow(): Promise<number> {
  return await scheduleAutomationService.processScheduleAutomation();
}

/**
 * Get job metrics
 */
export function getMetrics() {
  return { ...metrics };
}

// ============================================
// EXPORTS
// ============================================

export const scheduleAutomationJob = {
  start: startScheduleAutomationJob,
  stop: stopScheduleAutomationJob,
  isRunning: isScheduleAutomationJobRunning,
  processNow,
  getMetrics,
};

export default scheduleAutomationJob;
