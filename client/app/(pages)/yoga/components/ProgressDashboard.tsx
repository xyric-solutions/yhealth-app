"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Clock,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Loader2,
  History,
  Sparkles,
  Zap,
  BarChart3,
  Activity,
  Trophy,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { yogaHistoryService } from "@/src/shared/services/yoga.service";
import type {
  YogaStats,
  YogaSessionLog,
  YogaMilestone,
} from "@shared/types/domain/yoga";

// ─── Helpers ─────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(minutes: number): string {
  if (!minutes || isNaN(minutes)) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

const sessionTypeLabels: Record<string, string> = {
  recovery_flow: "Recovery",
  morning_flow: "Morning Flow",
  evening_flow: "Evening Flow",
  power_yoga: "Power Yoga",
  gentle_stretch: "Gentle Stretch",
  hip_opener_flow: "Hip Opener",
  balance_flow: "Balance",
  sleep_prep: "Sleep Prep",
  eye_exercise: "Eye Yoga",
  face_yoga: "Face & Smile Yoga",
  desk_stretch: "Desk Break",
  breathwork_focus: "Breathwork Focus",
  custom: "Custom",
  ai_generated: "AI Generated",
};

const sessionTypeColors: Record<string, { bg: string; text: string; bar: string }> = {
  recovery_flow: { bg: "bg-emerald-500/15", text: "text-emerald-400", bar: "bg-emerald-500" },
  morning_flow: { bg: "bg-amber-500/15", text: "text-amber-400", bar: "bg-amber-500" },
  evening_flow: { bg: "bg-indigo-500/15", text: "text-indigo-400", bar: "bg-indigo-500" },
  power_yoga: { bg: "bg-red-500/15", text: "text-red-400", bar: "bg-red-500" },
  gentle_stretch: { bg: "bg-teal-500/15", text: "text-teal-400", bar: "bg-teal-500" },
  hip_opener_flow: { bg: "bg-pink-500/15", text: "text-pink-400", bar: "bg-pink-500" },
  balance_flow: { bg: "bg-cyan-500/15", text: "text-cyan-400", bar: "bg-cyan-500" },
  sleep_prep: { bg: "bg-violet-500/15", text: "text-violet-400", bar: "bg-violet-500" },
  eye_exercise: { bg: "bg-sky-500/15", text: "text-sky-400", bar: "bg-sky-500" },
  face_yoga: { bg: "bg-fuchsia-500/15", text: "text-fuchsia-400", bar: "bg-fuchsia-500" },
  desk_stretch: { bg: "bg-teal-500/15", text: "text-teal-400", bar: "bg-teal-500" },
  breathwork_focus: { bg: "bg-violet-500/15", text: "text-violet-400", bar: "bg-violet-500" },
  custom: { bg: "bg-zinc-500/15", text: "text-zinc-400", bar: "bg-zinc-500" },
  ai_generated: { bg: "bg-sky-500/15", text: "text-sky-400", bar: "bg-sky-500" },
};

const milestoneConfig: Record<string, { gradient: string; glow: string; label: string; icon: typeof Trophy }> = {
  "3_day_streak": { gradient: "from-amber-500 to-orange-500", glow: "shadow-amber-500/25", label: "3 Day Streak", icon: Flame },
  "7_day_streak": { gradient: "from-orange-500 to-red-500", glow: "shadow-orange-500/25", label: "7 Day Streak", icon: Flame },
  "14_day_streak": { gradient: "from-red-500 to-rose-500", glow: "shadow-red-500/25", label: "14 Day Streak", icon: Flame },
  "30_day_streak": { gradient: "from-rose-500 to-pink-500", glow: "shadow-rose-500/25", label: "30 Day Streak", icon: Flame },
  "10_sessions": { gradient: "from-blue-500 to-indigo-500", glow: "shadow-blue-500/25", label: "10 Sessions", icon: CalendarCheck },
  "30_sessions": { gradient: "from-indigo-500 to-violet-500", glow: "shadow-indigo-500/25", label: "30 Sessions", icon: CalendarCheck },
  "50_sessions": { gradient: "from-violet-500 to-purple-500", glow: "shadow-violet-500/25", label: "50 Sessions", icon: CalendarCheck },
  "100_sessions": { gradient: "from-purple-500 to-fuchsia-500", glow: "shadow-purple-500/25", label: "100 Sessions", icon: Trophy },
  "100_minutes": { gradient: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/25", label: "100 Minutes", icon: Clock },
  "500_minutes": { gradient: "from-teal-500 to-cyan-500", glow: "shadow-teal-500/25", label: "500 Minutes", icon: Clock },
  "1000_minutes": { gradient: "from-cyan-500 to-sky-500", glow: "shadow-cyan-500/25", label: "1000 Minutes", icon: Clock },
  first_meditation: { gradient: "from-pink-500 to-rose-500", glow: "shadow-pink-500/25", label: "First Meditation", icon: Sparkles },
  first_yoga_nidra: { gradient: "from-fuchsia-500 to-purple-500", glow: "shadow-fuchsia-500/25", label: "First Yoga Nidra", icon: Sparkles },
  first_ai_session: { gradient: "from-sky-500 to-blue-500", glow: "shadow-sky-500/25", label: "First AI Session", icon: Sparkles },
};

// ─── Animated counter hook ───────────────────────────────

function useAnimatedNumber(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const safe = safeNum(target);
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * safe);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

// ─── Motion variants ─────────────────────────────────────

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

// ─── GlassCard wrapper ──────────────────────────────────

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-linear-to-b from-white/4 to-white/[0.01]",
        "backdrop-blur-2xl",
        "border border-white/6",
        "transition-all duration-500",
        "hover:border-white/10",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

// ─── Section header ─────────────────────────────────────

function SectionHeader({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  trailing,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border",
            iconBg
          )}
        >
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-[10px] text-zinc-500">{subtitle}</p>
        </div>
      </div>
      {trailing}
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  formatFn?: (v: number) => string;
  gradient: string;
  glowColor: string;
  decimals?: number;
  trend?: "up" | "down" | "stable";
}

function StatCard({
  icon,
  value,
  label,
  suffix,
  prefix,
  formatFn,
  gradient,
  glowColor,
  decimals = 0,
  trend,
}: StatCardProps) {
  const animated = useAnimatedNumber(safeNum(value));
  const display = formatFn
    ? formatFn(animated)
    : `${prefix ?? ""}${decimals > 0 ? animated.toFixed(decimals) : Math.round(animated)}${suffix ?? ""}`;

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-400 bg-emerald-500/10"
      : trend === "down"
        ? "text-rose-400 bg-rose-500/10"
        : "text-zinc-500 bg-zinc-500/10";

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl p-4 sm:p-5",
          "bg-linear-to-b from-white/4 to-white/[0.01]",
          "backdrop-blur-2xl",
          "border border-white/6",
          "transition-all duration-500",
          "hover:border-white/10 hover:shadow-lg",
          `hover:${glowColor}`
        )}
      >
        {/* Top gradient accent */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r opacity-50 group-hover:opacity-100 transition-opacity duration-500",
            gradient
          )}
        />

        {/* Subtle radial glow on hover */}
        <div
          className={cn(
            "pointer-events-none absolute -top-8 -left-8 h-24 w-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700",
            "bg-linear-to-br",
            gradient
          )}
          style={{ opacity: 0 }}
        />

        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              "flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-linear-to-br shadow-lg",
              gradient,
              glowColor
            )}
          >
            {icon}
          </div>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold",
                trendColor
              )}
            >
              <TrendIcon className="w-3 h-3" />
              {trend === "up" && <ArrowUpRight className="w-2.5 h-2.5" />}
            </div>
          )}
        </div>

        <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
          {display}
        </p>
        <p className="mt-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          {label}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Weekly Activity Bar Chart ───────────────────────────

function WeeklyAreaChart({ history }: { history: YogaSessionLog[] }) {
  const weekData = useMemo(() => {
    const days: { label: string; minutes: number; sessions: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
      const daySessions = history.filter(
        (l) => l.startedAt?.slice(0, 10) === dateStr
      );
      const totalMin = daySessions.reduce(
        (sum, l) => sum + safeNum(l.actualDurationSeconds, 0) / 60,
        0
      );
      days.push({
        label: dayLabel,
        minutes: Math.round(totalMin),
        sessions: daySessions.length,
      });
    }
    return days;
  }, [history]);

  const maxMin = Math.max(...weekData.map((d) => d.minutes), 1);
  const barMaxH = 120;

  return (
    <GlassCard>
      <div className="p-4 sm:p-5">
        <SectionHeader
          icon={<BarChart3 className="w-4 h-4" />}
          iconBg="bg-linear-to-br from-emerald-500/15 to-sky-500/15 border-emerald-500/20"
          iconColor="text-emerald-400"
          title="Weekly Activity"
          subtitle="Minutes per day"
          trailing={
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Minutes
            </div>
          }
        />

        <div
          className="flex items-end justify-between gap-1.5 sm:gap-3"
          style={{ height: barMaxH + 28 }}
        >
          {weekData.map((day, i) => {
            const h =
              maxMin > 0 ? (day.minutes / maxMin) * barMaxH : 0;
            const isToday = i === 6;
            return (
              <div
                key={day.label}
                className="flex flex-col items-center flex-1 gap-1.5"
              >
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="text-[9px] sm:text-[10px] text-zinc-400 tabular-nums font-medium"
                >
                  {day.minutes > 0 ? `${day.minutes}m` : ""}
                </motion.span>
                <div
                  className="relative w-full flex justify-center"
                  style={{ height: barMaxH }}
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{
                      height: Math.max(h, day.minutes > 0 ? 4 : 2),
                    }}
                    transition={{
                      duration: 0.8,
                      delay: 0.1 + i * 0.06,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={cn(
                      "w-full max-w-[32px] sm:max-w-[40px] rounded-t-lg absolute bottom-0",
                      isToday
                        ? "bg-linear-to-t from-emerald-600 to-emerald-400 shadow-lg shadow-emerald-500/20"
                        : day.minutes > 0
                          ? "bg-linear-to-t from-emerald-600/60 to-emerald-400/40"
                          : "bg-white/4"
                    )}
                  >
                    {/* Shimmer on today's bar */}
                    {isToday && day.minutes > 0 && (
                      <motion.div
                        animate={{ y: ["100%", "-100%"] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          repeatDelay: 3,
                        }}
                        className="absolute inset-x-0 h-1/3 bg-linear-to-t from-transparent via-white/20 to-transparent rounded-t-lg"
                      />
                    )}
                  </motion.div>
                </div>
                <span
                  className={cn(
                    "text-[9px] sm:text-[10px] font-semibold",
                    isToday ? "text-emerald-400" : "text-zinc-500"
                  )}
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Session Type Distribution ───────────────────────────

function SessionTypeChart({
  data,
}: {
  data: Array<{ sessionType: string; count: number }>;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.count - a.count).slice(0, 6),
    [data]
  );
  const max = Math.max(...sorted.map((d) => d.count), 1);

  if (sorted.length === 0) return null;

  return (
    <GlassCard>
      <div className="p-4 sm:p-5">
        <SectionHeader
          icon={<Activity className="w-4 h-4" />}
          iconBg="bg-linear-to-br from-cyan-500/15 to-blue-500/15 border-cyan-500/20"
          iconColor="text-cyan-400"
          title="Session Types"
          subtitle="Distribution by practice"
        />

        <div className="space-y-3">
          {sorted.map((item, i) => {
            const colors =
              sessionTypeColors[item.sessionType] || sessionTypeColors.custom;
            const pct = (item.count / max) * 100;
            return (
              <motion.div
                key={item.sessionType}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                className="group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", colors.bar)} />
                    <span className="text-[11px] sm:text-xs text-zinc-300 font-medium">
                      {sessionTypeLabels[item.sessionType] || item.sessionType}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 tabular-nums font-semibold">
                    {item.count}
                  </span>
                </div>
                <div className="h-2 bg-white/4 rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", colors.bar)}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{
                      duration: 0.8,
                      delay: 0.3 + i * 0.06,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Mood Trend Chart ────────────────────────────────────

function MoodTrendChart({ history }: { history: YogaSessionLog[] }) {
  const moodData = useMemo(() => {
    return history
      .filter((l) => l.moodBefore != null && l.moodAfter != null)
      .slice(0, 10)
      .reverse()
      .map((l) => ({
        before: safeNum(l.moodBefore),
        after: safeNum(l.moodAfter),
        delta: safeNum(l.moodAfter) - safeNum(l.moodBefore),
        date: new Date(l.startedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      }));
  }, [history]);

  if (moodData.length < 2) return null;

  const maxMood = 10;
  const chartW = 100;
  const chartH = 60;
  const stepX = chartW / (moodData.length - 1);

  const beforePath = moodData
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"} ${i * stepX} ${chartH - (d.before / maxMood) * chartH}`
    )
    .join(" ");
  const afterPath = moodData
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"} ${i * stepX} ${chartH - (d.after / maxMood) * chartH}`
    )
    .join(" ");
  const afterAreaPath = `${afterPath} L ${(moodData.length - 1) * stepX} ${chartH} L 0 ${chartH} Z`;

  return (
    <GlassCard>
      <div className="p-4 sm:p-5">
        <SectionHeader
          icon={<TrendingUp className="w-4 h-4" />}
          iconBg="bg-linear-to-br from-emerald-500/15 to-teal-500/15 border-emerald-500/20"
          iconColor="text-emerald-400"
          title="Mood Impact"
          subtitle="Before vs After sessions"
          trailing={
            <div className="flex items-center gap-3 text-[9px] sm:text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded bg-zinc-500" /> Before
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded bg-emerald-400" /> After
              </span>
            </div>
          }
        />

        <svg
          viewBox={`-2 -2 ${chartW + 4} ${chartH + 4}`}
          className="w-full h-auto"
          preserveAspectRatio="none"
          style={{ maxHeight: 140 }}
        >
          <motion.path
            d={afterAreaPath}
            fill="url(#moodAreaGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 1, delay: 0.3 }}
          />
          <motion.path
            d={beforePath}
            fill="none"
            stroke="rgba(100,116,139,0.4)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.2 }}
          />
          <motion.path
            d={afterPath}
            fill="none"
            stroke="#34d399"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.4 }}
          />
          {moodData.map((d, i) => (
            <motion.circle
              key={i}
              cx={i * stepX}
              cy={chartH - (d.after / maxMood) * chartH}
              r="2.5"
              fill="#0a0a0a"
              stroke="#34d399"
              strokeWidth="1.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.05 }}
            />
          ))}
          <defs>
            <linearGradient id="moodAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="flex justify-between mt-2 px-0.5">
          {moodData.map((d, i) => (
            <span
              key={i}
              className="text-[8px] sm:text-[9px] text-zinc-500 tabular-nums"
            >
              {d.date}
            </span>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Streak Banner ───────────────────────────────────────

function StreakBanner({
  streak,
}: {
  streak: { currentStreak: number; longestStreak: number };
}) {
  if (streak.currentStreak <= 0) return null;

  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 sm:p-6",
        "bg-linear-to-r from-orange-500/[0.08] via-amber-500/[0.04] to-transparent",
        "border border-orange-500/15",
        "backdrop-blur-2xl"
      )}
    >
      <div className="flex items-center gap-5">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 8, -8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="relative"
        >
          <div className="absolute inset-0 -m-2 rounded-full bg-orange-500/25 blur-xl" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20">
            <Flame className="h-6 w-6 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]" />
          </div>
        </motion.div>
        <div>
          <p className="text-lg font-bold text-white tracking-tight">
            {streak.currentStreak} day streak!
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {streak.longestStreak > 0
              ? `Personal best: ${streak.longestStreak} days`
              : "Keep it going!"}
          </p>
        </div>
      </div>

      {/* Fire particles */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -40, -70],
            x: [0, (i - 1.5) * 10],
            opacity: [0, 0.7, 0],
            scale: [0.4, 1, 0.2],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeOut",
          }}
          className="absolute bottom-3 left-10 h-1.5 w-1.5 rounded-full bg-orange-400/50"
        />
      ))}
    </motion.div>
  );
}

// ─── Milestone Badge ─────────────────────────────────────

function MilestoneBadge({ milestone }: { milestone: YogaMilestone }) {
  const config = milestoneConfig[milestone.milestone] || {
    gradient: "from-zinc-500 to-zinc-600",
    glow: "shadow-zinc-500/25",
    label: milestone.milestone.replace(/_/g, " "),
    icon: Award,
  };
  const MilestoneIcon = config.icon;

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ scale: 1.06, y: -3 }}
      className={cn(
        "group relative overflow-hidden rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3",
        "bg-linear-to-b from-white/4 to-white/[0.01]",
        "backdrop-blur-2xl border border-white/6",
        "transition-all duration-300 hover:border-white/10",
        `hover:shadow-md hover:${config.glow}`
      )}
    >
      {/* Shimmer */}
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatDelay: 5,
          ease: "easeInOut",
        }}
        className="absolute inset-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/4 to-transparent"
      />
      <div className="relative flex items-center gap-2.5">
        <div
          className={cn(
            "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-linear-to-br shadow-sm",
            config.gradient
          )}
        >
          <MilestoneIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
        </div>
        <span className="text-[11px] sm:text-sm font-semibold text-zinc-300 capitalize">
          {config.label}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Session History Card ────────────────────────────────

function SessionHistoryCard({ log, index }: { log: YogaSessionLog; index: number }) {
  const duration = safeNum(log.actualDurationSeconds, 0) / 60;
  const moodChange =
    log.moodBefore != null && log.moodAfter != null
      ? safeNum(log.moodAfter) - safeNum(log.moodBefore)
      : null;
  const typeStyle =
    sessionTypeColors[log.sessionType] || sessionTypeColors.custom;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ x: 4 }}
      className={cn(
        "group relative flex items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-4 py-3 sm:py-3.5",
        "bg-white/[0.02] backdrop-blur-xl border border-white/4",
        "hover:bg-white/4 hover:border-white/8",
        "transition-all duration-300"
      )}
    >
      {/* Left accent */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-linear-to-b from-emerald-500 to-sky-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div
        className={cn(
          "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl",
          typeStyle.bg
        )}
      >
        <Zap className={cn("h-4 w-4", typeStyle.text)} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-semibold text-white truncate">
          {sessionTypeLabels[log.sessionType] || log.sessionType}
        </p>
        <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">
          {formatDate(log.startedAt)}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <span className="text-[10px] sm:text-xs font-medium text-zinc-400 tabular-nums">
          {formatDuration(duration)}
        </span>
        {moodChange !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold tabular-nums",
              moodChange > 0
                ? "bg-emerald-500/15 text-emerald-400"
                : moodChange < 0
                  ? "bg-red-500/15 text-red-400"
                  : "bg-zinc-500/15 text-zinc-500"
            )}
          >
            {moodChange > 0 ? "+" : ""}
            {moodChange}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────

export default function ProgressDashboard() {
  const [stats, setStats] = useState<YogaStats | null>(null);
  const [history, setHistory] = useState<YogaSessionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [statsRes, historyRes] = await Promise.all([
          yogaHistoryService.getStats(),
          yogaHistoryService.getHistory({ limit: 20 }),
        ]);
        if (!cancelled) {
          if (statsRes.data) setStats(statsRes.data);
          if (historyRes.data?.logs) setHistory(historyRes.data.logs);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-7 w-7 text-emerald-400" />
        </motion.div>
        <p className="text-sm text-zinc-500">Loading your progress...</p>
      </div>
    );
  }

  const streak = stats?.streak;
  const milestones = streak?.milestonesAchieved || [];
  const moodDelta = safeNum(stats?.averageMoodDelta);
  const trend = stats?.recentTrend;

  // Empty state
  if (!stats || stats.totalSessions === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 px-4"
      >
        <motion.div
          animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="mb-8"
        >
          <div className="relative">
            <div className="absolute inset-0 -m-4 rounded-full bg-emerald-500/15 blur-3xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500/15 to-sky-500/15 border border-white/10">
              <Sparkles className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
        </motion.div>
        <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
          Your Journey Begins Here
        </h3>
        <p className="text-sm text-zinc-400 text-center max-w-sm leading-relaxed">
          Complete your first yoga session to start tracking your progress,
          streaks, and milestones.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="space-y-6 sm:space-y-8"
    >
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<Flame className="h-5 w-5 text-white" />}
          value={safeNum(streak?.currentStreak)}
          label="Day Streak"
          gradient="from-orange-500 to-amber-500"
          glowColor="shadow-orange-500/20"
          trend={safeNum(streak?.currentStreak) > 0 ? "up" : "stable"}
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5 text-white" />}
          value={safeNum(stats.totalSessions)}
          label="Sessions"
          gradient="from-emerald-500 to-sky-500"
          glowColor="shadow-emerald-500/20"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-white" />}
          value={safeNum(stats.totalMinutes)}
          label="Total Time"
          formatFn={(v) => formatDuration(Math.round(v))}
          gradient="from-blue-500 to-cyan-500"
          glowColor="shadow-blue-500/20"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-white" />}
          value={moodDelta}
          label="Avg Mood Change"
          prefix={moodDelta > 0 ? "+" : ""}
          gradient="from-emerald-500 to-teal-500"
          glowColor="shadow-emerald-500/20"
          decimals={1}
          trend={
            trend === "improving"
              ? "up"
              : trend === "declining"
                ? "down"
                : "stable"
          }
        />
      </div>

      {/* Streak Banner */}
      <StreakBanner
        streak={{
          currentStreak: safeNum(streak?.currentStreak),
          longestStreak: safeNum(streak?.longestStreak),
        }}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <WeeklyAreaChart history={history} />
        <SessionTypeChart data={stats.sessionsByType || []} />
      </div>

      {/* Mood Trend */}
      <MoodTrendChart history={history} />

      {/* Milestones */}
      {milestones.length > 0 && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/20">
              <Award className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Milestones</h2>
              <p className="text-[10px] text-zinc-500">
                {milestones.length} earned
              </p>
            </div>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="flex flex-wrap gap-2.5"
          >
            {milestones.map((ms: YogaMilestone) => (
              <MilestoneBadge key={ms.milestone} milestone={ms} />
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* Recent Sessions */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-zinc-500/15 to-zinc-600/15 border border-zinc-500/20">
            <History className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Recent Sessions</h2>
            <p className="text-[10px] text-zinc-500">
              {history.length} shown
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-white/4 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-zinc-500">
              No sessions yet. Start your first practice!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((log, i) => (
              <SessionHistoryCard key={log.id} log={log} index={i} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
