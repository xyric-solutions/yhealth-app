"use client";

import {

  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,

  Bar,
  ComposedChart,
} from "recharts";
import { Activity, TrendingUp } from "lucide-react";
import type { EmotionChartDataPoint } from "../utils/emotionChartUtils";
import { getEmotionEmoji, getEmotionLabel } from "@/src/shared/services/emotion.service";

interface EmotionAnalyticsChartsProps {
  chartData: EmotionChartDataPoint[];
  isLoading?: boolean;
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: EmotionChartDataPoint; name: string; value: number; color: string }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-white/20 rounded-lg p-4 shadow-xl backdrop-blur-sm min-w-[200px]">
        <p className="text-white font-semibold mb-2">{data.dateFormatted}</p>
        {payload.map((entry, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <p className="text-sm text-slate-300">
              {entry.name}: <span className="font-semibold text-white">{entry.value}</span>
            </p>
          </div>
        ))}
        {data.total > 0 && (
          <>
            <div className="h-px bg-white/10 my-2" />
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Dominant: {data.dominantEmotion ? `${getEmotionEmoji(data.dominantEmotion)} ${getEmotionLabel(data.dominantEmotion)}` : 'N/A'}</p>
              <p className="text-xs text-slate-400">Confidence: {data.confidenceAvg.toFixed(0)}%</p>
              <p className="text-xs text-slate-400">Total logs: {data.total}</p>
            </div>
          </>
        )}
      </div>
    );
  }
  return null;
};

export function EmotionAnalyticsCharts({
  chartData,
  isLoading = false,
}: EmotionAnalyticsChartsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <Activity className="w-8 h-8 text-pink-400 animate-pulse mx-auto mb-2" />
          <p className="text-sm text-slate-400">Loading charts...</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
        <TrendingUp className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No emotion data yet</p>
        <p className="text-sm text-slate-500">Start logging emotions to see analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Area Chart - Sentiment Trends */}
      <div className="bg-slate-900/30 rounded-xl p-4 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-pink-400" />
          <h4 className="text-sm font-semibold text-white">Sentiment Trends (Area Chart)</h4>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorNeutral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6b7280" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6b7280" stopOpacity={0.05} />
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
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={{ stroke: '#4b5563' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="positive"
              stackId="1"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#colorPositive)"
              name="Positive"
              dot={{ fill: '#22c55e', r: 3, strokeWidth: 2, stroke: '#1f2937' }}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="neutral"
              stackId="1"
              stroke="#6b7280"
              strokeWidth={2}
              fill="url(#colorNeutral)"
              name="Neutral"
              dot={{ fill: '#6b7280', r: 3, strokeWidth: 2, stroke: '#1f2937' }}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="negative"
              stackId="1"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#colorNegative)"
              name="Negative"
              dot={{ fill: '#ef4444', r: 3, strokeWidth: 2, stroke: '#1f2937' }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-400">Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-slate-400">Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-400">Negative</span>
          </div>
        </div>
      </div>

      {/* Composed Chart - Daily Activity & Confidence */}
      <div className="bg-slate-900/30 rounded-xl p-4 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-semibold text-white">Activity & Confidence (Composed Chart)</h4>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="dateFormatted"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={{ stroke: '#4b5563' }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={{ stroke: '#4b5563' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={{ stroke: '#4b5563' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="left"
              dataKey="total"
              fill="#8b5cf6"
              fillOpacity={0.6}
              name="Daily Logs"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="confidenceAvg"
              stroke="#ec4899"
              strokeWidth={3}
              dot={{ fill: '#ec4899', r: 4, strokeWidth: 2, stroke: '#1f2937' }}
              activeDot={{ r: 6 }}
              name="Avg Confidence (%)"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500 opacity-60" />
            <span className="text-slate-400">Daily Logs</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-pink-500" />
            <span className="text-slate-400">Confidence</span>
          </div>
        </div>
      </div>
    </div>
  );
}

