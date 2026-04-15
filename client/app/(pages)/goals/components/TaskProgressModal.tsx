"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CheckCircle2, Circle, Loader2, Sparkles, TrendingUp,
  Dumbbell, Utensils, Smile, BookOpen, Droplets, Activity,
  CheckCircle, AlertCircle, ChevronDown, Save, Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

// ─── Types ──────────────────────────────────────────────────────────

interface GoalAction {
  id: string;
  actionType: string;
  title: string;
  description?: string;
  frequency?: string;
  isCompleted: boolean;
  completedToday: boolean;
  sortOrder: number;
}

interface DataSignal {
  label: string;
  value: string;
  icon: string;
}

interface AutoProgress {
  taskCompletion: { completed: number; total: number; percentage: number };
  dataSignals: DataSignal[];
  calculatedProgress: number;
}

interface Goal {
  id?: string;
  title: string;
  pillar: string;
  targetValue: number;
  targetUnit: string;
  currentValue?: number;
  progress?: number;
  status?: string;
}

interface TaskProgressModalProps {
  goal: Goal;
  isOpen: boolean;
  onClose: () => void;
  onProgressUpdated: (goalId: string, progress: number, currentValue: number) => void;
}

// ─── Icon Map ───────────────────────────────────────────────────────

const signalIcons: Record<string, typeof Dumbbell> = {
  Dumbbell, Utensils, Smile, BookOpen, Droplets, Activity, CheckCircle2,
};

const moodEmojis = [
  { value: 1, emoji: "😞", label: "Struggling" },
  { value: 2, emoji: "😐", label: "Not great" },
  { value: 3, emoji: "🙂", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🤩", label: "Crushing it" },
];

const actionTypeIcons: Record<string, string> = {
  habit: "🔄",
  schedule: "📅",
  journal_prompt: "📝",
  tracking: "📊",
  milestone: "🎯",
  behavioral_trick: "🧠",
};

// ─── Component ──────────────────────────────────────────────────────

export default function TaskProgressModal({
  goal,
  isOpen,
  onClose,
  onProgressUpdated,
}: TaskProgressModalProps) {
  const [actions, setActions] = useState<GoalAction[]>([]);
  const [autoProgress, setAutoProgress] = useState<AutoProgress | null>(null);
  const [loadingActions, setLoadingActions] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState<number>(goal.currentValue || 0);
  const [generating, setGenerating] = useState(false);

  const goalId = goal.id;

  // Fetch actions
  const fetchActions = useCallback(async () => {
    if (!goalId) return;
    setLoadingActions(true);
    try {
      const res = await api.get<{ actions: GoalAction[]; generated: boolean }>(`/assessment/goals/${goalId}/actions`);
      if (res.success && res.data?.actions) {
        setActions(res.data.actions);
        if (res.data.generated) setGenerating(false);
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingActions(false);
    }
  }, [goalId]);

  // Fetch auto-progress
  const fetchAutoProgress = useCallback(async () => {
    if (!goalId) return;
    setLoadingProgress(true);
    try {
      const res = await api.get<{ progress: AutoProgress }>(`/assessment/goals/${goalId}/auto-progress`);
      if (res.success && res.data?.progress) {
        setAutoProgress(res.data.progress);
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingProgress(false);
    }
  }, [goalId]);

  useEffect(() => {
    if (isOpen && goalId) {
      fetchActions();
      fetchAutoProgress();
      setMood(null);
      setNote("");
      setShowManual(false);
      setManualValue(goal.currentValue || 0);
    }
  }, [isOpen, goalId, fetchActions, fetchAutoProgress, goal.currentValue]);

  // Toggle action
  const handleToggle = async (actionId: string) => {
    setTogglingId(actionId);
    try {
      const res = await api.post<{ completed: boolean }>(`/assessment/goals/${goalId}/actions/${actionId}/toggle`, {});
      if (res.success) {
        setActions(prev =>
          prev.map(a => a.id === actionId ? { ...a, completedToday: res.data!.completed } : a)
        );
        // Refetch auto-progress
        fetchAutoProgress();
      }
    } catch {
      // Silent fail
    } finally {
      setTogglingId(null);
    }
  };

  // Save progress
  const handleSave = async () => {
    if (!goalId) return;
    setSaving(true);
    try {
      const progress = showManual
        ? Math.min(100, Math.round((manualValue / goal.targetValue) * 100))
        : autoProgress?.calculatedProgress || goal.progress || 0;

      const currentValue = showManual
        ? manualValue
        : goal.targetValue * (progress / 100);

      await api.patch(`/assessment/goals/${goalId}`, {
        currentValue: Math.round(currentValue * 10) / 10,
      });

      onProgressUpdated(goalId, progress, Math.round(currentValue * 10) / 10);
      onClose();
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  };

  const completedCount = actions.filter(a => a.completedToday).length;
  const totalCount = actions.length;
  const displayProgress = autoProgress?.calculatedProgress ?? goal.progress ?? 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0f0f18] border border-white/[0.08] shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/[0.06] bg-[#0f0f18]/95 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Update Progress</h3>
                <p className="text-xs text-zinc-500 truncate max-w-[300px]">{goal.title}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Auto-Progress Ring + Stats */}
            <div className="flex items-center gap-5 p-4 rounded-xl bg-gradient-to-br from-emerald-500/[0.06] to-sky-500/[0.04] border border-white/[0.06]">
              {/* Progress Ring */}
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke="url(#progressGrad)" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - displayProgress / 100)}`}
                    className="transition-all duration-700"
                  />
                  <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-white tabular-nums">{Math.round(displayProgress)}%</span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {completedCount}/{totalCount} tasks done today
                </p>
                {loadingProgress ? (
                  <p className="text-xs text-zinc-500 mt-1">Calculating progress...</p>
                ) : (
                  <p className="text-xs text-zinc-500 mt-1">Based on your tasks + activity data</p>
                )}

                {/* Data signals */}
                {autoProgress && autoProgress.dataSignals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {autoProgress.dataSignals.map((signal, i) => {
                      const IconComp = signalIcons[signal.icon] || Activity;
                      return (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-400">
                          <IconComp className="h-2.5 w-2.5 text-emerald-400" />
                          {signal.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Daily Tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Daily Tasks
                </h4>
                {totalCount > 0 && (
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    {completedCount}/{totalCount} completed
                  </span>
                )}
              </div>

              {loadingActions ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse">
                      <div className="h-5 w-5 rounded-full bg-white/[0.06]" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 w-3/4 rounded bg-white/[0.06]" />
                        <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-emerald-400 text-center py-1">
                    <Sparkles className="inline h-3 w-3 mr-1" />
                    Generating your personalized tasks...
                  </p>
                </div>
              ) : actions.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-sm">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  No tasks generated yet
                </div>
              ) : (
                <div className="space-y-1.5">
                  {actions.map(action => (
                    <motion.button
                      key={action.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleToggle(action.id)}
                      disabled={togglingId === action.id}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200",
                        "border",
                        action.completedToday
                          ? "bg-emerald-500/[0.06] border-emerald-500/15"
                          : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]"
                      )}
                    >
                      {togglingId === action.id ? (
                        <Loader2 className="h-5 w-5 shrink-0 mt-0.5 animate-spin text-emerald-400" />
                      ) : action.completedToday ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 mt-0.5 text-zinc-600" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          action.completedToday ? "text-emerald-300 line-through decoration-emerald-500/30" : "text-white"
                        )}>
                          <span className="mr-1.5">{actionTypeIcons[action.actionType] || "📋"}</span>
                          {action.title}
                        </p>
                        {action.description && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
                            {action.description}
                          </p>
                        )}
                      </div>
                      {action.frequency && (
                        <span className="text-[9px] text-zinc-600 uppercase tracking-wider shrink-0 mt-1">
                          {action.frequency}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Mood */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">How do you feel about this goal?</h4>
              <div className="flex gap-2">
                {moodEmojis.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMood(mood === m.value ? null : m.value)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all",
                      mood === m.value
                        ? "bg-emerald-500/10 border-emerald-500/20 scale-105"
                        : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <span className="text-[9px] text-zinc-500">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Note */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Quick note <span className="text-zinc-600 font-normal">(optional)</span></h4>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="How's it going? Any wins or blockers?"
                maxLength={300}
                rows={2}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/30 resize-none"
              />
            </div>

            {/* Manual fallback */}
            <div>
              <button
                onClick={() => setShowManual(!showManual)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Edit3 className="h-3 w-3" />
                Manual update
                <ChevronDown className={cn("h-3 w-3 transition-transform", showManual && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showManual && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <input
                        type="number"
                        value={manualValue}
                        onChange={e => setManualValue(Number(e.target.value))}
                        min={0}
                        max={goal.targetValue * 2}
                        className="w-24 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/30 tabular-nums"
                      />
                      <span className="text-sm text-zinc-400">/ {goal.targetValue} {goal.targetUnit}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex gap-3 p-5 border-t border-white/[0.06] bg-[#0f0f18]/95 backdrop-blur-xl">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-zinc-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Progress
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
