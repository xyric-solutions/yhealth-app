'use client';

import { motion } from 'framer-motion';
import { Check, ChevronRight, Sparkles } from 'lucide-react';
import { InsightChip } from './InsightChip';
import type { DisplayInsight } from './types';

interface CompletionViewProps {
  insights: DisplayInsight[];
  onComplete: () => void;
}

export function CompletionView({ insights, onComplete }: CompletionViewProps) {
  return (
    <motion.div
      className="flex flex-col items-center gap-6 sm:gap-8 py-12 sm:py-16 px-4"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Icon — sky-600 checkmark circle with decorative sparkles */}
      <motion.div
        className="relative w-20 h-20 sm:w-24 sm:h-24"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {/* Decorative sparkle dots */}
        <motion.div
          className="absolute -top-2 -right-1 text-emerald-400"
          animate={{ opacity: [0.4, 1, 0.4], y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
        >
          <Sparkles className="w-4 h-4" />
        </motion.div>
        <motion.div
          className="absolute -bottom-1 -left-2 text-sky-400"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, 2, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
        >
          <Sparkles className="w-3 h-3" />
        </motion.div>
        <motion.div
          className="absolute top-1 -left-3 text-teal-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 0.8 }}
        >
          <Sparkles className="w-3 h-3" />
        </motion.div>

        {/* Main circle */}
        <div className="absolute inset-0 rounded-full bg-sky-600/20 blur-xl" />
        <div className="relative w-full h-full rounded-full bg-sky-600 flex items-center justify-center shadow-2xl shadow-sky-600/30 border-4 border-sky-600/30">
          <Check className="w-10 h-10 sm:w-12 sm:h-12 text-white" strokeWidth={3} />
        </div>
      </motion.div>

      {/* Text */}
      <div className="text-center">
        <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-3">
          Assessment Complete
        </h3>
        <p className="text-[rgba(239,237,253,0.7)] text-sm sm:text-base max-w-md mx-auto">
          Thank you for sharing. I have everything I need to create your personalized health plan.
        </p>
      </div>

      {/* Insights summary */}
      {insights.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {insights.map((insight, i) => (
            <InsightChip key={insight.id} insight={insight} index={i} />
          ))}
        </div>
      )}

      {/* Continue button — sky-600 */}
      <motion.button
        onClick={onComplete}
        className="group flex items-center justify-center gap-3 w-full max-w-md px-8 py-4 rounded-xl bg-sky-600 text-white font-medium text-lg border border-white/20 shadow-lg shadow-sky-600/20 hover:bg-sky-500 transition-all duration-300"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span>Continue to your plan</span>
        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </motion.button>
    </motion.div>
  );
}
