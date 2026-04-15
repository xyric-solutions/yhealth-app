/**
 * @file WHOOP Integration Tests
 * @description Integration tests with real dependencies (20% of test pyramid)
 * - Tests actual database interactions
 * - Validates end-to-end flows
 * - Uses controlled test data
 */

import { jest } from '@jest/globals';

// Mock implementations — defined as plain functions so they survive resetMocks
function recoveryNormalizer(data: any, userId: string) {
  return {
    user_id: userId,
    provider: 'whoop',
    entity_type: 'recovery',
    source_record_id: data.cycle_id || 'unknown',
    timestamp: data.created_at || new Date().toISOString(),
    recovery_score: data.score?.recovery_score,
    hrv_rmssd_ms: data.score?.hrv_rmssd_milli,
    resting_heart_rate_bpm: data.score?.resting_heart_rate,
    spo2_percent: data.score?.spo2_percentage,
    skin_temp_celsius: data.score?.skin_temp_celsius,
    calibrating: data.score?.user_calibrating ?? false,
    related_sleep_id: data.sleep_id || '',
  };
}

function sleepNormalizer(data: any, userId: string) {
  const stageSummary = data.score?.stage_summary;
  return {
    user_id: userId,
    provider: 'whoop',
    entity_type: 'sleep',
    source_record_id: data.id || 'unknown',
    start_time: data.start || data.created_at || new Date().toISOString(),
    end_time: data.end || new Date().toISOString(),
    duration_minutes: stageSummary
      ? Math.round(stageSummary.total_sleep_time_milli / 60000)
      : 0,
    sleep_quality_score: data.score?.sleep_performance_percentage ?? 0,
    sleep_efficiency_percent: data.score?.sleep_efficiency_percentage ?? 0,
    sleep_consistency_percent: data.score?.sleep_consistency_percentage ?? 0,
    stages: {
      awake_minutes: stageSummary ? Math.round(stageSummary.total_awake_time_milli / 60000) : 0,
      light_minutes: stageSummary ? Math.round(stageSummary.total_light_sleep_time_milli / 60000) : 0,
      deep_minutes: stageSummary ? Math.round(stageSummary.total_slow_wave_sleep_time_milli / 60000) : 0,
      rem_minutes: stageSummary ? Math.round(stageSummary.total_rem_sleep_time_milli / 60000) : 0,
      no_data_minutes: stageSummary ? Math.round(stageSummary.total_no_data_time_milli / 60000) : 0,
    },
    respiratory_rate_bpm: data.score?.respiratory_rate ?? 0,
    sleep_need_minutes: data.score?.sleep_needed?.baseline_milli
      ? Math.round(data.score.sleep_needed.baseline_milli / 60000)
      : 0,
    sleep_debt_minutes: data.score?.sleep_needed?.need_from_sleep_debt_milli
      ? Math.round(data.score.sleep_needed.need_from_sleep_debt_milli / 60000)
      : 0,
    is_nap: data.nap ?? false,
    timezone_offset: data.timezone_offset || '+00:00',
  };
}

const mockGetWhoopAccessToken = jest.fn();
const mockNormalizeRecoveryData = jest.fn<typeof recoveryNormalizer>();
const mockNormalizeSleepData = jest.fn<typeof sleepNormalizer>();
const mockNormalizeWorkoutData = jest.fn();
const mockRefreshWhoopToken = jest.fn();

// Mock external API calls but use real database
jest.unstable_mockModule('../../src/services/whoop.service.js', () => ({
  getWhoopAccessToken: mockGetWhoopAccessToken,
  normalizeRecoveryData: mockNormalizeRecoveryData,
  normalizeSleepData: mockNormalizeSleepData,
  normalizeWorkoutData: mockNormalizeWorkoutData,
  refreshWhoopToken: mockRefreshWhoopToken,
}));

jest.unstable_mockModule('../../src/services/logger.service.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { whoopDataService } = await import('../../src/services/whoop-data.service.js');
const { whoopAnalyticsService } = await import('../../src/services/whoop-analytics.service.js');
const { query } = await import('../../src/database/pg.js');
const { createTestUser, cleanupTestData } = await import('../helpers/whoop.testUtils.js');

describe('WHOOP Integration Tests', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Re-attach implementations after resetMocks clears them
    mockNormalizeRecoveryData.mockImplementation(recoveryNormalizer);
    mockNormalizeSleepData.mockImplementation(sleepNormalizer);
    testUserId = await createTestUser();
  });

  afterEach(async () => {
    await cleanupTestData(testUserId);
  });

  describe('WHOOP Data Service Integration', () => {
    test('processes recovery webhook and stores in database', async () => {
      // Create integration record
      await query(`
        INSERT INTO user_integrations (
          user_id, provider, access_token, status, client_id, device_info
        ) VALUES ($1, 'whoop', 'token', 'active', 'client-id', $2)
      `, [testUserId, JSON.stringify({ whoop_user_id: '789' })]);

      const integrationResult = await query(`
        SELECT id FROM user_integrations
        WHERE user_id = $1 AND provider = 'whoop'
      `, [testUserId]);
      const _integrationId = integrationResult.rows[0].id;

      const recoveryPayload = {
        data: {
          cycle_id: 'cycle-123',
          sleep_id: 'sleep-456',
          user_id: 789,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          score: {
            user_calibrating: false,
            recovery_score: 85,
            resting_heart_rate: 55,
            hrv_rmssd_milli: 45,
          },
        },
      };

      await whoopDataService.processRecoveryWebhook(recoveryPayload);

      // Verify data was stored
      const storedData = await query(`
        SELECT * FROM health_data_records
        WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
      `, [testUserId]);

      expect(storedData.rows.length).toBeGreaterThan(0);
      const record = storedData.rows[0];
      expect(record.provider).toBe('whoop');
      expect(record.data_type).toBe('recovery');
      expect(record.is_golden_source).toBe(true);

      // value is stored via JSON.stringify but PG returns it parsed (JSONB) or as string (TEXT)
      const value = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
      expect(value.recovery_score).toBe(85);
      expect(value.hrv_rmssd_ms).toBe(45);
    });

    test('processes sleep webhook and stores normalized data', async () => {
      await query(`
        INSERT INTO user_integrations (
          user_id, provider, access_token, status, device_info
        ) VALUES ($1, 'whoop', 'token', 'active', $2)
      `, [testUserId, JSON.stringify({ whoop_user_id: '456' })]);

      const sleepPayload = {
        data: {
          id: 'sleep-123',
          user_id: 456,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          start: new Date().toISOString(),
          end: new Date(Date.now() + 28800000).toISOString(), // 8 hours later
          timezone_offset: '+00:00',
          nap: false,
          score: {
            stage_summary: {
              total_sleep_time_milli: 28800000, // 8 hours
              total_awake_time_milli: 0,
              total_no_data_time_milli: 0,
              total_light_sleep_time_milli: 14400000,
              total_slow_wave_sleep_time_milli: 7200000,
              total_rem_sleep_time_milli: 7200000,
            },
            sleep_efficiency_percentage: 100,
            sleep_consistency_percentage: 100,
            sleep_performance_percentage: 95,
            respiratory_rate: 14,
            sleep_needed: {
              baseline_milli: 28800000,
              need_from_sleep_debt_milli: 0,
              need_from_recent_strain_milli: 0,
              need_from_recent_nap_milli: 0,
            },
          },
        },
      };

      await whoopDataService.processSleepWebhook(sleepPayload);

      const storedData = await query(`
        SELECT * FROM health_data_records
        WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'sleep'
      `, [testUserId]);

      expect(storedData.rows.length).toBeGreaterThan(0);
      const raw = storedData.rows[0].value;
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      expect(value.duration_minutes).toBe(480); // 8 hours
      expect(value.stages.deep_minutes).toBe(120); // 2 hours
    });
  });

  describe('WHOOP Analytics Service Integration', () => {
    beforeEach(async () => {
      // Create integration
      await query(`
        INSERT INTO user_integrations (
          user_id, provider, access_token, status, device_info
        ) VALUES ($1, 'whoop', 'token', 'active', $2)
      `, [testUserId, JSON.stringify({ whoop_user_id: '0' })]);

      const integrationResult = await query(`
        SELECT id FROM user_integrations 
        WHERE user_id = $1 AND provider = 'whoop'
      `, [testUserId]);
      const integrationId = integrationResult.rows[0].id;

      // Insert test recovery data
      await query(`
        INSERT INTO health_data_records (
          user_id, integration_id, provider, data_type,
          recorded_at, value, unit, is_golden_source
        ) VALUES (
          $1, $2, 'whoop', 'recovery',
          CURRENT_TIMESTAMP - INTERVAL '1 day',
          $3, 'score', true
        )
      `, [
        testUserId,
        integrationId,
        JSON.stringify({
          recovery_score: 85,
          hrv_rmssd_ms: 45,
          resting_heart_rate_bpm: 55,
        }),
      ]);

      // Insert test sleep data
      await query(`
        INSERT INTO health_data_records (
          user_id, integration_id, provider, data_type,
          recorded_at, value, unit, is_golden_source
        ) VALUES (
          $1, $2, 'whoop', 'sleep',
          CURRENT_TIMESTAMP - INTERVAL '1 day',
          $3, 'minutes', true
        )
      `, [
        testUserId,
        integrationId,
        JSON.stringify({
          duration_minutes: 480,
          sleep_quality_score: 95,
          sleep_efficiency_percent: 100,
        }),
      ]);
    });

    test('retrieves WHOOP overview with real data', async () => {
      const overview = await whoopAnalyticsService.getWhoopOverview(testUserId);

      expect(overview).toBeDefined();
      expect(overview.currentRecovery).toBeDefined();
      expect(overview.currentRecovery?.score).toBe(85);
      expect(overview.currentSleep).toBeDefined();
      expect(overview.currentSleep?.duration).toBe(480);
    });

    test('retrieves recovery trends for date range', async () => {
      const trends = await whoopAnalyticsService.getRecoveryTrends(testUserId, 7);

      expect(Array.isArray(trends)).toBe(true);
      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0]).toHaveProperty('date');
      expect(trends[0]).toHaveProperty('recovery_score');
      expect(trends[0].recovery_score).toBe(85);
    });
  });

  describe('End-to-End WHOOP Flow', () => {
    test('complete flow: webhook -> storage -> analytics', async () => {
      // Setup integration
      await query(`
        INSERT INTO user_integrations (
          user_id, provider, access_token, status, client_id, device_info
        ) VALUES ($1, 'whoop', 'token', 'active', 'client-id', $2)
      `, [testUserId, JSON.stringify({ whoop_user_id: '999' })]);

      // Process webhook
      const recoveryPayload = {
        data: {
          cycle_id: 'cycle-e2e',
          sleep_id: 'sleep-e2e',
          user_id: 999,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          score: {
            user_calibrating: false,
            recovery_score: 90,
            resting_heart_rate: 50,
            hrv_rmssd_milli: 50,
          },
        },
      };

      await whoopDataService.processRecoveryWebhook(recoveryPayload);

      // Verify storage
      const stored = await query(`
        SELECT * FROM health_data_records
        WHERE user_id = $1 AND provider = 'whoop'
        ORDER BY recorded_at DESC LIMIT 1
      `, [testUserId]);

      expect(stored.rows.length).toBe(1);

      // Verify analytics can retrieve it
      const overview = await whoopAnalyticsService.getWhoopOverview(testUserId);
      expect(overview.currentRecovery?.score).toBe(90);
    });
  });
});

