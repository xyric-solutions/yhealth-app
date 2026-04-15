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
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { calculateBMI, getBMICategory } from './utils/progressCalculations';
import type { WeightRecord } from './utils/progressCalculations';

interface BMITrendChartProps {
  weightHistory: WeightRecord[];
  heightCm: number | null;
  timePeriod?: number | null;
}

interface BMIDataPoint {
  date: string;
  dateFormatted: string;
  bmi: number;
  category: string;
}

// Custom Tooltip for BMI
const BMITooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: BMIDataPoint }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const category = getBMICategory(data.bmi);
    return (
      <div className="bg-slate-900/95 border border-white/20 rounded-lg p-3 shadow-xl backdrop-blur-sm">
        <p className="text-white font-medium mb-1">{data.dateFormatted}</p>
        <p className="text-sm text-emerald-400 mb-1">
          BMI: <span className="font-semibold">{data.bmi.toFixed(1)}</span>
        </p>
        <p className={`text-xs ${category.color}`}>
          Category: <span className="font-semibold">{category.category}</span>
        </p>
      </div>
    );
  }
  return null;
};

export function BMITrendChart({
  weightHistory,
  heightCm,
  timePeriod,
}: BMITrendChartProps) {
  const chartData: BMIDataPoint[] = useMemo(() => {
    if (!heightCm || !weightHistory || weightHistory.length === 0) return [];

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

      if (filtered.length === 0) return [];

      // Sort by date
      const sorted = [...filtered].sort((a, b) => {
        try {
          return parseISO(a.date).getTime() - parseISO(b.date).getTime();
        } catch {
          return 0;
        }
      });

      const dataPoints: BMIDataPoint[] = [];
      
      for (const item of sorted) {
        try {
          const date = parseISO(item.date);
          const bmi = calculateBMI(item.weightKg, heightCm);
          const category = getBMICategory(bmi);

          dataPoints.push({
            date: item.date,
            dateFormatted: format(date, 'MMM d'),
            bmi: Math.round(bmi * 10) / 10,
            category: category.category,
          });
        } catch (error) {
          console.error('[BMITrendChart] Error processing item:', item, error);
          // Skip invalid items
        }
      }
      
      return dataPoints;
    } catch (error) {
      console.error('[BMITrendChart] Error processing weight history:', error);
      return [];
    }
  }, [weightHistory, heightCm, timePeriod]);

  if (!heightCm || chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-900/20 rounded-lg border border-white/5">
        <div className="text-6xl mb-3 opacity-20">📏</div>
        <p className="text-base font-medium mb-1">BMI tracking unavailable</p>
        <p className="text-sm text-slate-500">
          {!heightCm ? 'Height required to calculate BMI' : 'No weight data available'}
        </p>
      </div>
    );
  }

  // BMI category reference lines
  const underweightLine = 18.5;
  const normalLine = 25;
  const overweightLine = 30;

  // Format X-axis tick
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
            <linearGradient id="bmiGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
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
            domain={[15, 35]}
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => value.toFixed(0)}
            width={40}
          />
          
          <Tooltip content={<BMITooltip />} />
          
          {/* BMI category zones */}
          <ReferenceLine
            y={underweightLine}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="2 2"
            label={{ value: 'Underweight', position: 'right', fill: '#3b82f6', fontSize: 10 }}
          />
          <ReferenceLine
            y={normalLine}
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="2 2"
            label={{ value: 'Normal', position: 'right', fill: '#10b981', fontSize: 10 }}
          />
          <ReferenceLine
            y={overweightLine}
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="2 2"
            label={{ value: 'Overweight', position: 'right', fill: '#f59e0b', fontSize: 10 }}
          />
          
          {/* BMI area */}
          <Area
            type="monotone"
            dataKey="bmi"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#bmiGradient)"
            dot={{ fill: '#10b981', r: 3 }}
            activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      
      {/* BMI category legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-400"></div>
          <span className="text-xs text-slate-400">&lt; 18.5</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-400"></div>
          <span className="text-xs text-slate-400">18.5 - 25</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-400"></div>
          <span className="text-xs text-slate-400">25 - 30</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-400"></div>
          <span className="text-xs text-slate-400">&gt; 30</span>
        </div>
      </div>
    </div>
  );
}

