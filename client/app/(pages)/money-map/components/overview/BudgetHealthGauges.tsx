"use client";

import { motion } from "framer-motion";
import { Wallet, PiggyBank, TrendingDown, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatedGauge } from "../charts/AnimatedGauge";
import { fadeSlideUp, staggerContainer, formatCurrency } from "../../lib/motion";

interface BudgetHealthGaugesProps {
  savingsRate: number;
  budgetUsed: number;
  budgetTotal: number;
  debtToIncome: number;
  emergencyMonths: number;
}

interface MetricGaugeData {
  icon: LucideIcon;
  label: string;
  value: number;
  max: number;
  color: string;
  glowColor: string;
  formatValue: (v: number) => string;
  description: string;
}

export function BudgetHealthGauges({
  savingsRate,
  budgetUsed,
  budgetTotal,
  debtToIncome,
  emergencyMonths,
}: BudgetHealthGaugesProps) {
  const budgetPct = budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0;
  const budgetColor = budgetPct > 90 ? "#f43f5e" : budgetPct > 70 ? "#f59e0b" : "#059669";

  const metrics: MetricGaugeData[] = [
    {
      icon: PiggyBank,
      label: "Savings Rate",
      value: Math.max(savingsRate, 0),
      max: 100,
      color: savingsRate >= 20 ? "#059669" : savingsRate >= 10 ? "#f59e0b" : "#f43f5e",
      glowColor: "#34d399",
      formatValue: (v) => `${Math.round(v)}%`,
      description: savingsRate >= 20 ? "Excellent" : savingsRate >= 10 ? "Good" : "Low",
    },
    {
      icon: Wallet,
      label: "Budget Used",
      value: Math.min(budgetPct, 100),
      max: 100,
      color: budgetColor,
      glowColor: budgetColor,
      formatValue: (v) => `${Math.round(v)}%`,
      description: budgetTotal > 0 ? formatCurrency(budgetUsed, true) : "No budget",
    },
    {
      icon: TrendingDown,
      label: "Debt Ratio",
      value: Math.min(debtToIncome, 100),
      max: 100,
      color: debtToIncome <= 30 ? "#059669" : debtToIncome <= 50 ? "#f59e0b" : "#f43f5e",
      glowColor: "#0284c7",
      formatValue: (v) => `${Math.round(v)}%`,
      description: debtToIncome <= 30 ? "Healthy" : debtToIncome <= 50 ? "Moderate" : "High",
    },
    {
      icon: ShieldCheck,
      label: "Emergency Fund",
      value: Math.min(emergencyMonths, 12),
      max: 12,
      color: emergencyMonths >= 6 ? "#059669" : emergencyMonths >= 3 ? "#f59e0b" : "#f43f5e",
      glowColor: "#8b5cf6",
      formatValue: (v) => `${Math.round(v)}mo`,
      description: emergencyMonths >= 6 ? "Strong" : emergencyMonths >= 3 ? "Building" : "Start",
    },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.07] p-5"
    >
      <motion.div variants={fadeSlideUp} className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
        </div>
        <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-syne)]">
          Financial Health
        </h3>
      </motion.div>

      <motion.div
        variants={fadeSlideUp}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {metrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex flex-col items-center gap-1 group"
            >
              <AnimatedGauge
                value={metric.value}
                max={metric.max}
                size={88}
                strokeWidth={6}
                color={metric.color}
                glowColor={metric.glowColor}
                formatValue={metric.formatValue}
                delay={i * 0.15}
              />
              <div className="text-center mt-1">
                <div className="flex items-center justify-center gap-1">
                  <Icon className="w-3 h-3 text-slate-500" />
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                    {metric.label}
                  </span>
                </div>
                <span className="text-[10px] font-medium" style={{ color: metric.color }}>
                  {metric.description}
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
