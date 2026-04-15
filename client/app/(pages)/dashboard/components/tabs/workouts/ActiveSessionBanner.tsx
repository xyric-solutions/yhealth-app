"use client";

/**
 * @file ActiveSessionBanner
 * Displays the active workout session banner with timer, pause/stop controls,
 * motivational quote, and progress bar.
 */

import { motion } from "framer-motion";
import {
  Dumbbell,
  Play,
  Pause,
  Square,
  Timer,
  Sparkles,
} from "lucide-react";
import { formatTime } from "./utils";
import type { WorkoutSession } from "./types";

interface ActiveSessionBannerProps {
  workoutName: string;
  session: WorkoutSession;
  currentQuote: string;
  completedExercises: number;
  totalExercises: number;
  progressPercentage: number;
  onTogglePause: () => void;
  onStop: () => void;
}

export function ActiveSessionBanner({
  workoutName,
  session,
  currentQuote,
  completedExercises,
  totalExercises,
  progressPercentage,
  onTogglePause,
  onStop,
}: ActiveSessionBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -20, height: 0 }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 p-4 sm:p-6 relative overflow-hidden">
        {/* Animated background */}
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"
              >
                <Dumbbell className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </motion.div>
              <div className="min-w-0">
                <h3 className="text-white font-bold text-base sm:text-xl truncate">{workoutName}</h3>
                <div className="flex items-center gap-2 text-white/80">
                  <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-xl sm:text-2xl font-mono font-bold">{formatTime(session.elapsedSeconds)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={onTogglePause}
                className="p-2 sm:p-3 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                {session.isPaused ? <Play className="w-5 h-5 sm:w-6 sm:h-6" /> : <Pause className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
              <button
                onClick={onStop}
                className="p-2 sm:p-3 rounded-xl bg-white/20 hover:bg-red-500/50 text-white transition-colors"
              >
                <Square className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Motivational Quote */}
          <motion.div
            key={currentQuote}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-white/90"
          >
            <Sparkles className="w-4 h-4" />
            <p className="text-sm font-medium italic">{currentQuote}</p>
          </motion.div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-white/80 text-sm mb-2">
              <span>Progress</span>
              <span>{completedExercises}/{totalExercises} exercises</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                className="h-full bg-white rounded-full"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
