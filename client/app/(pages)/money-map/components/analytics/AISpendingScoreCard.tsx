"use client";

import { motion, type Variants } from "framer-motion";
import { Bot, CheckCircle, AlertTriangle, Zap, ChevronRight } from "lucide-react";
import { useCountUp, fadeSlideUp, spring } from "../../lib/motion";
import type { BudgetAlert, CategoryBreakdownItem, FinanceCategory } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_LABELS } from "@shared/types/domain/finance";

interface AISpendingScoreCardProps {
  score: number; // 0-100
  savingsRate: number;
  budgetAlerts: BudgetAlert[];
  topCategories: CategoryBreakdownItem[];
}

export function AISpendingScoreCard({ score, savingsRate, budgetAlerts, topCategories }: AISpendingScoreCardProps) {
  const animatedScore = useCountUp(score, 1500);
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs Work";
  const arcColor = score >= 80 ? "#059669" : score >= 60 ? "#0284c7" : score >= 40 ? "#f59e0b" : "#f43f5e";

  // Score arc
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  // Build assessment rows
  const assessments: Array<{ icon: React.ReactNode; label: string; status: string; color: string }> = [];

  // Savings rate
  assessments.push({
    icon: savingsRate >= 20 ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
    label: `Savings rate: ${savingsRate}%`,
    status: savingsRate >= 20 ? "Excellent" : savingsRate >= 10 ? "Moderate" : "Low",
    color: savingsRate >= 20 ? "text-emerald-400" : savingsRate >= 10 ? "text-amber-400" : "text-rose-400",
  });

  // Budget alerts
  if (budgetAlerts.length === 0) {
    assessments.push({
      icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
      label: "All budgets on track",
      status: "Great",
      color: "text-emerald-400",
    });
  } else {
    assessments.push({
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
      label: `${budgetAlerts.length} budget${budgetAlerts.length > 1 ? "s" : ""} over threshold`,
      status: "Review",
      color: "text-amber-400",
    });
  }

  // Top spending category
  if (topCategories.length > 0) {
    const top = topCategories[0];
    assessments.push({
      icon: top.percentage > 40
        ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        : <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
      label: `${FINANCE_CATEGORY_LABELS[top.category as FinanceCategory]}: ${top.percentage}% of spend`,
      status: top.percentage > 40 ? "High concentration" : "Balanced",
      color: top.percentage > 40 ? "text-amber-400" : "text-emerald-400",
    });
  }

  // Dots for rating
  const dots = 5;
  const filledDots = Math.round((score / 100) * dots);

  return (
    <motion.div
      variants={fadeSlideUp}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center">
          <Bot className="w-4 h-4 text-violet-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Financial Health Score</h3>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Score Arc */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
            <motion.circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke={arcColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white font-mono">{Math.round(animatedScore)}</span>
            <span className="text-[10px] text-slate-500">/100</span>
          </div>
        </div>

        {/* Score details */}
        <div className="flex-1 w-full">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-semibold" style={{ color: arcColor }}>{label}</span>
            <div className="flex gap-1">
              {Array.from({ length: dots }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{ backgroundColor: i < filledDots ? arcColor : "#1e293b" }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {assessments.map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5 + 0.1 * i, duration: 0.3 }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  {row.icon}
                  <span>{row.label}</span>
                </div>
                <span className={`text-[11px] font-medium ${row.color}`}>{row.status}</span>
              </motion.div>
            ))}
          </div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="mt-4 flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Ask AI Coach for Tips <ChevronRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
