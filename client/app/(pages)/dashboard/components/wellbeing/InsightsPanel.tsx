"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  Moon,
  Dumbbell,
  Heart,
  Brain,
  Zap,
} from "lucide-react";
import {
  insightsService,
  type InsightCorrelation,
} from "@/src/shared/services/wellbeing.service";

/* ── Confidence styles ── */
const CONFIDENCE = {
  high: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.06]",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
  },
  medium: {
    border: "border-amber-500/20",
    bg: "bg-amber-500/[0.06]",
    dot: "bg-amber-400",
    text: "text-amber-400",
  },
  low: {
    border: "border-slate-500/20",
    bg: "bg-slate-500/[0.06]",
    dot: "bg-slate-500",
    text: "text-slate-400",
  },
};

/* ── Pattern type to icon mapping ── */
function PatternIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("sleep")) return <Moon className="h-4 w-4 text-indigo-400" />;
  if (t.includes("exercise") || t.includes("workout"))
    return <Dumbbell className="h-4 w-4 text-green-400" />;
  if (t.includes("mood") || t.includes("gratitude"))
    return <Heart className="h-4 w-4 text-pink-400" />;
  if (t.includes("stress"))
    return <Activity className="h-4 w-4 text-rose-400" />;
  if (t.includes("recovery"))
    return <Zap className="h-4 w-4 text-amber-400" />;
  if (t.includes("energy"))
    return <TrendingUp className="h-4 w-4 text-orange-400" />;
  return <Brain className="h-4 w-4 text-violet-400" />;
}

/* ── Strength bar ── */
function StrengthBar({ value }: { value: number }) {
  const abs = Math.abs(value);
  const pct = Math.min(abs * 100, 100);
  const isNegative = value < 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${
            isNegative
              ? "bg-gradient-to-r from-rose-500 to-orange-500"
              : "bg-gradient-to-r from-emerald-500 to-teal-500"
          }`}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-500 tabular-nums w-10 text-right">
        {value > 0 ? "+" : ""}
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export function InsightsPanel() {
  const [correlations, setCorrelations] = useState<InsightCorrelation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    insightsService
      .getCorrelations()
      .then((res) => {
        if (res.success && res.data?.correlations) {
          setCorrelations(res.data.correlations);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDismiss = async (id: string) => {
    try {
      await insightsService.dismissInsight(id);
      setCorrelations((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // Silent fail
    }
  };

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-lg bg-white/[0.03] border border-white/[0.04] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (correlations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 mb-3">
          <Lightbulb className="h-5 w-5 text-amber-400/50" />
        </div>
        <p className="text-sm font-medium text-slate-400 mb-1">
          No correlations yet
        </p>
        <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">
          Keep logging your mood, workouts, and sleep. We&apos;ll surface
          health patterns as data builds up (7+ data points needed).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <AnimatePresence>
        {correlations.map((c, idx) => {
          const style = CONFIDENCE[c.confidence];

          return (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -40, height: 0 }}
              transition={{ delay: idx * 0.06 }}
              className={`group p-3.5 rounded-xl border ${style.border} ${style.bg} hover:bg-white/[0.04] transition-colors`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] shrink-0 mt-0.5">
                  <PatternIcon type={c.patternType} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white mb-0.5 leading-tight">
                    {c.headline}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">
                    {c.insight}
                  </p>

                  <StrengthBar value={c.correlationStrength} />

                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                      />
                      <span
                        className={`text-[10px] font-medium capitalize ${style.text}`}
                      >
                        {c.confidence}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-600">
                      {c.dataPoints} data points
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {c.windowDays}d window
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDismiss(c.id)}
                  className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 transition-all"
                  aria-label="Dismiss insight"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
