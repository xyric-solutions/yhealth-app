/**
 * @file HabitDashboard Component
 * @description Enhanced habit tracking view with edit/delete, analytics, and charts
 */

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Plus,
  Check,

  Calendar,
  Target,
  Edit,
  Trash2,
  BarChart3,
  List,
  TrendingUp,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { habitService } from "@/src/shared/services/wellbeing.service";
import type { Habit, HabitLog } from "@shared/types/domain/wellbeing";
import type { HabitAnalyticsResponse } from "@/src/shared/services/wellbeing.service";
import { format, parseISO } from "date-fns";
import {

  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { HabitFormModal } from "./HabitFormModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ViewMode = "list" | "analytics";

const _COLORS = {
  emerald: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
  },
};

const CHART_COLORS = ["#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];

export function HabitDashboard() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [habitAnalytics, setHabitAnalytics] = useState<HabitAnalyticsResponse['analytics'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingIds, setLoggingIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);

  useEffect(() => {
    loadHabits();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedHabit) {
      loadHabitData(selectedHabit.id);
    }
  }, [selectedHabit]);

  const loadHabits = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await habitService.getHabits(false);

      if (result.success && result.data) {
        setHabits(result.data.habits);
        if (result.data.habits.length > 0 && !selectedHabit) {
          setSelectedHabit(result.data.habits[0]);
        }
      } else {
        setError(result.error?.message || "Failed to load habits");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load habits");
    } finally {
      setIsLoading(false);
    }
  };

  const loadHabitData = async (habitId: string) => {
    setIsLoadingLogs(true);
    try {
      const [logsResult, analyticsResult] = await Promise.all([
        habitService.getLogs(habitId, 30),
        habitService.getAnalytics(habitId, 30),
      ]);

      if (logsResult.success && logsResult.data) {
        setHabitLogs(logsResult.data.logs);
      }
      if (analyticsResult.success && analyticsResult.data) {
        setHabitAnalytics(analyticsResult.data.analytics);
      }
    } catch (err: unknown) {
      console.error("Failed to load habit data:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleToggleCompletion = async (habit: Habit, completed: boolean) => {
    setLoggingIds((prev) => new Set(prev).add(habit.id));

    try {
      const result = await habitService.logCompletion(habit.id, {
        completed,
        log_date: format(new Date(), "yyyy-MM-dd"),
      });

      if (result.success) {
        loadHabits();
        if (selectedHabit?.id === habit.id) {
          loadHabitData(habit.id);
        }
      } else {
        alert(result.error?.message || "Failed to log habit");
      }
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to log habit");
    } finally {
      setLoggingIds((prev) => {
        const next = new Set(prev);
        next.delete(habit.id);
        return next;
      });
    }
  };

  const handleEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setIsFormOpen(true);
  };

  const handleDelete = (habit: Habit) => {
    setHabitToDelete(habit);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!habitToDelete) return;

    try {
      const result = await habitService.deleteHabit(habitToDelete.id);
      if (result.success) {
        if (selectedHabit?.id === habitToDelete.id) {
          setSelectedHabit(null);
          setHabitLogs([]);
          setHabitAnalytics(null);
        }
        loadHabits();
      } else {
        alert(result.error?.message || "Failed to delete habit");
      }
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to delete habit");
    } finally {
      setDeleteDialogOpen(false);
      setHabitToDelete(null);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingHabit(null);
    loadHabits();
  };

  // Prepare chart data
  const completionChartData = habitLogs
    .slice()
    .reverse()
    .map((log) => ({
      date: format(parseISO(log.logDate), "MMM dd"),
      completed: log.completed ? 1 : 0,
      value: log.value || 0,
    }));

  const weeklyCompletionData = (() => {
    const weeks: Record<string, { completed: number; total: number }> = {};
    habitLogs.forEach((log) => {
      const week = format(parseISO(log.logDate), "yyyy-'W'ww");
      if (!weeks[week]) {
        weeks[week] = { completed: 0, total: 0 };
      }
      weeks[week].total++;
      if (log.completed) {
        weeks[week].completed++;
      }
    });
    return Object.entries(weeks).map(([week, data]) => ({
      week,
      completionRate: (data.completed / data.total) * 100,
      completed: data.completed,
      total: data.total,
    }));
  })();

  const categoryDistribution = (() => {
    const categories: Record<string, number> = {};
    habits.forEach((habit) => {
      const category = habit.category || "Uncategorized";
      categories[category] = (categories[category] || 0) + 1;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  })();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border-emerald-500/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Target className="w-5 h-5 text-emerald-400" />
            My Habits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border-emerald-500/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Target className="w-5 h-5 text-emerald-400" />
            My Habits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400 text-sm">{error}</p>
          <Button
            onClick={loadHabits}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header with View Toggle */}
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white text-2xl">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
              className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500"
            >
              <Target className="w-5 h-5 text-white" />
            </motion.div>
            My Habits ({habits.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {habits.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  onClick={() => setViewMode("list")}
                  className={
                    viewMode === "list"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "text-slate-400 hover:text-white"
                  }
                >
                  <List className="w-4 h-4 mr-2" />
                  List
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "analytics" ? "default" : "ghost"}
                  onClick={() => setViewMode("analytics")}
                  className={
                    viewMode === "analytics"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "text-slate-400 hover:text-white"
                  }
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </Button>
              </div>
            )}
            <Button
              size="sm"
              onClick={() => {
                setEditingHabit(null);
                setIsFormOpen(true);
              }}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Habit
            </Button>
          </div>
        </div>

        {habits.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-64 text-slate-400"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 10, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <Target className="w-16 h-16 mb-4 opacity-50" />
            </motion.div>
            <p className="text-lg mb-2 font-medium">No habits yet</p>
            <p className="text-sm text-center mb-4">
              Start tracking habits to build consistency
            </p>
            <Button
              onClick={() => {
                setEditingHabit(null);
                setIsFormOpen(true);
              }}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Habit
            </Button>
          </motion.div>
        ) : viewMode === "list" ? (
          <div className="space-y-3">
            {habits.map((habit) => (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                className={`group relative p-5 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-emerald-500/20 hover:border-emerald-500/40 transition-all  ${
                  selectedHabit?.id === habit.id ? "ring-2 ring-emerald-500/50" : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-teal-600/5 to-cyan-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center justify-between gap-4">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setSelectedHabit(habit)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-semibold text-lg">{habit.habitName}</h3>
                      {habit.trackingType && (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 capitalize border border-emerald-500/30">
                          {habit.trackingType.replace("_", " ")}
                        </span>
                      )}
                      {habit.category && (
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-700/50 text-slate-300">
                          {habit.category}
                        </span>
                      )}
                    </div>
                    {habit.description && (
                      <p className="text-sm text-slate-400 mb-2 line-clamp-2">
                        {habit.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {habit.frequency}
                      </span>
                      {habit.targetValue && (
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Target: {habit.targetValue} {habit.unit || ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleCompletion(habit, true)}
                      disabled={loggingIds.has(habit.id)}
                      className="border-emerald-500/50 hover:bg-emerald-500/20 hover:border-emerald-500"
                    >
                      {loggingIds.has(habit.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 text-emerald-400" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(habit)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-400"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(habit)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
              >
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-white font-semibold">Total Habits</h3>
                </div>
                <p className="text-3xl font-bold text-emerald-400">{habits.length}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
              >
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-white font-semibold">Active Habits</h3>
                </div>
                <p className="text-3xl font-bold text-emerald-400">
                  {habits.filter((h) => h.isActive).length}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Flame className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-white font-semibold">Categories</h3>
                </div>
                <p className="text-3xl font-bold text-emerald-400">
                  {new Set(habits.map((h) => h.category || "Uncategorized")).size}
                </p>
              </motion.div>
            </div>

            {/* Category Distribution */}
            {categoryDistribution.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-emerald-500/20"
              >
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  Habit Distribution by Category
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent || 0 * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #059669",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Selected Habit Analytics */}
            {selectedHabit && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                  <h3 className="text-white font-semibold mb-2">{selectedHabit.habitName}</h3>
                  <p className="text-sm text-slate-400">{selectedHabit.description}</p>
                </div>

                {isLoadingLogs ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  </div>
                ) : habitAnalytics ? (
                  <>
                    {/* Analytics Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
                      >
                        <p className="text-xs text-slate-400 mb-1">Completion Rate</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {habitAnalytics.completionRate.toFixed(1)}%
                        </p>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
                      >
                        <p className="text-xs text-slate-400 mb-1">Current Streak</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {habitAnalytics.currentStreak}
                        </p>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
                      >
                        <p className="text-xs text-slate-400 mb-1">Longest Streak</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {habitAnalytics.longestStreak}
                        </p>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
                      >
                        <p className="text-xs text-slate-400 mb-1">Total Completions</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {habitAnalytics.totalCompletions}
                        </p>
                      </motion.div>
                    </div>

                    {/* Completion Trend */}
                    {completionChartData.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-emerald-500/20"
                      >
                        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                          Completion Trend (Last 30 Days)
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={completionChartData}>
                            <defs>
                              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#059669" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                              dataKey="date"
                              stroke="#9ca3af"
                              style={{ fontSize: "12px" }}
                            />
                            <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#1e293b",
                                border: "1px solid #059669",
                                borderRadius: "8px",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="completed"
                              stroke="#059669"
                              fillOpacity={1}
                              fill="url(#colorCompleted)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </motion.div>
                    )}

                    {/* Weekly Completion Rate */}
                    {weeklyCompletionData.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-emerald-500/20"
                      >
                        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-emerald-400" />
                          Weekly Completion Rate
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={weeklyCompletionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                              dataKey="week"
                              stroke="#9ca3af"
                              style={{ fontSize: "12px" }}
                            />
                            <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#1e293b",
                                border: "1px solid #059669",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar dataKey="completionRate" fill="#059669" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </motion.div>
                    )}
                  </>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <p>No analytics data available yet. Start logging your habit to see insights!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Habit Form Modal */}
      <HabitFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        habit={editingHabit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-emerald-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Habit</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              Are you sure you want to delete "{habitToDelete?.habitName}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
