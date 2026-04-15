/**
 * @file Calendar Sync Job
 * @description Periodically syncs Google Calendar events for all connected users.
 * Runs every 15 minutes. Follows the existing setInterval job pattern.
 */

import { query } from '../database/pg.js';
import { googleCalendarService } from '../services/google-calendar.service.js';
import { logger } from '../services/logger.service.js';

const JOB_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

async function processCalendarSync() {
  if (isRunning) return;
  if (!googleCalendarService.isConfigured()) return;
  isRunning = true;

  try {
    // Get all active connections
    const connections = await query<{
      id: string;
      user_id: string;
    }>(
      `SELECT id, user_id FROM calendar_connections
       WHERE sync_enabled = true AND sync_status != 'error'
       ORDER BY last_sync_at ASC NULLS FIRST
       LIMIT 50`,
    );

    if (connections.rows.length === 0) return;

    let synced = 0;
    let failed = 0;

    for (const conn of connections.rows) {
      try {
        await googleCalendarService.syncEvents(conn.user_id, conn.id, 7, 7);
        synced++;
      } catch (err) {
        failed++;
        logger.warn('[CalendarSync] Failed for connection', {
          connectionId: conn.id,
          userId: conn.user_id,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    if (synced > 0 || failed > 0) {
      logger.info('[CalendarSync] Batch completed', {
        total: connections.rows.length,
        synced,
        failed,
      });
    }
  } catch (error) {
    logger.error('[CalendarSync] Job failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  } finally {
    isRunning = false;
  }
}

export function startCalendarSync() {
  logger.info('[CalendarSync] Starting calendar sync job (every 15 min)');
  intervalId = setInterval(processCalendarSync, JOB_INTERVAL_MS);
  // Run first sync after 2 minutes (give server time to fully start)
  setTimeout(processCalendarSync, 120_000);
}

export function stopCalendarSync() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  logger.info('[CalendarSync] Stopped');
}

export const calendarSyncJob = {
  start: startCalendarSync,
  stop: stopCalendarSync,
  isRunning: () => isRunning,
  processNow: processCalendarSync,
};
