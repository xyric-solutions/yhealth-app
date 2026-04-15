'use client';

import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ParticleBackground } from './ParticleBackground';

interface AnalyticsWidgetProps {
  weeklyAvg: number;
  consistencyScore: number;
  dataPoints: number;
  trend: 'up' | 'down' | 'stable';
  isLoading?: boolean;
}

export function AnalyticsWidget({
  weeklyAvg,
  consistencyScore,
  dataPoints,
  trend,
  isLoading,
}: AnalyticsWidgetProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-black/40 border border-indigo-400/50 p-6 backdrop-blur-sm shadow-lg shadow-indigo-500/20"
    >
      <ParticleBackground color="indigo" particleCount={120} className="rounded-2xl" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">Analytics</h3>
              <p className="text-lg font-bold text-white">Insights</p>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-slate-800/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Weekly Average</span>
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
            </div>
            <p className="text-xl font-bold text-white">
              {isLoading ? '—' : weeklyAvg.toFixed(1)}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Consistency Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-800/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${consistencyScore}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"
                />
              </div>
              <span className="text-sm font-semibold text-white">{consistencyScore}%</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Data Points</span>
              <span className="text-sm font-semibold text-white">
                {isLoading ? '—' : dataPoints.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

