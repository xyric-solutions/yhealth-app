"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,

  CheckCircle2,
  Clock,
  Award,
  AlertTriangle,
  BarChart3,
  PieChart,
  Calendar,
  Activity,
  Sparkles,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Goal {
  id: string;
  category: string;
  title: string;
  status: string;
  progress: number;
  startDate: string;
  targetDate: string;
  completedAt?: string;
  currentValue: number;
  targetValue: number;
}

interface GoalsAnalyticsProps {
  goals: Goal[];
}

const COLORS = {
  active: "#10b981", // emerald-500
  completed: "#0ea5e9", // sky-500
  paused: "#f59e0b", // amber-500
  abandoned: "#ef4444", // red-500
  primary: "#059669", // emerald-600
  secondary: "#0284c7", // sky-600
};

export function GoalsAnalytics({ goals }: GoalsAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "daily">("overview");

  const analytics = useMemo(() => {
    if (goals.length === 0) return null;

    const now = new Date();
    const completed = goals.filter((g) => g.status === "completed");
    const active = goals.filter((g) => g.status === "active");
    const paused = goals.filter((g) => g.status === "paused");

    // Calculate completion rate
    const completionRate =
      goals.length > 0 ? Math.round((completed.length / goals.length) * 100) : 0;

    // Calculate average days to completion
    const completedWithDates = completed.filter((g) => g.completedAt);
    const avgDaysToCompletion =
      completedWithDates.length > 0
        ? Math.round(
            completedWithDates.reduce((sum, g) => {
              const start = new Date(g.startDate).getTime();
              const end = new Date(g.completedAt!).getTime();
              return sum + (end - start) / (1000 * 60 * 60 * 24);
            }, 0) / completedWithDates.length
          )
        : 0;

    // Calculate success rate (completed vs abandoned)
    const abandoned = goals.filter((g) => g.status === "abandoned");
    const totalEnded = completed.length + abandoned.length;
    const successRate =
      totalEnded > 0 ? Math.round((completed.length / totalEnded) * 100) : 0;

    // Progress over time (last 12 weeks)
    const progressOverTime = Array.from({ length: 12 }, (_, i) => {
      const weekDate = new Date();
      weekDate.setDate(weekDate.getDate() - (11 - i) * 7);
      const weekGoals = goals.filter((g) => {
        const start = new Date(g.startDate);
        return start <= weekDate;
      });
      const avgProgress =
        weekGoals.length > 0
          ? Math.round(weekGoals.reduce((sum, g) => sum + g.progress, 0) / weekGoals.length)
          : 0;
      return {
        week: `Week ${i + 1}`,
        progress: avgProgress,
      };
    });

    // Status distribution
    const statusData = [
      { name: "Active", value: active.length, color: COLORS.active },
      { name: "Completed", value: completed.length, color: COLORS.completed },
      { name: "Paused", value: paused.length, color: COLORS.paused },
      {
        name: "Abandoned",
        value: abandoned.length,
        color: COLORS.abandoned,
      },
    ].filter((item) => item.value > 0);

    // Category breakdown
    const categoryCounts: Record<string, number> = {};
    goals.forEach((g) => {
      categoryCounts[g.category] = (categoryCounts[g.category] || 0) + 1;
    });
    const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      value,
    }));

    // Goals needing attention (low progress, approaching deadline)
    const needsAttention = goals.filter((g) => {
      if (g.status !== "active") return false;
      const target = new Date(g.targetDate);
      const daysLeft = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return g.progress < 50 && daysLeft < 30;
    });

    // Fastest completed goals
    const fastestCompleted = completedWithDates
      .map((g) => {
        const start = new Date(g.startDate).getTime();
        const end = new Date(g.completedAt!).getTime();
        return {
          ...g,
          daysToComplete: Math.round((end - start) / (1000 * 60 * 60 * 24)),
        };
      })
      .sort((a, b) => a.daysToComplete - b.daysToComplete)
      .slice(0, 3);

    // Average progress by category
    const categoryProgress: Record<string, { total: number; count: number }> = {};
    goals.forEach((g) => {
      if (!categoryProgress[g.category]) {
        categoryProgress[g.category] = { total: 0, count: 0 };
      }
      categoryProgress[g.category].total += g.progress;
      categoryProgress[g.category].count += 1;
    });
    const categoryProgressData = Object.entries(categoryProgress).map(([name, data]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      progress: Math.round(data.total / data.count),
    }));

    // Daily completion data (last 30 days)
    const dailyCompletion = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (29 - i));
      const dateStr = date.toISOString().split("T")[0];

      // Calculate daily completion based on goals that were active on that day
      const activeGoalsOnDate = goals.filter((g) => {
        const start = new Date(g.startDate);
        const end = g.completedAt ? new Date(g.completedAt) : new Date(g.targetDate);
        return start <= date && date <= end;
      });

      // Simulate daily progress updates (based on goal progress distribution)
      const totalProgress = activeGoalsOnDate.reduce((sum, g) => {
        // Estimate daily progress contribution
        const daysSinceStart = Math.ceil(
          (date.getTime() - new Date(g.startDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const totalDays = Math.ceil(
          (new Date(g.targetDate).getTime() - new Date(g.startDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const expectedProgress = Math.min(100, Math.round((daysSinceStart / totalDays) * 100));
        const actualProgress = g.progress;
        // If goal is completed and date is before completion, use 100%
        if (g.status === "completed" && g.completedAt && date <= new Date(g.completedAt)) {
          return sum + 100;
        }
        // Otherwise use actual progress if date is today or past, expected if future
        return sum + (date <= now ? actualProgress : expectedProgress);
      }, 0);

      const avgProgress =
        activeGoalsOnDate.length > 0
          ? Math.round(totalProgress / activeGoalsOnDate.length)
          : 0;

      // Calculate completion percentage (goals that reached 100% on or before this date)
      const completedOnDate = activeGoalsOnDate.filter((g) => {
        if (g.status === "completed" && g.completedAt) {
          return new Date(g.completedAt).toISOString().split("T")[0] === dateStr;
        }
        return false;
      }).length;

      const completionRate =
        activeGoalsOnDate.length > 0
          ? Math.round((completedOnDate / activeGoalsOnDate.length) * 100)
          : 0;

      // Calculate daily activity (progress updates)
      const progressUpdates = activeGoalsOnDate.filter((g) => {
        // Simulate: assume progress updates happen when progress increases
        return g.progress > 0;
      }).length;

      return {
        date: dateStr,
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString("en-US", { month: "short" }),
        avgProgress,
        completionRate,
        activeGoals: activeGoalsOnDate.length,
        completedGoals: completedOnDate,
        progressUpdates,
        cumulativeProgress: totalProgress,
      };
    });

    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    for (let i = dailyCompletion.length - 1; i >= 0; i--) {
      const day = dailyCompletion[i];
      if (day.completionRate >= 50 || day.progressUpdates > 0) {
        tempStreak++;
        if (i === dailyCompletion.length - 1) {
          currentStreak = tempStreak;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return {
      completionRate,
      avgDaysToCompletion,
      successRate,
      progressOverTime,
      statusData,
      categoryData,
      needsAttention,
      fastestCompleted,
      categoryProgressData,
      dailyCompletion,
      currentStreak,
      longestStreak,
    };
  }, [goals]);

  if (!analytics || goals.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/5"
      >
        <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No analytics data available yet</p>
        <p className="text-sm text-slate-500 mt-1">Create some goals to see insights</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
        <button
          onClick={() => setActiveTab("overview")}
          className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
            activeTab === "overview"
              ? "text-white"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          {activeTab === "overview" && (
            <motion.div
              layoutId="activeAnalyticsTab"
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 opacity-90 shadow-lg shadow-emerald-500/30"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <BarChart3 className={`w-5 h-5 relative z-10 ${activeTab === "overview" ? "text-white" : ""}`} />
          <span className="relative z-10">Overview</span>
        </button>
        <button
          onClick={() => setActiveTab("daily")}
          className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
            activeTab === "daily"
              ? "text-white"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          {activeTab === "daily" && (
            <motion.div
              layoutId="activeAnalyticsTab"
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 opacity-90 shadow-lg shadow-emerald-500/30"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Activity className={`w-5 h-5 relative z-10 ${activeTab === "daily" ? "text-white" : ""}`} />
          <span className="relative z-10">Daily Completion</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-2xl font-bold text-white">{analytics.completionRate}%</span>
          </div>
          <p className="text-sm font-medium text-slate-300">Completion Rate</p>
          <p className="text-xs text-slate-400 mt-1">
            {goals.filter((g) => g.status === "completed").length} of {goals.length} goals
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-sky-500/10 to-sky-600/10 border border-sky-500/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-sky-400" />
            </div>
            <span className="text-2xl font-bold text-white">{analytics.avgDaysToCompletion}</span>
          </div>
          <p className="text-sm font-medium text-slate-300">Avg Days to Complete</p>
          <p className="text-xs text-slate-400 mt-1">Based on completed goals</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-sky-500/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-2xl font-bold text-white">{analytics.successRate}%</span>
          </div>
          <p className="text-sm font-medium text-slate-300">Success Rate</p>
          <p className="text-xs text-slate-400 mt-1">Completed vs abandoned</p>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Over Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-white/5 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Progress Over Time</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={analytics.progressOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="progress"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-2xl bg-white/5 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white">Status Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <RechartsPieChart>
              <Pie
                data={analytics.statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {analytics.statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Category Breakdown */}
      {analytics.categoryData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl bg-white/5 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Category Breakdown</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.categoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals Needing Attention */}
        {analytics.needsAttention.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Needs Attention</h3>
            </div>
            <div className="space-y-3">
              {analytics.needsAttention.slice(0, 3).map((goal) => (
                <div
                  key={goal.id}
                  className="p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <p className="text-sm font-medium text-white mb-1">{goal.title}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Progress: {goal.progress}%</span>
                    <span className="text-amber-400">
                      {Math.ceil(
                        // eslint-disable-next-line react-hooks/purity
                        (new Date(goal.targetDate).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )}{" "}
                      days left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Fastest Completed */}
        {analytics.fastestCompleted.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-white">Fastest Completed</h3>
            </div>
            <div className="space-y-3">
              {analytics.fastestCompleted.map((goal, index) => (
                <div
                  key={goal.id}
                  className="p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-white">{goal.title}</p>
                    <span className="text-xs text-emerald-400 font-medium">
                      #{index + 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Completed in {goal.daysToComplete} days
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
          </motion.div>
        )}

        {activeTab === "daily" && (
          <motion.div
            key="daily"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Daily Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">
                  {analytics.dailyCompletion[analytics.dailyCompletion.length - 1]?.completionRate || 0}%
                </p>
                <p className="text-sm font-medium text-slate-300">Today&apos;s Completion</p>
                <p className="text-xs text-slate-400 mt-1">
                  {analytics.dailyCompletion[analytics.dailyCompletion.length - 1]?.completedGoals || 0} of{" "}
                  {analytics.dailyCompletion[analytics.dailyCompletion.length - 1]?.activeGoals || 0} goals
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-5 rounded-2xl bg-gradient-to-br from-sky-500/10 to-sky-600/10 border border-sky-500/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-sky-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{analytics.currentStreak}</p>
                <p className="text-sm font-medium text-slate-300">Current Streak</p>
                <p className="text-xs text-slate-400 mt-1">Days in a row</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-sky-500/20 flex items-center justify-center">
                    <Award className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{analytics.longestStreak}</p>
                <p className="text-sm font-medium text-slate-300">Longest Streak</p>
                <p className="text-xs text-slate-400 mt-1">Best performance</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-5 rounded-2xl bg-gradient-to-br from-sky-500/10 to-emerald-500/10 border border-sky-500/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-sky-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">
                  {Math.round(
                    analytics.dailyCompletion.reduce((sum, d) => sum + d.completionRate, 0) /
                      analytics.dailyCompletion.length
                  )}
                  %
                </p>
                <p className="text-sm font-medium text-slate-300">30-Day Average</p>
                <p className="text-xs text-slate-400 mt-1">Completion rate</p>
              </motion.div>
            </div>

            {/* Daily Completion Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/5 via-sky-500/5 to-emerald-500/5 border border-emerald-500/20 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Daily Completion Rate</h3>
                    <p className="text-sm text-slate-400">Last 30 days performance</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                    <span className="text-slate-300">Completion Rate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-sky-500" />
                    <span className="text-slate-300">Avg Progress</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={analytics.dailyCompletion}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis
                    dataKey="dayNum"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickFormatter={(value, index) => {
                      const day = analytics.dailyCompletion[index];
                      return day ? `${day.dayNum}\n${day.day}` : value;
                    }}
                  />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                    labelFormatter={(label, _payload) => {
                      const day = analytics.dailyCompletion.find((d) => d.dayNum === label);
                      return day ? `${day.month} ${day.dayNum}, ${day.day}` : label;
                    }}
                    formatter={(value: number | undefined, name: string | undefined) => [
                      `${value ?? 0}%`,
                      (name === "completionRate" ? "Completion Rate" : "Avg Progress"),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="completionRate"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorCompletion)"
                  />
                  <Area
                    type="monotone"
                    dataKey="avgProgress"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fillOpacity={0.6}
                    fill="url(#colorProgress)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Daily Activity Line Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-sky-500/5 via-emerald-500/5 to-sky-500/5 border border-sky-500/20 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Daily Activity Trends</h3>
                    <p className="text-sm text-slate-400">Progress updates and goal activity</p>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={analytics.dailyCompletion}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis
                    dataKey="dayNum"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickFormatter={(value, index) => {
                      const day = analytics.dailyCompletion[index];
                      return day ? `${day.dayNum}\n${day.day}` : value;
                    }}
                  />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                    labelFormatter={(label, _payload) => {
                      const day = analytics.dailyCompletion.find((d) => d.dayNum === label);
                      return day ? `${day.month} ${day.dayNum}, ${day.day}` : label;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: "20px" }}
                    iconType="line"
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        activeGoals: "Active Goals",
                        progressUpdates: "Progress Updates",
                        completedGoals: "Completed Goals",
                      };
                      return labels[value] || value;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="activeGoals"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", r: 4 }}
                    name="activeGoals"
                  />
                  <Line
                    type="monotone"
                    dataKey="progressUpdates"
                    stroke="#0ea5e9"
                    strokeWidth={3}
                    dot={{ fill: "#0ea5e9", r: 4 }}
                    name="progressUpdates"
                  />
                  <Line
                    type="monotone"
                    dataKey="completedGoals"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ fill: "#059669", r: 4 }}
                    name="completedGoals"
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Weekly Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold text-white">This Week</h3>
                </div>
                <div className="space-y-3">
                  {analytics.dailyCompletion.slice(-7).map((day, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-sm font-semibold text-emerald-400">{day.day}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {day.month} {day.dayNum}
                          </p>
                          <p className="text-xs text-slate-400">{day.activeGoals} active goals</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{day.completionRate}%</p>
                        <p className="text-xs text-slate-400">completed</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-sky-400" />
                  <h3 className="font-semibold text-white">Performance Insights</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-300">Best Day</span>
                      <span className="text-xs text-emerald-400 font-medium">
                        {Math.max(...analytics.dailyCompletion.map((d) => d.completionRate))}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {
                        analytics.dailyCompletion.find(
                          (d) =>
                            d.completionRate ===
                            Math.max(...analytics.dailyCompletion.map((d) => d.completionRate))
                        )?.month
                      }{" "}
                      {
                        analytics.dailyCompletion.find(
                          (d) =>
                            d.completionRate ===
                            Math.max(...analytics.dailyCompletion.map((d) => d.completionRate))
                        )?.dayNum
                      }
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-sky-500/10 to-sky-600/10 border border-sky-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-300">Total Updates</span>
                      <span className="text-xs text-sky-400 font-medium">
                        {analytics.dailyCompletion.reduce((sum, d) => sum + d.progressUpdates, 0)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Progress updates in last 30 days</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-300">Consistency</span>
                      <span className="text-xs text-emerald-400 font-medium">
                        {Math.round(
                          (analytics.dailyCompletion.filter((d) => d.completionRate > 0).length /
                            analytics.dailyCompletion.length) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Days with activity</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

