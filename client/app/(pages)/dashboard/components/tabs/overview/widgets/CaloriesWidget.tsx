'use client';

import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useMemo } from 'react';
import { ParticleBackground } from './ParticleBackground';

interface CaloriesWidgetProps {
  consumed: number | null;
  burned: number | null;
  target: number;
  isLoading?: boolean;
}

export function CaloriesWidget({ consumed, burned, target, isLoading }: CaloriesWidgetProps) {
  const netCalories = useMemo(() => {
    if (consumed === null && burned === null) return null;
    const consumedVal = consumed || 0;
    const burnedVal = burned || 0;
    return consumedVal - burnedVal;
  }, [consumed, burned]);

  const progress = useMemo(() => {
    if (consumed === null) return 0;
    return Math.min((consumed / target) * 100, 100);
  }, [consumed, target]);

  const percentage = Math.round(progress);
  const isOverTarget = consumed !== null && consumed > target;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-black/40 border border-orange-400/50 p-6 backdrop-blur-sm shadow-lg shadow-orange-500/20"
    >
      <ParticleBackground color="orange" particleCount={120} className="rounded-2xl" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">Calories</h3>
              <p className="text-lg font-bold text-white">
                {isLoading ? '—' : consumed?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-slate-400">
                Target: {target.toLocaleString()} kcal
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-2 rounded-lg bg-slate-800/30">
            <p className="text-xs text-slate-400 mb-1">Burned</p>
            <p className="text-sm font-semibold text-orange-400">
              {burned?.toLocaleString() || '—'}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-800/30">
            <p className="text-xs text-slate-400 mb-1">Net</p>
            <p className={`text-sm font-semibold ${
              netCalories !== null && netCalories < 0 ? 'text-emerald-400' : 'text-slate-300'
            }`}>
              {netCalories !== null ? netCalories.toLocaleString() : '—'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Progress</span>
            <span className={`font-semibold ${isOverTarget ? 'text-orange-400' : 'text-slate-400'}`}>
              {percentage}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-800/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                isOverTarget
                  ? 'bg-gradient-to-r from-orange-500 to-red-500'
                  : 'bg-gradient-to-r from-orange-500/70 to-red-500/70'
              }`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

