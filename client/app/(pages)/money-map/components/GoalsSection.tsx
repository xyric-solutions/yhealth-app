"use client";

import { motion, AnimatePresence, type Variants, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useState, useMemo, useCallback } from "react";
import {
  Target,
  Plus,
  X,
  Trophy,
  Sparkles,
  Zap,
  TrendingUp,
  Calendar,
  Crown,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type {
  FinanceSavingGoal,
  CreateSavingGoalInput,
} from "@shared/types/domain/finance";
import {
  formatCurrency,
  AnimatedCurrency,
  fadeSlideUp,
  staggerContainer,
  spring,
} from "../lib/motion";

// ============================================
// PREMIUM 3D TILT CARD
// ============================================
function TiltCard({ 
  children, 
  className,
  glowColor = "emerald",
}: { 
  children: React.ReactNode; 
  className?: string;
  glowColor?: "emerald" | "amber" | "purple" | "rose" | "blue";
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };
  
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const glowColors = {
    emerald: "from-emerald-500/20 to-teal-500/20",
    amber: "from-amber-500/20 to-orange-500/20",
    purple: "from-purple-500/20 to-violet-500/20",
    rose: "from-rose-500/20 to-pink-500/20",
    blue: "from-blue-500/20 to-cyan-500/20",
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={`relative ${className}`}
    >
      <div 
        className={`relative overflow-hidden rounded-2xl h-full
          bg-gradient-to-br ${glowColors[glowColor]}
          backdrop-blur-xl border border-white/[0.07]
          shadow-xl shadow-black/20`}
        style={{ transform: "translateZ(20px)" }}
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="relative z-10 h-full">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// VARIANTS
// ============================================
const sheetBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const sheetPanel: Variants = {
  hidden: { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: spring.snappy },
  exit: { y: "100%", opacity: 0, transition: { duration: 0.25 } },
};

// ============================================
// TYPES
// ============================================
interface GoalsSectionProps {
  goals: FinanceSavingGoal[];
  onRefresh: () => void;
}

const MILESTONE_TICKS = [25, 50, 75, 100];
const QUICK_AMOUNTS = [10, 25, 50, 100, 500];

const GOAL_ICONS: Record<string, string> = {
  "🎯": "target",
  "✈️": "travel",
  "🏠": "home",
  "🚗": "car",
  "💍": "ring",
  "📱": "tech",
  "🎓": "education",
  "🏖️": "vacation",
  "💰": "wealth",
  "🔥": "fire",
};

// ============================================
// MAIN COMPONENT
// ============================================
export function GoalsSection({ goals, onRefresh }: GoalsSectionProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [contributingId, setContributingId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<Record<string, string>>({});

  const stats = useMemo(() => {
    const active = goals.filter((g) => g.status === "in_progress").length;
    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
    const achieved = goals.filter((g) => g.status === "achieved").length;
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    return { active, totalSaved, achieved, totalTarget };
  }, [goals]);

  const animatedActive = useCountUp(stats.active);
  const animatedSaved = useCountUp(stats.totalSaved);
  const animatedAchieved = useCountUp(stats.achieved);

  const handleContribute = useCallback(
    async (goalId: string, amount: number) => {
      setContributingId(goalId);
      try {
        await api.post(`/finance/goals/${goalId}/contribute`, { amount });
        onRefresh();
      } finally {
        setTimeout(() => setContributingId(null), 400);
      }
    },
    [onRefresh]
  );

  const handleCustomContribute = useCallback(
    async (goalId: string) => {
      const val = parseFloat(customAmount[goalId] || "0");
      if (val <= 0) return;
      await handleContribute(goalId, val);
      setCustomAmount((prev) => ({ ...prev, [goalId]: "" }));
    },
    [customAmount, handleContribute]
  );

  return (
    <div className="space-y-6">
      {/* Premium Stats Banner */}
      {goals.length > 0 && (
        <TiltCard glowColor="purple">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Crown className="w-5 h-5 text-purple-400" />
                </motion.div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Savings Goals</h3>
                  <p className="text-xs text-slate-400">Track your journey to financial freedom</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-mono font-bold text-emerald-400">
                  {formatCurrency(animatedSaved)}
                </span>
                <span className="text-xs text-slate-500 mx-1">/</span>
                <span className="text-sm font-mono text-slate-400">
                  {formatCurrency(stats.totalTarget)}
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <Target className="w-4 h-4 text-sky-400" />
                <div>
                  <span className="text-lg font-mono font-bold text-white">{animatedActive}</span>
                  <span className="text-[10px] text-slate-500 block">Active</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-lg font-mono font-bold text-emerald-400">{formatCurrency(animatedSaved)}</span>
                  <span className="text-[10px] text-slate-500 block">Saved</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <Trophy className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-lg font-mono font-bold text-amber-400">{animatedAchieved}</span>
                  <span className="text-[10px] text-slate-500 block">Achieved</span>
                </div>
              </div>
            </div>
          </div>
        </TiltCard>
      )}

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <motion.div
          variants={fadeSlideUp}
          initial="hidden"
          animate="show"
          className="rounded-2xl bg-white/[0.02] border border-white/[0.07] py-20 flex flex-col items-center justify-center"
        >
          <motion.div 
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-5"
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <Target className="w-10 h-10 text-emerald-400" />
          </motion.div>
          <h3 className="text-lg font-semibold text-white mb-2">Set your first savings goal</h3>
          <p className="text-sm text-slate-400 mb-6 text-center max-w-sm">
            Track progress toward the things that matter and watch your wealth grow
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
          >
            <Plus className="w-4 h-4" /> Create a goal
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              contributingId={contributingId}
              customAmount={customAmount}
              onContribute={handleContribute}
              onCustomContribute={handleCustomContribute}
              onCustomAmountChange={(val) => setCustomAmount((prev) => ({ ...prev, [goal.id]: val }))}
            />
          ))}

          {/* + New Goal Card */}
          <motion.button
            variants={fadeSlideUp}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreate(true)}
            className="group rounded-2xl border-2 border-dashed border-white/[0.1] hover:border-emerald-500/30 p-5 flex flex-col items-center justify-center gap-3 min-h-[280px] transition-all bg-white/[0.01] hover:bg-white/[0.03]"
          >
              <motion.div 
                className="w-14 h-14 rounded-2xl bg-white/[0.05] group-hover:bg-emerald-500/20 border border-white/[0.1] group-hover:border-emerald-500/30 flex items-center justify-center transition-all"
                whileHover={{ scale: 1.1, rotate: 90 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Plus className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </motion.div>
              <span className="text-sm text-slate-400 font-medium group-hover:text-emerald-400 transition-colors">
                New Goal
              </span>
            </motion.button>
        </motion.div>
      )}

      {/* Create Sheet */}
      <AnimatePresence>
        {showCreate && (
          <CreateGoalSheet
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// PREMIUM GOAL CARD
// ============================================
function GoalCard({
  goal,
  contributingId,
  customAmount,
  onContribute,
  onCustomContribute,
  onCustomAmountChange,
}: {
  goal: FinanceSavingGoal;
  contributingId: string | null;
  customAmount: Record<string, string>;
  onContribute: (id: string, amount: number) => void;
  onCustomContribute: (id: string) => void;
  onCustomAmountChange: (val: string) => void;
}) {
  const percent = goal.targetAmount > 0
    ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
    : 0;
  const isAchieved = goal.status === "achieved";
  const isContributing = contributingId === goal.id;
  const remaining = goal.targetAmount - goal.currentAmount;

  const getGlowColor = () => {
    if (isAchieved) return "emerald";
    if (percent >= 75) return "amber";
    return "blue";
  };

  return (
    <TiltCard className="h-full" glowColor={getGlowColor()}>
      <div className="p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={isAchieved ? { y: [0, -4, 0] } : {}}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-3xl"
            >
              {goal.emoji}
            </motion.div>
            <div>
              <h4 className="text-base font-semibold text-white">{goal.title}</h4>
              {goal.deadline && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span className="text-xs text-slate-500">
                    {new Date(goal.deadline).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
          {isAchieved && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium"
            >
              <Trophy className="w-3.5 h-3.5" />
              Achieved
            </motion.div>
          )}
        </div>

        {/* Amount Display */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-mono font-bold text-white">
            {formatCurrency(goal.currentAmount)}
          </span>
          <span className="text-sm text-slate-500">/</span>
          <span className="text-base font-mono text-slate-400">
            {formatCurrency(goal.targetAmount)}
          </span>
        </div>

        {/* Premium Progress Bar */}
        <div className="relative mb-4">
          {/* Milestone markers */}
          <div className="absolute inset-x-0 top-0 flex justify-between pointer-events-none">
            {MILESTONE_TICKS.map((tick) => (
              <div
                key={tick}
                className={`w-0.5 h-2 transition-colors ${percent >= tick ? "bg-white/30" : "bg-white/10"}`}
                style={{ left: `${tick}%` }}
              />
            ))}
          </div>
          
          <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className={`h-full rounded-full ${
                isAchieved
                  ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500"
                  : percent >= 75
                  ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"
                  : "bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"
              }`}
              style={{
                boxShadow: isAchieved
                  ? "0 0 20px rgba(16,185,129,0.5)"
                  : percent >= 75
                  ? "0 0 20px rgba(245,158,11,0.5)"
                  : "0 0 20px rgba(59,130,246,0.5)",
              }}
            >
              <motion.div
                className="h-full w-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
          </div>
          
          {/* Percentage badge */}
          <motion.div 
            className="absolute -top-1 transform -translate-y-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: `calc(${Math.min(percent, 95)}% - 20px)` }}
            transition={{ delay: 0.5 }}
          >
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isAchieved ? "bg-emerald-500/20 text-emerald-400"
              : percent >= 75 ? "bg-amber-500/20 text-amber-400"
              : "bg-blue-500/20 text-blue-400"
            }`}>
              {Math.round(percent)}%
            </span>
          </motion.div>
        </div>

        {/* Status */}
        <p className={`text-xs text-slate-400 ${isAchieved ? "mt-auto" : "mb-4"}`}>
          {isAchieved ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Goal achieved! Congratulations!
            </span>
          ) : remaining > 0 ? (
            <>
              <span className="text-slate-300 font-medium">{formatCurrency(remaining)}</span> more to reach your goal
            </>
          ) : (
            "Goal reached!"
          )}
        </p>

        {/* Quick Add Buttons */}
        {!isAchieved && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <motion.button
                  key={amount}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onContribute(goal.id, amount)}
                  disabled={isContributing}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-emerald-500/20 border border-white/[0.07] hover:border-emerald-500/30 text-xs text-slate-300 hover:text-emerald-400 transition-all disabled:opacity-50"
                >
                  +${amount}
                </motion.button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  placeholder="Custom amount"
                  value={customAmount[goal.id] || ""}
                  onChange={(e) => onCustomAmountChange(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 transition-all"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onCustomContribute(goal.id)}
                disabled={isContributing || !customAmount[goal.id]}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium disabled:opacity-50 transition-all"
              >
                {isContributing ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </TiltCard>
  );
}

// ============================================
// CREATE GOAL SHEET (Premium)
// ============================================
function CreateGoalSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [deadline, setDeadline] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const EMOJIS = ["🎯", "✈️", "🏠", "🚗", "💍", "📱", "🎓", "🏖️", "💰", "🔥"];

  const handleSubmit = async () => {
    if (!title || !targetAmount) return;
    setIsSubmitting(true);
    try {
      await api.post("/finance/goals", {
        title,
        targetAmount: parseFloat(targetAmount),
        currentAmount: 0,
        emoji,
        deadline: deadline || undefined,
        status: "in_progress",
      } as CreateSavingGoalInput);
      onCreated();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      variants={sheetBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        variants={sheetPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-lg bg-[#0a0f1c] border border-white/[0.1] rounded-t-3xl sm:rounded-2xl p-6 space-y-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Create Savings Goal</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Emoji Picker */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider mb-3 block">Choose Icon</label>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <motion.button
                key={e}
                whileTap={{ scale: 0.9 }}
                onClick={() => setEmoji(e)}
                className={`w-12 h-12 rounded-xl text-2xl transition-all ${
                  emoji === e
                    ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40"
                    : "bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.15]"
                }`}
              >
                {e}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Title Input */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Goal Name</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., New Car, Vacation, Emergency Fund"
            className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl px-4 py-3.5 text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        {/* Target Amount */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Target Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-mono text-slate-500">$</span>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl pl-12 pr-4 py-4 text-xl font-mono text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/40 transition-all"
            />
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Target Date (Optional)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500/40 transition-all"
          />
        </div>

        {/* Submit */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={!title || !targetAmount || isSubmitting}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <motion.div
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              Creating...
            </span>
          ) : (
            "Create Goal"
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// Helper hook
function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  
  useState(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * easeOut));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  });
  
  return value;
}
