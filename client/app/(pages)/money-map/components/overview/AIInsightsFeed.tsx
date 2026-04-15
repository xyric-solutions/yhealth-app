"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  Lightbulb,
  TrendingUp,
  X,
  DollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FinanceAIInsight, AIInsightType } from "@shared/types/domain/finance";
import {
  formatCurrency,
  staggerContainer,
  slideFromRight,
  spring,
} from "../../lib/motion";

interface AIInsightsFeedProps {
  insights: FinanceAIInsight[];
  onDismiss: (id: string) => void;
}

const TYPE_CONFIG: Record<
  AIInsightType,
  { icon: LucideIcon; color: string; bgColor: string; label: string }
> = {
  alert: {
    icon: AlertTriangle,
    color: "text-rose-400",
    bgColor: "bg-rose-500/10 border-rose-500/20",
    label: "ALERT",
  },
  pattern: {
    icon: Brain,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    label: "PATTERN",
  },
  suggestion: {
    icon: Lightbulb,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    label: "SUGGESTION",
  },
  forecast: {
    icon: TrendingUp,
    color: "text-sky-400",
    bgColor: "bg-sky-500/10 border-sky-500/20",
    label: "FORECAST",
  },
};

const cardExitVariants: Variants = {
  exit: {
    opacity: 0,
    scale: 0.9,
    x: -20,
    transition: { ...spring.snappy, duration: 0.3 },
  },
};

function InsightCard({
  insight,
  onDismiss,
}: {
  insight: FinanceAIInsight;
  onDismiss: (id: string) => void;
}) {
  const config = TYPE_CONFIG[insight.insightType];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      variants={slideFromRight}
      exit="exit"
      className={`flex w-72 shrink-0 snap-start flex-col rounded-xl border ${config.bgColor} p-4`}
    >
      {/* Badge + dismiss */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`relative flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1`}>
            <motion.span
              animate={
                insight.insightType === "alert" ? { rotate: [0, -10, 10, -10, 0] } :
                insight.insightType === "pattern" ? { rotate: [0, 360] } :
                insight.insightType === "suggestion" ? { scale: [1, 1.2, 1] } :
                { y: [0, -3, 0] }
              }
              transition={{
                duration: insight.insightType === "pattern" ? 4 : 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            </motion.span>
            <span className={`text-[10px] font-bold tracking-wider ${config.color}`}>
              {config.label}
            </span>
            {insight.insightType === "alert" && (
              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDismiss(insight.id)}
          className="rounded-md p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
          aria-label="Dismiss insight"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <h4 className="mb-1 font-[family-name:var(--font-syne)] text-sm font-semibold text-white">
        {insight.title}
      </h4>
      <p className="mb-3 line-clamp-3 flex-1 text-xs leading-relaxed text-white/50">
        {insight.body}
      </p>

      {/* Savings potential */}
      {insight.savingsPotential != null && insight.savingsPotential > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-mono text-xs font-medium text-emerald-400">
            Save {formatCurrency(insight.savingsPotential)}
          </span>
        </div>
      )}
    </motion.div>
  );
}

export function AIInsightsFeed({ insights, onDismiss }: AIInsightsFeedProps) {
  const visible = insights.filter((i) => !i.dismissed);

  return (
    <div className="space-y-3">
      <h3 className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-wide text-white/60 uppercase">
        AI Insights
      </h3>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        <AnimatePresence mode="popLayout">
          {visible.length > 0 ? (
            visible.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onDismiss={onDismiss}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex w-full items-center justify-center py-8 text-sm text-white/30"
            >
              No active insights
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
