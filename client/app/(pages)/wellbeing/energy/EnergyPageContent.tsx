"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Zap,
  TrendingUp,
  TrendingDown,
  Flame,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  ArrowLeft,
  ChevronDown,
  Activity,
  BarChart3,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  EnergyCheckIn,
  EnergyTimeline,
  EnergyPatterns,
} from "@/app/(pages)/dashboard/components/wellbeing";
import { energyService } from "@/src/shared/services/wellbeing.service";
import { subDays, format } from "date-fns";

/* ───────── Types ───────── */

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  trend?: number;
}

/* ───────── Inline Components ───────── */

function StatCard({ label, value, sub, icon: Icon, color, trend }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f0f18] p-4"
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
      {trend !== undefined && trend !== 0 && (
        <div className="mt-2 flex items-center gap-1">
          {trend > 0 ? (
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-400" />
          )}
          <span
            className={`text-[11px] font-medium ${
              trend > 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trend > 0 ? "+" : ""}
            {trend.toFixed(1)} vs prev
          </span>
        </div>
      )}
    </motion.div>
  );
}

function CircularScore({
  value,
  max,
  label,
  color,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" className="-rotate-90">
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
        />
        <motion.circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-lg font-bold text-white">
        {value.toFixed(1)}
      </span>
      <span className="text-[10px] text-slate-500 mt-[-4px]">{label}</span>
    </div>
  );
}

function TimeBar({
  label,
  value,
  max,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" style={{ color }} />
          <span className="text-xs text-slate-400">{label}</span>
        </div>
        <span className="text-xs font-medium text-white">
          {value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function ContextBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-20 truncate capitalize">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[11px] font-medium text-slate-500 w-8 text-right">
        {count}
      </span>
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
      <Icon className="h-4 w-4 text-amber-400" />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
  );
}

/* ───────── Period Options ───────── */

const PERIODS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const TIME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};

const TIME_COLORS: Record<string, string> = {
  morning: "#fbbf24",
  afternoon: "#f97316",
  evening: "#ef4444",
  night: "#8b5cf6",
};

const CONTEXT_COLORS = [
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#ec4899",
  "#64748b",
];

/* ───────── Main Content ───────── */

function EnergyContent() {
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [period, setPeriod] = useState(30);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Computed summary state
  const [summary, setSummary] = useState({
    avgEnergy: 0,
    totalLogs: 0,
    streak: 0,
    trend: 0,
    peakTime: "—",
    lowTime: "—",
    topContext: "—",
    timeOfDay: {} as Record<string, number>,
    contexts: [] as { tag: string; count: number }[],
  });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const end = new Date().toISOString().split("T")[0];
      const start = format(subDays(new Date(), period), "yyyy-MM-dd");

      const [timelineRes, patternsRes, logsRes] = await Promise.all([
        energyService.getTimeline(start, end),
        energyService.getPatterns(period),
        energyService.getLogs({ startDate: start, endDate: end }),
      ]);

      const logs = logsRes.data?.logs || [];
      const timeline = timelineRes.data?.timeline || [];
      const patterns = patternsRes.data?.patterns;

      // Avg energy
      const ratings = timeline.map((t) => t.energyRating).filter(Boolean);
      const avg =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 0;

      // Trend: compare last half vs first half
      const half = Math.floor(ratings.length / 2);
      const recentAvg =
        half > 0
          ? ratings.slice(half).reduce((a, b) => a + b, 0) /
            ratings.slice(half).length
          : 0;
      const prevAvg =
        half > 0
          ? ratings.slice(0, half).reduce((a, b) => a + b, 0) /
            ratings.slice(0, half).length
          : 0;
      const trend = prevAvg > 0 ? recentAvg - prevAvg : 0;

      // Streak
      let streak = 0;
      const logDates = new Set(
        logs.map((l) =>
          new Date(l.loggedAt || l.createdAt).toISOString().split("T")[0]
        )
      );
      const today = new Date();
      for (let i = 0; i < period; i++) {
        const d = format(subDays(today, i), "yyyy-MM-dd");
        if (logDates.has(d)) streak++;
        else break;
      }

      // Time of day
      const timeOfDay = (patterns as any)?.timeOfDay || {};
      let peakTime = "—";
      let lowTime = "—";
      const todEntries = Object.entries(timeOfDay) as [string, number][];
      if (todEntries.length > 0) {
        todEntries.sort((a, b) => b[1] - a[1]);
        peakTime = todEntries[0][0];
        lowTime = todEntries[todEntries.length - 1][0];
      }

      // Context tags
      const contextMap: Record<string, number> = {};
      logs.forEach((l) => {
        const tag = (l as any).context_tag || (l as any).contextTag;
        if (tag) contextMap[tag] = (contextMap[tag] || 0) + 1;
      });
      const contexts = Object.entries(contextMap)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

      setSummary({
        avgEnergy: avg,
        totalLogs: logs.length,
        streak,
        trend,
        peakTime,
        lowTime,
        topContext: contexts[0]?.tag || "—",
        timeOfDay,
        contexts,
      });
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const handler = () => loadSummary();
    window.addEventListener("energy-logged", handler);
    return () => window.removeEventListener("energy-logged", handler);
  }, [loadSummary]);

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
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-white hidden sm:inline">
                Energy Monitoring
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
                            ? "bg-amber-500/10 text-amber-400"
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

            {/* Log Energy Button */}
            <Button
              size="sm"
              onClick={() => setShowCheckIn(true)}
              className="h-7 px-3 text-xs bg-amber-500/90 hover:bg-amber-500 text-white border-0 rounded-md"
            >
              <Zap className="h-3 w-3 mr-1" />
              Log Energy
            </Button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-5">
            {/* ── Stat Cards ── */}
            {loading ? (
              <div className="h-24 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard
                  label="Avg Energy"
                  value={summary.avgEnergy.toFixed(1)}
                  sub={`/ 10`}
                  icon={Zap}
                  color="#f59e0b"
                  trend={summary.trend}
                />
                <StatCard
                  label="Total Logs"
                  value={summary.totalLogs}
                  sub={`in ${period}d`}
                  icon={BarChart3}
                  color="#06b6d4"
                />
                <StatCard
                  label="Streak"
                  value={`${summary.streak}d`}
                  sub="consecutive"
                  icon={Flame}
                  color="#ef4444"
                />
                <StatCard
                  label="Peak Time"
                  value={summary.peakTime}
                  sub="highest avg"
                  icon={Sunrise}
                  color="#fbbf24"
                />
                <StatCard
                  label="Low Time"
                  value={summary.lowTime}
                  sub="lowest avg"
                  icon={Moon}
                  color="#8b5cf6"
                />
                <StatCard
                  label="Top Context"
                  value={summary.topContext}
                  sub="most logged"
                  icon={Target}
                  color="#10b981"
                />
              </div>
            )}

            {/* ── Main Grid: 2/3 + 1/3 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left Column — Timeline + Patterns */}
              <div className="lg:col-span-2 space-y-5">
                {/* Energy Timeline */}
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={TrendingUp} title="Energy Timeline" />
                  <EnergyTimeline days={period} />
                </div>

                {/* Energy Patterns */}
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={Activity} title="Energy Patterns" />
                  <EnergyPatterns days={period} />
                </div>
              </div>

              {/* Right Column — Analytics Sidebar */}
              <div className="space-y-5">
                {/* Time of Day Rings */}
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={Sun} title="Time of Day" />
                  {Object.keys(summary.timeOfDay).length > 0 ? (
                    <div className="space-y-3">
                      {(
                        Object.entries(summary.timeOfDay) as [string, number][]
                      ).map(([period, value]) => (
                        <TimeBar
                          key={period}
                          label={period}
                          value={typeof value === "number" ? value : 0}
                          max={10}
                          color={TIME_COLORS[period] || "#f59e0b"}
                          icon={TIME_ICONS[period] || Sun}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 text-center py-4">
                      No time-of-day data yet
                    </p>
                  )}
                </div>

                {/* Circular Score */}
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={Zap} title="Energy Score" />
                  <div className="flex justify-center py-2 relative">
                    <CircularScore
                      value={summary.avgEnergy}
                      max={10}
                      label="avg energy"
                      color="#f59e0b"
                    />
                  </div>
                </div>

                {/* Context Breakdown */}
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={Target} title="Context Breakdown" />
                  {summary.contexts.length > 0 ? (
                    <div className="space-y-2.5">
                      {summary.contexts.slice(0, 8).map((ctx, idx) => (
                        <ContextBar
                          key={ctx.tag}
                          label={ctx.tag}
                          count={ctx.count}
                          total={summary.totalLogs}
                          color={CONTEXT_COLORS[idx % CONTEXT_COLORS.length]}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 text-center py-4">
                      No context tags yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Energy Check-In Modal ── */}
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
                className="rounded-xl border border-white/[0.08] bg-[#0f0f18] shadow-2xl max-w-md w-full"
              >
                <div className="p-5">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                      <Zap className="h-4 w-4 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      Log Energy
                    </h3>
                  </div>
                  <EnergyCheckIn
                    onSuccess={() => {
                      setShowCheckIn(false);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("energy-logged"));
                      }
                    }}
                    onCancel={() => setShowCheckIn(false)}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

/* ───────── Export ───────── */

function EnergyLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
    </div>
  );
}

export default function EnergyPageContent() {
  return (
    <Suspense fallback={<EnergyLoading />}>
      <EnergyContent />
    </Suspense>
  );
}
