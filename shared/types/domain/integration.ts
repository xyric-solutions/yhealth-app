/**
 * @file Integration domain types
 * @description Single source of truth for integration-related types
 */

export type IntegrationProvider =
  | 'whoop'
  | 'apple_health'
  | 'fitbit'
  | 'garmin'
  | 'oura'
  | 'samsung_health'
  | 'myfitnesspal'
  | 'nutritionix'
  | 'cronometer'
  | 'strava';

export type SyncStatus = 'active' | 'paused' | 'error' | 'disconnected' | 'pending';

export type DataType =
  | 'heart_rate'
  | 'hrv'
  | 'sleep'
  | 'steps'
  | 'workouts'
  | 'calories'
  | 'nutrition'
  | 'strain'
  | 'recovery'
  | 'body_temp'
  | 'vo2_max'
  | 'training_load'
  | 'gps_activities';

export interface Integration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  status: SyncStatus;
  connectedAt: string;
  lastSyncAt?: string;
  dataTypes: DataType[];
  metadata?: Record<string, unknown>;
}
