"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, Target, Clock, Flame, Trophy, TrendingUp, TrendingDown,
  Loader2, BarChart3, Activity, Sparkles, Zap, CheckCircle2,
  AlertTriangle, XCircle, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { visionHistoryService } from "@/src/shared/services/vision.service";
import type { VisionStats, VisionClassification } from "@shared/types/domain/vision";

import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar,
} from "recharts";

// ─── Animation Variants ─────────────────────────────────────────────

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

// ─── Classification Config ──────────────────────────────────────────

const classConfig: Record<VisionClassification, {
  label: string; description: string;
  icon: typeof CheckCircle2; color: string; ringColor: string;
  bg: string; border: string; glow: string;
}> = {
  normal: {
    label: "Normal Vision", description: "Your color perception is within the normal range",
    icon: CheckCircle2, color: "text-emerald-400", ringColor: "#34d399",
    bg: "from-emerald-500/8 to-emerald-500/3", border: "border-emerald-500/15",
    glow: "shadow-emerald-500/10",
  },
  protan_weak: {
    label: "Mild Red Weakness", description: "Slight difficulty distinguishing red-green hues",
    icon: AlertTriangle, color: "text-amber-400", ringColor: "#fbbf24",
    bg: "from-amber-500/8 to-amber-500/3", border: "border-amber-500/15",
    glow: "shadow-amber-500/10",
  },
  protan_strong: {
    label: "Red-Green Deficiency", description: "Significant difficulty with red-green discrimination",
    icon: XCircle, color: "text-red-400", ringColor: "#f87171",
    bg: "from-red-500/8 to-red-500/3", border: "border-red-500/15",
    glow: "shadow-red-500/10",
  },
  deutan_weak: {
    label: "Mild Green Weakness", description: "Slight difficulty distinguishing green hues",
    icon: AlertTriangle, color: "text-amber-400", ringColor: "#fbbf24",
    bg: "from-amber-500/8 to-amber-500/3", border: "border-amber-500/15",
    glow: "shadow-amber-500/10",
  },
  deutan_strong: {
    label: "Green Deficiency", description: "Significant difficulty with green discrimination",
    icon: XCircle, color: "text-red-400", ringColor: "#f87171",
    bg: "from-red-500/8 to-red-500/3", border: "border-red-500/15",
    glow: "shadow-red-500/10",
  },
  tritan_weak: {
    label: "Mild Blue-Yellow Weakness", description: "Slight difficulty distinguishing blue-yellow hues",
    icon: AlertTriangle, color: "text-amber-400", ringColor: "#fbbf24",
    bg: "from-amber-500/8 to-amber-500/3", border: "border-amber-500/15",
    glow: "shadow-amber-500/10",
  },
  tritan_strong: {
    label: "Blue-Yellow Deficiency", description: "Significant difficulty with blue-yellow discrimination",
    icon: XCircle, color: "text-red-400", ringColor: "#f87171",
    bg: "from-red-500/8 to-red-500/3", border: "border-red-500/15",
    glow: "shadow-red-500/10",
  },
};

// ─── Animated Number ────────────────────────────────────────────────

function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const duration = 1200;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(eased * value);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <span ref={ref}>{displayed.toFixed(decimals)}{suffix}</span>;
}

// ─── Hero Score Ring ────────────────────────────────────────────────

function HeroScoreRing({ accuracy, classification }: { accuracy: number; classification?: VisionClassification }) {
  const config = classification ? classConfig[classification] : classConfig.normal;
  const data = [{ value: accuracy, fill: config.ringColor }];

  return (
    <motion.div variants={fadeUp} className="relative flex flex-col items-center">
      {/* Glow behind ring */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[60px] opacity-20"
        style={{ background: config.ringColor }}
      />

      <div className="relative w-52 h-52 sm:w-60 sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="50%"
            innerRadius="78%" outerRadius="100%"
            barSize={12}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              background={{ fill: "rgba(255,255,255,0.04)" }}
              dataKey="value"
              cornerRadius={10}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl sm:text-5xl font-bold text-white tabular-nums">
            <AnimatedNumber value={accuracy} decimals={1} />
          </span>
          <span className="text-[11px] text-zinc-500 uppercase tracking-widest mt-1">Accuracy %</span>
        </div>
      </div>

      {/* Classification label */}
      <div className="flex items-center gap-2 mt-3">
        <config.icon className={cn("h-4 w-4", config.color)} />
        <span className={cn("text-sm font-semibold", config.color)}>{config.label}</span>
      </div>
      <p className="text-[11px] text-zinc-500 mt-1 text-center max-w-xs">{config.description}</p>
    </motion.div>
  );
}

// ─── Premium KPI Card ───────────────────────────────────────────────

function KPICard({
  icon: Icon, label, value, subtext, accent, gradient, delay = 0,
}: {
  icon: typeof Eye; label: string; value: string | number; subtext?: string;
  accent: string; gradient: string; delay?: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, scale: 1.02 }}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "border border-white/[0.06]",
        "bg-gradient-to-br", gradient,
        "backdrop-blur-2xl p-4 sm:p-5",
        "transition-shadow duration-500",
        "hover:shadow-xl hover:border-white/[0.1]"
      )}
    >
      {/* Shimmer */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
      >
        <div className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
      </motion.div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">{label}</span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{value}</p>
        {subtext && <p className="text-[11px] text-zinc-500 mt-1.5">{subtext}</p>}
      </div>
    </motion.div>
  );
}

// ─── Glass Chart Card ───────────────────────────────────────────────

function ChartCard({
  title, icon: Icon, iconColor, children, className,
}: {
  title: string; icon: typeof TrendingUp; iconColor: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "rounded-2xl overflow-hidden",
        "border border-white/[0.06]",
        "bg-gradient-to-b from-white/[0.04] to-white/[0.01]",
        "backdrop-blur-2xl",
        className
      )}
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconColor)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="px-3 pb-4">
        {children}
      </div>
    </motion.div>
  );
}

// ─── Custom Tooltip ─────────────────────────────────────────────────

function PremiumTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-zinc-900/95 border border-white/10 px-4 py-3 shadow-2xl backdrop-blur-xl">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.stroke || p.fill }} />
          <span className="text-xs text-zinc-300">{p.name}:</span>
          <span className="text-xs font-bold text-white">{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function VisionProgress() {
  const [stats, setStats] = useState<VisionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    visionHistoryService
      .getStats()
      .then((res) => {
        if (res.success && res.data?.stats) setStats(res.data.stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-emerald-400/20" />
        </div>
        <span className="text-sm text-zinc-500">Loading analytics...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-24 space-y-4"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-800/50 border border-white/5 mx-auto">
          <Eye className="h-10 w-10 text-zinc-600" />
        </div>
        <div>
          <p className="text-base font-medium text-zinc-400">No vision test data yet</p>
          <p className="text-sm text-zinc-600 mt-1">Complete a color vision test to see your analytics here</p>
        </div>
      </motion.div>
    );
  }

  const cls = stats.latestClassification ? classConfig[stats.latestClassification] : null;
  const hasCharts = stats.accuracyTrend.length > 0;
  const hasResponseChart = stats.responseTimeTrend.length > 0;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Hero Section: Score Ring + Classification */}
      <motion.div
        variants={fadeUp}
        className={cn(
          "relative rounded-3xl overflow-hidden",
          "border", cls?.border || "border-white/[0.06]",
          "bg-gradient-to-br", cls?.bg || "from-white/[0.04] to-transparent",
          "backdrop-blur-2xl shadow-xl", cls?.glow || ""
        )}
      >
        {/* Background mesh */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/2 -right-1/3 w-[180%] h-[180%] rounded-full opacity-[0.02] bg-[conic-gradient(from_0deg,transparent,currentColor,transparent)]"
            style={{ color: cls?.ringColor || "#34d399" }}
          />
        </div>

        <div className="relative z-10 py-8 sm:py-10 px-6">
          <HeroScoreRing
            accuracy={stats.averageAccuracy}
            classification={stats.latestClassification}
          />
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          icon={Target} label="Accuracy"
          value={`${stats.averageAccuracy.toFixed(1)}%`}
          accent="bg-emerald-500/15 text-emerald-400"
          gradient="from-emerald-500/[0.06] to-transparent"
        />
        <KPICard
          icon={Clock} label="Avg Response"
          value={`${(stats.averageResponseTimeMs / 1000).toFixed(1)}s`}
          accent="bg-sky-500/15 text-sky-400"
          gradient="from-sky-500/[0.06] to-transparent"
        />
        <KPICard
          icon={BarChart3} label="Tests Taken"
          value={stats.totalTests}
          subtext={stats.totalExercises > 0 ? `+ ${stats.totalExercises} exercises` : undefined}
          accent="bg-violet-500/15 text-violet-400"
          gradient="from-violet-500/[0.06] to-transparent"
        />
        <KPICard
          icon={Flame} label="Streak"
          value={`${stats.streak.currentStreak}d`}
          subtext={`Best: ${stats.streak.longestStreak}d`}
          accent="bg-amber-500/15 text-amber-400"
          gradient="from-amber-500/[0.06] to-transparent"
        />
      </motion.div>

      {/* Charts — Side by Side on Desktop */}
      {(hasCharts || hasResponseChart) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Accuracy Trend */}
          {hasCharts && (
            <ChartCard title="Accuracy Trend" icon={TrendingUp} iconColor="bg-emerald-500/15 text-emerald-400">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.accuracyTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<PremiumTooltip />} />
                  <Area
                    type="monotone" dataKey="accuracy" name="Accuracy %"
                    stroke="#34d399" strokeWidth={2.5} fill="url(#accGrad)"
                    dot={{ r: 4, fill: "#111", stroke: "#34d399", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#34d399", stroke: "#111", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Response Time Trend */}
          {hasResponseChart && (
            <ChartCard title="Response Time" icon={Activity} iconColor="bg-sky-500/15 text-sky-400">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.responseTimeTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<PremiumTooltip />} />
                  <Area
                    type="monotone" dataKey="avgMs" name="Avg ms"
                    stroke="#38bdf8" strokeWidth={2.5} fill="url(#rtGrad)"
                    dot={{ r: 4, fill: "#111", stroke: "#38bdf8", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#38bdf8", stroke: "#111", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* Bottom row: Milestones + Suggested Exercises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Milestones */}
        <motion.div
          variants={fadeUp}
          className={cn(
            "rounded-2xl overflow-hidden",
            "border border-white/[0.06]",
            "bg-gradient-to-b from-white/[0.04] to-white/[0.01]",
            "backdrop-blur-2xl p-5"
          )}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <Trophy className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Milestones</h3>
            <span className="ml-auto text-[10px] text-zinc-600 tabular-nums">
              {stats.streak.milestonesAchieved.length} earned
            </span>
          </div>

          {stats.streak.milestonesAchieved.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {stats.streak.milestonesAchieved.map((m) => (
                <motion.span
                  key={m.milestone}
                  whileHover={{ scale: 1.05 }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/15 text-[11px] font-semibold text-amber-400"
                >
                  <Sparkles className="h-3 w-3" />
                  {m.milestone.replace(/_/g, " ")}
                </motion.span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-4 text-zinc-600">
              <Trophy className="h-5 w-5" />
              <span className="text-xs">Complete tests to unlock milestones</span>
            </div>
          )}
        </motion.div>

        {/* Suggested Exercises */}
        <motion.div
          variants={fadeUp}
          className={cn(
            "rounded-2xl overflow-hidden",
            "border border-white/[0.06]",
            "bg-gradient-to-b from-white/[0.04] to-white/[0.01]",
            "backdrop-blur-2xl p-5"
          )}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Eye className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Recommended</h3>
          </div>

          <div className="space-y-2.5">
            {stats.suggestedExercises.map((ex, i) => (
              <motion.div
                key={ex}
                whileHover={{ x: 4 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Zap className="h-3 w-3 text-emerald-400" />
                </div>
                <span className="text-xs text-zinc-300 font-medium">{ex}</span>
                <ArrowUpRight className="h-3 w-3 text-zinc-600 ml-auto" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
