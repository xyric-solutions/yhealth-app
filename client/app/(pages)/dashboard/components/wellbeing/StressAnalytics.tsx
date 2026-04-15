"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,

  ReferenceLine,
} from "recharts";
import { format, parseISO, startOfDay, eachDayOfInterval, subDays } from "date-fns";
import { TrendingUp, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { type StressLog, type StressSummary } from "@/src/shared/services/stress.service";

interface StressAnalyticsProps {
  logs: StressLog[];
  summary: StressSummary[];
  isLoading: boolean;
  onRefresh: () => void;
}

interface ChartDataPoint {
  date: string;
  dateFormatted: string;
  avgStress: number;
  maxStress: number;
  minStress: number;
  logCount: number;
  allRatings: number[];
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint; name: string; value: number; color: string }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-white/20 rounded-lg p-4 shadow-xl backdrop-blur-sm">
        <p className="text-white font-semibold mb-2">{data.dateFormatted}</p>
        {payload.map((entry, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <p className="text-sm text-slate-300">
              {entry.name}: <span className="font-semibold text-white">{entry.value?.toFixed(1)}</span>
            </p>
          </div>
        ))}
        {data.logCount > 0 && (
          <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-white/10">
            {data.logCount} log{data.logCount !== 1 ? 's' : ''} this day
          </p>
        )}
      </div>
    );
  }
  return null;
};

export function StressAnalytics({
  logs,
  summary,
  isLoading,
  onRefresh,
}: StressAnalyticsProps) {
  // Prepare chart data - daily aggregation
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!summary || summary.length === 0) return [];

    try {
      // Get date range (last 14 days)
      const today = startOfDay(new Date());
      const startDate = subDays(today, 13);
      const dateRange = eachDayOfInterval({ start: startDate, end: today });

      // Create a map of date -> summary data
      const summaryMap = new Map<string, StressSummary>();
      summary.forEach((s) => {
        const dateKey = format(parseISO(s.date), 'yyyy-MM-dd');
        summaryMap.set(dateKey, s);
      });

      // Group logs by date
      const logsByDate = new Map<string, number[]>();
      logs.forEach((log) => {
        try {
          const logDate = startOfDay(parseISO(log.loggedAt));
          const dateKey = format(logDate, 'yyyy-MM-dd');
          if (!logsByDate.has(dateKey)) {
            logsByDate.set(dateKey, []);
          }
          logsByDate.get(dateKey)!.push(log.stressRating);
        } catch {
          // Skip invalid dates
        }
      });

      // Build chart data points
      const dataPoints: ChartDataPoint[] = dateRange.map((date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const daySummary = summaryMap.get(dateKey);
        const dayLogs = logsByDate.get(dateKey) || [];

        return {
          date: dateKey,
          dateFormatted: format(date, 'MMM d'),
          avgStress: daySummary?.dailyAvg || 0,
          maxStress: daySummary?.dailyMax || 0,
          minStress: dayLogs.length > 0 ? Math.min(...dayLogs) : 0,
          logCount: daySummary?.logsCount || 0,
          allRatings: dayLogs,
        };
      });

      return dataPoints;
    } catch (error) {
      console.error('[StressAnalytics] Error processing data:', error);
      return [];
    }
  }, [logs, summary]);

  // Calculate overall stats
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;

    const nonZeroData = chartData.filter((d) => d.logCount > 0);
    if (nonZeroData.length === 0) return null;

    const avgStress = nonZeroData.reduce((sum, d) => sum + d.avgStress, 0) / nonZeroData.length;
    const maxStress = Math.max(...nonZeroData.map((d) => d.maxStress));
    const totalLogs = nonZeroData.reduce((sum, d) => sum + d.logCount, 0);
    const avgLogsPerDay = totalLogs / nonZeroData.length;

    return {
      avgStress: Math.round(avgStress * 10) / 10,
      maxStress,
      totalLogs,
      avgLogsPerDay: Math.round(avgLogsPerDay * 10) / 10,
    };
  }, [chartData]);

  // Get stress level color
  const getStressColor = (rating: number): string => {
    if (rating <= 2) return "#10b981"; // green - no stress
    if (rating <= 4) return "#84cc16"; // lime - mild
    if (rating <= 6) return "#eab308"; // yellow - moderate
    if (rating <= 8) return "#f97316"; // orange - high
    return "#ef4444"; // red - extreme
  };

  const avgColor = stats ? getStressColor(stats.avgStress) : "#8b5cf6";
  const maxColor = stats ? getStressColor(stats.maxStress) : "#ec4899";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Activity className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">Stress Analytics</h3>
            <p className="text-xs text-slate-400 mt-0.5">14-day trend analysis</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[400px]">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
          <TrendingUp className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No stress data yet</p>
          <p className="text-sm text-slate-500">Start logging to see your analytics</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                <p className="text-xs text-slate-400 mb-1">Average Stress</p>
                <p className="text-2xl font-bold text-white" style={{ color: avgColor }}>
                  {stats.avgStress.toFixed(1)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-500/5 border border-pink-500/20">
                <p className="text-xs text-slate-400 mb-1">Peak Stress</p>
                <p className="text-2xl font-bold text-white" style={{ color: maxColor }}>
                  {stats.maxStress}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                <p className="text-xs text-slate-400 mb-1">Total Logs</p>
                <p className="text-2xl font-bold text-white">{stats.totalLogs}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20">
                <p className="text-xs text-slate-400 mb-1">Avg/Day</p>
                <p className="text-2xl font-bold text-white">{stats.avgLogsPerDay.toFixed(1)}</p>
              </div>
            </div>
          )}

          {/* Area Chart - Stress Trends */}
          <div className="bg-slate-900/30 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-semibold text-white">Stress Trend (Area Chart)</h4>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAvgStress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorMaxStress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis
                  dataKey="dateFormatted"
                  stroke="#6b7280"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickLine={{ stroke: '#4b5563' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 10]}
                  stroke="#6b7280"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickLine={{ stroke: '#4b5563' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={5} stroke="#6b7280" strokeDasharray="2 2" opacity={0.3} label={{ value: "Moderate", position: "insideTopRight", fill: "#6b7280", fontSize: 10 }} />
                <Area
                  type="monotone"
                  dataKey="maxStress"
                  stroke="#ec4899"
                  strokeWidth={2}
                  fill="url(#colorMaxStress)"
                  name="Peak Stress"
                  dot={{ fill: '#ec4899', r: 3, strokeWidth: 2, stroke: '#1f2937' }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="avgStress"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorAvgStress)"
                  name="Average Stress"
                  dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 2, stroke: '#1f2937' }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-slate-400">Average</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-pink-500" />
                <span className="text-slate-400">Peak</span>
              </div>
            </div>
          </div>

          {/* Line Chart - Detailed View */}
          <div className="bg-slate-900/30 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-pink-400" />
              <h4 className="text-sm font-semibold text-white">Detailed Analysis (Line Chart)</h4>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis
                  dataKey="dateFormatted"
                  stroke="#6b7280"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickLine={{ stroke: '#4b5563' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 10]}
                  stroke="#6b7280"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickLine={{ stroke: '#4b5563' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={5} stroke="#6b7280" strokeDasharray="2 2" opacity={0.3} />
                <Line
                  type="monotone"
                  dataKey="avgStress"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', r: 4, strokeWidth: 2, stroke: '#1f2937' }}
                  activeDot={{ r: 6, strokeWidth: 3 }}
                  name="Average Stress"
                />
                <Line
                  type="monotone"
                  dataKey="maxStress"
                  stroke="#ec4899"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#ec4899', r: 3, strokeWidth: 2, stroke: '#1f2937' }}
                  activeDot={{ r: 5 }}
                  name="Peak Stress"
                />
                <Line
                  type="monotone"
                  dataKey="minStress"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ fill: '#10b981', r: 3, strokeWidth: 2, stroke: '#1f2937' }}
                  activeDot={{ r: 5 }}
                  name="Lowest Stress"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-purple-500" />
                <span className="text-slate-400">Average</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-pink-500 border-dashed border-t-2" />
                <span className="text-slate-400">Peak</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-green-500 border-dashed border-t-2" />
                <span className="text-slate-400">Lowest</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

