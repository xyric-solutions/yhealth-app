'use client';

import { useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  TrendingUp,
  Flame,
  Droplets,
  ChevronRight,
  Plus,
  Sparkles,
  Trophy,
  Target,
} from 'lucide-react';
import { OrbitGraph } from './OrbitGraph';
import type { OrbitNodeData, OrbitEdgeData } from './orbit-types';
import type { EnhancedHealthMetrics } from '../widgets/UnifiedHealthDashboard';
import type { Plan, TodayData, WeeklySummary } from '../types';

// ─────────────────────────────────────────────────────────────
// Props — this component replaces the entire dashboard tab
// ─────────────────────────────────────────────────────────────

interface WellnessOrbitDashboardProps {
  healthMetrics: EnhancedHealthMetrics | null;
  stats: {
    currentStreak: number;
    weekCompletionRate: number;
    completedToday: number;
    totalToday: number;
    weekChange: number;
  } | null;
  plan: Plan | null;
  todayData: TodayData | null;
  weeklySummary: WeeklySummary | null;
  isLoading?: boolean;
  onActivityComplete: (activityId: string) => void;
  onAddWater: () => void;
  onRefresh?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Futuristic glass card wrapper
// ─────────────────────────────────────────────────────────────

function GlassCard({
  children,
  className = '',
  glowColor,
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.005 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`relative rounded-2xl border border-white/[0.08] overflow-hidden ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* top-left ambient glow */}
      {glowColor && (
        <div
          className="absolute top-0 left-0 w-2/3 h-2/3 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 15% 15%, ${glowColor}12 0%, transparent 70%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat Pill (compact metric display)
// ─────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  change,
  color,
}: {
  icon: React.ComponentType<{ className?: string; color?: string }>;
  label: string;
  value: string | number;
  change?: number;
  color: string;
}) {
  return (
    <GlassCard glowColor={color} className="p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18` }}
        >
          <Icon className="w-5 h-5" color={color} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-white/50 uppercase tracking-wider font-medium truncate">{label}</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-bold text-white">{value}</p>
            {change !== undefined && change !== 0 && (
              <span className={`text-xs font-medium ${change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {change > 0 ? '↑' : '↓'} {Math.abs(change)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Today's Schedule (compact futuristic list)
// ─────────────────────────────────────────────────────────────

function OrbitSchedule({
  todayData,
  onActivityComplete,
}: {
  todayData: TodayData | null;
  onActivityComplete: (id: string) => void;
}) {
  const activities = todayData?.activities || [];
  const completed = activities.filter((a) => a.status === 'completed').length;

  return (
    <GlassCard glowColor="#10b981" className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Today&apos;s Schedule</h3>
            <p className="text-[11px] text-white/40">{completed}/{activities.length} completed</p>
          </div>
        </div>
        {/* progress ring */}
        <div className="relative w-10 h-10">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle
              cx="20" cy="20" r="16" fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(completed / Math.max(activities.length, 1)) * 100.5} 100.5`}
              style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.5))' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
            {activities.length > 0 ? Math.round((completed / activities.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* activity list */}
      <div className="space-y-1.5 max-h-[240px] overflow-y-auto scrollbar-hide">
        {activities.length === 0 && (
          <p className="text-sm text-white/30 text-center py-6">No activities scheduled</p>
        )}
        {activities.slice(0, 6).map((activity) => {
          const isDone = activity.status === 'completed';
          return (
            <motion.button
              key={activity.id}
              onClick={() => !isDone && onActivityComplete(activity.id)}
              disabled={isDone}
              whileHover={isDone ? {} : { x: 4 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                isDone
                  ? 'bg-emerald-500/8 border border-emerald-500/15'
                  : 'bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1]'
              }`}
            >
              {/* status dot */}
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isDone ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-white/20'
                }`}
              />
              <span className={`text-sm flex-1 truncate ${isDone ? 'text-white/50 line-through' : 'text-white/80'}`}>
                {activity.title}
              </span>
              {activity.preferredTime && (
                <span className="text-[10px] text-white/30 shrink-0">{activity.preferredTime}</span>
              )}
              {!isDone && <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />}
            </motion.button>
          );
        })}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Quick Actions Bar
// ─────────────────────────────────────────────────────────────

function QuickActions({ onAddWater }: { onAddWater: () => void }) {
  const actions = [
    { label: 'Water', icon: Droplets, color: '#3b82f6', onClick: onAddWater },
    { label: 'Quick Log', icon: Plus, color: '#10b981', onClick: () => {} },
  ];

  return (
    <div className="flex gap-2">
      {actions.map((a) => (
        <motion.button
          key={a.label}
          onClick={a.onClick}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm font-medium text-white/70 hover:text-white transition-colors"
          style={{
            background: `linear-gradient(135deg, ${a.color}10 0%, transparent 100%)`,
          }}
        >
          <a.icon className="w-4 h-4" color={a.color} />
          {a.label}
        </motion.button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Gamification Strip (XP + Streak + Level compact)
// ─────────────────────────────────────────────────────────────

function GamificationStrip({ streak }: { streak: number }) {
  const tierName =
    streak >= 90 ? 'Supernova' :
    streak >= 60 ? 'Wildfire' :
    streak >= 30 ? 'Inferno' :
    streak >= 14 ? 'Blaze' :
    streak >= 7 ? 'Flame' :
    streak >= 3 ? 'Spark' : '';

  return (
    <GlassCard glowColor="#f97316" className="p-4">
      <div className="flex items-center gap-4">
        {/* streak fire */}
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-12 h-12 rounded-2xl bg-orange-500/15 flex items-center justify-center"
          >
            <Flame className="w-6 h-6 text-orange-400" />
          </motion.div>
          {streak > 0 && (
            <div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[9px] font-bold text-white"
              style={{ boxShadow: '0 0 8px rgba(249,115,22,0.6)' }}
            >
              {streak}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">
              {streak > 0 ? `${streak}-Day Streak` : 'Start Streak'}
            </p>
            {tierName && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 font-medium">
                {tierName}
              </span>
            )}
          </div>
          {/* progress to next tier */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((streak / 30) * 100, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                style={{ boxShadow: '0 0 8px rgba(249,115,22,0.4)' }}
              />
            </div>
            <span className="text-[10px] text-white/30 shrink-0">
              {streak < 30 ? `${30 - streak}d to Inferno` : 'Max tier!'}
            </span>
          </div>
        </div>

        <Trophy className="w-5 h-5 text-amber-400/40 shrink-0" />
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Weekly Summary Strip
// ─────────────────────────────────────────────────────────────

function WeeklySummaryStrip({ summary }: { summary: WeeklySummary | null }) {
  if (!summary) return null;

  return (
    <GlassCard glowColor="#8b5cf6" className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
          <Target className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Weekly Focus</p>
          <p className="text-[11px] text-white/40 truncate">
            {summary.focus?.focus || 'Stay consistent with your plan'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-violet-300">
            {summary.stats?.completionRate != null ? `${Math.round(summary.stats.completionRate)}%` : '--'}
          </p>
          <p className="text-[10px] text-white/30">completion</p>
        </div>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Orchestrator
// ─────────────────────────────────────────────────────────────

export function WellnessOrbitDashboard({
  healthMetrics,
  stats,
  plan,
  todayData,
  weeklySummary,
  isLoading,
  onActivityComplete,
  onAddWater,
}: WellnessOrbitDashboardProps) {
  const router = useRouter();

  // ── build orbit nodes from real data ──
  const nodes = useMemo<OrbitNodeData[]>(() => {
    const hm = healthMetrics;
    const st = stats;
    const todayPct = st && st.totalToday > 0 ? st.completedToday / st.totalToday : 0;

    return [
      {
        id: 'fitness',
        label: 'Fitness',
        icon: 'dumbbell',
        value: st ? `${st.completedToday}/${st.totalToday}` : '--',
        subtitle: 'Today\'s workouts',
        color: '#10b981',
        colorEnd: '#059669',
        progress: todayPct,
        href: '/dashboard?tab=workouts',
      },
      {
        id: 'nutrition',
        label: 'Nutrition',
        icon: 'salad',
        value: hm?.calories?.consumed ?? '--',
        unit: 'kcal',
        subtitle: `of ${hm?.calories?.target ?? 2200}`,
        color: '#f59e0b',
        colorEnd: '#d97706',
        progress: hm ? Math.min((hm.calories.consumed || 0) / (hm.calories.target || 2200), 1) : 0,
        href: '/dashboard?tab=nutrition',
      },
      {
        id: 'mindfulness',
        label: 'Mindfulness',
        icon: 'brain',
        value: st?.currentStreak ?? 0,
        unit: 'day',
        subtitle: 'Streak',
        color: '#8b5cf6',
        colorEnd: '#7c3aed',
        progress: Math.min((st?.currentStreak ?? 0) / 30, 1),
        href: '/dashboard?tab=wellbeing',
      },
      {
        id: 'heart',
        label: 'Heart Rate',
        icon: 'heart',
        value: hm?.heartRate?.current ?? '--',
        unit: 'bpm',
        subtitle: hm?.heartRate?.resting ? `Resting: ${hm.heartRate.resting}` : undefined,
        color: '#ef4444',
        colorEnd: '#dc2626',
        progress: hm?.heartRate?.current ? Math.min(hm.heartRate.current / 180, 1) : 0,
        href: '/whoop',
      },
      {
        id: 'steps',
        label: 'Steps',
        icon: 'footprints',
        value: hm?.steps?.value != null ? hm.steps.value.toLocaleString() : '--',
        subtitle: `Goal: ${(hm?.steps?.target ?? 10000).toLocaleString()}`,
        color: '#06b6d4',
        colorEnd: '#0891b2',
        progress: hm?.steps?.value ? Math.min(hm.steps.value / (hm.steps.target || 10000), 1) : 0,
        href: '/whoop',
      },
      {
        id: 'water',
        label: 'Hydration',
        icon: 'droplets',
        value: `${hm?.water?.consumed ?? 0}/${hm?.water?.target ?? 8}`,
        unit: 'glasses',
        color: '#3b82f6',
        colorEnd: '#2563eb',
        progress: hm ? Math.min((hm.water.consumed || 0) / (hm.water.target || 8), 1) : 0,
      },
      {
        id: 'sleep',
        label: 'Sleep',
        icon: 'moon',
        value: '--',
        unit: 'hrs',
        subtitle: 'Last night',
        color: '#6366f1',
        colorEnd: '#4f46e5',
        progress: 0,
        href: '/whoop',
      },
      {
        id: 'streak',
        label: 'Streak',
        icon: 'flame',
        value: stats?.currentStreak ?? 0,
        unit: 'days',
        subtitle: stats?.currentStreak && stats.currentStreak >= 7 ? 'On fire!' : 'Keep going',
        color: '#f97316',
        colorEnd: '#ea580c',
        progress: Math.min((stats?.currentStreak ?? 0) / 30, 1),
      },
    ];
  }, [healthMetrics, stats]);

  // ── cross-pillar edges ──
  const edges = useMemo<OrbitEdgeData[]>(
    () => [
      { from: 'fitness', to: 'nutrition', label: 'Fuel', strength: 0.7 },
      { from: 'fitness', to: 'heart', label: 'Cardio', strength: 0.6 },
      { from: 'sleep', to: 'mindfulness', label: 'Recovery', strength: 0.5 },
      { from: 'water', to: 'nutrition', label: 'Hydrate', strength: 0.4 },
      { from: 'streak', to: 'fitness', label: 'Consistency', strength: 0.6 },
      { from: 'steps', to: 'heart', label: 'Activity', strength: 0.5 },
    ],
    [],
  );

  const handleNodeClick = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (node?.href) router.push(node.href);
    },
    [nodes, router],
  );

  const weekPct = stats?.weekCompletionRate ?? 0;
  const hubSub = isLoading ? 'Loading…' : `${Math.round(weekPct)}% this week`;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ─── ORBIT GRAPH ─── */}
      <div className="relative rounded-3xl overflow-hidden border border-white/[0.06]">
        {/* ambient light */}
        <div
          className="absolute top-0 left-0 w-1/2 h-1/2 pointer-events-none z-[1]"
          style={{
            background: 'radial-gradient(ellipse at 20% 20%, rgba(34,211,238,0.06) 0%, transparent 70%)',
          }}
        />
        <OrbitGraph
          nodes={nodes}
          edges={edges}
          hubLabel="You"
          hubSubLabel={hubSub}
          onNodeClick={handleNodeClick}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-3xl z-20">
            <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ─── STAT PILLS ROW ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatPill
          icon={Target}
          label="Today"
          value={`${stats?.completedToday ?? 0}/${stats?.totalToday ?? 0}`}
          color="#10b981"
        />
        <StatPill
          icon={TrendingUp}
          label="Week Rate"
          value={`${Math.round(weekPct)}%`}
          change={stats?.weekChange}
          color="#06b6d4"
        />
        <StatPill
          icon={Flame}
          label="Streak"
          value={stats?.currentStreak ?? 0}
          color="#f97316"
        />
        <StatPill
          icon={Sparkles}
          label="Plan"
          value={plan ? `Week ${plan.currentWeek || 1}` : 'None'}
          color="#8b5cf6"
        />
      </div>

      {/* ─── MAIN GRID: SCHEDULE + GAMIFICATION + QUICK ACTIONS ─── */}
      <div className="grid lg:grid-cols-3 gap-4 min-w-0">
        {/* Left — Schedule */}
        <div className="lg:col-span-2 space-y-4">
          <OrbitSchedule todayData={todayData} onActivityComplete={onActivityComplete} />
          <QuickActions onAddWater={onAddWater} />
        </div>

        {/* Right — Gamification + Summary */}
        <div className="space-y-4">
          <GamificationStrip streak={stats?.currentStreak ?? 0} />
          <WeeklySummaryStrip summary={weeklySummary} />
        </div>
      </div>
    </div>
  );
}
