"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Star,
  Sparkles,
  Crown,
  Flame,
  Medal,
  Rocket,
  X,
  Plus,
  Clock,
  Zap,
  Dumbbell,
  TrendingUp,
  Target,
  Calendar,
} from "lucide-react";
import { useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import type { PlanCompletionStats } from "./types";

// --- Progress-Based Theming ---

interface CelebrationTier {
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
  bgGradient: string;
  borderColor: string;
  accentColor: string;
  confettiColors: string[];
  icon: typeof Trophy;
}

function getTier(rate: number): CelebrationTier {
  if (rate >= 90) return {
    title: "Legendary Finish!",
    subtitle: "You crushed every single week. Absolute beast mode!",
    emoji: "👑",
    gradient: "from-amber-400 to-yellow-500",
    bgGradient: "from-amber-500/20 to-yellow-500/20",
    borderColor: "border-amber-400/40",
    accentColor: "text-amber-400",
    confettiColors: ["#fbbf24", "#f59e0b", "#d97706", "#fcd34d"],
    icon: Crown,
  };
  if (rate >= 70) return {
    title: "Amazing Effort!",
    subtitle: "You showed incredible dedication throughout this program!",
    emoji: "🔥",
    gradient: "from-emerald-400 to-teal-500",
    bgGradient: "from-emerald-500/20 to-teal-500/20",
    borderColor: "border-emerald-400/40",
    accentColor: "text-emerald-400",
    confettiColors: ["#34d399", "#10b981", "#14b8a6", "#2dd4bf"],
    icon: Flame,
  };
  if (rate >= 50) return {
    title: "Great Job!",
    subtitle: "Solid commitment! Every workout counts toward your goals.",
    emoji: "💪",
    gradient: "from-cyan-400 to-blue-500",
    bgGradient: "from-cyan-500/20 to-blue-500/20",
    borderColor: "border-cyan-400/40",
    accentColor: "text-cyan-400",
    confettiColors: ["#22d3ee", "#06b6d4", "#0ea5e9", "#38bdf8"],
    icon: Target,
  };
  return {
    title: "Well Done!",
    subtitle: "You completed the program. Every step forward matters!",
    emoji: "⭐",
    gradient: "from-violet-400 to-purple-500",
    bgGradient: "from-violet-500/20 to-purple-500/20",
    borderColor: "border-violet-400/40",
    accentColor: "text-violet-400",
    confettiColors: ["#a78bfa", "#8b5cf6", "#7c3aed", "#c084fc"],
    icon: Star,
  };
}

const FLOATING_EMOJIS = ["🏆", "⭐", "🔥", "💪", "🎉", "✨", "🥇", "🚀"];

// --- Celebration Modal ---

interface PlanCompletionCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNewPlan: () => void;
  stats: PlanCompletionStats | null;
}

export function PlanCompletionCelebration({
  isOpen,
  onClose,
  onCreateNewPlan,
  stats,
}: PlanCompletionCelebrationProps) {
  const fireConfetti = useCallback((colors: string[]) => {
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    // Big burst in the middle
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.6 },
        colors,
      });
    }, 300);
  }, []);

  useEffect(() => {
    if (isOpen && stats) {
      const tier = getTier(stats.overallCompletionRate);
      fireConfetti(tier.confettiColors);
    }
  }, [isOpen, stats, fireConfetti]);

  if (!stats) return null;

  const tier = getTier(stats.overallCompletionRate);
  const TierIcon = tier.icon;

  const statCards = [
    { label: "Workouts", value: `${stats.totalWorkoutsCompleted}/${stats.totalWorkoutsPlanned}`, icon: Dumbbell, color: "text-orange-400" },
    { label: "Total Time", value: stats.totalMinutes > 60 ? `${Math.round(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m` : `${stats.totalMinutes}m`, icon: Clock, color: "text-cyan-400" },
    { label: "Calories", value: stats.totalCalories.toLocaleString(), icon: Zap, color: "text-amber-400" },
    { label: "Exercises", value: String(stats.totalExercisesCompleted), icon: Target, color: "text-emerald-400" },
    { label: "Best Streak", value: `${stats.longestStreak} days`, icon: Flame, color: "text-red-400" },
    { label: "Score", value: `${stats.overallCompletionRate}%`, icon: TrendingUp, color: tier.accentColor },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none overflow-y-auto"
          >
            <div
              className={`
                relative w-full max-w-lg pointer-events-auto my-8
                bg-slate-900/95 backdrop-blur-xl rounded-3xl
                border ${tier.borderColor} shadow-2xl overflow-hidden
              `}
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${tier.bgGradient} opacity-30`} />

              {/* Animated Background Orbs */}
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 4, repeat: Infinity }}
                className={`absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br ${tier.gradient} rounded-full blur-3xl`}
              />
              <motion.div
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.15, 0.3, 0.15] }}
                transition={{ duration: 5, repeat: Infinity }}
                className={`absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br ${tier.gradient} rounded-full blur-3xl`}
              />

              {/* Floating Emojis */}
              {FLOATING_EMOJIS.map((emoji, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, y: 40 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    scale: [0.5, 1.2, 1, 0.5],
                    y: [40, -20, -60, -100],
                    x: [(i - 4) * 15, (i - 4) * 25, (i - 4) * 35],
                  }}
                  transition={{
                    delay: 0.5 + i * 0.15,
                    duration: 2.5,
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                  className="absolute top-1/4 left-1/2 text-2xl pointer-events-none"
                >
                  {emoji}
                </motion.div>
              ))}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>

              {/* Content */}
              <div className="relative p-6 sm:p-8 text-center">
                {/* Animated Trophy Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.1, damping: 12, stiffness: 200 }}
                  className="relative mx-auto mb-5 w-28 h-28"
                >
                  {/* Pulsing glow */}
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`absolute inset-0 rounded-full bg-gradient-to-br ${tier.gradient} blur-xl`}
                  />
                  {/* Spinning ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className={`absolute inset-0 rounded-full border-2 border-dashed ${tier.borderColor}`}
                  />
                  {/* Icon */}
                  <div className={`relative w-28 h-28 rounded-full bg-gradient-to-br ${tier.gradient} flex items-center justify-center shadow-2xl`}>
                    <TierIcon className="w-14 h-14 text-white" />
                  </div>
                  {/* Badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg text-xl"
                  >
                    {tier.emoji}
                  </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl sm:text-3xl font-bold text-white mb-2"
                >
                  {tier.title}
                </motion.h2>

                {/* Plan Name */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className={`text-sm font-medium ${tier.accentColor} mb-1`}
                >
                  {stats.planName} — {stats.durationWeeks} Week Program Complete
                </motion.p>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-slate-400 text-sm mb-5"
                >
                  {tier.subtitle}
                </motion.p>

                {/* XP Banner */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35, type: "spring" }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${tier.gradient} mb-5`}
                >
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                  >
                    <Sparkles className="w-5 h-5 text-white" />
                  </motion.div>
                  <span className="font-bold text-white text-sm">
                    +{stats.totalXpEarned} XP Earned!
                  </span>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {statCards.map((card, i) => {
                    const CardIcon = card.icon;
                    return (
                      <motion.div
                        key={card.label}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.06 }}
                        className="p-3 rounded-xl bg-white/5 border border-white/10"
                      >
                        <CardIcon className={`w-4 h-4 ${card.color} mx-auto mb-1`} />
                        <p className="text-lg font-bold text-white">{card.value}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{card.label}</p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Weekly Completion Bars */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="mb-6"
                >
                  <p className="text-xs text-slate-500 uppercase mb-2">Weekly Progress</p>
                  <div className="flex items-end gap-1.5 justify-center h-16">
                    {stats.weeklyCompletionRates.map((rate, i) => (
                      <motion.div
                        key={i}
                        className="flex flex-col items-center gap-1 flex-1"
                      >
                        <div className="w-full bg-slate-800 rounded-t-sm overflow-hidden flex flex-col justify-end" style={{ height: 48 }}>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(rate, 4)}%` }}
                            transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
                            className={`w-full bg-gradient-to-t ${tier.gradient} rounded-t-sm`}
                          />
                        </div>
                        <span className="text-[9px] text-slate-500">W{i + 1}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* CTA Buttons */}
                <div className="space-y-2">
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    onClick={onCreateNewPlan}
                    className={`
                      w-full py-3.5 px-6 rounded-xl font-semibold text-white
                      bg-gradient-to-r ${tier.gradient}
                      hover:opacity-90 transition-all duration-200
                      shadow-lg hover:shadow-xl flex items-center justify-center gap-2
                    `}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Plus className="w-5 h-5" />
                    Start New Plan
                  </motion.button>

                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.95 }}
                    onClick={onClose}
                    className="w-full py-3 px-6 rounded-xl font-medium text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Done
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Plan Completed Banner (inline for Today view) ---

interface PlanCompletedBannerProps {
  planName: string;
  durationWeeks: number;
  completionRate?: number;
  onViewSummary: () => void;
  onCreateNewPlan: () => void;
}

export function PlanCompletedBanner({
  planName,
  durationWeeks,
  completionRate,
  onViewSummary,
  onCreateNewPlan,
}: PlanCompletedBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-12 px-6"
    >
      {/* Trophy Animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 12 }}
        className="relative mb-6"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 w-24 h-24 rounded-full bg-amber-500/20 blur-xl"
        />
        <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-xl shadow-amber-500/25">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-2 -right-2 text-2xl"
        >
          🎉
        </motion.div>
      </motion.div>

      {/* Title */}
      <h3 className="text-2xl font-bold text-white mb-2">Plan Completed!</h3>
      <p className="text-slate-400 mb-1">{planName}</p>
      <div className="flex items-center gap-3 text-sm text-slate-500 mb-6">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {durationWeeks} weeks
        </span>
        {completionRate !== undefined && (
          <span className="flex items-center gap-1">
            <Medal className="w-3.5 h-3.5" />
            {completionRate}% completed
          </span>
        )}
      </div>

      <p className="text-slate-400 text-sm max-w-md mb-8">
        Congratulations on finishing your workout program! Ready for a new challenge?
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onCreateNewPlan}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold shadow-lg shadow-orange-500/25"
        >
          <Rocket className="w-5 h-5" />
          New Plan
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onViewSummary}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          View Summary
        </motion.button>
      </div>
    </motion.div>
  );
}
