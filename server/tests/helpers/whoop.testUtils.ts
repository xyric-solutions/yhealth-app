/**
 * @file WHOOP Test Utilities
 * @description Reusable test helpers for WHOOP integration tests
 */

import { query } from '../../src/database/pg.js';
import crypto from 'crypto';

/**
 * Creates a test user for WHOOP integration tests
 */
export async function createTestUser(): Promise<string> {
  const userId = crypto.randomUUID();

  await query(`
    INSERT INTO users (
      id, email, password, first_name, last_name, is_email_verified, auth_provider, role_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    userId,
    `test-${userId}@example.com`,
    'hashed-password',
    'Test',
    'User',
    true,
    'local',
    '11111111-1111-1111-1111-111111111101', // Default 'user' role
  ]);

  return userId;
}

/**
 * Creates a test WHOOP integration
 */
export async function createTestWhoopIntegration(
  userId: string,
  options: {
    clientId?: string;
    clientSecret?: string;
    status?: string;
    accessToken?: string;
  } = {}
): Promise<string> {
  const integrationId = crypto.randomUUID();
  const clientId = options.clientId || 'test-client-id';
  const clientSecret = options.clientSecret 
    ? Buffer.from(options.clientSecret).toString('base64')
    : Buffer.from('test-secret').toString('base64');

  await query(`
    INSERT INTO user_integrations (
      id, user_id, provider, client_id, client_secret,
      access_token, status, connected_at
    ) VALUES ($1, $2, 'whoop', $3, $4, $5, $6, CURRENT_TIMESTAMP)
  `, [
    integrationId,
    userId,
    clientId,
    clientSecret,
    options.accessToken || 'test-token',
    options.status || 'active',
  ]);

  return integrationId;
}

/**
 * Creates test health data record
 */
export async function createTestHealthRecord(
  userId: string,
  integrationId: string,
  dataType: 'recovery' | 'sleep' | 'strain',
  value: Record<string, unknown>,
  recordedAt?: Date
): Promise<string> {
  const recordId = crypto.randomUUID();
  const timestamp = recordedAt || new Date();

  await query(`
    INSERT INTO health_data_records (
      id, user_id, integration_id, provider, data_type,
      recorded_at, value, unit, is_golden_source
    ) VALUES ($1, $2, $3, 'whoop', $4, $5, $6, $7, true)
  `, [
    recordId,
    userId,
    integrationId,
    dataType,
    timestamp,
    JSON.stringify(value),
    dataType === 'sleep' ? 'minutes' : 'score',
  ]);

  return recordId;
}

/**
 * Cleans up test data
 */
export async function cleanupTestData(userId: string): Promise<void> {
  // Delete in reverse order of dependencies
  await query(`
    DELETE FROM health_data_records WHERE user_id = $1
  `, [userId]);

  await query(`
    DELETE FROM user_integrations WHERE user_id = $1
  `, [userId]);

  await query(`
    DELETE FROM users WHERE id = $1
  `, [userId]);
}

/**
 * Creates mock WHOOP recovery data
 */
export function createMockRecoveryData(overrides: Partial<any> = {}): any {
  return {
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
      spo2_percentage: 98,
      skin_temp_celsius: 36.5,
      ...overrides.score,
    },
    ...overrides,
  };
}

/**
 * Creates mock WHOOP sleep data
 */
export function createMockSleepData(overrides: Partial<any> = {}): any {
  return {
    id: 'sleep-123',
    user_id: 456,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    start: new Date().toISOString(),
    end: new Date(Date.now() + 28800000).toISOString(),
    timezone_offset: '+00:00',
    nap: false,
    score: {
      stage_summary: {
        total_sleep_time_milli: 28800000,
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
      ...overrides.score,
    },
    ...overrides,
  };
}

/**
 * Creates mock WHOOP workout data
 */
export function createMockWorkoutData(overrides: Partial<any> = {}): any {
  return {
    id: 'workout-123',
    user_id: 456,
    sport_id: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    start: new Date().toISOString(),
    end: new Date(Date.now() + 3600000).toISOString(),
    timezone_offset: '+00:00',
    score: {
      strain: 14.5,
      average_heart_rate: 150,
      max_heart_rate: 180,
      kilojoule: 2000,
      percent_recorded: 95,
    },
    distance_meter: 5000,
    altitude_gain_meter: 100,
    ...overrides,
  };
}

