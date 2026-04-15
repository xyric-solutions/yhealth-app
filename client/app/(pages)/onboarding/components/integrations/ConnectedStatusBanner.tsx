'use client';

import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import type { ConnectedStatusBannerProps } from './types';

/**
 * ConnectedStatusBanner - Shows the number of connected integrations
 *
 * Features:
 * - Animated entry/exit
 * - Gradient background
 * - Auto-sync messaging
 */
export function ConnectedStatusBanner({ connectedCount }: ConnectedStatusBannerProps) {
  if (connectedCount === 0) return null;

  return (
    <motion.div
      className="mb-8 p-5 rounded-2xl bg-linear-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/30"
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-lg">
            {connectedCount} integration{connectedCount !== 1 ? 's' : ''} connected
          </h3>
          <p className="text-sm text-slate-400">
            Your data will sync automatically in the background
          </p>
        </div>
        <Sparkles className="w-6 h-6 text-emerald-400" />
      </div>
    </motion.div>
  );
}
