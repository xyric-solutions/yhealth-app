/**
 * @file Preferences API Service
 * @description Centralized API calls for preferences-related operations
 */

import { api } from '@/lib/api-client';
import type { Preferences } from '@/src/types';

// Response Types
export interface CoachingStylesResponse {
  styles: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>;
  intensities: Array<{
    id: string;
    name: string;
    description: string;
    checkInsPerWeek: number;
  }>;
  channels: Array<{
    id: string;
    name: string;
    icon: string;
  }>;
}

/**
 * Preferences Service - handles all preferences API operations
 */
export const preferencesService = {
  /**
   * Get available coaching style options
   */
  getCoachingStyles: () =>
    api.get<CoachingStylesResponse>('/preferences/coaching/styles'),

  /**
   * Get current user preferences
   */
  get: () => api.get<{ preferences: Preferences }>('/preferences'),

  /**
   * Update user preferences
   */
  update: (preferences: Partial<Preferences>) =>
    api.patch<{ preferences: Preferences }>('/preferences', {
      coaching: {
        style: preferences.coachingStyle,
        intensity: preferences.coachingIntensity,
        preferredChannel: preferences.preferredChannel,
        checkInFrequency: preferences.checkInFrequency,
        preferredCheckInTime: preferences.preferredCheckInTime,
        timezone: preferences.timezone,
        aiPersonality: preferences.aiPersonality,
      },
      notifications: {
        quietHours: preferences.quietHours,
      },
    }),

  /**
   * Complete the preferences onboarding step
   */
  completeStep: () =>
    api.post<{ nextStep: string }>('/preferences/complete', {}),
};
