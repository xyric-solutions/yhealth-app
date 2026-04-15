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
  ReferenceLine,
  Legend,
  Line,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Scale } from 'lucide-react';
import { calculateMovingAverage } from './utils/progressCalculations';
import type { WeightRecord } from './utils/progressCalculations';

interface WeightTrendChartProps {
  history: WeightRecord[];
  timePeriod?: number | null;
  showTrendLine?: boolean;
  goalWeight?: number | null;
}

interface ChartDataPoint {
  date: string;
  dateFormatted: string;
  weight: number;
  trend?: number;
  goal?: number;
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; dataKey?: string; payload: ChartDataPoint }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-white/20 rounded-lg p-3 shadow-xl backdrop-blur-sm">
        <p className="text-white font-medium mb-1">{data.dateFormatted}</p>
        {payload.map((entry, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-semibold">{entry.value.toFixed(1)} kg</span>
          </p>
        ))}
        {data.trend && (
          <p className="text-sm text-slate-400 mt-1">
            Trend: <span className="font-semibold">{data.trend.toFixed(1)} kg</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export function WeightTrendChart({
  history,
  timePeriod,
  showTrendLine = true,
  goalWeight = null,
}: WeightTrendChartProps) {
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!history || history.length === 0) return [];

    try {
      // Validate and filter history items
      const validHistory = history.filter((item) => {
        if (!item || typeof item.date !== 'string' || typeof item.weightKg !== 'number') {
          console.warn('[WeightTrendChart] Invalid history item:', item);
          return false;
        }
        if (isNaN(item.weightKg) || item.weightKg <= 0) {
          console.warn('[WeightTrendChart] Invalid weight value:', item.weightKg);
          return false;
        }
        try {
          parseISO(item.date);
          return true;
        } catch {
          console.warn('[WeightTrendChart] Invalid date format:', item.date);
          return false;
        }
      });

      if (validHistory.length === 0) {
        console.warn('[WeightTrendChart] No valid history items after filtering');
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
          } catch {
            return false;
          }
        });
      }

      if (filtered.length === 0) {
        return [];
      }

      // Sort by date
      const sorted = [...filtered].sort((a, b) => {
        try {
          return parseISO(a.date).getTime() - parseISO(b.date).getTime();
        } catch {
          return 0;
        }
      });

      // Calculate moving average for trend line
      const trendData = showTrendLine ? calculateMovingAverage(sorted, 7) : [];

      // Prepare chart data
      const dataPoints: ChartDataPoint[] = [];
      
      for (const item of sorted) {
        try {
          const date = parseISO(item.date);
          const trend = trendData.find((t) => t.date === item.date)?.average;

          dataPoints.push({
            date: item.date,
            dateFormatted: format(date, 'MMM d'),
            weight: Math.round(item.weightKg * 10) / 10,
            trend: trend ? Math.round(trend * 10) / 10 : undefined,
            goal: goalWeight || undefined,
          });
        } catch (error) {
          console.error('[WeightTrendChart] Error processing item:', item, error);
          // Skip invalid items
        }
      }
      
      return dataPoints;
    } catch (error) {
      console.error('[WeightTrendChart] Error processing history:', error);
      return [];
    }
  }, [history, timePeriod, showTrendLine, goalWeight]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-900/20 rounded-lg border border-white/5">
        <Scale className="w-12 h-12 mb-3 text-slate-500 opacity-50" />
        <p className="text-base font-medium mb-1">No weight data yet</p>
        <p className="text-sm text-slate-500 mb-4">Start logging your weight to see trends</p>
        <button
          onClick={() => {
            // This will be handled by parent component
            const event = new CustomEvent('openWeightModal');
            window.dispatchEvent(event);
          }}
          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors text-sm font-medium border border-emerald-500/30"
        >
          Log Your First Weight
        </button>
      </div>
    );
  }

  // Calculate chart domain for Y-axis
  const weights = chartData.map((d) => d.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const padding = (maxWeight - minWeight) * 0.1 || 2;
  const yDomain = [Math.max(0, minWeight - padding), maxWeight + padding];

  // Format X-axis tick based on data range
  const formatXAxisTick = (dateStr: string) => {
    const date = parseISO(dateStr);
    const days = chartData.length;
    if (days <= 7) {
      return format(date, 'EEE d');
    } else if (days <= 30) {
      return format(date, 'MMM d');
    } else {
      return format(date, 'MMM');
    }
  };

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxisTick}
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            interval="preserveStartEnd"
          />
          
          <YAxis
            domain={yDomain}
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${value.toFixed(1)}`}
            width={50}
          />
          
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
            formatter={(value) => (
              <span className="text-sm text-slate-400">{value}</span>
            )}
          />
          
          {/* Goal line */}
          {goalWeight && (
            <ReferenceLine
              y={goalWeight}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ value: 'Goal', position: 'right', fill: '#f59e0b' }}
            />
          )}
          
          {/* Weight area */}
          <Area
            type="monotone"
            dataKey="weight"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#weightGradient)"
            name="Weight"
            dot={{ fill: '#10b981', r: 3 }}
            activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2 }}
          />
          
          {/* Trend line (moving average) */}
          {showTrendLine && chartData.some((d) => d.trend !== undefined) && (
            <Line
              type="monotone"
              dataKey="trend"
              stroke="#14b8a6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Trend (7-day avg)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

