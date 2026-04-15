"use client";

import { useMemo } from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';
import { parseISO } from 'date-fns';
import { groupByMonth } from './utils/progressCalculations';
import type { WeightRecord } from './utils/progressCalculations';

interface MonthlyProgressChartProps {
  weightHistory: WeightRecord[];
  workoutsByMonth?: Array<{ month: string; year: number; count: number }>;
}

interface MonthlyDataPoint {
  month: string;
  monthLabel: string;
  averageWeight: number;
  workouts: number;
  loggedDays: number;
  totalDays: number;
  consistency: number;
}

const MonthlyTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; dataKey?: string; payload: MonthlyDataPoint }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-white/20 rounded-lg p-3 shadow-xl backdrop-blur-sm">
        <p className="text-white font-medium mb-2">{data.monthLabel}</p>
        {payload.map((entry, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-semibold">{entry.value.toFixed(1)}</span>
            {entry.dataKey === 'averageWeight' && ' kg'}
            {entry.dataKey === 'workouts' && ' workouts'}
            {entry.dataKey === 'consistency' && '% consistency'}
          </p>
        ))}
        <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-white/10">
          Logged {data.loggedDays} of {data.totalDays} days
        </p>
      </div>
    );
  }
  return null;
};

export function MonthlyProgressChart({
  weightHistory,
  workoutsByMonth = [],
}: MonthlyProgressChartProps) {
  const chartData = useMemo<MonthlyDataPoint[]>(() => {
    if (!weightHistory || weightHistory.length === 0) return [];

    try {
      // Validate and filter weight history items
      const validHistory = weightHistory.filter((item) => {
        if (!item || typeof item.date !== 'string' || typeof item.weightKg !== 'number') {
          return false;
        }
        if (isNaN(item.weightKg) || item.weightKg <= 0) {
          return false;
        }
        try {
          parseISO(item.date);
          return true;
        } catch {
          return false;
        }
      });

      if (validHistory.length === 0) return [];

      // Group by month
      const monthlyData = groupByMonth(validHistory);

      if (monthlyData.length === 0) return [];

      // Combine with workout data
      return monthlyData.map((month) => {
        try {
          const workoutData = workoutsByMonth.find(
            (w) => w.month === month.month && w.year === month.year
          );

          return {
            month: `${month.year}-${month.month}`,
            monthLabel: `${month.month} ${month.year}`,
            averageWeight: Math.round(month.averageWeight * 10) / 10,
            workouts: workoutData?.count || month.workouts,
            loggedDays: month.loggedDays,
            totalDays: month.totalDays,
            consistency: Math.round((month.loggedDays / month.totalDays) * 100),
          };
        } catch (error) {
          console.error('[MonthlyProgressChart] Error processing month:', month, error);
          return null;
        }
      }).filter((item): item is MonthlyDataPoint => item !== null);
    } catch (error) {
      console.error('[MonthlyProgressChart] Error processing weight history:', error);
      return [];
    }
  }, [weightHistory, workoutsByMonth]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-900/20 rounded-lg border border-white/5">
        <div className="text-6xl mb-3 opacity-20">📆</div>
        <p className="text-base font-medium mb-1">No monthly data available</p>
        <p className="text-sm text-slate-500">Need more data points to show monthly breakdown</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          
          <XAxis
            dataKey="monthLabel"
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
          />
          
          <YAxis
            yAxisId="weight"
            orientation="left"
            stroke="#10b981"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${value.toFixed(1)}`}
            width={50}
          />
          
          <YAxis
            yAxisId="count"
            orientation="right"
            stroke="#f59e0b"
            style={{ fontSize: '12px' }}
            width={50}
          />
          
          <Tooltip content={<MonthlyTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => (
              <span className="text-sm text-slate-400">{value}</span>
            )}
          />
          
          <Bar
            yAxisId="count"
            dataKey="workouts"
            fill="#f59e0b"
            fillOpacity={0.6}
            name="Workouts"
            radius={[4, 4, 0, 0]}
          />
          
          <Line
            yAxisId="weight"
            type="monotone"
            dataKey="averageWeight"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
            name="Avg Weight (kg)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

