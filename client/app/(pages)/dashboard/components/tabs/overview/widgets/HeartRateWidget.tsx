'use client';

import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ParticleBackground } from './ParticleBackground';

interface HeartRateDataPoint {
  time: string;
  bpm: number;
}

interface HeartRateWidgetProps {
  currentBpm: number | null;
  restingBpm: number | null;
  history: HeartRateDataPoint[];
  isLoading?: boolean;
}

const getHeartRateZone = (bpm: number, maxBpm: number = 220): number => {
  const percentage = (bpm / maxBpm) * 100;
  if (percentage < 50) return 0; // Rest
  if (percentage < 60) return 1; // Zone 1 - Very Light
  if (percentage < 70) return 2; // Zone 2 - Light
  if (percentage < 80) return 3; // Zone 3 - Moderate
  if (percentage < 90) return 4; // Zone 4 - Hard
  return 5; // Zone 5 - Maximum
};

export function HeartRateWidget({
  currentBpm,
  restingBpm,
  history,
  isLoading,
}: HeartRateWidgetProps) {
  const zone = useMemo(() => {
    if (!currentBpm) return null;
    return getHeartRateZone(currentBpm);
  }, [currentBpm]);

  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    // Show last 24 data points or all if less
    return history.slice(-24).map((point) => ({
      time: point.time,
      bpm: point.bpm,
    }));
  }, [history]);

  if (isLoading || currentBpm === null) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl bg-black/40 border border-red-400/50 p-6 backdrop-blur-sm shadow-lg shadow-red-500/20"
      >
        <ParticleBackground color="red" particleCount={80} className="rounded-2xl" />
        <div className="relative z-10 flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-red-400/50" />
          </div>
          <p className="text-sm text-slate-400">No heart rate data available</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-black/40 border border-red-400/50 p-6 backdrop-blur-sm shadow-lg shadow-red-500/20"
    >
      <ParticleBackground color="red" particleCount={120} className="rounded-2xl" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center">
              <Heart className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">HEART RATE</h3>
              <p className="text-lg font-bold text-white">{currentBpm}</p>
              <p className="text-xs text-slate-400">BPM</p>
            </div>
          </div>
          {zone !== null && (
            <div className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
              <p className="text-xs font-semibold text-red-400">Zone {zone}</p>
            </div>
          )}
        </div>

        {/* Stats */}
        {restingBpm && (
          <div className="mb-4 p-3 rounded-lg bg-slate-800/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Resting</span>
              <span className="text-white font-semibold">{restingBpm} bpm</span>
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="h-32 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  style={{ fontSize: '10px' }}
                  tick={{ fill: '#64748b' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  style={{ fontSize: '10px' }}
                  tick={{ fill: '#64748b' }}
                  domain={['dataMin - 10', 'dataMax + 10']}
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
                  type="monotone"
                  dataKey="bpm"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#ef4444' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}

