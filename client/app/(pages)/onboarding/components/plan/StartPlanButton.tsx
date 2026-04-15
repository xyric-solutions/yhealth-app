'use client';

import { motion } from 'framer-motion';
import { Rocket, Play, RefreshCw } from 'lucide-react';
import type { StartPlanButtonProps } from './types';

export function StartPlanButton({ onClick, isStarting }: StartPlanButtonProps) {
  return (
    <>
      <motion.button
        onClick={onClick}
        disabled={isStarting}
        className={`
          w-full flex items-center justify-center gap-2 sm:gap-3
          py-3 sm:py-4 rounded-xl font-medium text-base sm:text-lg
          bg-gradient-to-r from-emerald-600 to-teal-500 text-white
          border border-white/10 shadow-lg shadow-emerald-600/20
          hover:shadow-emerald-600/30 transition-all duration-300
          ${isStarting ? 'opacity-70 cursor-not-allowed' : ''}
        `}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        whileHover={isStarting ? {} : { scale: 1.01 }}
        whileTap={isStarting ? {} : { scale: 0.99 }}
      >
        {isStarting ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Setting Up Your Plan...</span>
          </>
        ) : (
          <>
            <Rocket className="w-5 h-5" />
            <span>Start your journey</span>
            <Play className="w-4 h-4" />
          </>
        )}
      </motion.button>

      <motion.p
        className="text-center mt-3 sm:mt-4 text-xs sm:text-sm text-slate-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Your first session is tomorrow at 9:00 AM
      </motion.p>
    </>
  );
}
