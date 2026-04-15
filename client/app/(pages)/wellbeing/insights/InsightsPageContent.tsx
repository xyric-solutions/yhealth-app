"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Lightbulb,
  Sparkles,
  BarChart3,
  Hash,
  RefreshCw,
  Loader2,
  ChevronDown,
  Zap,
  Brain,
  TrendingUp,
  BookOpen,
  Activity,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout";
import { InsightsPanel } from "@/app/(pages)/dashboard/components/wellbeing/InsightsPanel";
import { ThemeCloud } from "@/app/(pages)/dashboard/components/wellbeing/ThemeCloud";
import { insightsService } from "@/src/shared/services/wellbeing.service";
import toast from "react-hot-toast";

/* ───────── Period Options ───────── */

const PERIODS = [
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

/* ───────── Inline Components ───────── */

function SectionHeader({
  icon: Icon,
  title,
  color = "text-amber-400",
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`h-4 w-4 ${color}`} />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {badge && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-400 border border-violet-500/20">
          {badge}
        </span>
      )}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  href,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  description: string;
  href: string;
  color: string;
}) {
  const router = useRouter();
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => router.push(href)}
      className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-colors text-left w-full"
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">{description}</p>
      </div>
    </motion.button>
  );
}

/* ───────── Main ───────── */

export default function InsightsPageContent() {
  const router = useRouter();
  const [period, setPeriod] = useState(30);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [computing, setComputing] = useState(false);
  const [computeResult, setComputeResult] = useState<{
    correlationsFound: number;
    themesFound: number;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCompute = useCallback(async () => {
    try {
      setComputing(true);
      setComputeResult(null);
      const res = await insightsService.computeNow(period);
      if (res.success && res.data) {
        setComputeResult({
          correlationsFound: res.data.correlationsFound,
          themesFound: res.data.themesFound,
        });
        setRefreshKey((k) => k + 1);
        if (res.data.correlationsFound > 0 || res.data.themesFound > 0) {
          toast.success(
            `Found ${res.data.correlationsFound} correlations and ${res.data.themesFound} themes`
          );
        } else {
          toast("No insights found yet — keep logging data!", { icon: "💡" });
        }
      }
    } catch {
      toast.error("Failed to compute insights");
    } finally {
      setComputing(false);
    }
  }, [period]);

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
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-white hidden sm:inline">
                Insights
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

            {/* Compute Now */}
            <motion.button
              onClick={handleCompute}
              disabled={computing}
              whileHover={!computing ? { scale: 1.02 } : {}}
              whileTap={!computing ? { scale: 0.98 } : {}}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold bg-amber-500/90 hover:bg-amber-500 text-white border-0 disabled:opacity-60 transition-colors"
            >
              {computing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              {computing ? "Analyzing..." : "Generate"}
            </motion.button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-5">
            {/* Compute result banner */}
            <AnimatePresence>
              {computeResult && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 shrink-0">
                    <Brain className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Analysis complete:{" "}
                      <strong className="text-amber-200">
                        {computeResult.correlationsFound} correlation
                        {computeResult.correlationsFound !== 1 ? "s" : ""}
                      </strong>{" "}
                      and{" "}
                      <strong className="text-amber-200">
                        {computeResult.themesFound} theme
                        {computeResult.themesFound !== 1 ? "s" : ""}
                      </strong>{" "}
                      detected over {period} days.
                    </p>
                  </div>
                  <button
                    onClick={() => setComputeResult(null)}
                    className="text-amber-400/50 hover:text-amber-400 transition-colors text-xs"
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Health Correlations */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5"
              >
                <SectionHeader
                  icon={BarChart3}
                  title="Health Correlations"
                  color="text-emerald-400"
                  badge="AI"
                />
                <p className="text-xs text-slate-500 mb-4 -mt-2 leading-relaxed">
                  Statistical patterns between your sleep, mood, exercise, and
                  recovery data.
                </p>
                <InsightsPanel key={`corr-${refreshKey}`} />
              </motion.div>

              {/* Recurring Themes */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5"
              >
                <SectionHeader
                  icon={Hash}
                  title="Recurring Themes"
                  color="text-purple-400"
                  badge="AI"
                />
                <p className="text-xs text-slate-500 mb-4 -mt-2 leading-relaxed">
                  Common topics and patterns extracted from your journal entries
                  and check-ins.
                </p>
                <ThemeCloud key={`theme-${refreshKey}`} />
              </motion.div>
            </div>

            {/* How It Works */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5"
            >
              <SectionHeader
                icon={Sparkles}
                title="How AI Insights Work"
                color="text-violet-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    step: "1",
                    title: "Log Your Data",
                    desc: "Track mood, energy, stress, sleep, workouts, and journal entries consistently.",
                    color: "#06b6d4",
                  },
                  {
                    step: "2",
                    title: "AI Detects Patterns",
                    desc: "Pearson correlations and LLM theme extraction analyze your data every 6 hours.",
                    color: "#a855f7",
                  },
                  {
                    step: "3",
                    title: "Actionable Insights",
                    desc: "Get personalized health correlations and recurring wellbeing themes surfaced here.",
                    color: "#f59e0b",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="flex items-start gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                  >
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: `${item.color}30` }}
                    >
                      <span style={{ color: item.color }}>{item.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white mb-0.5">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5"
            >
              <SectionHeader
                icon={TrendingUp}
                title="Build Your Data"
                color="text-cyan-400"
              />
              <p className="text-xs text-slate-500 mb-4 -mt-2 leading-relaxed">
                The more data you log, the better insights become. At least 7
                data points needed for each correlation type.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <QuickAction
                  icon={Activity}
                  label="Log Mood"
                  description="Track how you feel"
                  href="/wellbeing/mood"
                  color="#ec4899"
                />
                <QuickAction
                  icon={BookOpen}
                  label="Journal"
                  description="Write your thoughts"
                  href="/wellbeing/journal"
                  color="#818cf8"
                />
                <QuickAction
                  icon={Zap}
                  label="Log Energy"
                  description="Track energy levels"
                  href="/wellbeing/energy"
                  color="#f97316"
                />
                <QuickAction
                  icon={RefreshCw}
                  label="Check-In"
                  description="Emotional assessment"
                  href="/wellbeing/emotional-checkin"
                  color="#10b981"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
