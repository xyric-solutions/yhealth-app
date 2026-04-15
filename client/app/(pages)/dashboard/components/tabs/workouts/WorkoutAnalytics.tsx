"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Award,
  Clock,
  Loader2,
  Dumbbell,
  BarChart3,
  LineChart as LineChartIcon,
  BarChart2,
  Layers,
  Zap,
  Flame,
  Sparkles,
} from "lucide-react";
import { workoutsService, type WorkoutLog } from "@/src/shared/services";
import { workoutLogger } from "./logger";
import type { WorkoutPlan } from "./types";

interface DailyProgressData {
  date: string;
  completionRate: number;
  completed: number;
  total: number;
  status: 'completed' | 'partial' | 'pending' | 'rest';
}

interface WeeklyProgressData {
  week: string;
  completionRate: number;
  completed: number;
  total: number;
}

interface WorkoutAnalyticsData {
  dailyProgress: DailyProgressData[];
  weeklyProgress: WeeklyProgressData[];
  performanceMetrics: {
    averageCompletionRate: number;
    totalWorkouts: number;
    currentStreak: number;
    totalDuration: number;
  };
}

type ChartMode = 'line' | 'bar' | 'area';
type TimeRange = '7d' | '30d' | '90d' | '1y';

const RANGE_DAYS: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
const RANGE_LABEL: Record<TimeRange, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days', '1y': '1 year' };

interface WorkoutAnalyticsProps {
  selectedWorkoutId?: string;
  workouts?: WorkoutPlan[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function WorkoutAnalytics({ selectedWorkoutId, workouts = [] }: WorkoutAnalyticsProps) {
  const [data, setData] = useState<WorkoutAnalyticsData | null>(null);
  const [prevData, setPrevData] = useState<WorkoutAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [dailyChartMode, setDailyChartMode] = useState<ChartMode>('area');
  const [weeklyChartMode, setWeeklyChartMode] = useState<ChartMode>('area');
  const [error, setError] = useState<string | null>(null);

  const selectedWorkout = workouts.find(w => w.id === selectedWorkoutId);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!selectedWorkout) {
        setError('No workout plan selected');
        setIsLoading(false);
        return;
      }

      const days = RANGE_DAYS[timeRange];

      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevEndDate.setHours(23, 59, 59, 999);
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevEndDate.getDate() - days);
      prevStartDate.setHours(0, 0, 0, 0);

      const formatDate = (date: Date): string =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      const [currentResp, prevResp] = await Promise.all([
        workoutsService.getLogsByDateRange(formatDate(startDate), formatDate(endDate), selectedWorkoutId),
        workoutsService.getLogsByDateRange(formatDate(prevStartDate), formatDate(prevEndDate), selectedWorkoutId),
      ]);

      const mapLogs = (logs: WorkoutLog[] = []): WorkoutLog[] =>
        logs.map((log: WorkoutLog) => ({ ...log, date: log.scheduledDate }));

      const currentLogs = mapLogs(currentResp.data?.logs || []);
      const prevLogs = mapLogs(prevResp.data?.logs || []);

      setData(processWorkoutData(currentLogs, selectedWorkout, startDate, endDate));
      setPrevData(processWorkoutData(prevLogs, selectedWorkout, prevStartDate, prevEndDate));
    } catch (err: unknown) {
      workoutLogger.error('Failed to fetch workout analytics', err, { component: 'WorkoutAnalytics' });
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, selectedWorkoutId, selectedWorkout]);

  useEffect(() => {
    if (selectedWorkoutId && selectedWorkout) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, selectedWorkoutId, selectedWorkout]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'No data available'}</p>
          {selectedWorkoutId && (
            <button
              onClick={fetchAnalytics}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const delta = data.performanceMetrics.averageCompletionRate - (prevData?.performanceMetrics.averageCompletionRate ?? 0);
  const tier = getTier(data.performanceMetrics.averageCompletionRate);
  const insight = buildInsight(data, prevData, delta, timeRange);
  const bestDay = findBestDay(data.dailyProgress);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/30 to-amber-500/20 border border-orange-500/20">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-orange-300" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Workout Analytics</h2>
            <p className="text-xs sm:text-sm text-slate-400">Performance insights & progress intelligence</p>
          </div>
        </div>
        <div className="flex gap-1 w-full sm:w-auto bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {(['7d', '30d', '90d', '1y'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                timeRange === range
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* HERO KPI */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-5 sm:p-8"
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 w-80 h-80 rounded-full bg-amber-500/5 blur-3xl" />

        <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 md:gap-10 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${tier.chip}`}>
                <Sparkles className="w-3 h-3" />
                {tier.label}
              </span>
              <DeltaPill delta={delta} rangeLabel={RANGE_LABEL[timeRange]} />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl sm:text-6xl font-bold tracking-tight text-white">
                  {data.performanceMetrics.averageCompletionRate}
                </span>
                <span className="text-2xl sm:text-3xl font-semibold text-slate-400">/100</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">Performance Score · last {RANGE_LABEL[timeRange]}</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="mt-0.5 p-1.5 rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20">
                <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-violet-300/80 font-semibold">Coach Insight</p>
                <p className="text-sm text-slate-200 leading-relaxed">{insight}</p>
              </div>
            </div>
          </div>

          <HeroDonut percentage={data.performanceMetrics.averageCompletionRate} />
        </div>
      </motion.div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          index={0}
          icon={<Dumbbell className="w-4 h-4" />}
          label="Total Workouts"
          value={String(data.performanceMetrics.totalWorkouts)}
          sparkline={data.dailyProgress.map(d => d.completed)}
          accent="sky"
        />
        <StatCard
          index={1}
          icon={<Flame className="w-4 h-4" />}
          label="Current Streak"
          value={`${data.performanceMetrics.currentStreak}d`}
          sparkline={data.dailyProgress.map(d => (d.completionRate >= 50 ? 1 : 0))}
          accent="violet"
        />
        <StatCard
          index={2}
          icon={<Clock className="w-4 h-4" />}
          label="Total Duration"
          value={formatDuration(data.performanceMetrics.totalDuration)}
          sparkline={data.dailyProgress.map(d => d.completed * 5)}
          accent="emerald"
        />
        <StatCard
          index={3}
          icon={<Award className="w-4 h-4" />}
          label="Best Day"
          value={bestDay.label}
          hint={bestDay.hint}
          sparkline={data.dailyProgress.map(d => d.completionRate)}
          accent="amber"
        />
      </div>

      {/* Streak heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-5 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
              <Activity className="w-4 h-4 text-emerald-300" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-white">Consistency Heatmap</h3>
          </div>
          <HeatmapLegend />
        </div>
        <StreakHeatmap days={data.dailyProgress} />
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <ChartFrame
          title="Daily Progress"
          icon={<Calendar className="w-4 h-4 text-sky-300" />}
          mode={dailyChartMode}
          setMode={setDailyChartMode}
          delay={0.1}
        >
          <ResponsiveContainer width="100%" height={220} className="sm:!h-[300px]">
            {renderChart(data.dailyProgress, dailyChartMode, 'completionRate', '#38bdf8')}
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="Weekly Progress"
          icon={<TrendingUp className="w-4 h-4 text-orange-300" />}
          mode={weeklyChartMode}
          setMode={setWeeklyChartMode}
          delay={0.15}
        >
          <ResponsiveContainer width="100%" height={220} className="sm:!h-[300px]">
            {renderChart(data.weeklyProgress, weeklyChartMode, 'completionRate', '#fb923c')}
          </ResponsiveContainer>
        </ChartFrame>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function HeroDonut({ percentage }: { percentage: number }) {
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.max(0, Math.min(100, percentage)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="heroDonutGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="url(#heroDonutGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{percentage}%</span>
        <span className="text-[11px] uppercase tracking-wider text-slate-400 mt-0.5">Completion</span>
      </div>
    </div>
  );
}

function DeltaPill({ delta, rangeLabel }: { delta: number; rangeLabel: string }) {
  const rounded = Math.round(delta);
  const positive = rounded >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const chip = positive
    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    : 'bg-rose-500/10 text-rose-300 border-rose-500/20';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border ${chip}`}>
      <Icon className="w-3 h-3" />
      {positive ? '+' : ''}{rounded}% vs last {rangeLabel}
    </span>
  );
}

type StatAccent = 'sky' | 'violet' | 'emerald' | 'amber';
const ACCENT: Record<StatAccent, { icon: string; spark: string }> = {
  sky: { icon: 'bg-sky-500/15 text-sky-300 border-sky-500/20', spark: '#38bdf8' },
  violet: { icon: 'bg-violet-500/15 text-violet-300 border-violet-500/20', spark: '#a78bfa' },
  emerald: { icon: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', spark: '#34d399' },
  amber: { icon: 'bg-amber-500/15 text-amber-300 border-amber-500/20', spark: '#fbbf24' },
};

function StatCard({
  index,
  icon,
  label,
  value,
  hint,
  sparkline,
  accent,
}: {
  index: number;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  sparkline: number[];
  accent: StatAccent;
}) {
  const style = ACCENT[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-4 sm:p-5 hover:border-white/[0.12] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${style.icon}`}>
          {icon}
        </div>
        <Sparkline values={sparkline} color={style.spark} />
      </div>
      <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">{label}</p>
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </motion.div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const pts = useMemo(() => {
    if (!values.length) return '';
    const w = 64;
    const h = 24;
    const max = Math.max(1, ...values);
    const step = values.length > 1 ? w / (values.length - 1) : w;
    return values
      .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
      .join(' ');
  }, [values]);
  if (!pts) return null;
  return (
    <svg width={64} height={24} className="overflow-visible opacity-80">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeatmapLegend() {
  const steps = [
    { c: 'bg-white/[0.04]', label: '0' },
    { c: 'bg-emerald-500/25', label: '25' },
    { c: 'bg-emerald-500/45', label: '50' },
    { c: 'bg-emerald-500/65', label: '75' },
    { c: 'bg-emerald-500/90', label: '100' },
  ];
  return (
    <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500">
      <span>Less</span>
      <div className="flex gap-1">
        {steps.map(s => (
          <div key={s.label} className={`w-3 h-3 rounded-sm border border-white/[0.05] ${s.c}`} />
        ))}
      </div>
      <span>More</span>
    </div>
  );
}

function StreakHeatmap({ days }: { days: DailyProgressData[] }) {
  // Group into week columns (Sun→Sat)
  const weeks = useMemo(() => {
    const cols: (DailyProgressData | null)[][] = [];
    if (!days.length) return cols;
    const first = new Date(days[0].date + 'T00:00:00');
    const offset = first.getDay(); // 0 = Sunday
    let current: (DailyProgressData | null)[] = Array(offset).fill(null);
    for (const d of days) {
      current.push(d);
      if (current.length === 7) {
        cols.push(current);
        current = [];
      }
    }
    if (current.length) {
      while (current.length < 7) current.push(null);
      cols.push(current);
    }
    return cols;
  }, [days]);

  const bucket = (rate: number, total: number): string => {
    if (total === 0) return 'bg-white/[0.03] border-white/[0.04]';
    if (rate === 0) return 'bg-rose-500/10 border-rose-500/15';
    if (rate < 25) return 'bg-emerald-500/20 border-emerald-500/20';
    if (rate < 50) return 'bg-emerald-500/40 border-emerald-500/25';
    if (rate < 75) return 'bg-emerald-500/60 border-emerald-500/30';
    if (rate < 100) return 'bg-emerald-500/80 border-emerald-400/30';
    return 'bg-emerald-400 border-emerald-300/40 shadow-[0_0_10px_rgba(52,211,153,0.35)]';
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <div className="flex flex-col gap-1 pt-0.5 shrink-0">
        {dayLabels.map((d, i) => (
          <span key={d} className={`text-[10px] text-slate-500 h-3.5 leading-3.5 ${i % 2 === 0 ? '' : 'opacity-0'}`}>
            {d}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div
                key={di}
                title={
                  day
                    ? `${day.date} · ${day.completed}/${day.total} (${day.completionRate}%)`
                    : ''
                }
                className={`w-3.5 h-3.5 rounded-[3px] border ${day ? bucket(day.completionRate, day.total) : 'bg-transparent border-transparent'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartFrame({
  title,
  icon,
  mode,
  setMode,
  delay,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  mode: ChartMode;
  setMode: (m: ChartMode) => void;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-4 sm:p-6"
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            {icon}
          </span>
          {title}
        </h3>
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
          {(['line', 'bar', 'area'] as ChartMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`p-1.5 rounded transition-all ${
                mode === m
                  ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
              title={m.charAt(0).toUpperCase() + m.slice(1)}
            >
              {m === 'line' && <LineChartIcon className="w-3.5 h-3.5" />}
              {m === 'bar' && <BarChart2 className="w-3.5 h-3.5" />}
              {m === 'area' && <Layers className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getTier(score: number): { label: string; chip: string } {
  if (score >= 90) return { label: 'Elite', chip: 'bg-violet-500/15 text-violet-200 border border-violet-500/30' };
  if (score >= 75) return { label: 'Strong', chip: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30' };
  if (score >= 50) return { label: 'Building', chip: 'bg-amber-500/15 text-amber-200 border border-amber-500/30' };
  if (score > 0) return { label: 'Momentum', chip: 'bg-orange-500/15 text-orange-200 border border-orange-500/30' };
  return { label: 'Restart', chip: 'bg-rose-500/15 text-rose-200 border border-rose-500/30' };
}

function buildInsight(
  data: WorkoutAnalyticsData,
  prev: WorkoutAnalyticsData | null,
  delta: number,
  timeRange: TimeRange,
): string {
  const streak = data.performanceMetrics.currentStreak;
  const rate = data.performanceMetrics.averageCompletionRate;
  const total = data.performanceMetrics.totalWorkouts;
  const rangeLabel = RANGE_LABEL[timeRange];

  if (streak >= 7) {
    return `${streak}-day streak — your strongest stretch this period. Keep it alive with tomorrow's session.`;
  }
  if (prev && delta > 10) {
    return `You're ${Math.round(delta)}% above your previous ${rangeLabel}. Momentum is compounding — stay on cadence.`;
  }
  if (prev && delta < -10) {
    return `Completion dropped ${Math.abs(Math.round(delta))}% vs last ${rangeLabel}. Your Coach will rebalance upcoming sessions automatically.`;
  }
  if (total === 0) {
    return `No sessions logged in the last ${rangeLabel}. Start today — even a short workout restarts your streak.`;
  }
  return `Steady progress — ${rate}% average completion across ${total} sessions in the last ${rangeLabel}.`;
}

function findBestDay(days: DailyProgressData[]): { label: string; hint: string } {
  const active = days.filter(d => d.total > 0);
  if (!active.length) return { label: '—', hint: 'No sessions yet' };
  const best = active.reduce((a, b) => (b.completionRate > a.completionRate ? b : a));
  const d = new Date(best.date + 'T00:00:00');
  const label = d.toLocaleDateString('en-US', { weekday: 'short' });
  const hint = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${best.completionRate}%`;
  return { label, hint };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Chart renderer (single source of truth)
function renderChart(
  chartData: DailyProgressData[] | WeeklyProgressData[],
  mode: ChartMode,
  dataKey: string,
  color: string,
) {
  const isDaily = chartData.length > 0 && 'date' in chartData[0];
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getDate()}`;
  };
  const commonProps = {
    data: chartData,
    margin: { top: 5, right: 10, left: 0, bottom: 5 },
  };
  const axisProps = {
    stroke: '#64748b',
    tick: { fill: '#94a3b8', fontSize: 11 },
  };
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'rgba(15,18,25,0.95)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      backdropFilter: 'blur(8px)',
    },
    labelStyle: { color: '#fff', fontWeight: 600 },
    formatter: (value: number | undefined, _name: string | undefined, props: { payload?: DailyProgressData | WeeklyProgressData }) => {
      const val = value ?? 0;
      if (isDaily && props.payload && 'completed' in props.payload && 'total' in props.payload) {
        return [`${val}%`, `${props.payload.completed}/${props.payload.total} exercises`];
      }
      return [`${val}%`, 'Completion'];
    },
    labelFormatter: isDaily ? (label: string) => formatDateForDisplay(label) : undefined,
  };

  switch (mode) {
    case 'line':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey={isDaily ? 'date' : 'week'} {...axisProps} tickFormatter={isDaily ? formatDateForDisplay : undefined} />
          <YAxis domain={[0, 100]} {...axisProps} width={35} />
          <Tooltip {...tooltipStyle} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={{ fill: color, r: 3 }} activeDot={{ r: 6 }} />
        </LineChart>
      );
    case 'bar':
      return (
        <BarChart {...commonProps}>
          <defs>
            <linearGradient id={`barGrad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey={isDaily ? 'date' : 'week'} {...axisProps} tickFormatter={isDaily ? formatDateForDisplay : undefined} />
          <YAxis domain={[0, 100]} {...axisProps} width={35} />
          <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey={dataKey} fill={`url(#barGrad-${dataKey})`} radius={[6, 6, 0, 0]} />
        </BarChart>
      );
    case 'area':
      return (
        <AreaChart {...commonProps}>
          <defs>
            <linearGradient id={`areaGrad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey={isDaily ? 'date' : 'week'} {...axisProps} tickFormatter={isDaily ? formatDateForDisplay : undefined} />
          <YAxis domain={[0, 100]} {...axisProps} width={35} />
          <Tooltip {...tooltipStyle} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#areaGrad-${dataKey})`} />
        </AreaChart>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Data processing (unchanged — kept intact from prior implementation)
// ─────────────────────────────────────────────────────────────────────────────

function processWorkoutData(
  logs: WorkoutLog[],
  workoutPlan: WorkoutPlan,
  startDate: Date,
  endDate: Date
): WorkoutAnalyticsData {
  const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getDayName = (date: Date): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  const getScheduledExercisesForDate = (date: Date): number => {
    const dayName = getDayName(date);
    if (!workoutPlan.startDate) return 0;

    const planStart = new Date(workoutPlan.startDate);
    planStart.setHours(0, 0, 0, 0);

    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((normalizedDate.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
    const rawWeekNumber = Math.floor(daysDiff / 7) + 1;
    const durationWeeks = workoutPlan.durationWeeks || 999;
    const weekNumber = Math.min(Math.max(1, rawWeekNumber), durationWeeks);

    if (workoutPlan.weeks) {
      const weekKey = `week_${weekNumber}`;
      const weekPlan = workoutPlan.weeks[weekKey];
      if (weekPlan?.days?.[dayName]) {
        return weekPlan.days[dayName]?.exercises?.length || 0;
      }
    }

    if (workoutPlan.weeklySchedule?.[dayName]) {
      return workoutPlan.weeklySchedule[dayName]?.exercises?.length || 0;
    }

    return 0;
  };

  const logsByDate: Record<string, WorkoutLog[]> = {};
  logs.forEach(log => {
    const date = (log as WorkoutLog & { date?: string }).date || log.scheduledDate;
    if (date) {
      let dateStr: string;
      if (typeof date === 'string') {
        dateStr = date.split('T')[0];
      } else {
        const d = new Date(date);
        dateStr = formatDate(d);
      }
      if (!logsByDate[dateStr]) logsByDate[dateStr] = [];
      logsByDate[dateStr].push(log);
    }
  });

  const dailyProgress: DailyProgressData[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    const dayLogs = logsByDate[dateStr] || [];
    const totalExercises = getScheduledExercisesForDate(currentDate);

    let completedExercises = 0;
    dayLogs.forEach((log: WorkoutLog) => {
      if (log.exercisesCompleted && Array.isArray(log.exercisesCompleted)) {
        completedExercises += log.exercisesCompleted.length;
      }
    });

    let completionRate = 0;
    let status: 'completed' | 'partial' | 'pending' | 'rest' = 'rest';

    if (totalExercises > 0) {
      completionRate = Math.round((completedExercises / totalExercises) * 100);
      if (completionRate === 100) status = 'completed';
      else if (completionRate > 0) status = 'partial';
      else status = 'pending';
    } else if (dayLogs.length > 0) {
      const hasCompleted = dayLogs.some(l => l.status === 'completed');
      const hasPartial = dayLogs.some(l => l.status === 'partial');
      if (hasCompleted) { completionRate = 100; status = 'completed'; }
      else if (hasPartial || completedExercises > 0) { completionRate = 50; status = 'partial'; }
    }

    dailyProgress.push({
      date: dateStr,
      completionRate,
      completed: completedExercises,
      total: totalExercises,
      status,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const weeklyProgress: WeeklyProgressData[] = [];
  const weekStart = new Date(startDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  while (weekStart <= endDate) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekDays: DailyProgressData[] = [];
    const checkDate = new Date(weekStart);
    while (checkDate <= weekEnd && checkDate <= endDate) {
      const dateStr = formatDate(checkDate);
      const dayData = dailyProgress.find(d => d.date === dateStr);
      if (dayData) weekDays.push(dayData);
      checkDate.setDate(checkDate.getDate() + 1);
    }

    const totalCompleted = weekDays.reduce((sum, day) => sum + day.completed, 0);
    const totalScheduled = weekDays.reduce((sum, day) => sum + day.total, 0);
    const avgCompletionRate = weekDays.length > 0 && totalScheduled > 0
      ? Math.round((totalCompleted / totalScheduled) * 100)
      : 0;

    weeklyProgress.push({
      week: `Week ${weeklyProgress.length + 1}`,
      completionRate: avgCompletionRate,
      completed: totalCompleted,
      total: totalScheduled,
    });

    weekStart.setDate(weekStart.getDate() + 7);
  }

  const totalWorkouts = logs.length;
  const allCompleted = dailyProgress.reduce((sum, day) => sum + day.completed, 0);
  const allScheduled = dailyProgress.reduce((sum, day) => sum + day.total, 0);
  const averageCompletionRate = allScheduled > 0 ? Math.round((allCompleted / allScheduled) * 100) : 0;
  const totalDuration = logs.reduce((sum: number, log: WorkoutLog) => sum + (log.durationMinutes || 0), 0);

  let currentStreak = 0;
  for (let i = dailyProgress.length - 1; i >= 0; i--) {
    const day = dailyProgress[i];
    if (day.status === 'completed' || (day.status === 'partial' && day.completionRate >= 50)) {
      currentStreak++;
    } else if (day.total > 0) {
      break;
    }
  }

  return {
    dailyProgress,
    weeklyProgress,
    performanceMetrics: {
      averageCompletionRate,
      totalWorkouts,
      currentStreak,
      totalDuration,
    },
  };
}
