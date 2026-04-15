/**
 * @file JournalHistory Component
 * @description List of journal entries with filtering, editing, and analytics
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, BookOpen, Calendar, Trash2, RefreshCw, Edit2, X, TrendingUp, BarChart3, PieChart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { journalService } from "@/src/shared/services/wellbeing.service";
import type { JournalEntry } from "@shared/types/domain/wellbeing";
import { format, parseISO, subDays } from "date-fns";
import { confirm } from "@/components/common/ConfirmDialog";
import {

  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface JournalHistoryProps {
  limit?: number;
  onRefresh?: () => void;
}

const COLORS = {
  gratitude: "#fbbf24",
  reflection: "#3b82f6",
  emotional_processing: "#a855f7",
  stress_management: "#ef4444",
  self_compassion: "#10b981",
  future_focus: "#06b6d4",
  cross_pillar: "#8b5cf6",
};

export function JournalHistory({ limit = 20, onRefresh }: JournalHistoryProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editForm, setEditForm] = useState({ entryText: "", prompt: "" });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "analytics">("list");

  useEffect(() => {
    loadEntries();
    
    const handleJournalLogged = () => {
      loadEntries();
    };
    
    window.addEventListener('journal-logged', handleJournalLogged);
    return () => {
      window.removeEventListener('journal-logged', handleJournalLogged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const loadEntries = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await journalService.getEntries({ limit, page: 1 });

      if (result.success && result.data) {
        setEntries(result.data.entries);
      } else {
        setError(result.error?.message || "Failed to load entries");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load entries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEditForm({
      entryText: entry.entryText,
      prompt: entry.prompt || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    
    if (!editForm.entryText.trim()) {
      setError("Entry text cannot be empty");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await journalService.updateEntry(editingEntry.id, {
        entry_text: editForm.entryText.trim(),
        prompt: editForm.prompt.trim() || undefined,
      });

      if (result.success) {
        setEditingEntry(null);
        loadEntries();
        onRefresh?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('journal-logged'));
        }
      } else {
        setError(result.error?.message || "Failed to update entry");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to update entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entry: JournalEntry) => {
    const confirmed = await confirm({
      title: "Delete Journal Entry",
      description: "Are you sure you want to delete this entry? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const result = await journalService.deleteEntry(entry.id);

      if (result.success) {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        if (selectedEntry?.id === entry.id) {
          setSelectedEntry(null);
        }
        if (editingEntry?.id === entry.id) {
          setEditingEntry(null);
        }
        onRefresh?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('journal-logged'));
        }
      } else {
        alert(result.error?.message || "Failed to delete entry");
      }
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to delete entry");
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryColor = (category?: string): string => {
    switch (category) {
      case "gratitude":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "reflection":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "emotional_processing":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "stress_management":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "self_compassion":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "future_focus":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  // Analytics data
  const analyticsData = useMemo(() => {
    const last30Days = subDays(new Date(), 30);
    const filteredEntries = entries.filter((e) => 
      e.loggedAt && new Date(e.loggedAt) >= last30Days
    );

    // Word count over time
    const wordCountData = filteredEntries
      .map((entry) => ({
        date: format(parseISO(entry.loggedAt), "MMM d"),
        words: entry.wordCount || entry.entryText.split(/\s+/).filter(Boolean).length,
        fullDate: entry.loggedAt,
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

    // Category distribution
    const categoryCounts = filteredEntries.reduce((acc: Record<string, number>, entry) => {
      const cat = entry.promptCategory || "other";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      value,
      color: COLORS[name as keyof typeof COLORS] || "#6b7280",
    }));

    // Daily entries count
    const dailyCounts = filteredEntries.reduce((acc: Record<string, number>, entry) => {
      const date = format(parseISO(entry.loggedAt), "MMM d");
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const dailyData = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { wordCountData, categoryData, dailyData };
  }, [entries]);

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-blue-600/5 to-indigo-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Journal History</h3>
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
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-blue-600/5 to-indigo-600/5" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Journal History</h3>
          </div>
          <div className="text-center py-8">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={loadEntries}
              className="px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm transition-colors border border-emerald-500/30"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
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
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-blue-600/5 to-indigo-600/5" />
        <div className="relative p-6">
          {/* Header with view toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">Journal History</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === "list" ? "analytics" : "list")}
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20"
              >
                {viewMode === "list" ? (
                  <>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 mr-2" />
                    List View
                  </>
                )}
              </Button>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-white/80">No entries yet</p>
                <p className="text-sm mt-1 text-slate-400">Start journaling to see your reflections here</p>
              </motion.div>
            </div>
          ) : viewMode === "analytics" ? (
            <div className="space-y-6">
              {/* Word Count Trend */}
              {analyticsData.wordCountData.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Word Count Trend
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={analyticsData.wordCountData}>
                      <defs>
                        <linearGradient id="wordGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: "11px" }} />
                      <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "1px solid #10b981",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="words"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#wordGradient)"
                        name="Words"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Category Distribution */}
              {analyticsData.categoryData.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-emerald-400" />
                    Category Distribution
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <RechartsPieChart>
                        <Pie
                          data={analyticsData.categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {analyticsData.categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #10b981",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "#e2e8f0" }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {analyticsData.categoryData.map((item, index) => (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-slate-800/50 to-slate-800/30 border border-emerald-500/10"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-sm text-white">{item.name}</span>
                          </div>
                          <span className="text-sm font-bold text-emerald-400">{item.value}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Daily Entries Count */}
              {analyticsData.dailyData.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    Daily Entries
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analyticsData.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: "11px" }} />
                      <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "1px solid #10b981",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Entries" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4 rounded-xl bg-gradient-to-r from-slate-800/50 to-slate-800/30 border border-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300 group cursor-pointer"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {entry.promptCategory && (
                        <span
                          className={`
                            inline-block px-3 py-1 rounded-full text-xs font-medium mb-2 border
                            ${getCategoryColor(entry.promptCategory)}
                          `}
                        >
                          {entry.promptCategory.replace(/_/g, " ")}
                        </span>
                      )}
                      <p className="text-white font-medium mb-1 line-clamp-2">
                        {entry.prompt || "Free-form entry"}
                      </p>
                      <p className="text-sm text-slate-400 line-clamp-2">
                        {entry.entryText}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {entry.loggedAt ? format(parseISO(entry.loggedAt), "MMM d, yyyy") : "N/A"}
                        </span>
                        <span>{entry.wordCount || entry.entryText.split(/\s+/).filter(Boolean).length} words</span>
                      </div>
                    </div>
                    {/* Edit and Delete buttons */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(entry);
                        }}
                        className="p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry);
                        }}
                        disabled={isDeleting}
                        className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Entry Detail Modal */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Journal Entry</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Calendar className="w-4 h-4" />
                {selectedEntry.loggedAt ? format(parseISO(selectedEntry.loggedAt), "MMMM d, yyyy 'at' h:mm a") : "N/A"}
              </div>
              {selectedEntry.promptCategory && (
                <span
                  className={`
                    inline-block px-3 py-1 rounded-full text-xs font-medium border
                    ${getCategoryColor(selectedEntry.promptCategory)}
                  `}
                >
                  {selectedEntry.promptCategory.replace(/_/g, " ")}
                </span>
              )}
              {selectedEntry.prompt && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30">
                  <p className="text-white font-medium">{selectedEntry.prompt}</p>
                </div>
              )}
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="text-white whitespace-pre-wrap leading-relaxed">
                  {selectedEntry.entryText}
                </p>
              </div>
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  onClick={() => setSelectedEntry(null)}
                  className="flex-1 border-white/20 hover:bg-white/10"
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedEntry(null);
                    handleEdit(selectedEntry);
                  }}
                  className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedEntry)}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEditingEntry(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl shadow-2xl shadow-emerald-500/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-blue-600/10 to-indigo-600/10" />
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
                      <Edit2 className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Edit Journal Entry</h3>
                  </div>
                  <button
                    onClick={() => setEditingEntry(null)}
                    className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Prompt (optional)
                    </label>
                    <Textarea
                      value={editForm.prompt}
                      onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                      placeholder="Journal prompt..."
                      rows={2}
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Entry Text *
                    </label>
                    <Textarea
                      value={editForm.entryText}
                      onChange={(e) => setEditForm({ ...editForm, entryText: e.target.value })}
                      placeholder="Write your thoughts..."
                      rows={8}
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {editForm.entryText.trim().split(/\s+/).filter(Boolean).length} words
                    </p>
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
                      onClick={() => setEditingEntry(null)}
                      disabled={isSaving}
                      className="flex-1 border-white/20 hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      disabled={isSaving || !editForm.entryText.trim()}
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
