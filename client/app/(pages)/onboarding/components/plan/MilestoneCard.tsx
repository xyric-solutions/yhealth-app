'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import type { MilestoneCardProps } from './types';

export function MilestoneCard({ milestone }: MilestoneCardProps) {
  return (
    <motion.div
      className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-emerald-600/10 border border-emerald-600/30 mb-6 sm:mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
    >
      <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center">
        <Star className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" fill="currentColor" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] sm:text-xs text-emerald-400 font-medium">
          First Milestone
        </span>
        <p className="text-sm sm:text-base font-semibold text-white">{milestone.title}</p>
        <span className="text-xs text-emerald-400/60">{milestone.description}</span>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium bg-emerald-600/20 text-emerald-400">
          Day {milestone.day}
        </span>
      </div>
    </motion.div>
  );
}
