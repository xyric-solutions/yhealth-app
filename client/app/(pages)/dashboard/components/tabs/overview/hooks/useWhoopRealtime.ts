'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface WhoopRealtimeData {
  heartRate: {
    current: number | null;
    resting: number | null;
    max: number | null;
    zone: number; // 0-5
    history: Array<{ time: string; bpm: number }>;
    lastUpdated: string | null;
  };
  recovery: {
    score: number | null;
    hrv: number | null;
    spo2: number | null;
    skinTemp: number | null;
  };
  strain: {
    score: number | null; // 0-21
    normalized: number | null; // 0-100
    calories: number | null;
    avgHr: number | null;
    maxHr: number | null;
  };
  sleep: {
    hours: number | null;
    quality: number | null;
    efficiency: number | null;
  };
  isConnected: boolean;
  lastSync: string | null;
}

interface UseWhoopRealtimeOptions {
  enabled?: boolean;
  /** Refetch interval in ms; omit to disable polling. */
  pollInterval?: number;
}

const defaultData: WhoopRealtimeData = {
  heartRate: {
    current: null,
    resting: null,
    max: null,
    zone: 0,
    history: [],
    lastUpdated: null,
  },
  recovery: {
    score: null,
    hrv: null,
    spo2: null,
    skinTemp: null,
  },
  strain: {
    score: null,
    normalized: null,
    calories: null,
    avgHr: null,
    maxHr: null,
  },
  sleep: {
    hours: null,
    quality: null,
    efficiency: null,
  },
  isConnected: false,
  lastSync: null,
};

export function useWhoopRealtime(options: UseWhoopRealtimeOptions = {}) {
  const { enabled = true, pollInterval } = options;

  const [data, setData] = useState<WhoopRealtimeData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWhoopData = useCallback(async () => {
    if (!enabled) return;

    try {
      // Fetch Whoop overview which includes all metrics
      // API returns: currentRecovery, currentSleep, todayStrain, trends
      const response = await api.get<{
        currentRecovery: {
          score: number;
          hrv: number;
          rhr: number;  // API uses 'rhr' not 'restingHeartRate'
          spo2?: number;
          skinTemp?: number;
          timestamp?: string;
        } | null;
        currentSleep: {
          duration: number;  // in minutes
          quality: number;
          efficiency: number;
          timestamp?: string;
        } | null;
        todayStrain: {
          score: number;
          normalized: number;  // API uses 'normalized' not 'normalizedScore'
          avgHeartRate?: number;  // API uses 'avgHeartRate' not 'averageHeartRate'
          maxHeartRate?: number;
          calories?: number;  // API uses 'calories' not 'caloriesBurned'
          timestamp?: string;
        } | null;
        trends: {
          recovery7d: number[];
          sleep7d: number[];
          strain7d: number[];
        };
      }>('/whoop/analytics/overview');

      if (response.success && response.data) {
        const whoopData = response.data;

        // Calculate heart rate zone (0-5 based on percentage of max)
        const currentHr = whoopData.todayStrain?.avgHeartRate || whoopData.currentRecovery?.rhr || null;
        const maxHr = whoopData.todayStrain?.maxHeartRate || 220;
        const zone = currentHr ? Math.min(5, Math.floor((currentHr / maxHr) * 6)) : 0;

        // Build heart rate history from recovery trends (recovery7d is an array of scores)
        // Since we don't have detailed time-series, create synthetic history from the trends
        const hrHistory: Array<{ time: string; bpm: number }> = [];
        if (whoopData.currentRecovery?.rhr) {
          // Add current RHR as the latest data point
          hrHistory.push({
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            bpm: whoopData.currentRecovery.rhr,
          });
        }

        // Convert sleep duration from minutes to hours
        const sleepHours = whoopData.currentSleep?.duration
          ? parseFloat((whoopData.currentSleep.duration / 60).toFixed(1))
          : null;

        setData({
          heartRate: {
            current: currentHr,
            resting: whoopData.currentRecovery?.rhr || null,
            max: whoopData.todayStrain?.maxHeartRate || null,
            zone,
            history: hrHistory,
            lastUpdated: whoopData.todayStrain?.timestamp || whoopData.currentRecovery?.timestamp || new Date().toISOString(),
          },
          recovery: {
            score: whoopData.currentRecovery?.score || null,
            hrv: whoopData.currentRecovery?.hrv || null,
            spo2: whoopData.currentRecovery?.spo2 || null,
            skinTemp: whoopData.currentRecovery?.skinTemp || null,
          },
          strain: {
            score: whoopData.todayStrain?.score || null,
            normalized: whoopData.todayStrain?.normalized || null,
            calories: whoopData.todayStrain?.calories || null,
            avgHr: whoopData.todayStrain?.avgHeartRate || null,
            maxHr: whoopData.todayStrain?.maxHeartRate || null,
          },
          sleep: {
            hours: sleepHours,
            quality: whoopData.currentSleep?.quality || null,
            efficiency: whoopData.currentSleep?.efficiency || null,
          },
          isConnected: !!(whoopData.currentRecovery || whoopData.todayStrain || whoopData.currentSleep),
          lastSync: whoopData.todayStrain?.timestamp || whoopData.currentRecovery?.timestamp || new Date().toISOString(),
        });
        setError(null);
      }
    } catch (err) {
      console.warn('[useWhoopRealtime] Failed to fetch Whoop data:', err);
      // Don't set error - just mark as not connected
      setData(prev => ({ ...prev, isConnected: false }));
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  // Initial fetch
  useEffect(() => {
    fetchWhoopData();
  }, [fetchWhoopData]);

  useEffect(() => {
    if (!enabled || pollInterval == null || pollInterval <= 0) return;
    const id = setInterval(() => {
      void fetchWhoopData();
    }, pollInterval);
    return () => clearInterval(id);
  }, [enabled, pollInterval, fetchWhoopData]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    setIsLoading(true);
    return fetchWhoopData();
  }, [fetchWhoopData]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
