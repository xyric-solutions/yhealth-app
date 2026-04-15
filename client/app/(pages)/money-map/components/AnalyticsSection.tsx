"use client";

import { useRef, useMemo } from "react";
import { motion, useInView } from "framer-motion";
import { TrendingUp, PieChart, BarChart3, Grid3X3, ListOrdered, Radar, Activity } from "lucide-react";
import { staggerContainer, fadeSlideUp } from "../lib/motion";
import { TrendLineChart } from "./charts/TrendLineChart";
import { CategoryDonut } from "./charts/CategoryDonut";
import { MonthBarChart } from "./charts/MonthBarChart";
import { SpendingHeatmap } from "./charts/SpendingHeatmap";
import { TopCategoriesRanked } from "./analytics/TopCategoriesRanked";
import { AISpendingScoreCard } from "./analytics/AISpendingScoreCard";
import { SpendingRadar } from "./charts/SpendingRadar";
import { CashFlowWave } from "./charts/CashFlowWave";
import { AnimatedGauge } from "./charts/AnimatedGauge";
import type {
  CategoryBreakdownItem,
  SpendingTrend,
  MonthlySummary,
  BudgetAlert,
  FinanceTransaction,
} from "@shared/types/domain/finance";

interface AnalyticsSectionProps {
  categoryBreakdown: CategoryBreakdownItem[];
  trends: SpendingTrend[];
  comparison: { current: MonthlySummary; previous: MonthlySummary } | null;
  budgetAlerts: BudgetAlert[];
  transactions: FinanceTransaction[];
  totalExpense: number;
  totalIncome: number;
  savingsRate: number;
  financeScore: number;
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-5% 0px" });
  return (
    <motion.div ref={ref} variants={staggerContainer} initial="hidden" animate={isInView ? "show" : "hidden"} className={className}>
      {children}
    </motion.div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.07] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, label, color }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-syne)]">{label}</h3>
    </div>
  );
}

export function AnalyticsSection({
  categoryBreakdown, trends, comparison, budgetAlerts,
  transactions, totalExpense, totalIncome, savingsRate, financeScore,
}: AnalyticsSectionProps) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const heatmapData = transactions
    .filter(t => t.transactionType === "expense" && t.transactionDate.startsWith(currentMonth))
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.transactionDate] = (acc[t.transactionDate] || 0) + t.amount;
      return acc;
    }, {});
  const heatmapDays = Object.entries(heatmapData).map(([date, amount]) => ({ date, amount }));

  const trendChartData = trends.map(t => ({ month: t.month, income: t.income, expense: t.expense, net: t.net }));
  const barChartData = trends.map(t => ({ month: t.month, income: t.income, expense: t.expense }));

  const cashFlowData = useMemo(() => {
    return trends.slice(-6).map(t => ({
      label: new Date(t.month + "-01").toLocaleDateString("en", { month: "short" }),
      income: t.income,
      expense: t.expense,
    }));
  }, [trends]);

  const avgDailySpend = useMemo(() => {
    const daysWithSpend = Object.keys(heatmapData).length;
    return daysWithSpend > 0 ? totalExpense / daysWithSpend : 0;
  }, [heatmapData, totalExpense]);

  const topCategoryPct = categoryBreakdown.length > 0 ? categoryBreakdown[0].percentage : 0;

  return (
    <div className="space-y-5">
      {/* Row 0: Quick Metric Gauges */}
      <Section>
        <motion.div variants={fadeSlideUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <GlassCard className="p-4 flex items-center gap-4">
            <AnimatedGauge
              value={savingsRate}
              max={100}
              size={64}
              strokeWidth={5}
              color="#059669"
              glowColor="#34d399"
              formatValue={(v) => `${Math.round(v)}%`}
              delay={0}
            />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Savings</p>
              <p className="text-sm font-semibold text-white font-mono">{savingsRate}%</p>
              <p className="text-[9px] text-emerald-400/60">{savingsRate >= 20 ? "Excellent" : "Building"}</p>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-4">
            <AnimatedGauge
              value={financeScore}
              max={100}
              size={64}
              strokeWidth={5}
              color={financeScore >= 80 ? "#059669" : financeScore >= 60 ? "#0284c7" : "#f59e0b"}
              delay={0.1}
              formatValue={(v) => `${Math.round(v)}`}
              sublabel="/100"
            />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Score</p>
              <p className="text-sm font-semibold text-white font-mono">{financeScore}</p>
              <p className="text-[9px]" style={{ color: financeScore >= 80 ? "#059669" : financeScore >= 60 ? "#0284c7" : "#f59e0b" }}>
                {financeScore >= 80 ? "Excellent" : financeScore >= 60 ? "Good" : "Fair"}
              </p>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-4">
            <AnimatedGauge
              value={Math.min(topCategoryPct, 100)}
              max={100}
              size={64}
              strokeWidth={5}
              color={topCategoryPct > 40 ? "#f59e0b" : "#8b5cf6"}
              delay={0.2}
              formatValue={(v) => `${Math.round(v)}%`}
            />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Top Cat.</p>
              <p className="text-sm font-semibold text-white font-mono">{topCategoryPct.toFixed(0)}%</p>
              <p className="text-[9px] text-slate-400">{topCategoryPct > 40 ? "Concentrated" : "Balanced"}</p>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex items-center gap-4">
            <AnimatedGauge
              value={budgetAlerts.length === 0 ? 100 : Math.max(0, 100 - budgetAlerts.length * 25)}
              max={100}
              size={64}
              strokeWidth={5}
              color={budgetAlerts.length === 0 ? "#059669" : "#f43f5e"}
              delay={0.3}
              formatValue={(v) => `${Math.round(v)}%`}
            />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Budget</p>
              <p className="text-sm font-semibold text-white font-mono">
                {budgetAlerts.length === 0 ? "On Track" : `${budgetAlerts.length} Alert${budgetAlerts.length > 1 ? "s" : ""}`}
              </p>
              <p className="text-[9px]" style={{ color: budgetAlerts.length === 0 ? "#059669" : "#f43f5e" }}>
                {budgetAlerts.length === 0 ? "All good" : "Review needed"}
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </Section>

      {/* Row 1: Cash Flow Wave (full width) */}
      {cashFlowData.length >= 2 && (
        <Section>
          <GlassCard className="p-5">
            <motion.div variants={fadeSlideUp}>
              <SectionHeader icon={Activity} label="Cash Flow Analysis" color="#059669" />
              <CashFlowWave data={cashFlowData} height={240} />
            </motion.div>
          </GlassCard>
        </Section>
      )}

      {/* Row 2: Spending Trend (7-col) + Category Donut (5-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Section className="lg:col-span-7">
          <GlassCard className="p-5 h-full">
            <motion.div variants={fadeSlideUp}>
              <SectionHeader icon={TrendingUp} label="Spending Trend" color="#059669" />
              {trendChartData.length >= 1 ? (
                <TrendLineChart data={trendChartData} height={260} />
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                  Add transactions to see trends
                </div>
              )}
            </motion.div>
          </GlassCard>
        </Section>

        <Section className="lg:col-span-5">
          <GlassCard className="p-5 h-full">
            <motion.div variants={fadeSlideUp}>
              <SectionHeader icon={PieChart} label="Category Split" color="#0284c7" />
              {categoryBreakdown.length > 0 ? (
                <CategoryDonut data={categoryBreakdown} totalExpense={totalExpense} size={220} />
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                  No expense data for this month
                </div>
              )}
            </motion.div>
          </GlassCard>
        </Section>
      </div>

      {/* Row 3: Spending Radar (6-col) + Monthly Comparison (6-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {categoryBreakdown.length >= 3 && (
          <Section>
            <GlassCard className="p-5">
              <motion.div variants={fadeSlideUp}>
                <SectionHeader icon={Radar} label="Spending Radar" color="#8b5cf6" />
                <div className="flex justify-center py-2">
                  <SpendingRadar data={categoryBreakdown} size={280} />
                </div>
              </motion.div>
            </GlassCard>
          </Section>
        )}

        <Section>
          <GlassCard className="p-5">
            <motion.div variants={fadeSlideUp}>
              <SectionHeader icon={BarChart3} label="Monthly Comparison" color="#f59e0b" />
              {barChartData.length >= 1 ? (
                <MonthBarChart data={barChartData} height={240} />
              ) : (
                <div className="h-56 flex items-center justify-center text-xs text-slate-500">
                  Add transactions to see monthly comparison
                </div>
              )}
            </motion.div>
          </GlassCard>
        </Section>
      </div>

      {/* Row 4: Top Categories (6-col) + Daily Heatmap (6-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section>
          <GlassCard className="p-5">
            <motion.div variants={fadeSlideUp}>
              <SectionHeader icon={ListOrdered} label="Top Categories" color="#8b5cf6" />
              {categoryBreakdown.length > 0 ? (
                <TopCategoriesRanked
                  data={categoryBreakdown}
                  previousData={comparison?.previous.categoryBreakdown}
                />
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-500">No data</div>
              )}
            </motion.div>
          </GlassCard>
        </Section>

        <Section>
          <GlassCard className="p-5">
            <motion.div variants={fadeSlideUp}>
              <SectionHeader icon={Grid3X3} label="Daily Spend Heatmap" color="#059669" />
              <SpendingHeatmap
                data={heatmapDays}
                month={currentMonth}
                allTransactions={transactions.map(t => ({
                  transactionDate: t.transactionDate,
                  amount: t.amount,
                  transactionType: t.transactionType,
                }))}
              />
            </motion.div>
          </GlassCard>
        </Section>
      </div>

      {/* Row 5: AI Spending Score (full width) */}
      <Section>
        <AISpendingScoreCard
          score={financeScore}
          savingsRate={savingsRate}
          budgetAlerts={budgetAlerts}
          topCategories={categoryBreakdown}
        />
      </Section>
    </div>
  );
}
