'use client';

import { motion } from 'framer-motion';
import { Footprints, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { ParticleBackground } from './ParticleBackground';

interface StepsWidgetProps {
  steps: number | null;
  target: number;
  isLoading?: boolean;
}

export function StepsWidget({ steps, target, isLoading }: StepsWidgetProps) {
  const progress = useMemo(() => {
    if (!steps || steps === 0) return 0;
    return Math.min((steps / target) * 100, 100);
  }, [steps, target]);

  const isComplete = progress >= 100;
  const percentage = Math.round(progress);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-black/40 border border-emerald-400/50 p-6 backdrop-blur-sm shadow-lg shadow-emerald-500/20"
    >
      <ParticleBackground color="emerald" particleCount={120} className="rounded-2xl" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <Footprints className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">Steps</h3>
              <p className="text-lg font-bold text-white">
                {isLoading ? '—' : steps?.toLocaleString() || '0'}
              </p>
            </div>
          </div>
          {isComplete && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </motion.div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Target: {target.toLocaleString()}</span>
            <span className={`font-semibold ${isComplete ? 'text-emerald-400' : 'text-slate-400'}`}>
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
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                  : 'bg-gradient-to-r from-emerald-500/50 to-teal-500/50'
              }`}
            />
          </div>
        </div>

        {/* Remaining steps */}
        {!isComplete && steps !== null && (
          <div className="mt-3 text-xs text-slate-400">
            {Math.max(0, target - steps).toLocaleString()} steps remaining
          </div>
        )}
      </div>
    </motion.div>
  );
}

