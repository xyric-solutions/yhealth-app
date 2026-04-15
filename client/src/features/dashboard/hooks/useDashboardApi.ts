'use client';

import { useCallback } from 'react';
import { useAsyncState } from '@/src/shared/hooks';
import { plansService } from '@/src/shared/services';
import { ApiError } from '@/lib/api-client';
import type { Plan, TodayData, WeeklySummary } from '@/src/types';

export interface DashboardData {
  plan: Plan | null;
  todayData: TodayData | null;
  weeklySummary: WeeklySummary | null;
  weekCompletionRate: number;
}

/**
 * Hook for all dashboard API operations
 */
export function useDashboardApi() {
  const { isLoading, error, setError, execute } = useAsyncState<DashboardData>();

  const clearError = useCallback(() => setError(null), [setError]);

  /**
   * Fetch all dashboard data in parallel
   */
  const fetchDashboardData = useCallback(async (): Promise<DashboardData | undefined> => {
    return execute(async () => {
      // Fetch active plan first
      const planResponse = await plansService.getActive();

      if (!planResponse.success || !planResponse.data) {
        throw new ApiError('No active plan found', 404, 'NOT_FOUND');
      }

      const { plan, weekCompletionRate } = planResponse.data;

      // Fetch today's data
      const todayResponse = await plansService.getToday();
      const todayData = todayResponse.success ? todayResponse.data ?? null : null;

      // Fetch weekly summary
      let weeklySummary: WeeklySummary | null = null;
      if (plan?.id) {
        const summaryResponse = await plansService.getWeeklySummary(plan.id);
        weeklySummary = summaryResponse.success ? summaryResponse.data ?? null : null;
      }

      return {
        plan,
        todayData,
        weeklySummary,
        weekCompletionRate,
      };
    });
  }, [execute]);

  /**
   * Log activity completion
   */
  const logActivityComplete = useCallback(
    async (planId: string, activityId: string) => {
      return execute(async () => {
        await plansService.logActivity(planId, activityId, {
          status: 'completed',
          scheduledDate: new Date().toISOString(),
        });
        return {} as DashboardData; // Type hack, we'll refetch after
      });
    },
    [execute]
  );

  /**
   * Log activity skipped
   */
  const logActivitySkipped = useCallback(
    async (planId: string, activityId: string, notes?: string) => {
      return execute(async () => {
        await plansService.logActivity(planId, activityId, {
          status: 'skipped',
          scheduledDate: new Date().toISOString(),
          notes,
        });
        return {} as DashboardData;
      });
    },
    [execute]
  );

  return {
    isLoading,
    error,
    clearError,
    fetchDashboardData,
    logActivityComplete,
    logActivitySkipped,
  };
}
