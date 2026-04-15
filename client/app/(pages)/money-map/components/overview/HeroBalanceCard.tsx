"use client";

import { motion, type Variants } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  AnimatedCurrency,
  fadeSlideUp,
  spring,
} from "../../lib/motion";
import { SparkLine } from "../charts/SparkLine";

interface HeroBalanceCardProps {
  income: number;
  expense: number;
  savingsRate: number;
  momDelta: number;
}

const progressBarVariants: Variants = {
  hidden: { width: "0%" },
  show: {
    width: "var(--target-width)",
    transition: { ...spring.soft, delay: 0.4 },
  },
};

export function HeroBalanceCard({
  income,
  expense,
  savingsRate,
  momDelta,
}: HeroBalanceCardProps) {
  const balance = income - expense;
  const isExpenseUp = momDelta > 0;
  const clampedRate = Math.min(Math.max(savingsRate, 0), 100);

  return (
    <motion.div
      variants={fadeSlideUp}
      initial="hidden"
      animate="show"
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] p-6 sm:p-8"
    >
      {/* Animated gradient mesh background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-mesh absolute -left-1/4 -top-1/4 h-[150%] w-[150%] opacity-30" />
      </div>
      <style>{`
        @keyframes meshDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(2%, -3%) scale(1.02); }
          66% { transform: translate(-1%, 2%) scale(0.98); }
        }
        .hero-mesh {
          background: radial-gradient(ellipse at 30% 40%, rgba(5, 150, 105, 0.25) 0%, transparent 60%),
                      radial-gradient(ellipse at 70% 60%, rgba(2, 132, 199, 0.15) 0%, transparent 55%),
                      radial-gradient(ellipse at 50% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
          animation: meshDrift 12s ease-in-out infinite;
        }
      `}</style>

      {/* Content */}
      <div className="relative z-10 space-y-6">
        {/* Balance */}
        <div>
          <p className="text-sm font-medium tracking-wide text-white/50 uppercase">
            Net Balance
          </p>
          <AnimatedCurrency
            value={balance}
            className="block font-[family-name:var(--font-syne)] text-4xl font-bold tracking-tight text-white sm:text-5xl"
          />
        </div>

        {/* Savings progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Savings Rate</span>
            <span className="font-mono text-emerald-400">{clampedRate.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              variants={progressBarVariants}
              initial="hidden"
              animate="show"
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={
                { "--target-width": `${clampedRate}%` } as React.CSSProperties
              }
            />
          </div>
        </div>

        {/* Income / Expense split */}
        <div className="grid grid-cols-2 gap-4">
          {/* Income */}
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/40">Income</p>
              <AnimatedCurrency
                value={income}
                compact
                className="block truncate font-mono text-sm font-semibold text-emerald-400"
              />
            </div>
            <SparkLine
              data={[40, 55, 48, 60, 72, 65, 80]}
              color="#059669"
              height={24}
              width={56}
            />
          </div>

          {/* Expense */}
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10"
              animate={{ y: [0, 3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <TrendingDown className="h-4 w-4 text-rose-400" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/40">Expenses</p>
              <AnimatedCurrency
                value={expense}
                compact
                className="block truncate font-mono text-sm font-semibold text-rose-400"
              />
            </div>
            <SparkLine
              data={[30, 42, 38, 50, 45, 55, 48]}
              color="#f43f5e"
              height={24}
              width={56}
            />
          </div>
        </div>

        {/* MoM delta badge */}
        <div className="flex items-center justify-end">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isExpenseUp
                ? "bg-rose-500/10 text-rose-400"
                : "bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {isExpenseUp ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            <span className="font-mono">
              {Math.abs(momDelta).toFixed(1)}% vs last month
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
