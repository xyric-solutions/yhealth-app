'use client';

import { motion } from 'framer-motion';
import { Moon, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { ParticleBackground } from './ParticleBackground';

interface SleepWidgetProps {
  hours: number | null;
  quality: number | null; // 0-100
  target: number;
  isLoading?: boolean;
}

export function SleepWidget({ hours, quality, target, isLoading }: SleepWidgetProps) {
  const progress = useMemo(() => {
    if (!hours || hours === 0) return 0;
    return Math.min((hours / target) * 100, 100);
  }, [hours, target]);

  const percentage = Math.round(progress);
  const isComplete = progress >= 100;
  const qualityScore = quality || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-black/40 border border-violet-400/50 p-6 backdrop-blur-sm shadow-lg shadow-violet-500/20"
    >
      <ParticleBackground color="indigo" particleCount={120} className="rounded-2xl" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
              <Moon className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">Sleep</h3>
              <p className="text-lg font-bold text-white">
                {isLoading ? '—' : hours ? `${hours.toFixed(1)}h` : '0h'}
              </p>
              <p className="text-xs text-slate-400">
                Target: {target}h
              </p>
            </div>
          </div>
          {isComplete && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center"
            >
              <TrendingUp className="w-4 h-4 text-violet-400" />
            </motion.div>
          )}
        </div>

        {/* Quality Score */}
        {quality !== null && (
          <div className="mb-4 p-3 rounded-lg bg-slate-800/30 border border-violet-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Quality</span>
              <span className="text-sm font-semibold text-violet-400">{qualityScore}%</span>
            </div>
            <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${qualityScore}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-400"
              />
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Progress</span>
            <span className={`font-semibold ${isComplete ? 'text-violet-400' : 'text-slate-400'}`}>
              {percentage}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-800/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                isComplete
                  ? 'bg-gradient-to-r from-violet-400 to-indigo-400'
                  : 'bg-gradient-to-r from-violet-500/70 to-indigo-500/70'
              }`}
            />
          </div>
        </div>

        {/* Remaining */}
        {!isComplete && hours !== null && (
          <div className="mt-3 text-xs text-slate-400">
            {Math.max(0, target - hours).toFixed(1)}h remaining
          </div>
        )}
      </div>
    </motion.div>
  );
}

