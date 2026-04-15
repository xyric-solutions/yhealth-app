"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react";
import {
  Target,
  Plus,
  ChevronRight,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Dumbbell,
  Moon,
  Brain,
  Utensils,
  Zap,
  Star,
  Trophy,
  Clock,
  Edit3,
  Trash2,
  MoreVertical,
  Loader2,
  AlertCircle,
  Heart,
  X,
  Check,
  Search,
  Sparkles,
  CheckSquare,
  Square,
  AlertTriangle,
  Save,
  RotateCcw,
  Flame,
  Award,
  Play,
  Pause,
  RefreshCw,
  DollarSign,
  BookHeart,
  Users,
  GraduationCap,
  Briefcase,
  HeartPulse,
  Compass,
  Lightbulb,
  Smile,
  Shield,
  Palette,
  Sprout,
  MessageCircle,
  GripVertical,
  LayoutGrid,
  List,
} from "lucide-react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { lifeGoalsService } from "@/src/shared/services/wellbeing.service";
import type { LifeGoal, LifeGoalCategory } from "@shared/types/domain/wellbeing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

// Types
interface Goal {
  id: string;
  category: string;
  pillar: string;
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  currentValue?: number;
  startDate: string;
  targetDate: string;
  durationWeeks: number;
  status: string;
  isPrimary: boolean;
  progress: number;
  motivation?: string;
  milestones?: Array<{
    id: string;
    title: string;
    targetValue: number;
    completed: boolean;
    completedAt?: string;
  }>;
}

interface EditingGoal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  targetDate: string;
  status: string;
}

// Goal category config
const goalCategoryConfig: Record<
  string,
  { icon: React.ReactNode; color: string; bgColor: string; gradient: string }
> = {
  weight_loss: { icon: <TrendingUp className="w-5 h-5" />, color: "text-blue-400", bgColor: "from-blue-500/20 to-cyan-500/20", gradient: "from-blue-500 to-cyan-500" },
  muscle_building: { icon: <Dumbbell className="w-5 h-5" />, color: "text-orange-400", bgColor: "from-orange-500/20 to-red-500/20", gradient: "from-orange-500 to-red-500" },
  sleep_improvement: { icon: <Moon className="w-5 h-5" />, color: "text-indigo-400", bgColor: "from-indigo-500/20 to-purple-500/20", gradient: "from-indigo-500 to-purple-500" },
  stress_wellness: { icon: <Brain className="w-5 h-5" />, color: "text-cyan-400", bgColor: "from-cyan-500/20 to-teal-500/20", gradient: "from-cyan-500 to-teal-500" },
  energy_productivity: { icon: <Zap className="w-5 h-5" />, color: "text-yellow-400", bgColor: "from-yellow-500/20 to-amber-500/20", gradient: "from-yellow-500 to-amber-500" },
  nutrition: { icon: <Utensils className="w-5 h-5" />, color: "text-green-400", bgColor: "from-green-500/20 to-emerald-500/20", gradient: "from-green-500 to-emerald-500" },
  fitness: { icon: <Heart className="w-5 h-5" />, color: "text-rose-400", bgColor: "from-rose-500/20 to-pink-500/20", gradient: "from-rose-500 to-pink-500" },
  habit_building: { icon: <Flame className="w-5 h-5" />, color: "text-amber-400", bgColor: "from-amber-500/20 to-orange-500/20", gradient: "from-amber-500 to-orange-500" },
  overall_optimization: { icon: <Sparkles className="w-5 h-5" />, color: "text-violet-400", bgColor: "from-violet-500/20 to-purple-500/20", gradient: "from-violet-500 to-purple-500" },
};

// Life goal category config
const lifeGoalCategoryConfig: Record<
  string,
  { icon: React.ReactNode; color: string; bgColor: string; gradient: string; label: string }
> = {
  financial: { icon: <DollarSign className="w-5 h-5" />, color: "text-emerald-400", bgColor: "from-emerald-500/20 to-green-500/20", gradient: "from-emerald-500 to-green-500", label: "Financial" },
  faith: { icon: <BookHeart className="w-5 h-5" />, color: "text-amber-400", bgColor: "from-amber-500/20 to-yellow-500/20", gradient: "from-amber-500 to-yellow-500", label: "Faith" },
  relationships: { icon: <Users className="w-5 h-5" />, color: "text-pink-400", bgColor: "from-pink-500/20 to-rose-500/20", gradient: "from-pink-500 to-rose-500", label: "Relationships" },
  education: { icon: <GraduationCap className="w-5 h-5" />, color: "text-blue-400", bgColor: "from-blue-500/20 to-indigo-500/20", gradient: "from-blue-500 to-indigo-500", label: "Education" },
  career: { icon: <Briefcase className="w-5 h-5" />, color: "text-slate-400", bgColor: "from-slate-500/20 to-zinc-500/20", gradient: "from-slate-500 to-zinc-500", label: "Career" },
  health_wellness: { icon: <HeartPulse className="w-5 h-5" />, color: "text-red-400", bgColor: "from-red-500/20 to-rose-500/20", gradient: "from-red-500 to-rose-500", label: "Health & Wellness" },
  spiritual: { icon: <Compass className="w-5 h-5" />, color: "text-teal-400", bgColor: "from-teal-500/20 to-cyan-500/20", gradient: "from-teal-500 to-cyan-500", label: "Spiritual" },
  social: { icon: <MessageCircle className="w-5 h-5" />, color: "text-sky-400", bgColor: "from-sky-500/20 to-blue-500/20", gradient: "from-sky-500 to-blue-500", label: "Social" },
  productivity: { icon: <Zap className="w-5 h-5" />, color: "text-yellow-400", bgColor: "from-yellow-500/20 to-amber-500/20", gradient: "from-yellow-500 to-amber-500", label: "Productivity" },
  happiness: { icon: <Smile className="w-5 h-5" />, color: "text-orange-400", bgColor: "from-orange-500/20 to-yellow-500/20", gradient: "from-orange-500 to-yellow-500", label: "Happiness" },
  anxiety_management: { icon: <Shield className="w-5 h-5" />, color: "text-cyan-400", bgColor: "from-cyan-500/20 to-teal-500/20", gradient: "from-cyan-500 to-teal-500", label: "Anxiety Management" },
  creative: { icon: <Palette className="w-5 h-5" />, color: "text-fuchsia-400", bgColor: "from-fuchsia-500/20 to-purple-500/20", gradient: "from-fuchsia-500 to-purple-500", label: "Creative" },
  personal_growth: { icon: <Sprout className="w-5 h-5" />, color: "text-lime-400", bgColor: "from-lime-500/20 to-green-500/20", gradient: "from-lime-500 to-green-500", label: "Personal Growth" },
  custom: { icon: <Lightbulb className="w-5 h-5" />, color: "text-violet-400", bgColor: "from-violet-500/20 to-purple-500/20", gradient: "from-violet-500 to-purple-500", label: "Custom" },
};

// Kanban column config
const KANBAN_COLUMNS = [
  { id: "active", label: "Active", icon: Zap, color: "emerald", dotColor: "bg-emerald-400" },
  { id: "paused", label: "Paused", icon: Pause, color: "amber", dotColor: "bg-amber-400" },
  { id: "completed", label: "Completed", icon: CheckCircle2, color: "sky", dotColor: "bg-sky-400" },
  { id: "draft", label: "Other", icon: Clock, color: "slate", dotColor: "bg-slate-400" },
] as const;

// ── Confirmation Modal ──
const ConfirmModal = ({
  isOpen, onClose, onConfirm, title, message, confirmText = "Delete", isLoading = false, count = 1,
}: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmText?: string; isLoading?: boolean; count?: number;
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-[#0f0f18] border border-white/[0.06] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="text-sm text-slate-400">{message}</p>
            </div>
          </div>
          {count > 1 && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300"><strong>{count}</strong> goals will be permanently deleted.</p>
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] text-white border border-white/[0.06] hover:bg-white/[0.08] transition-colors disabled:opacity-50 cursor-pointer">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ── Edit Modal ──
const EditModal = ({
  isOpen, onClose, onSave, goal, isLoading,
}: {
  isOpen: boolean; onClose: () => void; onSave: (data: EditingGoal) => void;
  goal: Goal | null; isLoading: boolean;
}) => {
  const prevGoalIdRef = useRef<string | null>(null);
  const [editData, setEditData] = useState<EditingGoal | null>(() => {
    if (!goal) return null;
    return { id: goal.id, title: goal.title, description: goal.description, targetValue: goal.targetValue, targetDate: goal.targetDate.split('T')[0], status: goal.status };
  });

  useEffect(() => {
    const currentGoalId = goal?.id ?? null;
    if (currentGoalId !== prevGoalIdRef.current) {
      prevGoalIdRef.current = currentGoalId;
      startTransition(() => {
        if (goal) {
          setEditData({ id: goal.id, title: goal.title, description: goal.description, targetValue: goal.targetValue, targetDate: goal.targetDate.split('T')[0], status: goal.status });
        } else {
          setEditData(null);
        }
      });
    }
  }, [goal]);

  if (!editData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-[#0f0f18] border border-white/[0.06] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Edit Goal</h3>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input type="text" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all" placeholder="Goal title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all resize-none" placeholder="Describe your goal" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Target Value</label>
                  <input type="number" value={editData.targetValue} onChange={(e) => setEditData({ ...editData, targetValue: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Target Date</label>
                  <input type="date" value={editData.targetDate} onChange={(e) => setEditData({ ...editData, targetDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {['active', 'paused', 'completed', 'abandoned'].map((status) => (
                    <button key={status} onClick={() => setEditData({ ...editData, status })}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        editData.status === status
                          ? status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : status === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : status === 'completed' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          : 'bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08]'
                      }`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-white/[0.06]">
              <button onClick={onClose} disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] text-white border border-white/[0.06] hover:bg-white/[0.08] transition-colors disabled:opacity-50 cursor-pointer">
                Cancel
              </button>
              <button onClick={() => onSave(editData)} disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── Draggable Goal Card ──
function DraggableGoalCard({ goal, onEdit, onDelete, onPauseResume, onComplete, onReactivate }: {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onPauseResume: (goal: Goal) => void;
  onComplete: (goal: Goal) => void;
  onReactivate: (goal: Goal) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: goal.id });
  const config = goalCategoryConfig[goal.category] || goalCategoryConfig.fitness;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border transition-all ${
        isDragging
          ? "opacity-30 border-emerald-500/30 bg-emerald-500/[0.04]"
          : "bg-[#0f0f18] border-white/[0.06] hover:border-white/[0.12]"
      }`}
    >
      <div className="p-3.5">
        {/* Drag handle + Category icon */}
        <div className="flex items-start gap-2.5">
          <div
            {...listeners}
            {...attributes}
            className="mt-0.5 p-1 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
          >
            <GripVertical className="w-3.5 h-3.5 text-slate-500" />
          </div>

          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${config.bgColor} flex items-center justify-center ${config.color} flex-shrink-0`}>
            {config.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h4 className="text-sm font-semibold text-white truncate">{goal.title}</h4>
              {goal.isPrimary && (
                <Star className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />
              )}
            </div>
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{goal.description}</p>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] transition-all cursor-pointer focus:opacity-100 focus:outline-none">
                <MoreVertical className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-[#0f0f18] border-white/[0.06]">
              <DropdownMenuItem onClick={() => onEdit(goal)} className="cursor-pointer text-slate-300 focus:text-white focus:bg-white/[0.06]">
                <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
              {(goal.status === 'active' || goal.status === 'paused') && (
                <DropdownMenuItem onClick={() => onPauseResume(goal)}
                  className={`cursor-pointer ${goal.status === 'paused' ? 'text-green-400 focus:bg-green-500/10' : 'text-yellow-400 focus:bg-yellow-500/10'}`}>
                  {goal.status === 'paused' ? <><Play className="mr-2 h-3.5 w-3.5" /> Resume</> : <><Pause className="mr-2 h-3.5 w-3.5" /> Pause</>}
                </DropdownMenuItem>
              )}
              {goal.status === 'active' && (
                <DropdownMenuItem onClick={() => onComplete(goal)} className="cursor-pointer text-sky-400 focus:bg-sky-500/10">
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Complete
                </DropdownMenuItem>
              )}
              {(goal.status === 'completed' || goal.status === 'abandoned') && (
                <DropdownMenuItem onClick={() => onReactivate(goal)} className="cursor-pointer text-emerald-400 focus:bg-emerald-500/10">
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reactivate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem onClick={() => onDelete(goal)} className="cursor-pointer text-red-400 focus:bg-red-500/10">
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Progress */}
        <div className="mt-3 ml-8">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-600">Progress</span>
            <span className="text-[11px] font-semibold text-white">{goal.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${config.gradient}`}
              initial={{ width: 0 }}
              animate={{ width: `${goal.progress}%` }}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2.5 ml-8 text-[11px] text-slate-600">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{goal.durationWeeks}w</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            <span>{goal.targetValue} {goal.targetUnit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Goal Card Overlay (shown during drag) ──
function GoalCardOverlay({ goal }: { goal: Goal }) {
  const config = goalCategoryConfig[goal.category] || goalCategoryConfig.fitness;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-[#0f0f18] shadow-2xl shadow-emerald-500/20 p-3.5 w-[280px] rotate-2">
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${config.bgColor} flex items-center justify-center ${config.color} flex-shrink-0`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-white truncate">{goal.title}</h4>
            {goal.isPrimary && <Star className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />}
          </div>
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{goal.description}</p>
        </div>
      </div>
      <div className="mt-2.5 ml-[46px]">
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full rounded-full bg-gradient-to-r ${config.gradient}`} style={{ width: `${goal.progress}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ──
function KanbanColumn({ columnId, label, icon: Icon, color, dotColor, goals, searchQuery, cardHandlers }: {
  columnId: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  dotColor: string;
  goals: Goal[];
  searchQuery: string;
  cardHandlers: {
    onEdit: (goal: Goal) => void;
    onDelete: (goal: Goal) => void;
    onPauseResume: (goal: Goal) => void;
    onComplete: (goal: Goal) => void;
    onReactivate: (goal: Goal) => void;
  };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  const filtered = goals.filter((g) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return g.title.toLowerCase().includes(q) || g.description.toLowerCase().includes(q);
  });

  const colorMap: Record<string, { headerBg: string; borderGlow: string; iconBg: string; iconText: string }> = {
    emerald: { headerBg: "bg-emerald-500/[0.06]", borderGlow: "border-emerald-500/30 shadow-emerald-500/10", iconBg: "bg-emerald-500/15", iconText: "text-emerald-400" },
    amber: { headerBg: "bg-amber-500/[0.06]", borderGlow: "border-amber-500/30 shadow-amber-500/10", iconBg: "bg-amber-500/15", iconText: "text-amber-400" },
    sky: { headerBg: "bg-sky-500/[0.06]", borderGlow: "border-sky-500/30 shadow-sky-500/10", iconBg: "bg-sky-500/15", iconText: "text-sky-400" },
    slate: { headerBg: "bg-slate-500/[0.04]", borderGlow: "border-slate-500/30 shadow-slate-500/10", iconBg: "bg-slate-500/15", iconText: "text-slate-400" },
  };
  const c = colorMap[color] || colorMap.slate;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[270px] w-full rounded-xl border transition-all duration-200 ${
        isOver
          ? `${c.borderGlow} shadow-lg bg-white/[0.02]`
          : "border-white/[0.06] bg-[#0a0a0f]/50"
      }`}
    >
      {/* Column header */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-t-xl ${c.headerBg}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="text-xs font-semibold text-white">{label}</span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium tabular-nums bg-white/[0.04] px-2 py-0.5 rounded-md">
          {filtered.length}
        </span>
      </div>

      {/* Cards container */}
      <div className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-360px)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${c.iconText}`} />
              </div>
              <p className="text-[11px] text-slate-600 font-medium">
                {searchQuery ? "No matches" : "No goals"}
              </p>
              <p className="text-[10px] text-slate-700 mt-0.5">
                {searchQuery ? "Try different terms" : "Drag goals here"}
              </p>
            </motion.div>
          ) : (
            filtered.map((goal) => (
              <motion.div
                key={goal.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <DraggableGoalCard goal={goal} {...cardHandlers} />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main Component ──
export function GoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [boardView, setBoardView] = useState<"board" | "list">("board");
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "paused">("all");

  // Selection (list view)
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Modals
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Life goals state
  const [lifeGoals, setLifeGoals] = useState<LifeGoal[]>([]);
  const [isLifeGoalsLoading, setIsLifeGoalsLoading] = useState(true);
  const [showCreateLifeGoal, setShowCreateLifeGoal] = useState(false);
  const [newLifeGoal, setNewLifeGoal] = useState({ category: '' as LifeGoalCategory, title: '', motivation: '', tracking_method: 'manual' as string });
  const [checkinGoalId, setCheckinGoalId] = useState<string | null>(null);
  const [checkinNote, setCheckinNote] = useState('');
  const [checkinMood, setCheckinMood] = useState(3);

  // ── Data Fetching ──
  const fetchGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<{ goals: Goal[] }>("/assessment/goals");
      if (response.success && response.data) {
        setGoals(response.data.goals || []);
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load goals");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLifeGoals = useCallback(async () => {
    setIsLifeGoalsLoading(true);
    try {
      const response = await lifeGoalsService.getGoals({ status: 'active' });
      if (response.success && response.data) setLifeGoals(response.data.goals || []);
    } catch { /* supplementary */ } finally { setIsLifeGoalsLoading(false); }
  }, []);

  useEffect(() => { fetchGoals(); fetchLifeGoals(); }, [fetchGoals, fetchLifeGoals]);

  // ── Life Goals Handlers ──
  const handleCreateLifeGoal = async () => {
    if (!newLifeGoal.category || !newLifeGoal.title.trim()) return;
    try {
      await lifeGoalsService.createGoal({ category: newLifeGoal.category, title: newLifeGoal.title.trim(), motivation: newLifeGoal.motivation || undefined, tracking_method: newLifeGoal.tracking_method });
      setShowCreateLifeGoal(false);
      setNewLifeGoal({ category: '' as LifeGoalCategory, title: '', motivation: '', tracking_method: 'manual' });
      fetchLifeGoals();
    } catch { /* silent */ }
  };

  const handleLifeGoalCheckin = async (goalId: string) => {
    try {
      await lifeGoalsService.createCheckin(goalId, { note: checkinNote || undefined, mood_about_goal: checkinMood });
      setCheckinGoalId(null); setCheckinNote(''); setCheckinMood(3);
      fetchLifeGoals();
    } catch { /* silent */ }
  };

  const handleDeleteLifeGoal = async (goalId: string) => {
    try { await lifeGoalsService.deleteGoal(goalId); fetchLifeGoals(); } catch { /* silent */ }
  };

  // ── Computed Data ──
  const stats = useMemo(() => ({
    total: goals.length,
    active: goals.filter((g) => g.status === "active").length,
    completed: goals.filter((g) => g.status === "completed").length,
    paused: goals.filter((g) => g.status === "paused").length,
    avgProgress: goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0,
  }), [goals]);

  const goalsByStatus = useMemo(() => {
    const map: Record<string, Goal[]> = { active: [], paused: [], completed: [], draft: [] };
    goals.forEach((g) => {
      if (g.status === 'active') map.active.push(g);
      else if (g.status === 'paused') map.paused.push(g);
      else if (g.status === 'completed') map.completed.push(g);
      else map.draft.push(g);
    });
    return map;
  }, [goals]);

  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      const matchesFilter = filter === "all" || goal.status === filter;
      const matchesSearch = !searchQuery || goal.title.toLowerCase().includes(searchQuery.toLowerCase()) || goal.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [goals, filter, searchQuery]);

  // ── Selection Handlers ──
  const toggleSelection = (goalId: string) => {
    setSelectedGoals((prev) => { const next = new Set(prev); if (next.has(goalId)) next.delete(goalId); else next.add(goalId); return next; });
  };
  const selectAll = () => setSelectedGoals(new Set(filteredGoals.map((g) => g.id)));
  const clearSelection = () => { setSelectedGoals(new Set()); setIsSelectionMode(false); };

  // ── CRUD Handlers ──
  const handleEdit = (goal: Goal) => { setEditingGoal(goal); setIsEditModalOpen(true); };

  const handleSaveEdit = async (data: EditingGoal) => {
    setIsUpdating(true);
    try {
      await api.patch(`/assessment/goals/${data.id}`, { title: data.title, description: data.description, targetValue: data.targetValue, targetDate: data.targetDate, status: data.status });
      setGoals((prev) => prev.map((g) => g.id === data.id ? { ...g, title: data.title, description: data.description, targetValue: data.targetValue, targetDate: data.targetDate, status: data.status } : g));
      setIsEditModalOpen(false); setEditingGoal(null);
    } catch (err) { console.error("Failed to update goal:", err); }
    finally { setIsUpdating(false); }
  };

  const handleDelete = (goal: Goal) => { setGoalToDelete(goal); setIsDeleteModalOpen(true); };

  const confirmDelete = async () => {
    if (!goalToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/assessment/goals/${goalToDelete.id}`);
      setGoals((prev) => prev.filter((g) => g.id !== goalToDelete.id));
      setIsDeleteModalOpen(false); setGoalToDelete(null);
    } catch (err) { console.error("Failed to delete goal:", err); }
    finally { setIsDeleting(false); }
  };

  const confirmBulkDelete = async () => {
    if (selectedGoals.size === 0) return;
    setIsDeleting(true);
    try {
      await api.delete("/assessment/goals", { goalIds: Array.from(selectedGoals) });
      setGoals((prev) => prev.filter((g) => !selectedGoals.has(g.id)));
      setSelectedGoals(new Set()); setIsSelectionMode(false); setIsBulkDeleteModalOpen(false);
    } catch (err) { console.error("Failed to delete goals:", err); }
    finally { setIsDeleting(false); }
  };

  const handlePauseResume = async (goal: Goal) => {
    const newStatus = goal.status === 'paused' ? 'active' : 'paused';
    try {
      await api.patch(`/assessment/goals/${goal.id}`, { status: newStatus });
      setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, status: newStatus } : g));
    } catch (err) { console.error("Failed to update goal status:", err); }
  };

  const handleComplete = async (goal: Goal) => {
    try {
      await api.patch(`/assessment/goals/${goal.id}`, { status: 'completed', currentValue: goal.targetValue });
      setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, status: 'completed', progress: 100, currentValue: goal.targetValue } : g));
    } catch (err) { console.error("Failed to complete goal:", err); }
  };

  const handleReactivate = async (goal: Goal) => {
    try {
      await api.patch(`/assessment/goals/${goal.id}`, { status: 'active' });
      setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, status: 'active' } : g));
    } catch (err) { console.error("Failed to reactivate goal:", err); }
  };

  // ── DnD Handlers ──
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const goalId = active.id as string;
    const targetColumn = over.id as string;

    // Only process if dropped on a column (not another card)
    const validColumns: string[] = KANBAN_COLUMNS.map(c => c.id);
    if (!validColumns.includes(targetColumn)) return;

    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    // Map column id to actual status
    const newStatus = targetColumn === 'draft' ? 'abandoned' : targetColumn;
    if (goal.status === newStatus) return;

    // Special handling for completing
    const updates: Partial<Goal> & { status: string } = { status: newStatus };
    if (newStatus === 'completed') {
      updates.currentValue = goal.targetValue;
    }

    // Optimistic update
    setGoals((prev) => prev.map((g) =>
      g.id === goalId
        ? { ...g, ...updates, progress: newStatus === 'completed' ? 100 : g.progress }
        : g
    ));

    // API call
    api.patch(`/assessment/goals/${goalId}`, updates).catch((err) => {
      console.error("Failed to update goal status:", err);
      fetchGoals(); // Rollback on error
    });
  };

  const activeGoal = activeId ? goals.find(g => g.id === activeId) : null;

  const cardHandlers = { onEdit: handleEdit, onDelete: handleDelete, onPauseResume: handlePauseResume, onComplete: handleComplete, onReactivate: handleReactivate };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="space-y-0">
        <div className="h-12 border-b border-white/[0.06] px-4 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="h-4 w-24 rounded bg-white/[0.06] animate-pulse" />
          <div className="flex-1" />
          <div className="w-20 h-7 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>
        <div className="px-4 py-5 space-y-5">
          <div className="grid grid-cols-5 gap-3">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="p-3 rounded-xl bg-[#0f0f18] border border-white/[0.06]">
                <div className="w-6 h-6 rounded-md bg-white/[0.04] animate-pulse mb-2" />
                <div className="h-5 w-8 rounded bg-white/[0.06] animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0a0a0f]/50 min-h-[300px]">
                <div className="h-10 rounded-t-xl bg-white/[0.02]" />
                <div className="p-2 space-y-2">
                  {[0,1].map(j => (
                    <div key={j} className="h-28 rounded-xl bg-white/[0.02] animate-pulse" style={{ animationDelay: `${(i*2+j)*100}ms` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={fetchGoals} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors cursor-pointer">
          <RotateCcw className="w-4 h-4" /> Try Again
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ── Sticky Top Bar ── */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center h-12 px-4 gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <h1 className="text-sm font-semibold text-white">My Goals</h1>
          <div className="flex-1" />

          {/* View Toggle */}
          <div className="hidden sm:flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5">
            <button
              onClick={() => setBoardView("board")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                boardView === "board" ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <LayoutGrid className="w-3 h-3" /> Board
            </button>
            <button
              onClick={() => setBoardView("list")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                boardView === "list" ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <List className="w-3 h-3" /> List
            </button>
          </div>

          {/* Search */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg transition-all ${showSearch ? "bg-emerald-500/15 text-emerald-400" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"}`}
          >
            {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          {/* New Goal */}
          <Link href="/goals"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Goal
          </Link>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-white/[0.06]">
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search goals..." autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-all" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="px-4 sm:px-5 py-5 space-y-5">

        {/* Stats Row */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Target, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400" },
            { label: "Active", value: stats.active, icon: Zap, iconBg: "bg-green-500/10", iconColor: "text-green-400" },
            { label: "Completed", value: stats.completed, icon: CheckCircle2, iconBg: "bg-sky-500/10", iconColor: "text-sky-400" },
            { label: "Paused", value: stats.paused, icon: Clock, iconBg: "bg-amber-500/10", iconColor: "text-amber-400" },
            { label: "Progress", value: `${stats.avgProgress}%`, icon: TrendingUp, iconBg: "bg-purple-500/10", iconColor: "text-purple-400" },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-xl bg-[#0f0f18] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-6 h-6 rounded-md ${stat.iconBg} flex items-center justify-center`}>
                  <stat.icon className={`w-3 h-3 ${stat.iconColor}`} />
                </div>
                <span className="text-[11px] text-slate-500 font-medium">{stat.label}</span>
              </div>
              <p className="text-lg font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Board View ── */}
        {boardView === "board" && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory md:snap-none scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
            >
              {KANBAN_COLUMNS.map((col) => (
                <div key={col.id} className="snap-start flex-1 min-w-[270px]">
                  <KanbanColumn
                    columnId={col.id}
                    label={col.label}
                    icon={col.icon}
                    color={col.color}
                    dotColor={col.dotColor}
                    goals={goalsByStatus[col.id] || []}
                    searchQuery={searchQuery}
                    cardHandlers={cardHandlers}
                  />
                </div>
              ))}
            </motion.div>

            <DragOverlay>
              {activeGoal ? <GoalCardOverlay goal={activeGoal} /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* ── List View ── */}
        {boardView === "list" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
                {(["all", "active", "completed", "paused"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`relative px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                      filter === f ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-300"
                    }`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => isSelectionMode ? clearSelection() : setIsSelectionMode(true)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelectionMode ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08]"
                  }`}>
                  {isSelectionMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {isSelectionMode ? "Cancel" : "Select"}
                </button>
                {isSelectionMode && selectedGoals.size > 0 && (
                  <button onClick={() => setIsBulkDeleteModalOpen(true)}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedGoals.size})
                  </button>
                )}
              </div>
            </div>

            {/* Goal Cards */}
            <AnimatePresence mode="popLayout">
              {filteredGoals.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Target className="w-8 h-8 text-emerald-400/50" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">No goals found</p>
                  <p className="text-xs text-slate-600 mt-1">Try a different filter or create a new goal</p>
                </motion.div>
              ) : (
                filteredGoals.map((goal, index) => {
                  const config = goalCategoryConfig[goal.category] || goalCategoryConfig.fitness;
                  const isSelected = selectedGoals.has(goal.id);

                  return (
                    <motion.div key={goal.id} layout
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.02 }}
                      className={`relative overflow-hidden p-4 rounded-xl border transition-all group ${
                        isSelected ? "bg-emerald-500/[0.06] border-emerald-500/30" : "bg-[#0f0f18] border-white/[0.06] hover:border-white/[0.12]"
                      }`}>

                      <div className="flex items-start gap-3">
                        {isSelectionMode && (
                          <button onClick={() => toggleSelection(goal.id)}
                            className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                              isSelected ? "bg-emerald-500 border-emerald-500" : "border-white/20 hover:border-emerald-500"
                            }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>
                        )}

                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.bgColor} flex items-center justify-center ${config.color} flex-shrink-0`}>
                          {config.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-semibold text-white truncate">{goal.title}</h3>
                            {goal.isPrimary && <Star className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              goal.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                              : goal.status === "completed" ? "bg-sky-500/15 text-sky-400"
                              : goal.status === "paused" ? "bg-amber-500/15 text-amber-400"
                              : "bg-slate-500/15 text-slate-400"
                            }`}>
                              {goal.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">{goal.description}</p>

                          {/* Progress */}
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-slate-600">Progress</span>
                              <span className="text-[11px] font-semibold text-white">{goal.progress}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <motion.div className={`h-full rounded-full bg-gradient-to-r ${config.gradient}`}
                                initial={{ width: 0 }} animate={{ width: `${goal.progress}%` }}
                                transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: index * 0.03 }} />
                            </div>
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-600">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {goal.durationWeeks}w</span>
                            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {goal.targetValue} {goal.targetUnit}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] transition-all cursor-pointer focus:opacity-100 focus:outline-none">
                              <MoreVertical className="w-4 h-4 text-slate-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 bg-[#0f0f18] border-white/[0.06]">
                            <DropdownMenuItem onClick={() => handleEdit(goal)} className="cursor-pointer text-slate-300 focus:text-white focus:bg-white/[0.06]">
                              <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                            {(goal.status === 'active' || goal.status === 'paused') && (
                              <DropdownMenuItem onClick={() => handlePauseResume(goal)}
                                className={`cursor-pointer ${goal.status === 'paused' ? 'text-green-400' : 'text-yellow-400'}`}>
                                {goal.status === 'paused' ? <><Play className="mr-2 h-3.5 w-3.5" /> Resume</> : <><Pause className="mr-2 h-3.5 w-3.5" /> Pause</>}
                              </DropdownMenuItem>
                            )}
                            {goal.status === 'active' && (
                              <DropdownMenuItem onClick={() => handleComplete(goal)} className="cursor-pointer text-sky-400">
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Complete
                              </DropdownMenuItem>
                            )}
                            {(goal.status === 'completed' || goal.status === 'abandoned') && (
                              <DropdownMenuItem onClick={() => handleReactivate(goal)} className="cursor-pointer text-emerald-400">
                                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reactivate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-white/[0.06]" />
                            <DropdownMenuItem onClick={() => handleDelete(goal)} className="cursor-pointer text-red-400">
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Achievements Preview ── */}
        {stats.completed > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-[#0f0f18] border border-amber-500/[0.12] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Achievements</h3>
              </div>
              <button className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
              {[
                { icon: <Flame className="w-4 h-4" />, title: "First Steps", desc: "First week done", color: "bg-orange-500/10 border-orange-500/[0.12]" },
                { icon: <Zap className="w-4 h-4" />, title: "Consistency", desc: "7-day streak", color: "bg-yellow-500/10 border-yellow-500/[0.12]" },
                { icon: <Award className="w-4 h-4" />, title: "Goal Setter", desc: "Created 3 goals", color: "bg-emerald-500/10 border-emerald-500/[0.12]" },
              ].map((a, i) => (
                <div key={i} className={`flex-shrink-0 p-3 rounded-xl border ${a.color} min-w-[140px]`}>
                  <div className="text-amber-400 mb-1.5">{a.icon}</div>
                  <h4 className="text-xs font-semibold text-white">{a.title}</h4>
                  <p className="text-[10px] text-slate-500">{a.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Life Goals Section ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Compass className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Life Goals</h3>
                <p className="text-[11px] text-slate-500">Financial, faith, career, relationships & more</p>
              </div>
            </div>
            <button onClick={() => setShowCreateLifeGoal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/20 text-violet-300 hover:border-violet-400/40 transition-all text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {/* Create Life Goal Form */}
          <AnimatePresence>
            {showCreateLifeGoal && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="p-4 rounded-xl bg-[#0f0f18] border border-violet-500/[0.12] space-y-3">
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
                    {Object.entries(lifeGoalCategoryConfig).filter(([k]) => k !== 'custom').map(([key, cfg]) => (
                      <button key={key} onClick={() => setNewLifeGoal(prev => ({ ...prev, category: key as LifeGoalCategory }))}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-[10px] ${
                          newLifeGoal.category === key ? `bg-gradient-to-br ${cfg.bgColor} border-white/20 ${cfg.color}` : 'border-white/[0.06] text-slate-500 hover:border-white/[0.12]'
                        }`}>
                        {cfg.icon}
                        <span className="truncate w-full text-center">{cfg.label}</span>
                      </button>
                    ))}
                  </div>
                  <input type="text" placeholder="What's your goal?" value={newLifeGoal.title}
                    onChange={(e) => setNewLifeGoal(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none" />
                  <input type="text" placeholder="Why does this matter? (optional)" value={newLifeGoal.motivation}
                    onChange={(e) => setNewLifeGoal(prev => ({ ...prev, motivation: e.target.value }))}
                    className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowCreateLifeGoal(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleCreateLifeGoal} disabled={!newLifeGoal.category || !newLifeGoal.title.trim()}
                      className="px-4 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-medium disabled:opacity-40 hover:bg-violet-600 transition-all">
                      Create
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Life Goals Grid */}
          {isLifeGoalsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            </div>
          ) : lifeGoals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Compass className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No life goals yet. What do you want to improve?</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {lifeGoals.map((goal) => {
                const cfg = lifeGoalCategoryConfig[goal.category] || lifeGoalCategoryConfig.custom;
                const isCheckinOpen = checkinGoalId === goal.id;
                return (
                  <motion.div key={goal.id} layout whileHover={{ y: -2 }}
                    className="p-3.5 rounded-xl bg-[#0f0f18] border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${cfg.bgColor.includes('from-') ? `bg-gradient-to-br ${cfg.bgColor}` : cfg.bgColor} ${cfg.color}`}>
                          {cfg.icon}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white">{goal.title}</h4>
                          <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
                            <MoreVertical className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#0f0f18] border-white/[0.06]">
                          <DropdownMenuItem onClick={() => setCheckinGoalId(goal.id)} className="text-slate-300">
                            <Check className="w-3.5 h-3.5 mr-2" /> Check In
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/[0.06]" />
                          <DropdownMenuItem onClick={() => handleDeleteLifeGoal(goal.id)} className="text-red-400">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(goal.progress)}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${goal.progress}%` }}
                          className={`h-full rounded-full bg-gradient-to-r ${cfg.gradient}`} />
                      </div>
                    </div>

                    {goal.motivation && (
                      <p className="text-[11px] text-slate-500 italic line-clamp-2">&ldquo;{goal.motivation}&rdquo;</p>
                    )}

                    <button onClick={() => setCheckinGoalId(isCheckinOpen ? null : goal.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-slate-400 transition-colors">
                      <CheckCircle2 className="w-3 h-3" /> Check In
                    </button>

                    {/* Inline Check-in */}
                    <AnimatePresence>
                      {isCheckinOpen && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                            <textarea placeholder="How's it going?" value={checkinNote}
                              onChange={(e) => setCheckinNote(e.target.value)} rows={2}
                              className="w-full p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-xs placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none resize-none" />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500">Mood:</span>
                              {[1, 2, 3, 4, 5].map(n => (
                                <button key={n} onClick={() => setCheckinMood(n)}
                                  className={`w-6 h-6 rounded-full text-[10px] font-medium transition-all ${
                                    checkinMood === n ? 'bg-violet-500 text-white scale-110' : 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.08]'
                                  }`}>{n}</button>
                              ))}
                            </div>
                            <button onClick={() => handleLifeGoalCheckin(goal.id)}
                              className="w-full py-1.5 rounded-lg bg-violet-500 text-white text-xs font-medium hover:bg-violet-600 transition-all">
                              Log Check-in
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Modals */}
      <EditModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingGoal(null); }} onSave={handleSaveEdit} goal={editingGoal} isLoading={isUpdating} />
      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setGoalToDelete(null); }} onConfirm={confirmDelete}
        title="Delete Goal" message={`Are you sure you want to delete "${goalToDelete?.title}"? This action cannot be undone.`} confirmText="Delete" isLoading={isDeleting} />
      <ConfirmModal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} onConfirm={confirmBulkDelete}
        title="Delete Multiple Goals" message="Are you sure you want to delete the selected goals? This action cannot be undone." confirmText="Delete All" isLoading={isDeleting} count={selectedGoals.size} />
    </div>
  );
}
