'use client';

import { motion } from 'framer-motion';
import { Droplet, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { ParticleBackground } from './ParticleBackground';

interface EnhancedWaterIntakeWidgetProps {
  consumed: number; // in ml
  target: number; // in ml
  isLoading?: boolean;
  onAddWater?: () => void;
}

export function EnhancedWaterIntakeWidget({
  consumed,
  target,
  isLoading,
  onAddWater,
}: EnhancedWaterIntakeWidgetProps) {
  const progress = useMemo(() => {
    if (!consumed || consumed === 0) return 0;
    return Math.min((consumed / target) * 100, 100);
  }, [consumed, target]);

  const glasses = Math.round(consumed / 250); // Assuming 250ml per glass
  const targetGlasses = Math.round(target / 250);
  const percentage = Math.round(progress);
  const isComplete = progress >= 100;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-black/40 border border-cyan-400/50 p-6 backdrop-blur-sm shadow-lg shadow-cyan-500/20"
    >
      <ParticleBackground color="cyan" particleCount={120} className="rounded-2xl" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Droplet className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">Water Intake</h3>
              <p className="text-lg font-bold text-white">
                {isLoading ? '—' : `${glasses}/${targetGlasses}`}
              </p>
              <p className="text-xs text-slate-400">
                {isLoading ? '—' : `${Math.round(consumed)}ml / ${Math.round(target)}ml`}
              </p>
            </div>
          </div>
          {onAddWater && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onAddWater}
              className="w-10 h-10 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 flex items-center justify-center transition-colors"
            >
              <Plus className="w-5 h-5 text-cyan-400" />
            </motion.button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Progress</span>
            <span className={`font-semibold ${isComplete ? 'text-cyan-400' : 'text-slate-400'}`}>
              {percentage}%
            </span>
          </div>
          <div className="h-3 bg-slate-800/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                isComplete
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-400'
                  : 'bg-gradient-to-r from-cyan-500/70 to-blue-500/70'
              }`}
            />
          </div>
        </div>

        {/* Remaining */}
        {!isComplete && (
          <div className="mt-3 text-xs text-slate-400">
            {Math.max(0, Math.round((target - consumed) / 250))} glasses remaining
          </div>
        )}
      </div>
    </motion.div>
  );
}

