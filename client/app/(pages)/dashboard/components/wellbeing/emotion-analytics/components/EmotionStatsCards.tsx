"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Heart, TrendingUp, TrendingDown, Minus, Activity, Target } from "lucide-react";
import type { EmotionChartDataPoint } from "../utils/emotionChartUtils";
import { getEmotionEmoji, getEmotionLabel } from "@/src/shared/services/emotion.service";
import { calculateEmotionStats } from "../utils/emotionChartUtils";

interface EmotionStatsCardsProps {
  chartData: EmotionChartDataPoint[];
  trend?: 'improving' | 'stable' | 'declining';
}

export function EmotionStatsCards({ chartData, trend }: EmotionStatsCardsProps) {
  const stats = useMemo(() => calculateEmotionStats(chartData), [chartData]);

  const getTrendIcon = () => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case "declining":
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "improving":
        return "from-green-500/10 to-green-500/5 border-green-500/20";
      case "declining":
        return "from-red-500/10 to-red-500/5 border-red-500/20";
      default:
        return "from-slate-500/10 to-slate-500/5 border-slate-500/20";
    }
  };

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Logs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-500/5 border border-pink-500/20"
      >
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-pink-400" />
          <p className="text-xs text-slate-400">Total Logs</p>
        </div>
        <p className="text-2xl font-bold text-white">{stats.totalLogs}</p>
      </motion.div>

      {/* Average Confidence */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20"
      >
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-purple-400" />
          <p className="text-xs text-slate-400">Avg Confidence</p>
        </div>
        <p className="text-2xl font-bold text-white">{stats.avgConfidence.toFixed(0)}%</p>
      </motion.div>

      {/* Dominant Emotion */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20"
      >
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-4 h-4 text-blue-400" />
          <p className="text-xs text-slate-400">Dominant</p>
        </div>
        {stats.dominantEmotion ? (
          <div className="flex items-center gap-2">
            <span className="text-xl">{getEmotionEmoji(stats.dominantEmotion)}</span>
            <p className="text-lg font-bold text-white truncate">
              {getEmotionLabel(stats.dominantEmotion)}
            </p>
          </div>
        ) : (
          <p className="text-lg font-bold text-slate-400">N/A</p>
        )}
      </motion.div>

      {/* Trend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={`p-4 rounded-xl bg-gradient-to-br ${getTrendColor()}`}
      >
        <div className="flex items-center gap-2 mb-2">
          {getTrendIcon()}
          <p className="text-xs text-slate-400">Trend</p>
        </div>
        <p className="text-lg font-bold text-white capitalize">
          {trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Declining' : 'Stable'}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
          <span>+{stats.positiveDays}</span>
          <span>/</span>
          <span>-{stats.negativeDays}</span>
          <span>/</span>
          <span>~{stats.neutralDays}</span>
        </div>
      </motion.div>
    </div>
  );
}

