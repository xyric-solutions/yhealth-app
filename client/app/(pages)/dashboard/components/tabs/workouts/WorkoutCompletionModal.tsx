"use client";

/**
 * @file WorkoutCompletionModal
 * Celebratory modal displayed after a user finishes a workout session,
 * showing summary stats (duration, exercises) and XP earned.
 */

import { motion } from "framer-motion";
import { Trophy, Award } from "lucide-react";
import { formatTime } from "./utils";

interface WorkoutCompletionModalProps {
  isOpen: boolean;
  elapsedSeconds: number;
  totalExercises: number;
  onDone: () => void;
}

export function WorkoutCompletionModal({
  isOpen,
  elapsedSeconds,
  totalExercises,
  onDone,
}: WorkoutCompletionModalProps) {
  if (!isOpen) return null;

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
        className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-3xl p-8 max-w-sm w-full text-center"
      >
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1 }}
          className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center"
        >
          <Trophy className="w-12 h-12 text-amber-400" />
        </motion.div>

        <h3 className="text-2xl font-bold text-white mb-2">Workout Complete! 🎉</h3>
        <p className="text-slate-300 mb-4">Amazing work! You crushed it!</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-2xl font-bold text-white">{formatTime(elapsedSeconds)}</p>
            <p className="text-xs text-slate-400">Duration</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-2xl font-bold text-white">{totalExercises}</p>
            <p className="text-xs text-slate-400">Exercises</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6 text-emerald-400">
          <Award className="w-5 h-5" />
          <span className="font-medium">+50 XP Earned!</span>
        </div>

        <button
          onClick={onDone}
          className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
        >
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}
