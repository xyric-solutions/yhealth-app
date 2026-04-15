"use client";

import { useRef, useMemo } from "react";
import { motion, useInView } from "framer-motion";
import { Activity } from "lucide-react";
import type {
  TransactionSummary,
  MonthlySummary,
  BudgetAlert,
  FinanceTransaction,
  FinanceBudget,
  FinanceSavingGoal,
  CategoryBreakdownItem,
  SpendingTrend,
  FinanceAIInsight,
} from "@shared/types/domain/finance";
import { staggerContainer, fadeSlideUp } from "../lib/motion";
import { HeroBalanceCard } from "./overview/HeroBalanceCard";
import { VelocityStrip } from "./overview/VelocityStrip";
import { SpendingOrbit } from "./overview/SpendingOrbit";
import { MonthComparisonBanner } from "./overview/MonthComparisonBanner";
import { AIInsightsFeed } from "./overview/AIInsightsFeed";
import { RecentTransactionsPreview } from "./overview/RecentTransactionsPreview";
import { BudgetHealthGauges } from "./overview/BudgetHealthGauges";
import { CashFlowWave } from "./charts/CashFlowWave";

interface OverviewSectionProps {
  summary: TransactionSummary | null;
  monthlySummary: MonthlySummary | null;
  budgetAlerts: BudgetAlert[];
  recentTransactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  goals: FinanceSavingGoal[];
  categoryBreakdown: CategoryBreakdownItem[];
  trends: SpendingTrend[];
  insights: FinanceAIInsight[];
  comparison?: { current: MonthlySummary; previous: MonthlySummary } | null;
  onDismissInsight: (id: string) => void;
  onViewAllTransactions: () => void;
}

function ViewportSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-8% 0px" });

  return (
    <motion.div
      ref={ref}
      variants={staggerContainer}
      initial="hidden"
      animate={isInView ? "show" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function OverviewSection({
  summary,
  monthlySummary,
  budgetAlerts,
  recentTransactions,
  budgets,
  goals,
  categoryBreakdown,
  trends,
  insights,
  comparison,
  onDismissInsight,
  onViewAllTransactions,
}: OverviewSectionProps) {
  const income = summary?.totalIncome || 0;
  const expense = summary?.totalExpense || 0;
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  const momDelta = monthlySummary?.momDelta || 0;

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvg = dayOfMonth > 0 ? expense / dayOfMonth : 0;
  const todaySpend = recentTransactions
    .filter(t => t.transactionDate === now.toISOString().split("T")[0] && t.transactionType === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const weekTotal = recentTransactions
    .filter(t => {
      const txDate = new Date(t.transactionDate);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      return txDate >= weekAgo && t.transactionType === "expense";
    })
    .reduce((s, t) => s + t.amount, 0);
  const monthForecast = dailyAvg * daysInMonth;
  const recentDays = trends.map(t => t.expense);

  const budgetUsed = budgets.reduce((s, b) => s + (b.currentSpend || 0), 0);
  const budgetTotal = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const goalsSaved = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
  const goalsTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const emergencyMonths = income > 0 ? goalsSaved / (expense / Math.max(dayOfMonth, 1) * 30) : 0;

  const cashFlowData = useMemo(() => {
    return trends.slice(-6).map(t => ({
      label: new Date(t.month + "-01").toLocaleDateString("en", { month: "short" }),
      income: t.income,
      expense: t.expense,
    }));
  }, [trends]);

  return (
    <div className="space-y-5">
      {/* Hero Balance */}
      <ViewportSection>
        <HeroBalanceCard
          income={income}
          expense={expense}
          savingsRate={savingsRate}
          momDelta={momDelta}
        />
      </ViewportSection>

      {/* Financial Health Gauges */}
      <ViewportSection>
        <BudgetHealthGauges
          savingsRate={savingsRate}
          budgetUsed={budgetUsed}
          budgetTotal={budgetTotal}
          debtToIncome={0}
          emergencyMonths={emergencyMonths}
        />
      </ViewportSection>

      {/* Spending Velocity */}
      <ViewportSection>
        <VelocityStrip
          dailyAvg={dailyAvg}
          weekTotal={weekTotal}
          monthForecast={monthForecast}
          todaySpend={todaySpend}
          recentDays={recentDays.length > 1 ? recentDays : [0, todaySpend]}
        />
      </ViewportSection>

      {/* Cash Flow Wave Chart */}
      {cashFlowData.length >= 2 && (
        <ViewportSection>
          <motion.div variants={fadeSlideUp} className="rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.07] p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-syne)]">Cash Flow</h3>
              <div className="ml-auto flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-1 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" /> Income
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-1 rounded-full bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.5)]" /> Expenses
                </span>
              </div>
            </div>
            <CashFlowWave data={cashFlowData} height={200} />
          </motion.div>
        </ViewportSection>
      )}

      {/* Spending Orbit + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ViewportSection>
          <SpendingOrbit
            categories={categoryBreakdown}
            totalExpense={expense}
          />
        </ViewportSection>
        <ViewportSection>
          <RecentTransactionsPreview
            transactions={recentTransactions}
            onViewAll={onViewAllTransactions}
          />
        </ViewportSection>
      </div>

      {/* Month Comparison */}
      {comparison && (
        <ViewportSection>
          <MonthComparisonBanner
            current={comparison.current}
            previous={comparison.previous}
          />
        </ViewportSection>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <ViewportSection>
          <AIInsightsFeed
            insights={insights}
            onDismiss={onDismissInsight}
          />
        </ViewportSection>
      )}
    </div>
  );
}
