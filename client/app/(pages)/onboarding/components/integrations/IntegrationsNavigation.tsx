'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, SkipForward } from 'lucide-react';
import type { IntegrationsNavigationProps } from './types';

/**
 * IntegrationsNavigation - Back/Next navigation buttons
 *
 * Features:
 * - Skip option when no connections
 * - Animated shine effect on continue button
 * - Hover animations
 */
export function IntegrationsNavigation({
  hasConnections,
  onBack,
  onNext,
  onSkip,
}: IntegrationsNavigationProps) {
  return (
    <motion.div
      className="flex flex-col sm:flex-row items-center justify-between gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <motion.button
        onClick={onBack}
        className="group flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-slate-400 hover:text-white transition-colors"
        whileHover={{ x: -4 }}
        whileTap={{ scale: 0.98 }}
      >
        <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
        Back
      </motion.button>

      <div className="flex items-center gap-3">
        {!hasConnections && (
          <SkipButton onClick={onSkip || onNext} />
        )}
        {hasConnections ? (
          <ContinueButton onClick={onNext} />
        ) : (
          <ContinueWithoutButton onClick={onNext} />
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="group relative flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-base
               bg-linear-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25
               hover:shadow-xl hover:shadow-cyan-500/30 transition-all duration-300 overflow-hidden"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: '-100%' }}
        animate={{ x: '200%' }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3,
        }}
      />
      <span className="relative z-10">Continue to Preferences</span>
      <ArrowRight className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-1" />
    </motion.button>
  );
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="group flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-slate-400 hover:text-amber-400 transition-colors border border-slate-700 hover:border-amber-500/50"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <SkipForward className="w-4 h-4" />
      <span>Skip for now</span>
    </motion.button>
  );
}

function ContinueWithoutButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="group relative flex items-center gap-3 px-6 py-3 rounded-xl font-medium text-base
               bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-300"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <span>Continue Without</span>
      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
    </motion.button>
  );
}
