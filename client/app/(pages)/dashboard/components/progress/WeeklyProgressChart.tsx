"use client";

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { groupByWeek } from './utils/progressCalculations';
import type { WeightRecord } from './utils/progressCalculations';

interface WeeklyProgressChartProps {
  weightHistory: WeightRecord[];
  workoutsByWeek?: Array<{ weekStart: string; count: number }>;
  timePeriod?: number | null;
}

interface WeeklyDataPoint {
  week: string;
  weekLabel: string;
  averageWeight: number;
  workouts: number;
  streak: number;
}

const WeeklyTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; dataKey?: string; payload: WeeklyDataPoint }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-white/20 rounded-lg p-3 shadow-xl backdrop-blur-sm">
        <p className="text-white font-medium mb-2">{data.weekLabel}</p>
        {payload.map((entry, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-semibold">{entry.value.toFixed(1)}</span>
            {entry.dataKey === 'averageWeight' && ' kg'}
            {entry.dataKey === 'workouts' && ' workouts'}
            {entry.dataKey === 'streak' && ' days'}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function WeeklyProgressChart({
  weightHistory,
  workoutsByWeek = [],
  timePeriod,
}: WeeklyProgressChartProps) {
  const chartData = useMemo<WeeklyDataPoint[]>(() => {
    if (!weightHistory || weightHistory.length === 0) {
      console.log('[WeeklyProgressChart] No weight history provided');
      return [];
    }

    try {
      console.log('[WeeklyProgressChart] Processing weight history:', weightHistory.length, 'items');

      // Validate and filter weight history items
      const validHistory = weightHistory.filter((item) => {
        if (!item || typeof item.date !== 'string' || typeof item.weightKg !== 'number') {
          console.warn('[WeeklyProgressChart] Invalid history item:', item);
          return false;
        }
        if (isNaN(item.weightKg) || item.weightKg <= 0) {
          console.warn('[WeeklyProgressChart] Invalid weight value:', item.weightKg);
          return false;
        }
        try {
          parseISO(item.date);
          return true;
        } catch (err) {
          console.warn('[WeeklyProgressChart] Invalid date format:', item.date, err);
          return false;
        }
      });

      if (validHistory.length === 0) {
        console.warn('[WeeklyProgressChart] No valid history items after filtering');
        return [];
      }

      // Filter by time period if specified
      let filtered = validHistory;
      if (timePeriod) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - timePeriod);
        filtered = validHistory.filter((item) => {
          try {
            const itemDate = parseISO(item.date);
            return itemDate >= cutoffDate;
          } catch (err) {
            console.warn('[WeeklyProgressChart] Error parsing date:', item.date, err);
            return false;
          }
        });
        console.log('[WeeklyProgressChart] After time filter:', filtered.length, 'items');
      }

      if (filtered.length === 0) {
        console.log('[WeeklyProgressChart] No items after time period filter');
        return [];
      }

      // Group by week
      const weeklyData = groupByWeek(filtered);
      console.log('[WeeklyProgressChart] Grouped into weeks:', weeklyData.length, 'weeks');

      if (weeklyData.length === 0) return [];

      // Combine with workout data
      return weeklyData.map((week) => {
        try {
          const weekStartDate = parseISO(week.weekStart);
          const workoutData = workoutsByWeek.find(
            (w) => w.weekStart === week.weekStart
          );

          return {
            week: week.weekStart,
            weekLabel: `Week of ${format(weekStartDate, 'MMM d')}`,
            averageWeight: Math.round(week.averageWeight * 10) / 10,
            workouts: workoutData?.count || week.workouts,
            streak: week.streak,
          };
        } catch (error) {
          console.error('[WeeklyProgressChart] Error processing week:', week, error);
          return null;
        }
      }).filter((item): item is WeeklyDataPoint => item !== null);
    } catch (error) {
      console.error('[WeeklyProgressChart] Error processing weight history:', error);
      return [];
    }
  }, [weightHistory, workoutsByWeek, timePeriod]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-900/20 rounded-lg border border-white/5">
        <div className="text-6xl mb-3 opacity-20">📅</div>
        <p className="text-base font-medium mb-1">No weekly data available</p>
        <p className="text-sm text-slate-500">Need more data points to show weekly breakdown</p>
      </div>
    );
  }

  // Calculate domain for weight axis
  const weights = chartData.map((d) => d.averageWeight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightPadding = (maxWeight - minWeight) * 0.1 || 2;
  const weightDomain = [Math.max(0, minWeight - weightPadding), maxWeight + weightPadding];

  // Calculate domain for workouts axis
  const workouts = chartData.map((d) => d.workouts);
  const maxWorkouts = Math.max(...workouts, 4);
  const workoutsDomain = [0, maxWorkouts];

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
          <defs>
            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="workoutsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          
          <XAxis
            dataKey="weekLabel"
            angle={-45}
            textAnchor="end"
            height={80}
            stroke="#94a3b8"
            style={{ fontSize: '11px' }}
            interval={0}
          />
          
          <YAxis
            yAxisId="weight"
            orientation="left"
            domain={weightDomain}
            stroke="#10b981"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${value.toFixed(1)}`}
            width={50}
          />
          
          <YAxis
            yAxisId="count"
            orientation="right"
            domain={workoutsDomain}
            stroke="#f59e0b"
            style={{ fontSize: '12px' }}
            width={50}
          />
          
          <Tooltip content={<WeeklyTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => (
              <span className="text-sm text-slate-400">{value}</span>
            )}
          />
          
          {/* Weight area */}
          <Area
            yAxisId="weight"
            type="monotone"
            dataKey="averageWeight"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#weightGradient)"
            name="Avg Weight (kg)"
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
          />
          
          {/* Workouts area */}
          <Area
            yAxisId="count"
            type="monotone"
            dataKey="workouts"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#workoutsGradient)"
            name="Workouts"
            dot={{ fill: '#f59e0b', r: 3 }}
            activeDot={{ r: 5, stroke: '#f59e0b', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

