"use client";

/**
 * @file RestTimerModal
 * Full-screen overlay countdown timer displayed between exercise sets
 * during an active workout session.
 */

import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { formatTime } from "./utils";

interface RestTimerModalProps {
  isResting: boolean;
  restTimeRemaining: number;
  onSkipRest: () => void;
}

export function RestTimerModal({
  isResting,
  restTimeRemaining,
  onSkipRest,
}: RestTimerModalProps) {
  if (!isResting) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="w-24 h-24 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center"
        >
          <RotateCcw className="w-12 h-12 text-cyan-400" />
        </motion.div>

        <h3 className="text-xl font-bold text-white mb-2">Rest Time</h3>
        <p className="text-slate-400 mb-6">Catch your breath and prepare for the next set!</p>

        <div className="text-6xl font-mono font-bold text-cyan-400 mb-6">
          {formatTime(restTimeRemaining)}
        </div>

        <button
          onClick={onSkipRest}
          className="w-full py-3 rounded-xl bg-cyan-500 text-white font-semibold hover:bg-cyan-600 transition-colors"
        >
          Skip Rest
        </button>
      </motion.div>
    </motion.div>
  );
}
