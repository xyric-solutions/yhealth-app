'use client';

import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

/**
 * MinimumIntegrationBanner - Info banner when no integrations are connected
 *
 * Features:
 * - Animated entry/exit
 * - Blue info styling (not blocking)
 * - Explains benefit of integrations
 */
export function MinimumIntegrationBanner({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;

  return (
    <motion.div
      className="mb-8 p-5 rounded-2xl bg-linear-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 border border-blue-500/30"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Info className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-blue-300 font-semibold mb-1">
            Integrations are optional
          </h4>
          <p className="text-sm text-slate-400">
            Connecting your health devices or apps enables your AI coach to provide
            personalized, data-driven recommendations. You can skip this step and
            connect integrations later from your settings.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
