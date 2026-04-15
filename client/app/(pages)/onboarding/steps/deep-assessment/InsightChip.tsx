'use client';

import { motion } from 'framer-motion';
import type { DisplayInsight } from './types';

interface InsightChipProps {
  insight: DisplayInsight;
  index: number;
}

const categoryColors: Record<string, string> = {
  motivation: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
  barrier: 'from-red-500/20 to-pink-500/20 border-red-500/30 text-red-400',
  preference: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400',
  lifestyle: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
  goal: 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30 text-purple-400',
  health_status: 'from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400',
};

export function InsightChip({ insight, index }: InsightChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r ${categoryColors[insight.category] || categoryColors.goal} border backdrop-blur-sm`}
    >
      {insight.icon}
      <span className="text-xs font-medium capitalize">{insight.category.replace('_', ' ')}</span>
    </motion.div>
  );
}
