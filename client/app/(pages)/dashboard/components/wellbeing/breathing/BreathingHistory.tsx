"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Wind, Clock, Target, TrendingUp, Loader2, Flame, Award, Timer, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BreathingTest, BreathingStats as BreathingStatsType } from "@shared/types/domain/wellbeing";

interface BreathingHistoryProps {
  tests?: BreathingTest[];
  stats?: BreathingStatsType;
  isLoading?: boolean;
  className?: string;
  maxItems?: number;
  showStats?: boolean;
}

const testTypeConfig: Record<string, { label: string; icon: typeof Wind; gradient: string; iconBg: string }> = {
  breath_hold: {
    label: "Breath Hold",
    icon: Timer,
    gradient: "from-cyan-500/20 to-teal-500/20",
    iconBg: "bg-gradient-to-br from-cyan-500 to-teal-500",
  },
  box_breathing: {
    label: "Box Breathing",
    icon: Target,
    gradient: "from-violet-500/20 to-purple-500/20",
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-500",
  },
  "4-7-8": {
    label: "4-7-8 Relaxation",
    icon: Wind,
    gradient: "from-emerald-500/20 to-green-500/20",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-500",
  },
  custom: {
    label: "Custom Pattern",
    icon: Sparkles,
    gradient: "from-amber-500/20 to-orange-500/20",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
  },
};

const lungCapacityConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; progressColor: string }> = {
  poor: {
    label: "Poor",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
    progressColor: "bg-gradient-to-r from-red-500 to-red-400",
  },
  fair: {
    label: "Fair",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    borderColor: "border-yellow-500/30",
    progressColor: "bg-gradient-to-r from-yellow-500 to-yellow-400",
  },
  good: {
    label: "Good",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/30",
    progressColor: "bg-gradient-to-r from-emerald-500 to-emerald-400",
  },
  excellent: {
    label: "Excellent",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    borderColor: "border-cyan-500/30",
    progressColor: "bg-gradient-to-r from-cyan-500 to-teal-400",
  },
};

const getCapacityProgress = (capacity: string): number => {
  switch (capacity) {
    case "poor": return 25;
    case "fair": return 50;
    case "good": return 75;
    case "excellent": return 100;
    default: return 0;
  }
};

export function BreathingHistory({
  tests = [],
  stats,
  isLoading = false,
  className,
  maxItems = 5,
  showStats = false,
}: BreathingHistoryProps) {
  const displayTests = tests.slice(0, maxItems);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-[200px]", className)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mx-auto" />
            <div className="absolute inset-0 blur-xl bg-cyan-500/30 rounded-full" />
          </div>
          <p className="text-slate-400 text-sm mt-3">Loading your history...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-4", className)}
    >
      {/* Optional Quick Stats */}
      {showStats && stats && stats.totalTests > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden p-3 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-purple-500/10" />
            <div className="relative">
              <div className="text-2xl font-bold text-white">{stats.totalTests}</div>
              <div className="text-xs text-slate-400">Total Tests</div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden p-3 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-cyan-500/30 text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10" />
            <div className="relative">
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                {stats.bestBreathHoldSeconds.toFixed(0)}s
              </div>
              <div className="text-xs text-slate-400">Best Hold</div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden p-3 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 text-center"
          >
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br",
              stats.improvementPercentage > 0 ? "from-emerald-500/10 to-green-500/10" : "from-slate-500/10 to-slate-600/10"
            )} />
            <div className="relative">
              <div className="flex items-center justify-center gap-1">
                {stats.recentTrend === "improving" && (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                )}
                <span
                  className={cn(
                    "text-lg font-bold",
                    stats.improvementPercentage > 0 ? "text-emerald-400" : "text-slate-400"
                  )}
                >
                  {stats.improvementPercentage > 0 ? "+" : ""}
                  {stats.improvementPercentage.toFixed(0)}%
                </span>
              </div>
              <div className="text-xs text-slate-400">Improvement</div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Recent Tests Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-300">Recent Sessions</h4>
          {tests.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              {tests.length}
            </span>
          )}
        </div>
        {tests.length > maxItems && (
          <span className="text-xs text-slate-500">
            Showing {maxItems} of {tests.length}
          </span>
        )}
      </div>

      {/* Test List */}
      <AnimatePresence mode="popLayout">
        {displayTests.length > 0 ? (
          <div className="space-y-3">
            {displayTests.map((test, index) => {
              const config = testTypeConfig[test.testType] || testTypeConfig.custom;
              const capacityConfig = lungCapacityConfig[test.lungCapacityEstimate || "fair"];
              const Icon = config.icon;

              return (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  {/* Gradient overlay on hover */}
                  <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br",
                    config.gradient
                  )} />

                  {/* Top highlight line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent group-hover:via-cyan-500/50 transition-colors duration-300" />

                  <div className="relative p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left side - Icon and Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <motion.div
                          whileHover={{ rotate: [0, -10, 10, 0] }}
                          transition={{ duration: 0.4 }}
                          className={cn(
                            "p-2.5 rounded-xl shadow-lg",
                            config.iconBg
                          )}
                        >
                          <Icon className="w-4 h-4 text-white" />
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm group-hover:text-cyan-50 transition-colors truncate">
                            {config.label}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(test.completedAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right side - Results */}
                      <div className="text-right shrink-0">
                        {test.breathHoldDurationSeconds && (
                          <div className="flex items-baseline gap-1 justify-end">
                            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                              {test.breathHoldDurationSeconds.toFixed(1)}
                            </span>
                            <span className="text-sm text-cyan-400/70">s</span>
                          </div>
                        )}
                        {test.lungCapacityEstimate && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border capitalize mt-1",
                              capacityConfig.bgColor,
                              capacityConfig.color,
                              capacityConfig.borderColor
                            )}
                          >
                            {test.lungCapacityEstimate === "excellent" && <Award className="w-3 h-3" />}
                            {capacityConfig.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lung Capacity Progress Bar */}
                    {test.lungCapacityEstimate && (
                      <div className="mt-3">
                        <div className="h-1.5 w-full rounded-full bg-slate-700/50 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${getCapacityProgress(test.lungCapacityEstimate)}%` }}
                            transition={{ delay: index * 0.05 + 0.2, duration: 0.5, ease: "easeOut" }}
                            className={cn("h-full rounded-full", capacityConfig.progressColor)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Additional metrics row */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700/30">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <div className="p-1 rounded bg-slate-700/50">
                          <Target className="w-3 h-3" />
                        </div>
                        <span>{test.totalCyclesCompleted} cycles</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <div className="p-1 rounded bg-slate-700/50">
                          <Timer className="w-3 h-3" />
                        </div>
                        <span>{formatDuration(test.totalDurationSeconds)}</span>
                      </div>
                      {test.consistencyScore !== undefined && test.consistencyScore > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="p-1 rounded bg-emerald-500/20">
                            <Flame className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-emerald-400 font-medium">{test.consistencyScore}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden text-center py-10 rounded-xl border border-dashed border-slate-700/50 bg-slate-800/20"
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:20px_20px]" />

            <div className="relative">
              <motion.div
                animate={{
                  y: [0, -8, 0],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="relative mb-4"
              >
                <div className="absolute inset-0 blur-xl bg-cyan-500/20 rounded-full scale-150" />
                <Wind className="w-12 h-12 text-slate-600 mx-auto relative" />
              </motion.div>
              <p className="text-slate-400 mb-1 font-medium">No breathing tests yet</p>
              <p className="text-slate-500 text-sm">Complete your first test to see your history</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default BreathingHistory;
