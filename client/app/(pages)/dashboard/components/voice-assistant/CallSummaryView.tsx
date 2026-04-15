"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Lightbulb,
  CheckCircle2,
  Circle,
  Clock,
  Target,
  Dumbbell,
  Utensils,
  Moon,
  Heart,
  Sparkles,
  Repeat,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  Share2,
} from "lucide-react";
import {
  callSummaryService,
  type CallSummary,
  type ActionItem,
  type ActionCategory,
  formatDuration,
} from "@/src/shared/services/call-summary.service";
import { toast } from "react-hot-toast";

// Icon mapping for categories
const categoryIcons: Record<ActionCategory, typeof Dumbbell> = {
  fitness: Dumbbell,
  nutrition: Utensils,
  sleep: Moon,
  stress: Heart,
  wellness: Sparkles,
  goal: Target,
  habit: Repeat,
  follow_up: Calendar,
};

const categoryColors: Record<ActionCategory, string> = {
  fitness: "text-orange-400 bg-orange-500/20",
  nutrition: "text-green-400 bg-green-500/20",
  sleep: "text-violet-400 bg-violet-500/20",
  stress: "text-red-400 bg-red-500/20",
  wellness: "text-blue-400 bg-blue-500/20",
  goal: "text-yellow-400 bg-yellow-500/20",
  habit: "text-cyan-400 bg-cyan-500/20",
  follow_up: "text-slate-400 bg-slate-500/20",
};

const priorityColors = {
  high: "border-red-500 bg-red-500/10",
  medium: "border-amber-500 bg-amber-500/10",
  low: "border-green-500 bg-green-500/10",
};

interface CallSummaryViewProps {
  callId?: string;
  summary?: CallSummary;
  onClose?: () => void;
  compact?: boolean;
}

export function CallSummaryView({
  callId,
  summary: providedSummary,
  onClose,
  compact = false,
}: CallSummaryViewProps) {
  const [summary, setSummary] = useState<CallSummary | null>(providedSummary || null);
  const [isLoading, setIsLoading] = useState(!providedSummary && !!callId);
  const [error, setError] = useState<string | null>(null);
  const [expandedInsights, setExpandedInsights] = useState(!compact);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (callId && !providedSummary) {
      loadSummary();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, providedSummary]);

  const loadSummary = async () => {
    if (!callId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await callSummaryService.getSummaryByCallId(callId);
      if (response.success && response.data) {
        setSummary(response.data);
      } else {
        setError("Summary not found");
      }
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : null) || "Failed to load summary");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActionItem = async (item: ActionItem) => {
    if (updatingItems.has(item.id)) return;

    setUpdatingItems((prev) => new Set(prev).add(item.id));

    const newStatus = item.status === "completed" ? "pending" : "completed";

    try {
      const response = await callSummaryService.updateActionItemStatus(item.id, newStatus);
      if (response.success && response.data) {
        setSummary((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            actionItems: prev.actionItems.map((ai) =>
              ai.id === item.id ? response.data! : ai
            ),
          };
        });
        toast.success(newStatus === "completed" ? "Action completed!" : "Action reopened");
      }
    } catch (_err) {
      toast.error("Failed to update action item");
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleShare = () => {
    if (!summary) return;
    
    const text = `📋 Call Summary\n\n${summary.summary}\n\n✨ Key Insights:\n${summary.keyInsights.map(i => `• ${i}`).join('\n')}`;
    
    if (navigator.share) {
      navigator.share({
        title: "Call Summary",
        text,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Summary copied to clipboard");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
        <p className="text-slate-400">{error || "No summary available"}</p>
      </div>
    );
  }

  const completedCount = summary.actionItems.filter((i) => i.status === "completed").length;
  const totalCount = summary.actionItems.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Call Summary
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {summary.depthMode === "deep" ? "Comprehensive" : "Brief"} summary •{" "}
            {formatDuration(summary.duration)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Summary Text */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {summary.summary}
        </p>
        {summary.emotionalTrend && (
          <p className="mt-3 text-xs text-slate-400">
            Emotional tone: <span className="text-purple-400 capitalize">{summary.emotionalTrend}</span>
          </p>
        )}
      </div>

      {/* Key Insights */}
      {summary.keyInsights.length > 0 && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setExpandedInsights(!expandedInsights)}
            className="w-full p-4 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-white">
                Key Insights ({summary.keyInsights.length})
              </span>
            </div>
            {expandedInsights ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          <AnimatePresence>
            {expandedInsights && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-2">
                  {summary.keyInsights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-2"
                    >
                      <span className="text-yellow-400 mt-0.5">•</span>
                      <p className="text-sm text-slate-300">{insight}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Action Items */}
      {summary.actionItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-green-400" />
              Action Items
            </h4>
            <span className="text-xs text-slate-400">
              {completedCount}/{totalCount} completed
            </span>
          </div>

          <div className="space-y-2">
            {summary.actionItems.map((item) => {
              const Icon = categoryIcons[item.category] || Target;
              const colorClass = categoryColors[item.category] || "text-slate-400 bg-slate-500/20";
              const isUpdating = updatingItems.has(item.id);

              return (
                <motion.div
                  key={item.id}
                  layout
                  className={`p-3 rounded-xl border-l-4 bg-white/5 ${priorityColors[item.priority]} ${
                    item.status === "completed" ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleActionItem(item)}
                      disabled={isUpdating}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                      ) : item.status === "completed" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          item.status === "completed"
                            ? "text-slate-400 line-through"
                            : "text-white"
                        }`}
                      >
                        {item.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${colorClass}`}>
                          <Icon className="w-3 h-3" />
                          {item.category}
                        </span>
                        {item.dueDate && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="w-3 h-3" />
                            {new Date(item.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default CallSummaryView;

