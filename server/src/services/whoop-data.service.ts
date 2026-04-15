/**
 * @file WHOOP Data Service
 * @description Processes WHOOP webhook payloads, normalizes data, and stores in health_data_records.
 * Supports proper UPSERT deduplication, batch inserts, rate limit handling, and data validation.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { ApiError } from '../utils/ApiError.js';
import {
  normalizeRecoveryData,
  normalizeSleepData,
  normalizeWorkoutData,
  getWhoopAccessToken,
  refreshWhoopToken,
} from './whoop.service.js';
import type { WhoopRecoveryData, WhoopSleepData, WhoopWorkoutData } from './whoop.service.js';
import { dailBalenciaMetricsService } from './daily-health-metrics.service.js';

// WHOOP API v2 base URL
const WHOOP_API_V2_BASE = 'https://api.prod.whoop.com/developer/v2';

// Batch size for multi-row inserts (stay within PG parameter limits)
const BATCH_UPSERT_SIZE = 25;

// ============================================
// TYPES
// ============================================

interface WebhookPayload {
  user_id?: number;
  user_id_string?: string;
  data?: any;
  event_type?: string;
  type?: string;
  timestamp?: string;
}

interface UpsertHealthRecordParams {
  userId: string;
  integrationId: string;
  dataType: string;
  recordedAt: string;
  value: object;
  unit: string;
  rawDataId: string;
}

export interface SyncCounts {
  recovery: number;
  sleep: number;
  workouts: number;
  created: number;
  updated: number;
  skipped: number;
}

// ============================================
// DATA VALIDATION
// ============================================

function validateRecoveryData(data: unknown): data is WhoopRecoveryData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.user_id === 'number' &&
    d.score != null &&
    typeof d.score === 'object' &&
    typeof (d.score as Record<string, unknown>).recovery_score === 'number'
  );
}

function validateSleepData(data: unknown): data is WhoopSleepData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.user_id === 'number' &&
    typeof d.id === 'string' &&
    typeof d.start === 'string' &&
    typeof d.end === 'string' &&
    d.score != null &&
    typeof d.score === 'object'
  );
}

function validateWorkoutData(data: unknown): data is WhoopWorkoutData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.user_id === 'number' &&
    typeof d.id === 'string' &&
    typeof d.start === 'string' &&
    typeof d.end === 'string' &&
    d.score != null &&
    typeof d.score === 'object'
  );
}

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Find user ID from WHOOP user ID
 */
async function findUserIdByWhoopId(whoopUserId: number | string): Promise<string | null> {
  const userIdResult = await query<{ user_id: string }>(
    `SELECT user_id FROM user_integrations
     WHERE provider = 'whoop'
     AND device_info->>'whoop_user_id' = $1
     AND status = 'active'
     LIMIT 1`,
    [String(whoopUserId)]
  );

  if (userIdResult.rows.length > 0) {
    return userIdResult.rows[0].user_id;
  }

  return null;
}

/**
 * Resolve user ID and integration ID for a WHOOP webhook/API record.
 * Returns null if user or integration not found.
 */
async function resolveUserAndIntegration(
  whoopUserId: number | string,
  providedUserId?: string
): Promise<{ userId: string; integrationId: string } | null> {
  let userId = providedUserId;
  if (!userId) {
    const found = await findUserIdByWhoopId(whoopUserId);
    if (!found) {
      logger.warn('[WHOOPDataService] User not found for WHOOP user ID', { whoopUserId });
      return null;
    }
    userId = found;
  }

  const integrationResult = await query<{ id: string }>(
    `SELECT id FROM user_integrations
     WHERE user_id = $1 AND provider = 'whoop' AND status = 'active'
     LIMIT 1`,
    [userId]
  );

  if (integrationResult.rows.length === 0) {
    logger.warn('[WHOOPDataService] Active WHOOP integration not found', { userId });
    return null;
  }

  return { userId, integrationId: integrationResult.rows[0].id };
}

/**
 * Upsert a single health data record.
 * Uses ON CONFLICT with the dedup unique index to prevent duplicates.
 * Returns whether the record was created or updated.
 */
async function upsertHealthRecord(params: UpsertHealthRecordParams): Promise<'created' | 'updated'> {
  const result = await query<{ was_inserted: boolean }>(
    `INSERT INTO health_data_records (
      user_id, integration_id, provider, data_type,
      recorded_at, value, unit, is_golden_source, raw_data_id
    ) VALUES ($1, $2, 'whoop', $3, $4, $5, $6, true, $7)
    ON CONFLICT (user_id, provider, data_type, raw_data_id) WHERE raw_data_id IS NOT NULL
    DO UPDATE SET
      value = EXCLUDED.value,
      recorded_at = EXCLUDED.recorded_at,
      unit = EXCLUDED.unit,
      is_golden_source = EXCLUDED.is_golden_source,
      updated_at = CURRENT_TIMESTAMP
    RETURNING (xmax = 0) AS was_inserted`,
    [
      params.userId,
      params.integrationId,
      params.dataType,
      params.recordedAt,
      JSON.stringify(params.value),
      params.unit,
      params.rawDataId,
    ]
  );

  return result.rows[0]?.was_inserted ? 'created' : 'updated';
}

/**
 * Batch upsert health data records.
 * Returns counts of created, updated, and skipped records.
 */
async function batchUpsertHealthRecords(
  records: Array<{
    userId: string;
    integrationId: string;
    dataType: string;
    recordedAt: string;
    value: object;
    unit: string;
    rawDataId: string;
  }>
): Promise<{ created: number; updated: number; skipped: number }> {
  if (records.length === 0) return { created: 0, updated: 0, skipped: 0 };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Process in batches
  for (let i = 0; i < records.length; i += BATCH_UPSERT_SIZE) {
    const batch = records.slice(i, i + BATCH_UPSERT_SIZE);

    // Build multi-row INSERT
    const values: (string | number | boolean | object | Date | null)[] = [];
    const valuePlaceholders: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const offset = j * 7;
      valuePlaceholders.push(
        `($${offset + 1}, $${offset + 2}, 'whoop', $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, true, $${offset + 7})`
      );
      values.push(
        r.userId,
        r.integrationId,
        r.dataType,
        r.recordedAt,
        JSON.stringify(r.value),
        r.unit,
        r.rawDataId
      );
    }

    const result = await query<{ was_inserted: boolean }>(
      `INSERT INTO health_data_records (
        user_id, integration_id, provider, data_type,
        recorded_at, value, unit, is_golden_source, raw_data_id
      ) VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (user_id, provider, data_type, raw_data_id) WHERE raw_data_id IS NOT NULL
      DO UPDATE SET
        value = EXCLUDED.value,
        recorded_at = EXCLUDED.recorded_at,
        unit = EXCLUDED.unit,
        is_golden_source = EXCLUDED.is_golden_source,
        updated_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS was_inserted`,
      values
    );

    for (const row of result.rows) {
      if (row.was_inserted) created++;
      else updated++;
    }
  }

  return { created, updated, skipped };
}

// ============================================
// WEBHOOK PROCESSORS
// ============================================

/**
 * Process recovery webhook payload or API data
 */
export async function processRecoveryWebhook(payload: WebhookPayload, userId?: string): Promise<'created' | 'updated' | 'skipped'> {
  const recoveryData = payload.data;

  if (!validateRecoveryData(recoveryData)) {
    throw ApiError.badRequest('Invalid recovery data in payload');
  }

  const resolved = await resolveUserAndIntegration(recoveryData.user_id, userId);
  if (!resolved) return 'skipped';

  const normalized = normalizeRecoveryData(recoveryData, resolved.userId);

  const result = await upsertHealthRecord({
    userId: resolved.userId,
    integrationId: resolved.integrationId,
    dataType: 'recovery',
    recordedAt: normalized.timestamp,
    value: normalized,
    unit: 'score',
    rawDataId: normalized.source_record_id,
  });

  logger.info('[WHOOPDataService] Recovery data stored', {
    userId: resolved.userId,
    recoveryScore: normalized.recovery_score,
    timestamp: normalized.timestamp,
    action: result,
  });

  // Update daily health metrics
  try {
    const metricDate = new Date(normalized.timestamp);
    await dailBalenciaMetricsService.updateDailyMetrics(
      resolved.userId,
      metricDate,
      {
        recoveryScore: normalized.recovery_score,
        sleepHours: null,
        strainScore: null,
        cycleDay: null,
      },
      'whoop'
    );
  } catch (metricsError) {
    logger.warn('[WHOOPDataService] Failed to update daily metrics for recovery', {
      userId: resolved.userId,
      error: metricsError instanceof Error ? metricsError.message : 'Unknown error',
    });
  }

  return result;
}

/**
 * Process sleep webhook payload or API data
 */
export async function processSleepWebhook(payload: WebhookPayload, userId?: string): Promise<'created' | 'updated' | 'skipped'> {
  const sleepData = payload.data;

  if (!validateSleepData(sleepData)) {
    throw ApiError.badRequest('Invalid sleep data in payload');
  }

  const resolved = await resolveUserAndIntegration(sleepData.user_id, userId);
  if (!resolved) return 'skipped';

  const normalized = normalizeSleepData(sleepData, resolved.userId);

  const result = await upsertHealthRecord({
    userId: resolved.userId,
    integrationId: resolved.integrationId,
    dataType: 'sleep',
    recordedAt: normalized.start_time,
    value: normalized,
    unit: 'minutes',
    rawDataId: normalized.source_record_id,
  });

  logger.info('[WHOOPDataService] Sleep data stored', {
    userId: resolved.userId,
    durationMinutes: normalized.duration_minutes,
    startTime: normalized.start_time,
    action: result,
  });

  // Trigger proactive message for poor sleep
  const sleepHours = normalized.duration_minutes / 60;
  const sleepQuality = normalized.sleep_quality_score || 0;
  if (sleepHours < 6 || sleepQuality < 60) {
    setImmediate(async () => {
      try {
        const { proactiveMessagingService } = await import('./proactive-messaging.service.js');
        await proactiveMessagingService.checkAndSendSleepMessage(resolved.userId);
      } catch (error) {
        logger.warn('[WHOOPDataService] Error triggering proactive sleep message', {
          userId: resolved.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  // Update daily health metrics
  try {
    const metricDate = new Date(normalized.start_time);
    await dailBalenciaMetricsService.updateDailyMetrics(
      resolved.userId,
      metricDate,
      {
        sleepHours: normalized.duration_minutes / 60,
        recoveryScore: null,
        strainScore: null,
        cycleDay: null,
      },
      'whoop'
    );
  } catch (metricsError) {
    logger.warn('[WHOOPDataService] Failed to update daily metrics for sleep', {
      userId: resolved.userId,
      error: metricsError instanceof Error ? metricsError.message : 'Unknown error',
    });
  }

  return result;
}

/**
 * Process workout webhook payload or API data
 */
export async function processWorkoutWebhook(payload: WebhookPayload, userId?: string): Promise<'created' | 'updated' | 'skipped'> {
  const workoutData = payload.data;

  if (!validateWorkoutData(workoutData)) {
    throw ApiError.badRequest('Invalid workout data in payload');
  }

  const resolved = await resolveUserAndIntegration(workoutData.user_id, userId);
  if (!resolved) return 'skipped';

  const normalized = normalizeWorkoutData(workoutData, resolved.userId);

  const result = await upsertHealthRecord({
    userId: resolved.userId,
    integrationId: resolved.integrationId,
    dataType: 'strain',
    recordedAt: normalized.start_time,
    value: normalized,
    unit: 'score',
    rawDataId: normalized.source_record_id,
  });

  logger.info('[WHOOPDataService] Workout data stored', {
    userId: resolved.userId,
    strainScore: normalized.strain_score,
    startTime: normalized.start_time,
    action: result,
  });

  // Update daily health metrics (aggregate strain for the day)
  try {
    const metricDate = new Date(normalized.start_time);
    const existing = await dailBalenciaMetricsService.getDailyMetricsHistory(
      resolved.userId,
      metricDate,
      metricDate
    );

    const existingForDate = existing.find(
      (m) => m.metricDate.toISOString().split('T')[0] === metricDate.toISOString().split('T')[0]
    );

    const maxStrain = existingForDate?.strainScore
      ? Math.max(existingForDate.strainScore, normalized.strain_score)
      : normalized.strain_score;

    await dailBalenciaMetricsService.updateDailyMetrics(
      resolved.userId,
      metricDate,
      {
        strainScore: maxStrain,
        sleepHours: existingForDate?.sleepHours ?? null,
        recoveryScore: existingForDate?.recoveryScore ?? null,
        cycleDay: existingForDate?.cycleDay ?? null,
      },
      'whoop'
    );
  } catch (metricsError) {
    logger.warn('[WHOOPDataService] Failed to update daily metrics for workout', {
      userId: resolved.userId,
      error: metricsError instanceof Error ? metricsError.message : 'Unknown error',
    });
  }

  return result;
}

/**
 * Process cycle webhook payload
 */
export async function processCycleWebhook(payload: WebhookPayload): Promise<void> {
  const cycleData = payload.data;

  if (!cycleData || !cycleData.user_id) {
    throw ApiError.badRequest('Invalid cycle data in webhook payload');
  }

  logger.info('[WHOOPDataService] Cycle webhook received', {
    whoopUserId: cycleData.user_id,
    note: 'Cycle data processing - implement as needed',
  });

  // TODO: Implement cycle data processing if needed
  // Cycles are 24-hour physiological cycles tracked by WHOOP
}

// ============================================
// API FETCH HELPERS
// ============================================

/**
 * Helper function to fetch with automatic token refresh on 401 and rate limit handling on 429
 */
async function fetchWithAuthRetry(
  url: string,
  userId: string,
  currentToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const makeRequest = async (token: string): Promise<Response> => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  let response = await makeRequest(currentToken);

  // Handle rate limiting (429)
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    logger.warn('[WHOOPDataService] Rate limited by WHOOP API', { userId, retryAfterSeconds: retryAfter });
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    response = await makeRequest(currentToken);

    // If still 429 after waiting, return the response (caller handles)
    if (response.status === 429) {
      logger.error('[WHOOPDataService] Still rate limited after retry', { userId });
      return response;
    }
  }

  // If 401, try refreshing token and retry once
  if (response.status === 401) {
    logger.debug('[WHOOPDataService] 401 Unauthorized, attempting token refresh', { userId });

    try {
      const integrationResult = await query<{
        refresh_token: string | null;
        client_id: string | null;
        client_secret: string | null;
        scopes: string[] | null;
        status: string;
      }>(
        `SELECT refresh_token, client_id, client_secret, scopes, status
         FROM user_integrations
         WHERE user_id = $1 AND provider = 'whoop'`,
        [userId]
      );

      if (integrationResult.rows.length === 0) {
        logger.error('[WHOOPDataService] No integration found for token refresh', { userId });
        return response;
      }

      const integration = integrationResult.rows[0];

      if (integration.status === 'error' || integration.status === 'disconnected') {
        logger.error('[WHOOPDataService] Integration in error state - cannot refresh token', {
          userId,
          status: integration.status,
        });
        throw new Error('WHOOP_INTEGRATION_ERROR: Integration is in error state. Please reconnect your account.');
      }

      if (!integration.refresh_token || integration.refresh_token.trim().length === 0) {
        logger.error('[WHOOPDataService] No valid refresh token available', { userId });
        return response;
      }

      // Get credentials (per-user or from env)
      let clientId = integration.client_id;
      let clientSecret = integration.client_secret;

      if (!clientId || !clientSecret) {
        clientId = process.env.WHOOP_CLIENT_ID || null;
        clientSecret = process.env.WHOOP_CLIENT_SECRET || null;
        logger.debug('[WHOOPDataService] Using environment credentials for token refresh', { userId });
      }

      if (!clientId || !clientSecret) {
        logger.error('[WHOOPDataService] Missing credentials for token refresh', { userId });
        return response;
      }

      const { env } = await import('../config/env.config.js');
      const redirectUri = `${env.client.url}/auth/whoop/callback`;

      const newTokens = await refreshWhoopToken(
        integration.refresh_token,
        clientId,
        clientSecret,
        userId,
        redirectUri
      );

      // Update stored tokens
      await query(
        `UPDATE user_integrations
         SET access_token = $1, refresh_token = $2, token_expiry = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4 AND provider = 'whoop'`,
        [
          newTokens.accessToken,
          newTokens.refreshToken || integration.refresh_token,
          newTokens.expiresAt ? newTokens.expiresAt : null,
          userId,
        ]
      );

      logger.debug('[WHOOPDataService] Token refreshed after 401, retrying request', { userId });
      response = await makeRequest(newTokens.accessToken);
    } catch (refreshError) {
      const errorMessage = refreshError instanceof Error ? refreshError.message : 'Unknown error';
      const isClientIdMismatch = errorMessage.includes('credentials have changed') ||
                                 errorMessage.includes('Client ID') ||
                                 errorMessage.includes('does not match');

      logger.error('[WHOOPDataService] Token refresh failed after 401', {
        userId,
        error: errorMessage,
        isClientIdMismatch,
      });

      if (isClientIdMismatch) {
        try {
          await query(
            `UPDATE user_integrations
             SET access_token = NULL, refresh_token = NULL, token_expiry = NULL,
                 status = 'pending', last_sync_error = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND provider = 'whoop'`,
            [userId]
          );
          logger.warn('[WHOOPDataService] WHOOP tokens cleared due to client_id mismatch', {
            userId,
            action: 'User must reconnect WHOOP',
          });
        } catch (updateError) {
          logger.error('[WHOOPDataService] Failed to clear tokens after client_id mismatch', {
            userId,
            error: updateError instanceof Error ? updateError.message : 'Unknown error',
          });
        }
        throw new Error('WHOOP_INTEGRATION_ERROR: WHOOP credentials have changed. Your tokens have been cleared. Please click "Connect WHOOP" to reconnect with your current credentials.');
      }
    }
  }

  return response;
}

/**
 * Determine if an error is retryable (transient)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network errors
    if (msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('enotfound')) {
      return true;
    }
    // Rate limit or server errors encoded in message
    if (msg.includes('429') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      return true;
    }
    // Non-retryable: auth errors, integration errors
    if (msg.includes('whoop_integration_error')) return false;
  }
  return false;
}

// ============================================
// PAGINATED API FETCH
// ============================================

/**
 * Fetch all pages from a WHOOP API endpoint
 */
async function fetchAllPages(
  baseUrl: string,
  userId: string,
  accessToken: string,
  startISO: string,
  endISO: string,
  dataTypeName: string
): Promise<{ records: unknown[]; accessToken: string }> {
  let nextToken: string | null = null;
  const allRecords: unknown[] = [];
  let currentToken = accessToken;

  do {
    const params = new URLSearchParams({
      start: startISO,
      end: endISO,
      limit: '25',
    });
    if (nextToken) {
      params.set('nextToken', nextToken);
    }

    const url = `${baseUrl}?${params.toString()}`;

    let response: Response;
    try {
      response = await fetchWithAuthRetry(url, userId, currentToken);
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.message.includes('WHOOP_INTEGRATION_ERROR')) {
        throw fetchError;
      }
      throw fetchError;
    }

    // Check for integration error state after 401
    if (response.status === 401) {
      const errorCheck = await query<{ status: string }>(
        `SELECT status FROM user_integrations WHERE user_id = $1 AND provider = 'whoop'`,
        [userId]
      );
      if (errorCheck.rows.length > 0 && errorCheck.rows[0].status === 'error') {
        throw new Error('WHOOP_INTEGRATION_ERROR: Integration marked as error. Please reconnect your account.');
      }
      throw new Error('WHOOP_INTEGRATION_ERROR: Unable to authenticate with WHOOP. Please reconnect your account.');
    }

    // Rate limited even after retry in fetchWithAuthRetry
    if (response.status === 429) {
      logger.warn(`[WHOOPDataService] ${dataTypeName} API still rate limited, stopping pagination`, { userId });
      break;
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`[WHOOPDataService] ${dataTypeName} API returned non-OK status`, {
        userId,
        status: response.status,
        error: errorText.substring(0, 200),
      });
      break;
    }

    // Update token if it was refreshed
    try {
      const newToken = await getWhoopAccessToken(userId);
      if (newToken !== currentToken) {
        currentToken = newToken;
      }
    } catch {
      // Token check failure is non-fatal
    }

    const responseText = await response.text();
    let parsed: { records?: unknown[]; next_token?: string };
    try {
      parsed = JSON.parse(responseText) as { records?: unknown[]; next_token?: string };
    } catch (parseError) {
      logger.error(`[WHOOPDataService] Failed to parse ${dataTypeName} response`, {
        userId,
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
      });
      break;
    }

    const records = parsed.records || [];
    allRecords.push(...records);
    nextToken = parsed.next_token || null;

    logger.debug(`[WHOOPDataService] Fetched ${dataTypeName} page`, {
      userId,
      pageCount: records.length,
      totalSoFar: allRecords.length,
      hasNextPage: !!nextToken,
    });
  } while (nextToken);

  return { records: allRecords, accessToken: currentToken };
}

// ============================================
// HISTORICAL DATA FETCH
// ============================================

/**
 * Fetch historical data from WHOOP API with batch upserts
 */
export async function fetchHistoricalData(
  userId: string,
  days: number = 90
): Promise<SyncCounts> {
  const startTime = Date.now();

  logger.info('[WHOOPDataService] Starting historical data sync', { userId, days });

  try {
    let accessToken = await getWhoopAccessToken(userId);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let recoveryCount = 0;
    let sleepCount = 0;
    let workoutCount = 0;

    // Check integration status before starting
    const statusCheck = await query<{ status: string; last_sync_error: string | null; access_token: string | null }>(
      `SELECT status, last_sync_error, access_token
       FROM user_integrations
       WHERE user_id = $1 AND provider = 'whoop'`,
      [userId]
    );

    if (statusCheck.rows.length > 0) {
      const integration = statusCheck.rows[0];
      if (integration.status === 'error') {
        const errorMessage = integration.last_sync_error ||
          'WHOOP integration is in an error state. Please disconnect and reconnect your WHOOP account.';

        const isCredentialsMismatch = errorMessage.includes('credentials have changed') ||
                                       errorMessage.includes('Client ID') ||
                                       errorMessage.includes('does not match');

        if (isCredentialsMismatch && integration.access_token) {
          await query(
            `UPDATE user_integrations SET
             access_token = NULL, refresh_token = NULL, token_expiry = NULL,
             status = 'pending', last_sync_error = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND provider = 'whoop'`,
            [userId]
          );
          throw new Error('WHOOP credentials have changed. Your tokens have been cleared. Please click "Connect WHOOP" to reconnect with your current credentials.');
        }

        logger.error('[WHOOPDataService] Cannot sync - integration is in error state', {
          userId,
          status: integration.status,
          error: integration.last_sync_error,
        });
        throw new Error(errorMessage);
      }
    }

    // Get integration ID for batch inserts
    const integrationResult = await query<{ id: string }>(
      `SELECT id FROM user_integrations
       WHERE user_id = $1 AND provider = 'whoop' AND status = 'active' LIMIT 1`,
      [userId]
    );

    if (integrationResult.rows.length === 0) {
      throw new Error('No active WHOOP integration found');
    }
    const integrationId = integrationResult.rows[0].id;

    // ---- Fetch Recovery Data ----
    try {
      const recoveryResult = await fetchAllPages(
        `${WHOOP_API_V2_BASE}/recovery`,
        userId, accessToken, startISO, endISO, 'Recovery'
      );
      accessToken = recoveryResult.accessToken;
      recoveryCount = recoveryResult.records.length;

      // Validate and normalize records, then batch upsert
      const validRecoveryRecords = recoveryResult.records
        .filter(r => validateRecoveryData(r))
        .map(r => {
          const normalized = normalizeRecoveryData(r as WhoopRecoveryData, userId);
          return {
            userId,
            integrationId,
            dataType: 'recovery',
            recordedAt: normalized.timestamp,
            value: normalized as object,
            unit: 'score',
            rawDataId: normalized.source_record_id,
          };
        });

      const invalidCount = recoveryCount - validRecoveryRecords.length;
      if (invalidCount > 0) {
        logger.warn('[WHOOPDataService] Skipped invalid recovery records', { userId, invalidCount });
      }

      const counts = await batchUpsertHealthRecords(validRecoveryRecords);
      totalCreated += counts.created;
      totalUpdated += counts.updated;
      totalSkipped += invalidCount;

      logger.info('[WHOOPDataService] Recovery sync complete', {
        userId, fetched: recoveryCount, created: counts.created, updated: counts.updated, skipped: invalidCount,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('WHOOP_INTEGRATION_ERROR')) throw error;
      logger.error('[WHOOPDataService] Error fetching recovery data', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ---- Fetch Sleep Data ----
    try {
      const sleepResult = await fetchAllPages(
        `${WHOOP_API_V2_BASE}/activity/sleep`,
        userId, accessToken, startISO, endISO, 'Sleep'
      );
      accessToken = sleepResult.accessToken;
      sleepCount = sleepResult.records.length;

      const validSleepRecords = sleepResult.records
        .filter(r => validateSleepData(r))
        .map(r => {
          const normalized = normalizeSleepData(r as WhoopSleepData, userId);
          return {
            userId,
            integrationId,
            dataType: 'sleep',
            recordedAt: normalized.start_time,
            value: normalized as object,
            unit: 'minutes',
            rawDataId: normalized.source_record_id,
          };
        });

      const invalidCount = sleepCount - validSleepRecords.length;
      if (invalidCount > 0) {
        logger.warn('[WHOOPDataService] Skipped invalid sleep records', { userId, invalidCount });
      }

      const counts = await batchUpsertHealthRecords(validSleepRecords);
      totalCreated += counts.created;
      totalUpdated += counts.updated;
      totalSkipped += invalidCount;

      logger.info('[WHOOPDataService] Sleep sync complete', {
        userId, fetched: sleepCount, created: counts.created, updated: counts.updated, skipped: invalidCount,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('WHOOP_INTEGRATION_ERROR')) throw error;
      logger.error('[WHOOPDataService] Error fetching sleep data', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ---- Fetch Workout Data ----
    try {
      const workoutResult = await fetchAllPages(
        `${WHOOP_API_V2_BASE}/activity/workout`,
        userId, accessToken, startISO, endISO, 'Workout'
      );
      accessToken = workoutResult.accessToken;
      workoutCount = workoutResult.records.length;

      const validWorkoutRecords = workoutResult.records
        .filter(r => validateWorkoutData(r))
        .map(r => {
          const normalized = normalizeWorkoutData(r as WhoopWorkoutData, userId);
          return {
            userId,
            integrationId,
            dataType: 'strain',
            recordedAt: normalized.start_time,
            value: normalized as object,
            unit: 'score',
            rawDataId: normalized.source_record_id,
          };
        });

      const invalidCount = workoutCount - validWorkoutRecords.length;
      if (invalidCount > 0) {
        logger.warn('[WHOOPDataService] Skipped invalid workout records', { userId, invalidCount });
      }

      const counts = await batchUpsertHealthRecords(validWorkoutRecords);
      totalCreated += counts.created;
      totalUpdated += counts.updated;
      totalSkipped += invalidCount;

      logger.info('[WHOOPDataService] Workout sync complete', {
        userId, fetched: workoutCount, created: counts.created, updated: counts.updated, skipped: invalidCount,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('WHOOP_INTEGRATION_ERROR')) throw error;
      logger.error('[WHOOPDataService] Error fetching workout data', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    const duration = Date.now() - startTime;
    const totalRecords = recoveryCount + sleepCount + workoutCount;

    logger.info('[WHOOPDataService] Historical data sync completed', {
      userId,
      recoveryCount,
      sleepCount,
      workoutCount,
      totalRecords,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      durationMs: duration,
    });

    // Update daily metrics for today's data
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const latestRecovery = await query<{ value: any }>(
        `SELECT value FROM health_data_records
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
         AND recorded_at >= $2
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, today]
      );

      const latestSleep = await query<{ value: any }>(
        `SELECT value FROM health_data_records
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'sleep'
         AND recorded_at >= $2
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, today]
      );

      const todayStrain = await query<{ value: any }>(
        `SELECT value FROM health_data_records
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'strain'
         AND recorded_at >= $2
         ORDER BY (value->>'strain_score')::numeric DESC LIMIT 1`,
        [userId, today]
      );

      if (latestRecovery.rows[0] || latestSleep.rows[0] || todayStrain.rows[0]) {
        const recoveryData = latestRecovery.rows[0]?.value;
        const sleepData = latestSleep.rows[0]?.value;
        const strainData = todayStrain.rows[0]?.value;

        await dailBalenciaMetricsService.updateDailyMetrics(
          userId,
          today,
          {
            recoveryScore: recoveryData?.recovery_score ?? null,
            sleepHours: sleepData?.duration_minutes
              ? parseFloat((sleepData.duration_minutes / 60).toFixed(2))
              : null,
            strainScore: strainData?.strain_score ?? null,
            cycleDay: null,
          },
          'whoop'
        );
      }
    } catch (metricsError) {
      logger.warn('[WHOOPDataService] Failed to update daily metrics after historical sync', {
        userId,
        error: metricsError instanceof Error ? metricsError.message : 'Unknown error',
      });
    }

    return {
      recovery: recoveryCount,
      sleep: sleepCount,
      workouts: workoutCount,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[WHOOPDataService] Historical data sync failed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });
    throw error;
  }
}

export const whoopDataService = {
  processRecoveryWebhook,
  processSleepWebhook,
  processWorkoutWebhook,
  processCycleWebhook,
  fetchHistoricalData,
};
