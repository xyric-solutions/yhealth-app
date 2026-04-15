'use client';

import { motion } from 'framer-motion';
import { Award } from 'lucide-react';
import type { PrimaryGoalCardProps } from './types';

export function PrimaryGoalCard({ goal }: PrimaryGoalCardProps) {
  return (
    <motion.div
      className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-[#02000f] border border-emerald-600/30 bg-gradient-to-br from-emerald-600/5 to-transparent mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Award className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
        </div>
        <div>
          <span className="text-[11px] sm:text-xs text-emerald-400 font-medium uppercase tracking-wide">
            Primary Goal
          </span>
          <h3 className="text-base sm:text-xl font-semibold text-white mt-0.5">
            {goal?.title || 'Achieve your health goals'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {goal?.timeline?.durationWeeks || 16} week journey
          </p>
        </div>
      </div>
    </motion.div>
  );
}
