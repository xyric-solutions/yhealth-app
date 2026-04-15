'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Loader2, Calendar, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import toast from 'react-hot-toast';
import { WhoopMetricsCards } from './WhoopMetricsCards';
import { WhoopDailyCharts } from './WhoopDailyCharts';

interface WhoopOverview {
  currentRecovery: {
    score: number;
    hrv: number;
    rhr: number;
    timestamp: string;
  } | null;
  currentSleep: {
    duration: number;
    quality: number;
    efficiency: number;
    timestamp: string;
  } | null;
  todayStrain: {
    score: number;
    normalized: number;
    timestamp: string;
  } | null;
  trends: {
    recovery7d: Array<{ date: string; value: number }>;
    sleep7d: Array<{ date: string; value: number }>;
    strain7d: Array<{ date: string; value: number }>;
  };
}

interface RecoveryTrend {
  date: string;
  recovery_score: number;
  hrv_rmssd_ms: number;
  resting_heart_rate_bpm: number;
  skin_temp_celsius?: number;
  spo2_percent?: number;
}

interface SleepTrend {
  date: string;
  duration_minutes: number;
  sleep_quality_score: number;
  sleep_efficiency_percent: number;
  rem_minutes: number;
  deep_minutes: number;
}

interface StrainTrend {
  date: string;
  strain_score: number;
  strain_score_normalized: number;
  avg_heart_rate_bpm: number;
  calories_kcal: number;
}

interface WhoopDataSectionProps {
  timeRange?: '7d' | '30d' | '60d';
}

export function WhoopDataSection({ timeRange = '30d' }: WhoopDataSectionProps) {
  const [overview, setOverview] = useState<WhoopOverview | null>(null);
  const [recoveryTrends, setRecoveryTrends] = useState<RecoveryTrend[]>([]);
  const [sleepTrends, setSleepTrends] = useState<SleepTrend[]>([]);
  const [strainTrends, setStrainTrends] = useState<StrainTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWhoopConnected, setIsWhoopConnected] = useState<boolean | null>(null);

  // Calculate date range based on timeRange prop
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 60;
    start.setDate(start.getDate() - days);
    return { start, end };
  }, [timeRange]);

  // Check WHOOP connection status
  const checkWhoopConnection = useCallback(async () => {
    try {
      const statusRes = await api.get<{ isConnected: boolean; status?: string }>('/integrations/whoop/status');
      if (statusRes.success && statusRes.data) {
        const connected = statusRes.data.isConnected === true;
        setIsWhoopConnected(connected);
        return connected;
      }
      setIsWhoopConnected(false);
      return false;
    } catch (err) {
      console.error('Failed to check WHOOP status:', err);
      setIsWhoopConnected(false);
      return false;
    }
  }, []);

  const fetchWhoopData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // First check if WHOOP is connected
      const isConnected = await checkWhoopConnection();
      if (!isConnected) {
        setOverview(null);
        setRecoveryTrends([]);
        setSleepTrends([]);
        setStrainTrends([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const startDateStr = dateRange.start.toISOString().split('T')[0];
      const endDateStr = dateRange.end.toISOString().split('T')[0];

      // Fetch all data in parallel
      const [overviewRes, recoveryRes, sleepRes, strainRes] = await Promise.all([
        api.get<WhoopOverview>('/whoop/analytics/overview', {
          params: { startDate: startDateStr, endDate: endDateStr },
        }),
        api.get<{ trends: RecoveryTrend[] }>('/whoop/analytics/recovery', {
          params: { startDate: startDateStr, endDate: endDateStr },
        }),
        api.get<{ trends: SleepTrend[] }>('/whoop/analytics/sleep', {
          params: { startDate: startDateStr, endDate: endDateStr },
        }),
        api.get<{ trends: StrainTrend[] }>('/whoop/analytics/strain', {
          params: { startDate: startDateStr, endDate: endDateStr },
        }),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }

      if (recoveryRes.success && recoveryRes.data) {
        setRecoveryTrends(recoveryRes.data.trends || []);
      }

      if (sleepRes.success && sleepRes.data) {
        setSleepTrends(sleepRes.data.trends || []);
      }

      if (strainRes.success && strainRes.data) {
        setStrainTrends(strainRes.data.trends || []);
      }

      if (isRefresh) {
        toast.success('WHOOP data refreshed');
      }
    } catch (err: unknown) {
      console.error('Failed to fetch WHOOP data:', err);
      const errMsg = err instanceof Error ? err.message : '';
      if (!errMsg.includes('not found') && !errMsg.includes('No integration')) {
        toast.error('Failed to load WHOOP data');
      }
      setIsWhoopConnected(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dateRange, checkWhoopConnection]);

  // Fetch data when timeRange changes
  useEffect(() => {
    fetchWhoopData();
  }, [fetchWhoopData]);

  const formatDateRange = () => {
    return `${dateRange.start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${dateRange.end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  };

  // Show loading state
  if (isLoading || isWhoopConnected === null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-br from-emerald-500/10 via-slate-900/50 to-cyan-500/10 backdrop-blur-xl rounded-2xl p-8 border border-emerald-500/20"
      >
        <div className="flex items-center justify-center h-48 gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-8 h-8 text-emerald-500" />
          </motion.div>
          <span className="text-slate-400">Loading WHOOP data...</span>
        </div>
      </motion.div>
    );
  }

  // Don't show section if WHOOP is not connected
  if (isWhoopConnected === false) {
    return null;
  }

  // Show empty state if no data available
  if (!overview && recoveryTrends.length === 0 && sleepTrends.length === 0 && strainTrends.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-emerald-500/10 via-slate-900/50 to-cyan-500/10 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-400" />
              WHOOP Data
            </h3>
            <p className="text-sm text-slate-400 mt-1">Recovery, Sleep & Strain metrics from WHOOP</p>
          </div>
          <motion.button
            onClick={() => fetchWhoopData(true)}
            disabled={isRefreshing}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/30"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync Data
          </motion.button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
          <AlertCircle className="w-12 h-12 text-slate-500 mb-3" />
          <p className="text-slate-400 text-sm">No WHOOP data available for the selected date range.</p>
          <p className="text-slate-500 text-xs mt-2">Try adjusting the date range or syncing data.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-400" />
            WHOOP Data
          </h3>
          <p className="text-sm text-slate-400 mt-1">Recovery, Sleep & Strain metrics from WHOOP</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => fetchWhoopData(true)}
            disabled={isRefreshing}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/30"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync Data
          </motion.button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-white/10">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-300">{formatDateRange()}</span>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      {overview && (
        <WhoopMetricsCards
          recovery={overview.currentRecovery}
          sleep={overview.currentSleep}
          strain={overview.todayStrain}
        />
      )}

      {/* Daily Charts */}
      {(recoveryTrends.length > 0 || sleepTrends.length > 0 || strainTrends.length > 0) && (
        <WhoopDailyCharts
          recoveryTrends={recoveryTrends}
          sleepTrends={sleepTrends}
          strainTrends={strainTrends}
        />
      )}
    </motion.div>
  );
}
