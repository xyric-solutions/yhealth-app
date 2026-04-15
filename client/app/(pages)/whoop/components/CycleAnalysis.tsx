'use client';

import { useState, useEffect } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { AlertCircle, RefreshCw, Heart, Activity, Moon, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/whoop/DateRangePicker';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Cycle {
  id: number;
  start: string;
  end: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  };
  sleep?: {
    score?: {
      stage_summary?: {
        total_sleep_time_milli?: number;
        total_rem_sleep_time_milli?: number;
        total_slow_wave_sleep_time_milli?: number;
        total_light_sleep_time_milli?: number;
        total_awake_time_milli?: number;
      };
      sleep_efficiency_percentage?: number;
      sleep_performance_percentage?: number;
      respiratory_rate?: number;
    };
  };
  recovery?: {
    score?: {
      recovery_score?: number;
      resting_heart_rate?: number;
      hrv_rmssd_milli?: number;
    };
  };
  workouts?: Array<{
    id: string;
    sport_name?: string;
    score?: {
      strain?: number;
      average_heart_rate?: number;
      max_heart_rate?: number;
      kilojoule?: number;
      distance_meter?: number;
    };
  }>;
}

interface CyclesData {
  cycles: Cycle[];
}

export function CycleAnalysis() {
  const getDefaultDateRange = () => {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    return { from: startDate, to: endDate };
  };

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(
    getDefaultDateRange()
  );

  const buildQueryString = () => {
    const params = new URLSearchParams();
    
    // Only use date range if both dates are provided, otherwise use days
    if (dateRange.from && dateRange.to) {
      // When date range is provided, don't send days parameter
      // The controller will use the date range instead
      params.append('startDate', dateRange.from.toISOString().split('T')[0]);
      params.append('endDate', dateRange.to.toISOString().split('T')[0]);
    } else {
      // Fallback to days when no date range is provided
      params.append('days', '7');
    }
    
    return params.toString();
  };

  const queryString = buildQueryString();
  const endpoint = `/whoop/analytics/cycles?${queryString}`;

  const { data, isLoading, error, refetch } = useFetch<CyclesData>(endpoint, {
    immediate: true,
    deps: [dateRange.from?.toISOString(), dateRange.to?.toISOString()],
  });

  // Refetch immediately on mount (component is mounted when tab is active)
  // This ensures fresh data even if cache exists
  useEffect(() => {
    // Small delay to ensure component is fully mounted and useFetch has initialized
    const timeoutId = setTimeout(() => {
      refetch();
    }, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - refetch is stable from useFetch

  useEffect(() => {
    const handleTabChange = (event: CustomEvent<{ tab: string }>) => {
      if (event.detail.tab === 'cycles') {
        // Refetch when cycles tab becomes active
        setTimeout(() => {
          refetch();
        }, 100);
      }
    };

    window.addEventListener('whoop-tab-changed', handleTabChange as EventListener);
    
    // Also refetch when component becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoading) {
        refetch();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('whoop-tab-changed', handleTabChange as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoading, refetch]);

  const handleRetry = async () => {
    try {
      await refetch();
      toast.success('Refreshing cycle data...');
    } catch {
      toast.error('Failed to refresh cycle data');
    }
  };



  if (isLoading) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
      </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
        <div className="rounded-xl bg-red-500/10 backdrop-blur-sm border border-red-500/20 p-4 sm:p-6 transition-all duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              <div>
                <p className="text-[13px] sm:text-[14px] text-red-400 font-medium">Failed to load cycle data</p>
                <p className="text-[13px] sm:text-[14px] text-red-300/70 mt-1">
                  {error.message || 'Unable to fetch cycle analysis. Please check your connection and try again.'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.cycles || data.cycles.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
        <div className="rounded-xl bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 p-4 sm:p-6 transition-all duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              <div>
                <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No cycle data available</p>
                <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
                  No cycle data found for the selected date range. Make sure your WHOOP device is syncing data regularly.
                </p>
              </div>
            </div>
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data from cycles
  const chartData = data.cycles
    .map((cycle) => {
      const cycleStart = new Date(cycle.start);
      return {
        date: format(cycleStart, 'MMM d'),
        fullDate: cycleStart.toISOString(),
        avgHR: cycle.score?.average_heart_rate || null,
        maxHR: cycle.score?.max_heart_rate || null,
        strain: cycle.score?.strain || null,
        calories: cycle.score?.kilojoule ? cycle.score.kilojoule / 4.184 : null,
        sleepHours: cycle.sleep?.score?.stage_summary?.total_sleep_time_milli
          ? (cycle.sleep.score.stage_summary.total_sleep_time_milli || 0) / 3600000
          : null,
        sleepEfficiency: cycle.sleep?.score?.sleep_efficiency_percentage || null,
        sleepPerformance: cycle.sleep?.score?.sleep_performance_percentage || null,
        recovery: cycle.recovery?.score?.recovery_score || null,
        rhr: cycle.recovery?.score?.resting_heart_rate || null,
        hrv: cycle.recovery?.score?.hrv_rmssd_milli ? cycle.recovery.score.hrv_rmssd_milli / 1000 : null,
      };
    })
    .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Range Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      {/* Cycle Analytics Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 sm:space-y-6"
      >
        <h3 className="text-[16px] sm:text-[18px] font-semibold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
          Physiological Cycles Analytics
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Heart Rate Trends */}
          <div className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-4 sm:p-6">
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4 text-blue-400" />
              Heart Rate Trends
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="avgHRGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="maxHRGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis 
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="avgHR"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#avgHRGradient)"
                  name="Avg HR (bpm)"
                />
                <Area
                  type="monotone"
                  dataKey="maxHR"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#maxHRGradient)"
                  name="Max HR (bpm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sleep Metrics */}
          <div className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-4 sm:p-6">
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Moon className="w-4 h-4 text-purple-400" />
              Sleep Metrics
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  label={{ value: 'Percentage', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sleepHours"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', r: 5 }}
                  name="Sleep Hours"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sleepEfficiency"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#10b981', r: 4 }}
                  name="Efficiency (%)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sleepPerformance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="Performance (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recovery & Strain */}
          <div className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-4 sm:p-6">
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              Recovery & Strain
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="strainGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  label={{ value: 'Recovery (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  label={{ value: 'Strain', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="recovery"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#recoveryGradient)"
                  name="Recovery (%)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="strain"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#strainGradient)"
                  name="Strain"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* HRV & RHR */}
          <div className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-4 sm:p-6">
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4 text-cyan-400" />
              HRV & Resting Heart Rate
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  label={{ value: 'HRV (ms)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  label={{ value: 'RHR (bpm)', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="hrv"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ fill: '#06b6d4', r: 5 }}
                  name="HRV (ms)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rhr"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#f59e0b', r: 4 }}
                  name="RHR (bpm)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Default export for compatibility
export default CycleAnalysis;
