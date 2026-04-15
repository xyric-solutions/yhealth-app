"use client";

import { motion } from "framer-motion";
import { Calendar, Flame, Clock, Trophy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WellbeingSidebarProps {
  className?: string;
}

// Placeholder data
const todayPlan = [
  { time: "09:00", activity: "Morning meditation", completed: true },
  { time: "12:00", activity: "Mood check-in", completed: false },
  { time: "18:00", activity: "Evening journal", completed: false },
];

const streaks = [
  { label: "Journaling", days: 7, icon: "📝", color: "from-blue-500 to-indigo-500" },
  { label: "Mood tracking", days: 14, icon: "😊", color: "from-purple-500 to-pink-500" },
  { label: "Breathing", days: 3, icon: "🌬️", color: "from-cyan-500 to-teal-500" },
];

const upcomingSessions = [
  { time: "10:00 AM", title: "Guided Meditation", type: "Live" },
  { time: "2:00 PM", title: "Stress Management", type: "Live" },
];

export function WellbeingSidebar({ className }: WellbeingSidebarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className={cn("hidden lg:block space-y-6", className)}
    >
      {/* Today's Plan */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/95 via-slate-800/80 to-slate-900/95 backdrop-blur-2xl p-6 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5" />
        <div className="relative z-10">
          <div className="mb-5 flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-2.5 border border-blue-500/30"
            >
              <Calendar className="h-5 w-5 text-blue-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-white">Today&apos;s Plan</h3>
          </div>
          <div className="space-y-3">
            {todayPlan.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={{ scale: 1.02, x: 4 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-3.5 transition-all duration-300",
                  item.completed
                    ? "bg-slate-700/30 border border-slate-600/30"
                    : "bg-slate-700/50 border border-slate-600/50 hover:border-blue-500/30 hover:bg-slate-700/70"
                )}
              >
                <span className="text-xs font-bold text-slate-400 min-w-[3rem]">
                  {item.time}
                </span>
                <span
                  className={cn(
                    "flex-1 text-sm font-medium",
                    item.completed ? "text-slate-500 line-through" : "text-slate-300"
                  )}
                >
                  {item.activity}
                </span>
                {item.completed && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Streaks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/95 via-slate-800/80 to-slate-900/95 backdrop-blur-2xl p-6 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5" />
        <div className="relative z-10">
          <div className="mb-5 flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 p-2.5 border border-orange-500/30"
            >
              <Flame className="h-5 w-5 text-orange-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-white">Streaks</h3>
          </div>
          <div className="space-y-3">
            {streaks.map((streak, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1, type: "spring", stiffness: 300 }}
                whileHover={{ scale: 1.05, x: 4 }}
                className="flex items-center justify-between rounded-xl bg-slate-700/30 p-4 border border-slate-600/30 hover:border-orange-500/30 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{streak.icon}</span>
                  <span className="text-sm font-semibold text-slate-300">{streak.label}</span>
                </div>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-gradient-to-r text-sm font-bold text-white shadow-lg",
                    streak.color
                  )}
                >
                  <Flame className="h-4 w-4" />
                  {streak.days}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Upcoming Live Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/95 via-slate-800/80 to-slate-900/95 backdrop-blur-2xl p-6 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
        <div className="relative z-10">
          <div className="mb-5 flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-2.5 border border-purple-500/30"
            >
              <Clock className="h-5 w-5 text-purple-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-white">Upcoming Sessions</h3>
          </div>
          <div className="space-y-3">
            {upcomingSessions.map((session, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                whileHover={{ scale: 1.02, x: 4 }}
                className="rounded-xl bg-slate-700/30 p-4 border border-slate-600/30 hover:border-purple-500/30 transition-all duration-300"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">{session.time}</span>
                  <motion.span
                    whileHover={{ scale: 1.1 }}
                    className="rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2.5 py-1 text-xs font-bold text-purple-300 border border-purple-500/30"
                  >
                    {session.type}
                  </motion.span>
                </div>
                <p className="text-sm font-semibold text-slate-300">{session.title}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Competition Teaser */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        whileHover={{ scale: 1.02, y: -4 }}
        className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-rose-500/20 backdrop-blur-2xl p-6 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-rose-500/10" />
        <motion.div
          className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.2, rotate: 12 }}
              className="rounded-lg bg-gradient-to-br from-yellow-400/30 to-orange-500/30 p-2.5 border border-yellow-400/40"
            >
              <Trophy className="h-5 w-5 text-yellow-300" />
            </motion.div>
            <h3 className="text-lg font-bold text-white">Wellbeing Challenge</h3>
          </div>
          <p className="mb-5 text-sm font-medium text-slate-300 leading-relaxed">
            Join today&apos;s wellbeing challenge and compete with others!
          </p>
          <Button
            className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:from-purple-600 hover:via-pink-600 hover:to-rose-600 text-white font-bold shadow-lg shadow-purple-500/30 border border-purple-400/20 transition-all duration-300"
            size="sm"
          >
            Join Challenge
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
