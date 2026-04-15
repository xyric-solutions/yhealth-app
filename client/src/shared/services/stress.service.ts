/**
 * Stress Service
 * Client-side service for stress logging operations
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export type StressTrigger =
  | 'Work'
  | 'Relationships'
  | 'Finances'
  | 'Health'
  | 'Family'
  | 'Uncertainty'
  | 'Time pressure'
  | 'Conflict'
  | 'Other';

export type CheckInType = 'daily' | 'on_demand';

export interface StressLog {
  id: string;
  userId: string;
  stressRating: number; // 1-10
  triggers: StressTrigger[];
  otherTrigger?: string;
  note?: string;
  checkInType: CheckInType;
  clientRequestId: string;
  loggedAt: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export interface CreateStressLogInput {
  stressRating: number;
  triggers?: StressTrigger[];
  otherTrigger?: string;
  note?: string;
  checkInType: CheckInType;
  clientRequestId: string;
  loggedAt?: string; // Optional, defaults to now
}

export interface StressSummary {
  date: string;
  dailyAvg: number;
  dailyMax: number;
  logsCount: number;
  topTriggers: Array<{ trigger: StressTrigger; count: number }>;
}

export interface ExtremeStressStatus {
  hasExtremeStreak: boolean;
  consecutiveDays: number;
  startDate: string;
}

// ============================================================================
// Service
// ============================================================================

class StressService {
  /**
   * Create a stress log
   */
  async createLog(input: CreateStressLogInput): Promise<{ success: boolean; data?: StressLog; error?: unknown }> {
    try {
      // Transform camelCase to snake_case for backend API
      const requestBody = {
        stress_rating: input.stressRating,
        triggers: input.triggers,
        other_trigger: input.otherTrigger,
        note: input.note,
        check_in_type: input.checkInType,
        client_request_id: input.clientRequestId,
        ...(input.loggedAt && { logged_at: input.loggedAt }),
      };

      const response = await api.post<StressLog>('/v1/wellbeing/stress/logs', requestBody);
      return { success: response.success, data: response.data, error: response.error };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          message: (error as Error).message || 'Failed to create stress log',
          code: (error as { code?: string }).code || 'UNKNOWN_ERROR',
        },
      };
    }
  }

  /**
   * Get stress logs with optional date range
   */
  async getLogs(from?: string, to?: string): Promise<{ success: boolean; data?: StressLog[]; error?: unknown }> {
    try {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;

      const response = await api.get<StressLog[]>('/v1/wellbeing/stress/logs', { params });
      return { success: response.success, data: response.data, error: response.error };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          message: (error as Error).message || 'Failed to fetch stress logs',
          code: (error as { code?: string }).code || 'UNKNOWN_ERROR',
        },
      };
    }
  }

  /**
   * Get today's stress logs
   */
  async getTodayLogs(): Promise<{ success: boolean; data?: StressLog[]; error?: unknown }> {
    const today = new Date().toISOString().split('T')[0];
    return this.getLogs(today, today);
  }

  /**
   * Get stress summary for a date range
   */
  async getSummary(
    from: string,
    to: string
  ): Promise<{ success: boolean; data?: StressSummary[]; error?: unknown }> {
    try {
      const response = await api.get<StressSummary[]>('/v1/wellbeing/stress/summary', {
        params: { from, to },
      });
      return { success: response.success, data: response.data, error: response.error };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          message: (error as Error).message || 'Failed to fetch stress summary',
          code: (error as { code?: string }).code || 'UNKNOWN_ERROR',
        },
      };
    }
  }

  /**
   * Get extreme stress status (for crisis escalation)
   */
  async getExtremeStressStatus(): Promise<{
    success: boolean;
    data?: ExtremeStressStatus;
    error?: unknown;
  }> {
    try {
      const response = await api.get<ExtremeStressStatus>('/v1/wellbeing/stress/extreme-status');
      return { success: response.success, data: response.data, error: response.error };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          message: (error as Error).message || 'Failed to fetch extreme stress status',
          code: (error as { code?: string }).code || 'UNKNOWN_ERROR',
        },
      };
    }
  }

  /**
   * Generate a unique client request ID for idempotency
   */
  generateClientRequestId(): string {
    return `stress_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get stress rating label
   */
  getStressRatingLabel(rating: number): string {
    if (rating <= 2) return 'No stress';
    if (rating <= 4) return 'Mild';
    if (rating <= 6) return 'Moderate';
    if (rating <= 8) return 'High';
    return 'Extreme';
  }

  /**
   * Get stress rating color (for UI)
   */
  getStressRatingColor(rating: number): string {
    if (rating <= 2) return 'text-green-400';
    if (rating <= 4) return 'text-yellow-400';
    if (rating <= 6) return 'text-orange-400';
    if (rating <= 8) return 'text-red-400';
    return 'text-red-600';
  }
}

export const stressService = new StressService();

