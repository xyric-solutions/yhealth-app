/**
 * @file Buddy Suggestion Job
 * @description Runs weekly to precompute buddy suggestions for all active users.
 * Stores results in buddy_suggestions_cache for fast retrieval.
 */

import { logger } from '../services/logger.service.js';
import { buddySuggestionService } from '../services/buddy-suggestion.service.js';

const JOB_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STARTUP_DELAY_MS = 1020_000; // 17 minutes (stagger after other jobs)

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

async function processSuggestions(): Promise<void> {
  if (running) return;
  running = true;

  try {
    logger.info('[BuddySuggestionJob] Starting weekly suggestion refresh');
    const result = await buddySuggestionService.refreshAllSuggestions();
    logger.info('[BuddySuggestionJob] Refresh complete', { processed: result.processed });
  } catch (error) {
    logger.error('[BuddySuggestionJob] Fatal error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  } finally {
    running = false;
  }
}

export function startBuddySuggestionJob(): void {
  if (intervalId) return;

  logger.info('[BuddySuggestionJob] Scheduling weekly buddy suggestion refresh', {
    intervalMs: JOB_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
  });

  setTimeout(() => {
    processSuggestions();
    intervalId = setInterval(processSuggestions, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

export function stopBuddySuggestionJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[BuddySuggestionJob] Stopped');
  }
}
