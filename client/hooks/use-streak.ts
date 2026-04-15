'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  initSocket,
  subscribeToStreakUpdated,
  subscribeToStreakBroken,
  subscribeToStreakFreeze,
  subscribeToStreakAtRisk,
  subscribeToStreakMilestone,
} from '@/lib/socket-client';
import {
  streakApiService,
  type StreakStatus,
  type CalendarMonth,
} from '@/src/shared/services/streak.service';
import { useAuth } from '@/app/context/AuthContext';

export interface StreakMilestoneEvent {
  days: number;
  tierName: string;
  xpBonus: number;
  freezesEarned: number;
  titleUnlocked: string | null;
  badgeIcon: string;
}

export function useStreak() {
  const [streak, setStreak] = useState<StreakStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarMonth | null>(null);
  const [milestone, setMilestone] = useState<StreakMilestoneEvent | null>(null);
  const [streakBroken, setStreakBroken] = useState<{ previousStreak: number } | null>(null);
  const { user, isAuthenticated } = useAuth();

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setStreak(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await streakApiService.getStatus();
      if (response.success && response.data) {
        setStreak(response.data);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch streak status:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch streak'));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const loadMonth = useCallback(async (month: string) => {
    try {
      const response = await streakApiService.getCalendar(month);
      if (response.success && response.data) {
        setCalendarData(response.data);
      }
    } catch (err) {
      console.error('Failed to load calendar month:', err);
    }
  }, []);

  const purchaseFreeze = useCallback(async () => {
    const response = await streakApiService.purchaseFreeze();
    if (response.success) {
      await fetchStatus();
    }
    return response;
  }, [fetchStatus]);

  const applyFreeze = useCallback(async (date?: string) => {
    const response = await streakApiService.applyFreeze(date);
    if (response.success) {
      await fetchStatus();
    }
    return response;
  }, [fetchStatus]);

  const dismissMilestone = useCallback(() => setMilestone(null), []);
  const dismissBroken = useCallback(() => setStreakBroken(null), []);

  // Initial fetch + socket subscriptions
  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // Fetch initial status
    fetchStatus();

    // Initialize socket connection
    const socket = initSocket();
    if (!socket) {
      return;
    }

    // Subscribe to real-time streak events
    const cleanups: (() => void)[] = [];

    cleanups.push(
      subscribeToStreakUpdated((data) => {
        setStreak((prev) => (prev ? { ...prev, ...data } as StreakStatus : prev));
        fetchStatus();
      }),
    );

    cleanups.push(
      subscribeToStreakBroken((data) => {
        setStreakBroken(data);
        fetchStatus();
      }),
    );

    cleanups.push(
      subscribeToStreakFreeze((data) => {
        setStreak((prev) =>
          prev ? { ...prev, freezesAvailable: data.freezesRemaining } : prev,
        );
      }),
    );

    cleanups.push(
      subscribeToStreakAtRisk(() => {
        setStreak((prev) => (prev ? { ...prev, atRisk: true } : prev));
      }),
    );

    cleanups.push(
      subscribeToStreakMilestone((data: StreakMilestoneEvent) => {
        setMilestone(data);
        fetchStatus();
      }),
    );

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [isAuthenticated, user, fetchStatus]);

  return {
    streak,
    isLoading,
    error,
    refetch: fetchStatus,
    purchaseFreeze,
    applyFreeze,
    calendarData,
    loadMonth,
    milestone,
    dismissMilestone,
    streakBroken,
    dismissBroken,
  };
}
