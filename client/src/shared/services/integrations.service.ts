/**
 * @file Integrations API Service
 * @description Centralized API calls for integrations-related operations
 */

import { api } from '@/lib/api-client';

// Response Types
export interface IntegrationsListResponse {
  integrations: Array<{
    id: string;
    name: string;
    type: string;
    connected: boolean;
    dataTypes: string[];
  }>;
}

export interface IntegrationConnectResponse {
  authUrl?: string;
  connected: boolean;
}

/**
 * Integrations Service - handles all integrations API operations
 */
export const integrationsService = {
  /**
   * Get all available integrations
   */
  getAvailable: () => api.get<IntegrationsListResponse>('/integrations'),

  /**
   * Connect to an integration (initiates OAuth or direct connect)
   */
  connect: (integrationId: string) =>
    api.post<IntegrationConnectResponse>(
      `/integrations/${integrationId}/connect`,
      {}
    ),

  /**
   * Disconnect from an integration
   */
  disconnect: (integrationId: string) =>
    api.post<{ disconnected: boolean }>(
      `/integrations/${integrationId}/disconnect`,
      {}
    ),

  /**
   * Complete the integrations onboarding step
   */
  completeStep: () =>
    api.post<{ nextStep: string }>('/integrations/complete', {}),

  /**
   * Sync data from an integration
   */
  sync: (integrationId: string) =>
    api.post<{ synced: boolean; lastSyncAt: string }>(
      `/integrations/${integrationId}/sync`,
      {}
    ),
};
