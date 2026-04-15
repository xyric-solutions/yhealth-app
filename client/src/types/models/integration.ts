/**
 * @file Integration domain models
 */

export type IntegrationType = 'wearable' | 'app' | 'platform';

export type IntegrationProvider =
  | 'apple_health'
  | 'google_fit'
  | 'fitbit'
  | 'garmin'
  | 'strava'
  | 'whoop'
  | 'oura'
  | 'myfitnesspal';

export interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  icon: string;
  connected: boolean;
  lastSync?: Date;
  dataTypes: string[];
  provider?: IntegrationProvider;
}

export interface IntegrationConnection {
  integrationId: string;
  userId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  connectedAt: string;
  lastSyncAt?: string;
  syncStatus: 'active' | 'error' | 'pending';
}
