'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { PlanStatus } from './types';

interface EmptyStateProps {
  filter: PlanStatus | 'all';
}

const messages: Record<PlanStatus | 'all', { title: string; desc: string }> = {
  all: {
    title: 'No plans yet',
    desc: 'Create your first plan to start your health journey.',
  },
  active: {
    title: 'No active plans',
    desc: 'Start a new plan or resume a paused one to get going.',
  },
  paused: {
    title: 'No paused plans',
    desc: 'Paused plans will appear here when you need a break.',
  },
  completed: {
    title: 'No completed plans',
    desc: 'Complete your first plan to see it here.',
  },
  archived: {
    title: 'No archived plans',
    desc: 'Archived plans will be stored here for reference.',
  },
  draft: {
    title: 'No draft plans',
    desc: 'Draft plans will appear here during creation.',
  },
};

export function EmptyState({ filter }: EmptyStateProps) {
  const msg = messages[filter];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{msg.title}</h3>
      <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">{msg.desc}</p>
    </motion.div>
  );
}
