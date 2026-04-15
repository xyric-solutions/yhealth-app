'use client';

import { useState, useEffect } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { AlertCircle, RefreshCw, Activity, Heart } from 'lucide-react';
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

export function WorkoutCharts() {
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
    params.append('days', '7');
    if (dateRange.from) {
      params.append('startDate', dateRange.from.toISOString().split('T')[0]);
    }
    if (dateRange.to) {
      params.append('endDate', dateRange.to.toISOString().split('T')[0]);
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
      if (event.detail.tab === 'workouts') {
        // Refetch when workouts tab becomes active
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
      toast.success('Refreshing workout data...');
    } catch (_err) {
      toast.error('Failed to refresh workout data');
    }
  };

  // Calculate workout data for charts
  const getWorkoutChartData = () => {
    if (!data?.cycles) return null;

    const allWorkouts = data.cycles.flatMap(cycle => {
      return (cycle.workouts || []).map(workout => ({
        date: cycle.start,
        cycleId: cycle.id,
        sport: workout.sport_name || 'Workout',
        strain: workout.score?.strain || 0,
        avgHeartRate: workout.score?.average_heart_rate || 0,
        maxHeartRate: workout.score?.max_heart_rate || 0,
        calories: workout.score?.kilojoule ? workout.score.kilojoule / 4.184 : 0,
        distance: workout.score?.distance_meter ? workout.score.distance_meter / 1000 : 0,
      }));
    });

    if (allWorkouts.length === 0) return null;

    // Group by date for daily aggregation
    const dailyData = new Map<string, {
      date: string;
      workouts: number;
      totalStrain: number;
      totalCalories: number;
      totalDistance: number;
      avgHeartRate: number;
      maxHeartRate: number;
    }>();

    allWorkouts.forEach(workout => {
      const dateKey = new Date(workout.date).toISOString().split('T')[0];
      const existing = dailyData.get(dateKey) || {
        date: dateKey,
        workouts: 0,
        totalStrain: 0,
        totalCalories: 0,
        totalDistance: 0,
        avgHeartRate: 0,
        maxHeartRate: 0,
      };

      existing.workouts += 1;
      existing.totalStrain += workout.strain;
      existing.totalCalories += workout.calories;
      existing.totalDistance += workout.distance;
      existing.avgHeartRate = (existing.avgHeartRate * (existing.workouts - 1) + workout.avgHeartRate) / existing.workouts;
      existing.maxHeartRate = Math.max(existing.maxHeartRate, workout.maxHeartRate);

      dailyData.set(dateKey, existing);
    });

    const chartData = Array.from(dailyData.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(day => ({
        date: format(new Date(day.date), 'MMM d'),
        fullDate: day.date,
        workouts: day.workouts,
        avgStrain: day.totalStrain / day.workouts,
        totalCalories: day.totalCalories,
        totalDistance: day.totalDistance,
        avgHeartRate: Math.round(day.avgHeartRate),
        maxHeartRate: day.maxHeartRate,
      }));

    return {
      daily: chartData,
      all: allWorkouts,
      totals: {
        totalWorkouts: allWorkouts.length,
        avgStrain: allWorkouts.reduce((sum, w) => sum + w.strain, 0) / allWorkouts.length,
        totalCalories: allWorkouts.reduce((sum, w) => sum + w.calories, 0),
        totalDistance: allWorkouts.reduce((sum, w) => sum + w.distance, 0),
        avgHeartRate: Math.round(allWorkouts.reduce((sum, w) => sum + w.avgHeartRate, 0) / allWorkouts.length),
        maxHeartRate: Math.max(...allWorkouts.map(w => w.maxHeartRate)),
      },
    };
  };

  const workoutChartData = getWorkoutChartData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
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
                <p className="text-[13px] sm:text-[14px] text-red-400 font-medium">Failed to load workout data</p>
                <p className="text-[13px] sm:text-[14px] text-red-300/70 mt-1">
                  {error.message || 'Unable to fetch workout analytics. Please check your connection and try again.'}
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

  if (!workoutChartData || workoutChartData.daily.length === 0) {
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
                <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No workout data available</p>
                <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
                  No workout data found for the selected date range. Make sure your WHOOP device is syncing data regularly.
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Range Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        {workoutChartData.totals && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[13px] sm:text-[14px] text-slate-400">
            <span>Total: {workoutChartData.totals.totalWorkouts} workouts</span>
            <span className="hidden sm:inline">•</span>
            <span>{Math.round(workoutChartData.totals.totalCalories)} kcal</span>
            <span className="hidden sm:inline">•</span>
            <span>{workoutChartData.totals.totalDistance.toFixed(1)} km</span>
          </div>
        )}
      </div>

      {/* Workout Charts - Combined Analytics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 sm:space-y-6"
      >
        {/* Combined Workout Performance Chart */}
        <div className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-4 sm:p-6">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            Workout Performance Overview
          </h4>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={workoutChartData.daily}>
              <defs>
                <linearGradient id="strainGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="caloriesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                label={{ value: 'Strain & Calories', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#94a3b8"
                fontSize={12}
                tick={{ fill: '#94a3b8' }}
                label={{ value: 'Workouts', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
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
                dataKey="avgStrain"
                stroke="#ef4444"
                strokeWidth={3}
                fill="url(#strainGradient)"
                name="Avg Strain"
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="totalCalories"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#caloriesGradient)"
                name="Calories (kcal)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="workouts"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', r: 5 }}
                name="Workouts"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Heart Rate & Distance Chart */}
        <div className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-4 sm:p-6">
          <h4 className="text-[13px] sm:text-[14px] font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Heart className="w-4 h-4 text-blue-400" />
            Heart Rate & Distance Trends
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={workoutChartData.daily}>
              <defs>
                <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#94a3b8"
                fontSize={12}
                tick={{ fill: '#94a3b8' }}
                label={{ value: 'Distance (km)', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
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
                dataKey="avgHeartRate"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 5 }}
                name="Avg HR (bpm)"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="maxHeartRate"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#ef4444', r: 4 }}
                name="Max HR (bpm)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalDistance"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ fill: '#6366f1', r: 5 }}
                name="Distance (km)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}

