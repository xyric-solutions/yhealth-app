/**
 * @file EnergyTimeline Component
 * @description Visual chart showing energy levels throughout the day with edit functionality
 */

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, TrendingUp, Calendar, Edit2, Trash2, X } from "lucide-react";
import { energyService } from "@/src/shared/services/wellbeing.service";
import { format, subDays } from "date-fns";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { SliderInput } from "@/components/common/questions/SliderInput";
import { Input } from "@/components/ui/input";

interface EnergyTimelineItem {
  id?: string;
  timestamp: string;
  energyRating: number;
  contextTag?: string;
  contextNote?: string;
}

interface EnergyTimelineProps {
  days?: number;
  onRefresh?: () => void;
}

const CONTEXT_TAGS = [
  "post-meal",
  "post-workout",
  "during-work",
  "after-sleep",
  "after-caffeine",
  "after-social-activity",
];

export function EnergyTimeline({ days = 7, onRefresh }: EnergyTimelineProps) {
  const [timeline, setTimeline] = useState<EnergyTimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<{ id: string; energyRating: number; contextTag?: string; contextNote?: string } | null>(null);
  const [editForm, setEditForm] = useState({ energyRating: 5, contextTag: "", contextNote: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [_isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "chart">("chart");

  useEffect(() => {
    loadTimeline();
    
    const handleEnergyLogged = () => {
      loadTimeline();
    };
    
    window.addEventListener('energy-logged', handleEnergyLogged);
    return () => {
      window.removeEventListener('energy-logged', handleEnergyLogged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const loadTimeline = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = subDays(new Date(), days).toISOString().split("T")[0];

      const result = await energyService.getTimeline(startDate, endDate);

      if (result.success && result.data) {
        setTimeline(result.data.timeline);
      } else {
        setError(result.error?.message || "Failed to load timeline");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load timeline");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (log: EnergyTimelineItem) => {
    if (!log.id) {
      setError("Cannot edit: Log ID not available");
      return;
    }
    try {
      const result = await energyService.getLogById(log.id);
      if (result.success && result.data) {
        setEditingLog(result.data.energyLog);
        setEditForm({
          energyRating: result.data.energyLog.energyRating,
          contextTag: result.data.energyLog.contextTag || "",
          contextNote: result.data.energyLog.contextNote || "",
        });
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load log");
    }
  };

  const handleSave = async () => {
    if (!editingLog) return;
    
    setIsSaving(true);
    try {
      const result = await energyService.updateLog(editingLog.id, {
        energy_rating: editForm.energyRating,
        context_tag: editForm.contextTag || undefined,
        context_note: editForm.contextNote || undefined,
      });

      if (result.success) {
        setEditingLog(null);
        loadTimeline();
        onRefresh?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('energy-logged'));
        }
      } else {
        setError(result.error?.message || "Failed to update log");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to update log");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (logId: string) => {
    if (!confirm("Are you sure you want to delete this energy log?")) return;
    
    setIsDeleting(true);
    try {
      const result = await energyService.deleteLog(logId);
      if (result.success) {
        loadTimeline();
        onRefresh?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('energy-logged'));
        }
      } else {
        setError(result.error?.message || "Failed to delete log");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to delete log");
    } finally {
      setIsDeleting(false);
    }
  };

  // Prepare chart data
  const chartData = timeline.map((item) => ({
    date: format(new Date(item.timestamp), "MMM d"),
    time: format(new Date(item.timestamp), "h:mm a"),
    fullDate: item.timestamp,
    energy: item.energyRating,
    context: item.contextTag || "none",
  }));

  // Group by date for daily averages
  const dailyData = timeline.reduce((acc: Record<string, { date: string; values: number[]; count: number }>, item) => {
    const date = format(new Date(item.timestamp), "MMM d");
    if (!acc[date]) {
      acc[date] = { date, values: [], count: 0 };
    }
    acc[date].values.push(item.energyRating);
    acc[date].count++;
    return acc;
  }, {});

  const dailyChartData = Object.values(dailyData).map((day) => ({
    date: day.date,
    average: day.values.reduce((a: number, b: number) => a + b, 0) / day.values.length,
    min: Math.min(...day.values),
    max: Math.max(...day.values),
    count: day.count,
  }));

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-yellow-600/5 to-orange-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Energy Timeline</h3>
          </div>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-yellow-600/5 to-orange-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Energy Timeline</h3>
          </div>
          <div className="text-center py-8">
            <p className="text-red-400 text-sm mb-2">{error}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={loadTimeline}
              className="px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm transition-colors border border-emerald-500/30"
            >
              Retry
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-yellow-600/5 to-orange-600/5" />
        <div className="relative p-6">
          {/* Header with view toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">Energy Timeline ({days} days)</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === "chart" ? "list" : "chart")}
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20"
              >
                {viewMode === "chart" ? "List View" : "Chart View"}
              </Button>
            </div>
          </div>

          {timeline.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-white/80">No energy data yet</p>
                <p className="text-sm mt-1 text-slate-400">Start logging your energy levels to see patterns</p>
              </motion.div>
            </div>
          ) : viewMode === "chart" ? (
            <div className="space-y-6">
              {/* Daily Average Chart */}
              {dailyChartData.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-4">Daily Average Energy</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={dailyChartData}>
                      <defs>
                        <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis
                        dataKey="date"
                        stroke="#9ca3af"
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis
                        domain={[0, 10]}
                        stroke="#9ca3af"
                        style={{ fontSize: "12px" }}
                        label={{ value: "Energy", angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "#9ca3af" } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "1px solid #10b981",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                        }}
                        labelStyle={{ color: "#e2e8f0" }}
                        formatter={(value: unknown) => [`${Number(value).toFixed(1)}/10`, "Average"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="average"
                        stroke="#fbbf24"
                        strokeWidth={3}
                        fill="url(#energyGradient)"
                        name="Average Energy"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Detailed Line Chart */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-4">Detailed Energy Levels</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis
                      dataKey="time"
                      stroke="#9ca3af"
                      style={{ fontSize: "11px" }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      domain={[0, 10]}
                      stroke="#9ca3af"
                      style={{ fontSize: "12px" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #10b981",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      formatter={(value: unknown) => [`${Number(value).toFixed(1)}/10`, "Energy"]}
                    />
                    <Legend wrapperStyle={{ color: "#e2e8f0" }} />
                    <Line
                      type="monotone"
                      dataKey="energy"
                      stroke="#fbbf24"
                      strokeWidth={3}
                      dot={{ fill: "#fbbf24", r: 5 }}
                      activeDot={{ r: 7, fill: "#f59e0b" }}
                      name="Energy Level"
                      isAnimationActive={true}
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Stats Bar Chart */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-4">Energy Distribution</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: "12px" }} />
                    <YAxis domain={[0, 10]} stroke="#9ca3af" style={{ fontSize: "12px" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #10b981",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="average" fill="#fbbf24" radius={[8, 8, 0, 0]} name="Average" />
                    <Bar dataKey="max" fill="#f97316" radius={[8, 8, 0, 0]} name="Max" opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.slice(-20).reverse().map((item, index) => (
                <motion.div
                  key={item.id || item.timestamp}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-800/50 to-slate-800/30 border border-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300 group"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {format(new Date(item.timestamp), "MMM d, h:mm a")}
                    </p>
                    {item.contextTag && (
                      <p className="text-xs text-slate-400 mt-1 capitalize">
                        {item.contextTag.replace(/-/g, " ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        {item.energyRating}
                      </p>
                      <p className="text-xs text-slate-400">/10</p>
                    </div>
                    {/* Visual bar with animation */}
                    <div className="w-24 h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.energyRating / 10) * 100}%` }}
                        transition={{ duration: 0.8, delay: index * 0.05 }}
                        className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-full shadow-lg shadow-yellow-500/30"
                      />
                    </div>
                    {/* Edit and Delete buttons */}
                    {item.id && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleEdit(item)}
                          className="p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(item.id!)}
                          className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEditingLog(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl shadow-2xl shadow-emerald-500/20 max-w-md w-full"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-yellow-600/10 to-orange-600/10" />
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
                      <Edit2 className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Edit Energy Log</h3>
                  </div>
                  <button
                    onClick={() => setEditingLog(null)}
                    className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      Energy Level (1-10)
                    </label>
                    <SliderInput
                      value={editForm.energyRating}
                      onChange={(val) => setEditForm({ ...editForm, energyRating: val })}
                      min={1}
                      max={10}
                      step={1}
                      showValue
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      Context (optional)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CONTEXT_TAGS.map((tag) => {
                        const isSelected = editForm.contextTag === tag;
                        return (
                          <motion.button
                            key={tag}
                            onClick={() => setEditForm({ ...editForm, contextTag: isSelected ? "" : tag })}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              isSelected
                                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                                : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                            }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {tag.replace(/-/g, " ")}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Note (optional)
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g., after heavy lunch..."
                      value={editForm.contextNote}
                      onChange={(e) => setEditForm({ ...editForm, contextNote: e.target.value })}
                      maxLength={300}
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    />
                  </div>

                  {error && (
                    <motion.div
                      className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setEditingLog(null)}
                      disabled={isSaving}
                      className="flex-1 border-white/20 hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/30"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
