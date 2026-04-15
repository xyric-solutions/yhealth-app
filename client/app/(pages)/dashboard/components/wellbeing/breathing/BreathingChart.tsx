"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Calendar, Loader2, BarChart3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BreathingTimelineData } from "@shared/types/domain/wellbeing";

interface BreathingChartProps {
  data?: BreathingTimelineData[];
  isLoading?: boolean;
  className?: string;
  days?: 7 | 14 | 30;
  onDaysChange?: (days: 7 | 14 | 30) => void;
  showHeader?: boolean;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  breathHoldSeconds: number;
  testType: string;
  lungCapacity: string;
}

const dayOptions = [
  { value: 7, label: "7 Days" },
  { value: 14, label: "14 Days" },
  { value: 30, label: "30 Days" },
] as const;

export function BreathingChart({
  data = [],
  isLoading = false,
  className,
  days = 7,
  onDaysChange,
  showHeader = true,
}: BreathingChartProps) {
  const [selectedDays, setSelectedDays] = useState<7 | 14 | 30>(days);

  useEffect(() => {
    setSelectedDays(days);
  }, [days]);

  const handleDaysChange = (newDays: 7 | 14 | 30) => {
    setSelectedDays(newDays);
    if (onDaysChange) {
      onDaysChange(newDays);
    }
  };

  // Transform data for chart
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return [];

    // Group by date and take the best breath hold per day
    const groupedByDate = data.reduce((acc, item) => {
      if (!item.breathHoldDurationSeconds) return acc;

      const date = new Date(item.timestamp).toISOString().split("T")[0];
      if (!acc[date] || item.breathHoldDurationSeconds > acc[date].breathHoldDurationSeconds!) {
        acc[date] = item;
      }
      return acc;
    }, {} as Record<string, BreathingTimelineData>);

    return Object.entries(groupedByDate)
      .map(([date, item]) => ({
        date,
        displayDate: new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        breathHoldSeconds: item.breathHoldDurationSeconds || 0,
        testType: item.testType,
        lungCapacity: item.lungCapacityEstimate || "unknown",
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        average: 0,
        best: 0,
        trend: "stable" as const,
        trendValue: 0,
        totalSessions: 0,
      };
    }

    const values = chartData.map((d) => d.breathHoldSeconds);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const best = Math.max(...values);

    // Calculate trend (compare first half vs second half)
    let trend: "improving" | "declining" | "stable" = "stable";
    let trendValue = 0;

    if (chartData.length >= 4) {
      const midpoint = Math.floor(chartData.length / 2);
      const firstHalfAvg =
        chartData.slice(0, midpoint).reduce((sum, d) => sum + d.breathHoldSeconds, 0) / midpoint;
      const secondHalfAvg =
        chartData.slice(midpoint).reduce((sum, d) => sum + d.breathHoldSeconds, 0) /
        (chartData.length - midpoint);

      trendValue = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

      if (trendValue > 5) trend = "improving";
      else if (trendValue < -5) trend = "declining";
    }

    return { average, best, trend, trendValue, totalSessions: chartData.length };
  }, [chartData]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl"
        >
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 via-transparent to-teal-600/10" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

          <div className="relative">
            <p className="text-sm font-medium text-slate-400 mb-1">{data.displayDate}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                {data.breathHoldSeconds.toFixed(1)}
              </span>
              <span className="text-lg text-cyan-400/70">seconds</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn(
                "px-2 py-0.5 text-xs rounded-full border capitalize",
                data.lungCapacity === "excellent" && "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
                data.lungCapacity === "good" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                data.lungCapacity === "fair" && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                data.lungCapacity === "poor" && "bg-red-500/20 text-red-400 border-red-500/30"
              )}>
                {data.lungCapacity}
              </span>
              <span className="text-xs text-slate-500">{data.testType.replace("_", " ")}</span>
            </div>
          </div>
        </motion.div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-[350px]", className)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mx-auto" />
            <div className="absolute inset-0 blur-xl bg-cyan-500/30 rounded-full" />
          </div>
          <p className="text-slate-400 text-sm mt-3">Analyzing your breathing data...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-5", className)}
    >
      {/* Header with Days Selector */}
      <div className={cn("flex flex-col sm:flex-row sm:items-center gap-4", showHeader ? "justify-between" : "justify-end")}>
        {showHeader && (
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/20"
            >
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </motion.div>
            <div>
              <h3 className="text-lg font-semibold text-white">Breath Hold Performance</h3>
              <p className="text-xs text-slate-500">Track your lung capacity progress</p>
            </div>
          </div>
        )}

        {/* Enhanced Day Selector */}
        <div className="flex gap-1.5 p-1.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
          {dayOptions.map((option) => (
            <motion.button
              key={option.value}
              onClick={() => handleDaysChange(option.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                selectedDays === option.value
                  ? "text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {selectedDays === option.value && (
                <motion.div
                  layoutId="activeDay"
                  className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-lg shadow-lg shadow-cyan-500/30"
                  transition={{ type: "spring", duration: 0.4 }}
                />
              )}
              <span className="relative z-10">{option.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Enhanced Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Average",
            value: `${stats.average.toFixed(1)}s`,
            icon: Calendar,
            gradient: "from-violet-500/20 to-purple-500/20",
            iconColor: "text-violet-400",
            borderColor: "border-violet-500/20",
          },
          {
            label: "Best Record",
            value: `${stats.best.toFixed(1)}s`,
            icon: Sparkles,
            gradient: "from-cyan-500/20 to-teal-500/20",
            iconColor: "text-cyan-400",
            borderColor: "border-cyan-500/20",
            highlight: true,
          },
          {
            label: "Trend",
            value: stats.trend === "stable" ? "Stable" : `${stats.trendValue > 0 ? "+" : ""}${stats.trendValue.toFixed(0)}%`,
            icon: stats.trend === "improving" ? TrendingUp : stats.trend === "declining" ? TrendingDown : Minus,
            gradient: stats.trend === "improving"
              ? "from-emerald-500/20 to-green-500/20"
              : stats.trend === "declining"
                ? "from-red-500/20 to-rose-500/20"
                : "from-slate-500/20 to-slate-600/20",
            iconColor: stats.trend === "improving"
              ? "text-emerald-400"
              : stats.trend === "declining"
                ? "text-red-400"
                : "text-slate-400",
            borderColor: stats.trend === "improving"
              ? "border-emerald-500/20"
              : stats.trend === "declining"
                ? "border-red-500/20"
                : "border-slate-500/20",
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "relative overflow-hidden p-4 rounded-xl border backdrop-blur-sm",
              stat.borderColor,
              stat.highlight && "ring-1 ring-cyan-500/30"
            )}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br", stat.gradient)} />
            <div className="relative flex items-start gap-3">
              <div className={cn("p-2 rounded-lg bg-slate-900/50", stat.iconColor)}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-0.5">{stat.label}</div>
                <div className={cn(
                  "text-xl font-bold",
                  stat.highlight ? "bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent" : "text-white"
                )}>
                  {stat.value}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Enhanced Chart */}
      <AnimatePresence mode="wait">
        {chartData.length > 0 ? (
          <motion.div
            key="chart"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative h-[240px] w-full p-4 rounded-xl bg-slate-800/30 border border-slate-700/50"
          >
            {/* Subtle grid pattern background */}
            <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:24px_24px]" />

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="breathHoldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                    <stop offset="50%" stopColor="#14b8a6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "dataMax + 10"]}
                  tickFormatter={(value) => `${value}s`}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={stats.average}
                  stroke="#a78bfa"
                  strokeDasharray="8 4"
                  strokeWidth={1.5}
                  opacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="breathHoldSeconds"
                  stroke="url(#lineGradient)"
                  strokeWidth={3}
                  fill="url(#breathHoldGradient)"
                  filter="url(#glow)"
                  dot={{
                    fill: "#0f172a",
                    stroke: "#22d3ee",
                    strokeWidth: 2,
                    r: 5,
                  }}
                  activeDot={{
                    fill: "#22d3ee",
                    stroke: "#fff",
                    strokeWidth: 3,
                    r: 8,
                    filter: "url(#glow)",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative h-[240px] flex items-center justify-center rounded-xl border border-dashed border-slate-700/50 bg-slate-800/20 overflow-hidden"
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:24px_24px]" />

            <div className="relative text-center">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="relative mb-4"
              >
                <div className="absolute inset-0 blur-xl bg-cyan-500/20 rounded-full scale-150" />
                <BarChart3 className="w-14 h-14 text-slate-600 mx-auto relative" />
              </motion.div>
              <p className="text-slate-400 mb-1 font-medium">No chart data available</p>
              <p className="text-slate-500 text-sm">Complete some breathing tests to track your progress</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Legend */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400" />
          <span className="text-slate-400">Breath Hold Time</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 rounded-full bg-violet-400" style={{ backgroundImage: "repeating-linear-gradient(90deg, #a78bfa 0px, #a78bfa 8px, transparent 8px, transparent 12px)" }} />
          <span className="text-slate-400">Average ({stats.average.toFixed(1)}s)</span>
        </div>
      </div>
    </motion.div>
  );
}

export default BreathingChart;
