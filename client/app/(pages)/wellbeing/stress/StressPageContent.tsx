"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Activity,
  TrendingUp,
  Brain,
  ArrowLeft,
  ChevronDown,
  Flame,
  Heart,
  BarChart3,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  StressCheckIn,
  StressCrisisBanner,
  StressEveningPrompt,
  StressAnalytics,
  EmotionAnalytics,
} from "@/app/(pages)/dashboard/components/wellbeing";
import {
  stressService,
  type StressLog,
  type StressSummary,
} from "@/src/shared/services/stress.service";

/* ───────── Period Options ───────── */

const PERIODS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-4"
    >
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
    </motion.div>
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
      <Icon className="h-4 w-4 text-rose-400" />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
  );
}

/* ───────── Main Content ───────── */

function StressContent() {
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [stressLogs, setStressLogs] = useState<StressLog[]>([]);
  const [stressSummary, setStressSummary] = useState<StressSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(14);
  const [periodOpen, setPeriodOpen] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const from = format(subDays(today, period - 1), "yyyy-MM-dd");
      const to = format(today, "yyyy-MM-dd");

      const [logsResult, summaryResult] = await Promise.all([
        stressService.getLogs(from, to),
        stressService.getSummary(from, to),
      ]);

      if (logsResult.success && logsResult.data) setStressLogs(logsResult.data);
      if (summaryResult.success && summaryResult.data) setStressSummary(summaryResult.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckInClose = (open: boolean) => {
    setShowCheckIn(open);
    if (!open) fetchData();
  };

  // Compute stats
  const avgStress =
    stressLogs.length > 0
      ? stressLogs.reduce((a, l) => a + (l.stressRating || 0), 0) / stressLogs.length
      : 0;
  const highStressDays = stressSummary.filter((s) => s.dailyAvg > 7).length;
  const totalLogs = stressLogs.length;

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
              <Activity className="h-4 w-4 text-rose-400" />
              <span className="text-sm font-semibold text-white hidden sm:inline">
                Stress Management
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Period Selector */}
            <div className="relative">
              <button
                onClick={() => setPeriodOpen(!periodOpen)}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-white/[0.08] bg-white/[0.03] text-xs text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                {PERIODS.find((p) => p.value === period)?.label}
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
                          setPeriod(p.value);
                          setPeriodOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                          p.value === period
                            ? "bg-rose-500/10 text-rose-400"
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

            <Button
              size="sm"
              onClick={() => setShowCheckIn(true)}
              className="h-7 px-3 text-xs bg-rose-500/90 hover:bg-rose-500 text-white border-0 rounded-md"
            >
              <Activity className="h-3 w-3 mr-1" />
              Log Stress
            </Button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-5">
            {/* Crisis Banner */}
            <StressCrisisBanner />
            <StressEveningPrompt />

            {/* ── Stat Cards ── */}
            {loading ? (
              <div className="h-24 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-rose-400" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Avg Stress"
                  value={avgStress.toFixed(1)}
                  sub="/ 10"
                  icon={Activity}
                  color="#f43f5e"
                />
                <StatCard
                  label="Total Logs"
                  value={totalLogs}
                  sub={`in ${period}d`}
                  icon={BarChart3}
                  color="#06b6d4"
                />
                <StatCard
                  label="High Stress"
                  value={`${highStressDays}d`}
                  sub="above 7/10"
                  icon={Flame}
                  color="#ef4444"
                />
                <StatCard
                  label="Resilience"
                  value={avgStress <= 5 ? "Good" : avgStress <= 7 ? "Moderate" : "Low"}
                  sub="based on avg"
                  icon={Shield}
                  color="#10b981"
                />
              </div>
            )}

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                <SectionHeader icon={TrendingUp} title="Stress Analytics" />
                <StressAnalytics
                  logs={stressLogs}
                  summary={stressSummary}
                  isLoading={loading}
                  onRefresh={fetchData}
                />
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                <SectionHeader icon={Brain} title="Emotional Wellbeing" />
                <EmotionAnalytics days={period} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Stress Check-In Modal ── */}
        <AnimatePresence>
          {showCheckIn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowCheckIn(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 12 }}
                transition={{ type: "spring", damping: 28, stiffness: 350 }}
                onClick={(e) => e.stopPropagation()}
              >
                <StressCheckIn
                  open={showCheckIn}
                  onOpenChange={handleCheckInClose}
                  checkInType="on_demand"
                  initialMode="light"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

/* ───────── Export ───────── */

function StressLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
    </div>
  );
}

export default function StressPageContent() {
  return (
    <Suspense fallback={<StressLoading />}>
      <StressContent />
    </Suspense>
  );
}
