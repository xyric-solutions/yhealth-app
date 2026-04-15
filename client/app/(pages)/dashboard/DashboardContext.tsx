'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { api, ApiError } from '@/lib/api-client';
import type {
  Plan,
  TodayData,
  WeeklySummary,
  LogActivityData,
} from './components/tabs/overview/types';

interface DashboardContextValue {
  // Data
  plan: Plan | null;
  todayData: TodayData | null;
  weeklySummary: WeeklySummary | null;
  weekCompletionRate: number;

  // State
  isLoading: boolean;
  error: string | null;

  // Actions
  onActivityComplete: (activityId: string, data?: LogActivityData) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [weekCompletionRate, setWeekCompletionRate] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track if workout auto-check has been triggered to prevent duplicates
  const workoutAutoCheckTriggered = useRef(false);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch active plan
      const planResponse = await api.get<{
        plan: Plan;
        todayActivities: unknown[];
        weekCompletionRate: number;
      }>('/plans/active');

      if (planResponse.success && planResponse.data) {
        setPlan(planResponse.data.plan);
        setWeekCompletionRate(planResponse.data.weekCompletionRate);
      }

      // Fetch today's activities
      const todayResponse = await api.get<TodayData>('/plans/today');
      if (todayResponse.success && todayResponse.data) {
        setTodayData(todayResponse.data);
      }

      // Fetch weekly summary if we have a plan
      if (planResponse.data?.plan?.id) {
        const summaryResponse = await api.get<WeeklySummary>(
          `/plans/${planResponse.data.plan.id}/summary/weekly`
        );
        if (summaryResponse.success && summaryResponse.data) {
          setWeeklySummary(summaryResponse.data);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'NOT_FOUND') {
          setError('no_plan');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to load dashboard data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Load data on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
      
      // Trigger workout auto-check on dashboard load (as backup to AuthContext)
      // Only trigger once per session to avoid duplicate calls
      if (!workoutAutoCheckTriggered.current) {
        workoutAutoCheckTriggered.current = true;
        
        // Use dynamic import to avoid blocking initial load
        import('@/src/shared/services')
          .then(({ workoutRescheduleService }) => {
            workoutRescheduleService.autoCheckAndReschedule().catch((err) => {
              // Silently fail - don't interrupt user experience
              if (process.env.NODE_ENV === 'development') {
                console.log('[Dashboard] Workout auto-check completed with error:', err);
              }
            });
          })
          .catch((importError) => {
            // Silently fail if service can't be imported
            if (process.env.NODE_ENV === 'development') {
              console.log('[Dashboard] Failed to import workout reschedule service:', importError);
            }
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Only depend on isAuthenticated - fetchDashboardData is stable

  // Handle activity completion
  const handleActivityComplete = useCallback(async (activityId: string, data?: LogActivityData) => {
    if (!plan) return;

    try {
      await api.post(`/plans/${plan.id}/activities/${activityId}/log`, {
        status: data?.status || 'completed',
        scheduledDate: new Date().toISOString(),
        ...data,
      });

      // Refresh data
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to log activity:', err);
      throw err;
    }
  }, [plan, fetchDashboardData]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      plan,
      todayData,
      weeklySummary,
      weekCompletionRate,
      isLoading,
      error,
      onActivityComplete: handleActivityComplete,
      onRefresh: fetchDashboardData,
    }),
    [
      plan,
      todayData,
      weeklySummary,
      weekCompletionRate,
      isLoading,
      error,
      handleActivityComplete,
      fetchDashboardData,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}
