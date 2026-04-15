"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  Loader2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  callSummaryService,
  type ActionItem,
  type ActionCategory,
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

const categoryColors: Record<ActionCategory, { text: string; bg: string }> = {
  fitness: { text: "text-orange-400", bg: "bg-orange-500/20" },
  nutrition: { text: "text-green-400", bg: "bg-green-500/20" },
  sleep: { text: "text-violet-400", bg: "bg-violet-500/20" },
  stress: { text: "text-red-400", bg: "bg-red-500/20" },
  wellness: { text: "text-blue-400", bg: "bg-blue-500/20" },
  goal: { text: "text-yellow-400", bg: "bg-yellow-500/20" },
  habit: { text: "text-cyan-400", bg: "bg-cyan-500/20" },
  follow_up: { text: "text-slate-400", bg: "bg-slate-500/20" },
};

const priorityStyles = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-green-500",
};

interface ActionItemListProps {
  compact?: boolean;
  limit?: number;
  onViewAll?: () => void;
}

export function ActionItemList({
  compact: _compact = false,
  limit = 5,
  onViewAll,
}: ActionItemListProps) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await callSummaryService.getPendingActionItems();
      if (response.success && response.data) {
        setItems(response.data.actionItems);
      }
    } catch (err: unknown) {
      console.error("Failed to load action items:", err);
      setError((err instanceof Error ? err.message : null) || "Failed to load action items");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleItem = async (item: ActionItem) => {
    if (updatingItems.has(item.id)) return;

    setUpdatingItems((prev) => new Set(prev).add(item.id));

    const newStatus = item.status === "completed" ? "pending" : "completed";

    try {
      const response = await callSummaryService.updateActionItemStatus(item.id, newStatus);
      if (response.success && response.data) {
        if (newStatus === "completed") {
          // Remove from list after animation
          setTimeout(() => {
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          }, 300);
          toast.success("Action completed! 🎉");
        } else {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? response.data! : i))
          );
        }
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

  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return null;

    const date = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: "Overdue", color: "text-red-400" };
    if (diffDays === 0) return { text: "Today", color: "text-amber-400" };
    if (diffDays === 1) return { text: "Tomorrow", color: "text-blue-400" };
    if (diffDays <= 7) return { text: `${diffDays} days`, color: "text-slate-400" };
    return { text: date.toLocaleDateString(), color: "text-slate-500" };
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const displayItems = items.slice(0, limit);
  const hasMore = items.length > limit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">Action Items</h3>
            {items.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
                {items.length}
              </span>
            )}
          </div>
          {onViewAll && items.length > 0 && (
            <button
              onClick={onViewAll}
              className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {items.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm text-slate-400">All caught up! No pending actions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {displayItems.map((item) => {
                const Icon = categoryIcons[item.category] || Target;
                const colors = categoryColors[item.category] || categoryColors.follow_up;
                const isUpdating = updatingItems.has(item.id);
                const dueInfo = formatDueDate(item.dueDate);

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, scale: 0.9 }}
                    className={`p-3 rounded-xl bg-white/5 border-l-4 ${priorityStyles[item.priority]} hover:bg-white/10 transition-colors`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleItem(item)}
                        disabled={isUpdating}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-400 hover:text-green-400 transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{item.content}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}
                          >
                            <Icon className="w-3 h-3" />
                            {item.category}
                          </span>
                          {dueInfo && (
                            <span className={`inline-flex items-center gap-1 text-xs ${dueInfo.color}`}>
                              <Clock className="w-3 h-3" />
                              {dueInfo.text}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {hasMore && (
              <button
                onClick={onViewAll}
                className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                +{items.length - limit} more items
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ActionItemList;

