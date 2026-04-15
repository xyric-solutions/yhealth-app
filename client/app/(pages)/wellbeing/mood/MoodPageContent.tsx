"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Smile,
  ArrowLeft,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Activity,
  Brain,
  Sparkles,
  Calendar,
  Clock,
  Heart,
  Zap,
  Shield,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  MoodCheckIn,
  MoodTimeline,
  MoodArcTimeline,
  BehavioralPatternBadges,
} from "@/app/(pages)/dashboard/components/wellbeing/mood";
import { moodService } from "@/src/shared/services/wellbeing.service";

/* ─────────── Types ─────────── */

interface MoodSummary {
  avgMood: number | null;
  totalLogs: number;
  streak: number;
  trend: "up" | "down" | "stable";
  trendDelta: number;
  topEmotion: string | null;
  topEmotionFreq: number;
  timeOfDay: Record<string, number>;
  avgRatings: Record<string, number>;
  dominantEmotions: Array<{ tag: string; frequency: number }>;
}

/* ─────────── Loading ─────────── */

function MoodLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <div className="text-center space-y-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl animate-pulse" />
          <Loader2 className="h-10 w-10 animate-spin text-purple-400 mx-auto relative" />
        </div>
        <p className="text-slate-500 text-sm font-medium">Loading mood data...</p>
      </div>
    </div>
  );
}

/* ─────────── Stat Card ─────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
  trend?: "up" | "down" | "stable";
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    purple: { bg: "bg-purple-500/[0.06]", border: "border-purple-500/10", text: "text-purple-400", iconBg: "bg-purple-500/10" },
    emerald: { bg: "bg-emerald-500/[0.06]", border: "border-emerald-500/10", text: "text-emerald-400", iconBg: "bg-emerald-500/10" },
    amber: { bg: "bg-amber-500/[0.06]", border: "border-amber-500/10", text: "text-amber-400", iconBg: "bg-amber-500/10" },
    rose: { bg: "bg-rose-500/[0.06]", border: "border-rose-500/10", text: "text-rose-400", iconBg: "bg-rose-500/10" },
    blue: { bg: "bg-blue-500/[0.06]", border: "border-blue-500/10", text: "text-blue-400", iconBg: "bg-blue-500/10" },
    cyan: { bg: "bg-cyan-500/[0.06]", border: "border-cyan-500/10", text: "text-cyan-400", iconBg: "bg-cyan-500/10" },
  };
  const c = colorMap[color] || colorMap.purple;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${c.border} ${c.bg} p-4 transition-colors hover:border-white/[0.08]`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-semibold ${
            trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-slate-500"
          }`}>
            <TrendIcon className="w-3 h-3" />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white leading-none mb-1">{value}</p>
      <p className="text-[11px] text-slate-500 font-medium">{label}</p>
      {subtitle && <p className="text-[10px] text-slate-600 mt-0.5">{subtitle}</p>}
    </motion.div>
  );
}

/* ─────────── Circular Progress ─────────── */

function CircularScore({
  value,
  max = 10,
  label,
  color,
  size = 80,
}: {
  value: number;
  max?: number;
  label: string;
  color: string;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={4}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{value.toFixed(1)}</span>
        </div>
      </div>
      <span className="text-[11px] text-slate-500 font-medium capitalize">{label}</span>
    </div>
  );
}

/* ─────────── Time of Day Bar ─────────── */

function TimeOfDayBar({
  period,
  value,
  maxValue,
  icon: Icon,
  color,
}: {
  period: string;
  value: number;
  maxValue: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const pct = maxValue > 0 ? (value / 10) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-slate-400 capitalize font-medium">{period}</span>
          <span className="text-[11px] text-white font-semibold">{value.toFixed(1)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────── Emotion Tag ─────────── */

function EmotionTag({ tag, frequency, maxFreq }: { tag: string; frequency: number; maxFreq: number }) {
  const pct = maxFreq > 0 ? (frequency / maxFreq) * 100 : 0;
  return (
    <div className="flex items-center gap-3 group">
      <span className="text-xs text-slate-300 capitalize w-20 truncate font-medium">{tag}</span>
      <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] text-slate-500 font-semibold w-8 text-right">{frequency}x</span>
    </div>
  );
}

/* ─────────── Section Header ─────────── */

function SectionHeader({
  icon: Icon,
  title,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {badge && (
        <span className="text-[10px] font-semibold text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────── */
/* ═══════════ MAIN CONTENT ═══════════ */
/* ─────────────────────────────────────── */

function MoodContent() {
  const [showMoodCheckIn, setShowMoodCheckIn] = useState(false);
  const [summary, setSummary] = useState<MoodSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const router = useRouter();

  const loadSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = subDays(new Date(), periodDays).toISOString().split("T")[0];

      const [timelineRes, patternsRes, logsRes] = await Promise.all([
        moodService.getTimeline(startDate, endDate),
        moodService.getPatterns(periodDays),
        moodService.getLogs({ startDate, endDate, limit: 100 }),
      ]);

      // Compute summary
      let avgMood: number | null = null;
      let totalLogs = 0;
      let trend: "up" | "down" | "stable" = "stable";
      let trendDelta = 0;

      if (timelineRes.success && timelineRes.data?.timeline) {
        const entries = timelineRes.data.timeline.filter(
          (t) => t.averageRating !== undefined && t.averageRating !== null
        );
        totalLogs = entries.length;
        if (entries.length > 0) {
          const sum = entries.reduce((a, b) => a + (b.averageRating || 0), 0);
          avgMood = sum / entries.length;

          // Trend: compare last 7 days vs previous 7 days
          const recent = entries.slice(-7);
          const previous = entries.slice(-14, -7);
          if (recent.length > 0 && previous.length > 0) {
            const recentAvg = recent.reduce((a, b) => a + (b.averageRating || 0), 0) / recent.length;
            const prevAvg = previous.reduce((a, b) => a + (b.averageRating || 0), 0) / previous.length;
            trendDelta = recentAvg - prevAvg;
            trend = trendDelta > 0.3 ? "up" : trendDelta < -0.3 ? "down" : "stable";
          }
        }
      }

      // Streak: consecutive days with logs
      let streak = 0;
      if (logsRes.success && logsRes.data?.logs) {
        const logDates = new Set(
          logsRes.data.logs.map((l) =>
            format(new Date(l.loggedAt), "yyyy-MM-dd")
          )
        );
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = format(subDays(today, i), "yyyy-MM-dd");
          if (logDates.has(d)) {
            streak++;
          } else {
            break;
          }
        }
      }

      // Patterns
      const patterns = patternsRes.success ? patternsRes.data?.patterns : null;
      const dominantEmotions = patterns?.dominantEmotions || [];
      const topEmo = dominantEmotions.length > 0 ? dominantEmotions[0] : null;

      setSummary({
        avgMood,
        totalLogs,
        streak,
        trend,
        trendDelta,
        topEmotion: topEmo?.tag || null,
        topEmotionFreq: topEmo?.frequency || 0,
        timeOfDay: patterns?.timeOfDay || {},
        avgRatings: patterns?.averageRatings || {},
        dominantEmotions,
      });
    } catch (err) {
      console.error("Failed to load mood summary:", err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [periodDays]);

  useEffect(() => {
    loadSummary();

    const handleMoodLogged = () => loadSummary();
    window.addEventListener("mood-logged", handleMoodLogged);
    return () => window.removeEventListener("mood-logged", handleMoodLogged);
  }, [loadSummary]);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const TIME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    morning: Zap,
    afternoon: Activity,
    evening: Heart,
    night: Shield,
  };
  const TIME_COLORS: Record<string, string> = {
    morning: "#f59e0b",
    afternoon: "#10b981",
    evening: "#8b5cf6",
    night: "#3b82f6",
  };

  const periodOptions = [
    { label: "7 days", value: 7 },
    { label: "14 days", value: 14 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
  ];

  return (
    <DashboardLayout activeTab="wellbeing">
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* ══════════ Top Bar ══════════ */}
        <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur-sm">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* Left */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/wellbeing")}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-white/[0.06]" />
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20">
                    <Smile className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-white leading-none">Mood Analytics</h1>
                    <p className="text-[10px] text-slate-500 mt-0.5">Emotional intelligence dashboard</p>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-2">
                {/* Period selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>{periodDays}d</span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </button>
                  <AnimatePresence>
                    {showPeriodMenu && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowPeriodMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute right-0 top-full mt-1 w-28 rounded-lg bg-[#1a1a24] border border-white/[0.08] shadow-xl z-40 py-1"
                        >
                          {periodOptions.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setPeriodDays(opt.value);
                                setShowPeriodMenu(false);
                              }}
                              className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${
                                periodDays === opt.value
                                  ? "text-purple-400 bg-purple-500/10"
                                  : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <Button
                  onClick={() => setShowMoodCheckIn(true)}
                  size="sm"
                  className="h-7 px-3 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-500/20"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Log Mood
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ Content ══════════ */}
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* ── Stat Cards Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              icon={BarChart3}
              label="Avg Mood"
              value={summary?.avgMood?.toFixed(1) || "--"}
              subtitle="out of 10"
              color="purple"
              trend={summary?.trend}
            />
            <StatCard
              icon={Activity}
              label="Total Logs"
              value={summary?.totalLogs?.toString() || "0"}
              subtitle={`in ${periodDays} days`}
              color="emerald"
            />
            <StatCard
              icon={Zap}
              label="Streak"
              value={summary?.streak ? `${summary.streak}d` : "0d"}
              subtitle="consecutive days"
              color="amber"
            />
            <StatCard
              icon={TrendingUp}
              label="Trend"
              value={
                summary?.trendDelta
                  ? `${summary.trendDelta > 0 ? "+" : ""}${summary.trendDelta.toFixed(1)}`
                  : "--"
              }
              subtitle="vs last week"
              color="blue"
              trend={summary?.trend}
            />
            <StatCard
              icon={Brain}
              label="Top Emotion"
              value={summary?.topEmotion ? summary.topEmotion.charAt(0).toUpperCase() + summary.topEmotion.slice(1) : "--"}
              subtitle={summary?.topEmotionFreq ? `${summary.topEmotionFreq}x logged` : undefined}
              color="rose"
            />
            <StatCard
              icon={Sparkles}
              label="Check-ins"
              value={summary?.totalLogs ? Math.round(summary.totalLogs / Math.max(periodDays / 7, 1)).toString() : "0"}
              subtitle="per week avg"
              color="cyan"
            />
          </div>

          {/* ── Behavioral Pattern Badges ── */}
          <BehavioralPatternBadges />

          {/* ── Main Grid: 2 columns on desktop ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Timeline (2/3 width) */}
            <div className="lg:col-span-2 space-y-5">
              {/* Mood Timeline Chart */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] overflow-hidden">
                <div className="px-5 pt-5 pb-0">
                  <SectionHeader icon={Activity} title="Mood Timeline" badge={`${periodDays} days`} />
                </div>
                <div className="px-2 pb-4">
                  <MoodTimeline days={periodDays} />
                </div>
              </div>

              {/* Today's Mood Arc */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                <SectionHeader icon={Clock} title="Today's Mood Arc" badge={format(new Date(), "MMM d")} />
                <MoodArcTimeline date={todayStr} />
              </div>
            </div>

            {/* Right: Analytics Sidebar (1/3 width) */}
            <div className="space-y-5">
              {/* Deep Mode Ratings */}
              {summary && Object.keys(summary.avgRatings).length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={Heart} title="Wellness Metrics" />
                  <div className="grid grid-cols-2 gap-4 place-items-center">
                    {Object.entries(summary.avgRatings).map(([metric, value]) => {
                      const metricColors: Record<string, string> = {
                        happiness: "#10b981",
                        energy: "#f59e0b",
                        stress: "#ef4444",
                        anxiety: "#8b5cf6",
                      };
                      return (
                        <CircularScore
                          key={metric}
                          value={typeof value === "number" ? value : 0}
                          label={metric}
                          color={metricColors[metric] || "#10b981"}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Time of Day */}
              {summary && Object.keys(summary.timeOfDay).length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={Clock} title="By Time of Day" />
                  <div className="space-y-3">
                    {Object.entries(summary.timeOfDay).map(([period, value]) => (
                      <TimeOfDayBar
                        key={period}
                        period={period}
                        value={typeof value === "number" ? value : 0}
                        maxValue={10}
                        icon={TIME_ICONS[period] || Clock}
                        color={TIME_COLORS[period] || "#10b981"}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Dominant Emotions */}
              {summary && summary.dominantEmotions.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5">
                  <SectionHeader icon={Brain} title="Top Emotions" badge={`${summary.dominantEmotions.length}`} />
                  <div className="space-y-2.5">
                    {summary.dominantEmotions.slice(0, 6).map((item) => (
                      <EmotionTag
                        key={item.tag}
                        tag={item.tag}
                        frequency={item.frequency}
                        maxFreq={summary.dominantEmotions[0]?.frequency || 1}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for sidebar when no pattern data */}
              {isLoadingSummary && (
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                </div>
              )}
              {!isLoadingSummary && summary && Object.keys(summary.avgRatings).length === 0 && Object.keys(summary.timeOfDay).length === 0 && summary.dominantEmotions.length === 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-5 h-5 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">No patterns yet</p>
                  <p className="text-xs text-slate-600 mt-1">Log more moods to see insights</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════ Mood Check-In Modal ══════════ */}
        <MoodCheckIn
          open={showMoodCheckIn}
          onOpenChange={setShowMoodCheckIn}
          initialMode="light"
        />
      </div>
    </DashboardLayout>
  );
}

export default function MoodPageContent() {
  return (
    <Suspense fallback={<MoodLoading />}>
      <MoodContent />
    </Suspense>
  );
}
