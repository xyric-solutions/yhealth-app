"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Wind,
  ArrowLeft,
  TrendingUp,
  History,
  Sparkles,
  ChevronDown,
  BarChart3,
  Award,
  Timer,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import {
  BreathingTest,
  BreathingChart,
  BreathingHistory,
} from "@/app/(pages)/dashboard/components/wellbeing/breathing";
import { breathingService } from "@/src/shared/services/wellbeing.service";
import type {
  BreathingTest as BreathingTestType,
  BreathingTimelineData,
  BreathingStats,
  BreathingTestType as TestType,
} from "@shared/types/domain/wellbeing";
import { toast } from "sonner";

/* ───────── Period Options ───────── */

const PERIODS = [
  { label: "7 days", value: 7 as const },
  { label: "14 days", value: 14 as const },
  { label: "30 days", value: 30 as const },
];

/* ───────── Inline Components ───────── */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-cyan-400" />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
  );
}

/* ───────── Main Content ───────── */

function BreathingContent() {
  const router = useRouter();
  const [tests, setTests] = useState<BreathingTestType[]>([]);
  const [timeline, setTimeline] = useState<BreathingTimelineData[]>([]);
  const [stats, setStats] = useState<BreathingStats | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [chartDays, setChartDays] = useState<7 | 14 | 30>(7);
  const [periodOpen, setPeriodOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - chartDays);

      const [testsRes, timelineRes, statsRes] = await Promise.all([
        breathingService.getTests({ limit: 10 }),
        breathingService.getTimeline(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ),
        breathingService.getStats(chartDays),
      ]);

      if (testsRes.success && testsRes.data) setTests(testsRes.data.tests);
      if (timelineRes.success && timelineRes.data)
        setTimeline(timelineRes.data.timeline);
      if (statsRes.success && statsRes.data) setStats(statsRes.data.stats);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [chartDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTestComplete = async (result: {
    testType: TestType;
    patternName: string;
    breathHoldDurationSeconds?: number;
    totalCyclesCompleted: number;
    totalDurationSeconds: number;
    consistencyScore?: number;
    startedAt: string;
  }) => {
    try {
      const response = await breathingService.saveTest({
        test_type: result.testType,
        pattern_name: result.patternName,
        breath_hold_duration_seconds: result.breathHoldDurationSeconds,
        total_cycles_completed: result.totalCyclesCompleted,
        total_duration_seconds: result.totalDurationSeconds,
        consistency_score: result.consistencyScore,
        started_at: result.startedAt,
      });

      if (response.success) {
        toast.success("Breathing test saved!", {
          description: result.breathHoldDurationSeconds
            ? `You held your breath for ${result.breathHoldDurationSeconds.toFixed(1)} seconds`
            : `Completed ${result.totalCyclesCompleted} cycles`,
        });
        fetchData();
      }
    } catch {
      toast.error("Failed to save test", { description: "Please try again" });
    }
  };

  return (
    <DashboardLayout activeTab="wellbeing">
      <div className="flex flex-col h-full min-h-screen bg-[#0a0a0f]">
        {/* ── Sticky Top Bar ── */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl px-4 sm:px-6 h-12">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/wellbeing")}
              className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white hidden sm:inline">
                Breathing Test
              </span>
            </div>
          </div>

          {/* Period Selector */}
          <div className="relative">
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-white/[0.08] bg-white/[0.03] text-xs text-slate-300 hover:bg-white/[0.06] transition-colors"
            >
              {PERIODS.find((p) => p.value === chartDays)?.label}
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </button>
            <AnimatePresence>
              {periodOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-9 z-50 w-28 rounded-lg border border-white/[0.08] bg-[#15151f] shadow-xl overflow-hidden"
                >
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setChartDays(p.value);
                        setPeriodOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                        p.value === chartDays
                          ? "bg-cyan-500/10 text-cyan-400"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-5">
            {/* Stat Cards */}
            {stats && stats.totalTests > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Tests"
                  value={stats.totalTests}
                  icon={BarChart3}
                  color="#06b6d4"
                />
                <StatCard
                  label="Best Hold"
                  value={`${stats.bestBreathHoldSeconds.toFixed(0)}s`}
                  icon={Award}
                  color="#f59e0b"
                />
                <StatCard
                  label="Avg Duration"
                  value={`${stats.averageBreathHoldSeconds?.toFixed(0) || "—"}s`}
                  icon={Timer}
                  color="#8b5cf6"
                />
                <StatCard
                  label="Improvement"
                  value={`${stats.improvementPercentage > 0 ? "+" : ""}${stats.improvementPercentage.toFixed(0)}%`}
                  icon={TrendingUp}
                  color="#10b981"
                />
              </div>
            )}

            {/* Main Grid: Test + Sidebar */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              {/* Left — Breathing Test */}
              <div className="xl:col-span-7">
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <BreathingTest onComplete={handleTestComplete} />
                </div>
              </div>

              {/* Right — History */}
              <div className="xl:col-span-5">
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={History} title="Recent Activity" />
                  <BreathingHistory
                    tests={tests}
                    stats={stats}
                    isLoading={isLoading}
                    maxItems={4}
                  />
                </div>
              </div>
            </div>

            {/* Performance Analytics */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
              <SectionHeader icon={TrendingUp} title="Performance Analytics" />
              <BreathingChart
                data={timeline}
                isLoading={isLoading}
                days={chartDays}
                onDaysChange={(d) => setChartDays(d)}
                showHeader={false}
              />
            </div>

            {/* Pro Tips */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-slate-300">
                  Pro Tips
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500">
                <div className="flex gap-2">
                  <span className="text-cyan-400 font-semibold">1.</span>
                  <span>Practice on an empty stomach for best results</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-cyan-400 font-semibold">2.</span>
                  <span>Sit or lie down in a comfortable position</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-cyan-400 font-semibold">3.</span>
                  <span>Stay consistent — practice daily for improvement</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ───────── Export ───────── */

function BreathingLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
    </div>
  );
}

export default function BreathingPageContent() {
  return (
    <Suspense fallback={<BreathingLoading />}>
      <BreathingContent />
    </Suspense>
  );
}
