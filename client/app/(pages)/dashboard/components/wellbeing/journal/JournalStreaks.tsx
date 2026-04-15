/**
 * @file JournalStreaks Component
 * @description Display journaling streak information
 */

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Flame, Trophy } from "lucide-react";
import { journalService } from "@/src/shared/services/wellbeing.service";
import { format, parseISO } from "date-fns";

export function JournalStreaks() {
  const [streak, setStreak] = useState<{ currentStreak?: number; longestStreak?: number; streakStartDate?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStreak();
  }, []);

  const loadStreak = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await journalService.getStreak();

      if (result.success && result.data) {
        setStreak(result.data.streak);
      } else {
        setError(result.error?.message || "Failed to load streak");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load streak");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-orange-600/5 to-red-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-4">
            <Flame className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Journal Streak</h3>
          </div>
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !streak) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-orange-600/5 to-red-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-4">
            <Flame className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Journal Streak</h3>
          </div>
          <p className="text-red-400 text-sm">{error || "No streak data"}</p>
        </div>
      </div>
    );
  }

  const milestones = [
    { days: 3, label: "Getting Started", icon: "🌱" },
    { days: 7, label: "Week Warrior", icon: "🔥" },
    { days: 21, label: "Habit Formed", icon: "💪" },
    { days: 30, label: "Monthly Master", icon: "⭐" },
    { days: 100, label: "Century Club", icon: "🏆" },
  ];

  const nextMilestone = milestones.find((m) => m.days > (streak.currentStreak || 0));

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-orange-600/5 to-red-600/5" />
      <div className="relative p-6 space-y-6">
        {/* Current Streak */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="flex items-center justify-center gap-2 mb-2"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Flame className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <p className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              {streak.currentStreak || 0}
            </p>
          </motion.div>
          <p className="text-sm text-slate-400">Day Streak</p>
          {streak.streakStartDate && (
            <p className="text-xs text-slate-500 mt-1">
              Started {format(parseISO(streak.streakStartDate), "MMM d, yyyy")}
            </p>
          )}
        </div>

        {/* Longest Streak */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-emerald-500/20">
          <div className="text-center">
            <Trophy className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{streak.longestStreak || 0}</p>
            <p className="text-xs text-slate-400">Longest Streak</p>
          </div>
        </div>

        {/* Next Milestone */}
        {nextMilestone && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-4 border-t border-emerald-500/20"
          >
            <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-500/20 via-orange-500/20 to-yellow-500/20 border border-emerald-500/30">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{nextMilestone.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{nextMilestone.label}</p>
                  <p className="text-xs text-slate-300 mt-1">
                    {nextMilestone.days - (streak.currentStreak || 0)} more days to go!
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

