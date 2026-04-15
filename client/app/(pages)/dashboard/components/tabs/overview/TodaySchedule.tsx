'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Clock, Timer, Check, ChevronRight, RefreshCw,
  Sparkles, ChevronDown, Droplets, Utensils, Moon, Sun,
  Dumbbell, Brain, Heart, Calendar, Star, TrendingUp, Flame, Zap,
} from 'lucide-react';
import Link from 'next/link';
import type { TodayData, Plan } from './types';
import { activityIcons, formatTime } from './constants';

/* ════════════════════════════════════════════════════════
   INJECTED CSS
════════════════════════════════════════════════════════ */
const SCHEDULE_CSS = `
  @keyframes ts-node-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(var(--node-rgb), 0.55); }
    70%      { box-shadow: 0 0 0 10px rgba(var(--node-rgb), 0); }
  }
  @keyframes ts-ring {
    0%   { transform: scale(1); opacity: .48; }
    100% { transform: scale(2.6); opacity: 0; }
  }
  @keyframes ts-shimmer {
    from { transform: translateX(-150%); }
    to   { transform: translateX(200%); }
  }
  @keyframes ts-glow-hdr { 0%,100%{opacity:.3}  50%{opacity:.8}  }
  @keyframes ts-float     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  @keyframes ts-now-badge { 0%,100%{opacity:.85} 50%{opacity:1}   }
  @keyframes ts-stat-in   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ts-ping      { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.1);opacity:0} }
`;

/* ════════════════════════════════════════════════════════
   TYPE CONFIG MAP
════════════════════════════════════════════════════════ */
interface TC {
  color: string;
  rgb: string;
  gradient: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const TYPE_MAP: Record<string, TC> = {
  workout:     { color: '#f97316', rgb: '249,115,22',  gradient: 'from-orange-500 to-amber-600',   Icon: Dumbbell },
  exercise:    { color: '#f97316', rgb: '249,115,22',  gradient: 'from-orange-500 to-amber-600',   Icon: Activity },
  cardio:      { color: '#f43f5e', rgb: '244,63,94',   gradient: 'from-rose-500 to-pink-600',      Icon: Heart    },
  morning:     { color: '#fbbf24', rgb: '251,191,36',  gradient: 'from-amber-400 to-yellow-500',   Icon: Sun      },
  meal:        { color: '#a855f7', rgb: '168,85,247',  gradient: 'from-purple-500 to-violet-600',  Icon: Utensils },
  nutrition:   { color: '#a855f7', rgb: '168,85,247',  gradient: 'from-purple-500 to-violet-600',  Icon: Utensils },
  water:       { color: '#06b6d4', rgb: '6,182,212',   gradient: 'from-cyan-500 to-sky-600',       Icon: Droplets },
  sleep:       { color: '#818cf8', rgb: '129,140,248', gradient: 'from-indigo-400 to-violet-500',  Icon: Moon     },
  rest:        { color: '#818cf8', rgb: '129,140,248', gradient: 'from-indigo-400 to-violet-500',  Icon: Moon     },
  meditation:  { color: '#ec4899', rgb: '236,72,153',  gradient: 'from-pink-500 to-rose-600',      Icon: Brain    },
  mindfulness: { color: '#ec4899', rgb: '236,72,153',  gradient: 'from-pink-500 to-rose-600',      Icon: Brain    },
};

const getTC = (type: string): TC =>
  TYPE_MAP[type] ?? {
    color: '#10b981', rgb: '16,185,129',
    gradient: 'from-emerald-500 to-teal-600', Icon: Activity,
  };

/* ════════════════════════════════════════════════════════
   ICON RESOLVER
════════════════════════════════════════════════════════ */
function resolveIcon(
  type: string,
  externalSource?: unknown,
): React.ComponentType<{ className?: string }> {
  if (typeof externalSource === 'function') {
    return externalSource as React.ComponentType<{ className?: string }>;
  }
  return getTC(type).Icon;
}

/* ════════════════════════════════════════════════════════
   SKELETON
════════════════════════════════════════════════════════ */
function SkeletonRow({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex gap-3"
    >
      {/* Timeline stub */}
      <div className="flex flex-col items-center w-6 shrink-0 pt-3.5">
        <div className="w-5 h-5 rounded-full bg-white/[0.06] animate-pulse" />
        <div className="w-0.5 flex-1 mt-1.5 bg-white/[0.04] rounded-full" />
      </div>
      {/* Card stub */}
      <div
        className="flex-1 mb-2.5 flex items-center gap-3 p-4 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.018)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/5 rounded-lg bg-white/[0.06] animate-pulse" />
          <div className="h-2.5 w-3/5 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="h-2 w-1/3 rounded-lg bg-white/[0.03] animate-pulse" />
        </div>
        <div className="w-8 h-8 rounded-full bg-white/[0.04] animate-pulse shrink-0" />
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════
   TIMELINE NODE
════════════════════════════════════════════════════════ */
function TimelineNode({
  isCompleted,
  isCurrent,
  cfg,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
  cfg: TC;
}) {
  const size = isCurrent ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <div className="relative flex items-center justify-center shrink-0">
      {/* Outer expand ring for current */}
      {isCurrent && (
        <div
          className="absolute rounded-full border"
          style={{
            inset: '-5px',
            borderColor: cfg.color,
            opacity: 0.48,
            animation: 'ts-ring 2s ease-out infinite',
          }}
        />
      )}

      <motion.div
        className={`${size} rounded-full flex items-center justify-center`}
        style={{
          '--node-rgb': cfg.rgb,
          background: isCompleted
            ? 'rgba(16,185,129,0.14)'
            : isCurrent
              ? `rgba(${cfg.rgb},0.18)`
              : 'rgba(255,255,255,0.04)',
          border: `2px solid ${
            isCompleted ? '#10b981' : isCurrent ? cfg.color : 'rgba(255,255,255,0.1)'
          }`,
          boxShadow: isCompleted
            ? '0 0 10px rgba(16,185,129,0.3)'
            : isCurrent
              ? `0 0 14px rgba(${cfg.rgb},0.45), 0 0 28px rgba(${cfg.rgb},0.15)`
              : 'none',
          animation: isCurrent ? 'ts-node-pulse 2s ease-in-out infinite' : 'none',
        } as React.CSSProperties}
      >
        {isCompleted ? (
          <Check
            className="w-3 h-3 text-emerald-400"
            style={{ filter: 'drop-shadow(0 0 3px rgba(16,185,129,0.6))' }}
          />
        ) : isCurrent ? (
          <div className="relative">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
            />
            {/* Inner ping */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: cfg.color,
                animation: 'ts-ping 1.6s ease-out infinite',
                opacity: 0.5,
              }}
            />
          </div>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-white/15" />
        )}
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ACTIVITY CARD
════════════════════════════════════════════════════════ */
interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  preferredTime: string;
  duration?: number;
  status: string;
}

interface CardProps {
  activity: ActivityItem;
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isExpanded: boolean;
  cfg: TC;
  onToggle: () => void;
  onComplete: (e: React.MouseEvent) => void;
}

function ActivityCard({
  activity, index, isCompleted, isCurrent, isExpanded, cfg, onToggle, onComplete,
}: CardProps) {
  const IconComp = resolveIcon(activity.type, activityIcons?.[activity.type]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 22 }}
    >
      <motion.div
        onClick={onToggle}
        whileHover={{ x: 3, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
        className="group/card relative overflow-hidden rounded-[18px] cursor-pointer"
        style={{
          background: isCurrent
            ? `linear-gradient(135deg, rgba(${cfg.rgb},0.07) 0%, rgba(${cfg.rgb},0.02) 100%)`
            : isCompleted
              ? 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(16,185,129,0.01) 100%)'
              : 'linear-gradient(135deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.008) 100%)',
          border: `1px solid ${
            isCurrent
              ? `rgba(${cfg.rgb},0.22)`
              : isCompleted
                ? 'rgba(16,185,129,0.13)'
                : 'rgba(255,255,255,0.065)'
          }`,
          boxShadow: isCurrent
            ? `0 0 30px -8px rgba(${cfg.rgb},0.18), inset 0 1px 0 rgba(255,255,255,0.04)`
            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* ── Left accent bar ── */}
        <div
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
          style={{
            background: isCurrent
              ? `linear-gradient(180deg, ${cfg.color}, rgba(${cfg.rgb},0.4))`
              : isCompleted
                ? 'linear-gradient(180deg, #34d399, #059669)'
                : 'transparent',
            boxShadow: isCurrent
              ? `0 0 10px rgba(${cfg.rgb},0.5)`
              : isCompleted
                ? '0 0 8px rgba(16,185,129,0.35)'
                : 'none',
          }}
        />

        {/* ── Shimmer sweep (current only) ── */}
        {isCurrent && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(105deg, transparent 36%, rgba(255,255,255,0.028) 50%, transparent 64%)',
              animation: 'ts-shimmer 3.5s ease-in-out infinite',
            }}
          />
        )}

        <div className="flex items-start gap-3 p-3.5 sm:p-4 pl-4 sm:pl-[18px]">
          {/* ── Icon badge ── */}
          <div className="relative shrink-0">
            {/* Hover glow behind badge */}
            <div
              className="absolute -inset-1 rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"
              style={{
                background: `radial-gradient(circle, rgba(${cfg.rgb},0.35) 0%, transparent 70%)`,
                filter: 'blur(6px)',
              }}
            />
            <div
              className={`
                relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center
                bg-gradient-to-br ${cfg.gradient}
              `}
              style={{
                boxShadow: `0 4px 14px rgba(${cfg.rgb},0.38), 0 2px 4px rgba(0,0,0,0.3),
                            inset 0 1px 0 rgba(255,255,255,0.18)`,
                opacity: isCompleted ? 0.55 : 1,
                transition: 'opacity 0.3s ease',
              }}
            >
              <IconComp className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-white" />
            </div>

            {/* Live pulse dot */}
            {isCurrent && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900"
                style={{ background: cfg.color, boxShadow: `0 0 8px rgba(${cfg.rgb},0.8)` }}
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: cfg.color,
                    animation: 'ts-ping 1.6s ease-out infinite',
                    opacity: 0.5,
                  }}
                />
              </span>
            )}
          </div>

          {/* ── Text block ── */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3
                className={`font-semibold text-sm sm:text-[14.5px] leading-tight transition-all ${
                  isCompleted
                    ? 'text-slate-500 line-through decoration-slate-600/40'
                    : 'text-white'
                }`}
              >
                {activity.title}
              </h3>

              {isCurrent && (
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border"
                  style={{
                    color: cfg.color,
                    borderColor: `rgba(${cfg.rgb},0.3)`,
                    background: `rgba(${cfg.rgb},0.12)`,
                    animation: 'ts-now-badge 2s ease-in-out infinite',
                  }}
                >
                  NOW
                </span>
              )}

              {isCompleted && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20">
                  Done
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-[11.5px] text-slate-400/75 mt-0.5 line-clamp-1 leading-relaxed">
              {activity.description}
            </p>

            {/* Meta chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-400 font-medium"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.065)',
                }}
              >
                <Clock className="w-3 h-3 text-slate-500" />
                {formatTime(activity.preferredTime)}
              </span>

              {activity.duration != null && activity.duration > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-500 font-medium"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <Timer className="w-3 h-3" />
                  {activity.duration}m
                </span>
              )}

              {/* Type label chip */}
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide"
                style={{
                  color: isCompleted ? 'rgba(16,185,129,0.7)' : cfg.color,
                  background: isCompleted
                    ? 'rgba(16,185,129,0.08)'
                    : `rgba(${cfg.rgb},0.08)`,
                  border: `1px solid ${
                    isCompleted ? 'rgba(16,185,129,0.18)' : `rgba(${cfg.rgb},0.18)`
                  }`,
                }}
              >
                {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
              </span>
            </div>

            {/* ── Expanded accordion ── */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-3 pt-3 grid grid-cols-2 gap-2"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {/* XP reward */}
                    <div
                      className="p-2.5 rounded-xl text-center"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.065)',
                      }}
                    >
                      <p className="text-[10px] text-slate-500 mb-0.5">XP Reward</p>
                      <p className="text-sm font-bold text-yellow-400">
                        +{activity.duration ? activity.duration * 2 : 30} XP
                      </p>
                    </div>
                    {/* Category */}
                    <div
                      className="p-2.5 rounded-xl text-center"
                      style={{
                        background: `rgba(${cfg.rgb},0.06)`,
                        border: `1px solid rgba(${cfg.rgb},0.15)`,
                      }}
                    >
                      <p className="text-[10px] text-slate-500 mb-0.5">Category</p>
                      <p className="text-sm font-bold" style={{ color: cfg.color }}>
                        {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right actions ── */}
          <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
            <motion.button
              type="button"
              aria-label={isCompleted ? 'Unmark as complete' : 'Mark as complete'}
              onClick={onComplete}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center"
              style={{
                background: isCompleted
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(5,150,105,0.14))'
                  : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${
                  isCompleted ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'
                }`,
                boxShadow: isCompleted ? '0 0 16px rgba(16,185,129,0.18)' : 'none',
              }}
            >
              {isCompleted ? (
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 15 }}
                >
                  <Check
                    className="w-4 h-4 text-emerald-400"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.6))' }}
                  />
                </motion.div>
              ) : (
                <Check className="w-3.5 h-3.5 text-transparent group-hover/card:text-white/20 transition-colors duration-200" />
              )}
            </motion.button>

            {/* Chevron toggle */}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="text-slate-600 group-hover/card:text-slate-400 transition-colors cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
interface TodayScheduleProps {
  todayData: TodayData | null;
  plan: Plan | null;
  onActivityComplete: (activityId: string) => void;
  onRefresh?: () => void;
}

export function TodaySchedule({
  todayData,
  plan,
  onActivityComplete,
  onRefresh,
}: TodayScheduleProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* ── Detect current activity ──────────────────────── */
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const currentActivityIndex = (() => {
    if (!todayData?.activities) return -1;
    return todayData.activities.findIndex((a) => {
      const [h, m] = a.preferredTime.split(':').map(Number);
      const diff = Math.abs(h * 60 + m - (currentHour * 60 + currentMinute));
      return diff <= 30 && a.status !== 'completed';
    });
  })();

  /* ── Derived values ───────────────────────────────── */
  const completedCount = todayData?.completedCount ?? 0;
  const totalCount     = todayData?.totalCount     ?? 0;
  const progressPct    = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const circumference  = 2 * Math.PI * 12; // r=12

  const dateLabel = (() => {
    const d = new Date();
    const weekday = todayData?.dayOfWeek
      ? todayData.dayOfWeek.charAt(0).toUpperCase() + todayData.dayOfWeek.slice(1)
      : d.toLocaleDateString('en-US', { weekday: 'long' });
    const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${weekday}, ${md}`;
  })();

 

  return (
    <div className="p-4 sm:p-6">
      <style>{SCHEDULE_CSS}</style>

      {/* ══════════════════════════════════════════
          HEADER CARD
      ══════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-2xl mb-5 sm:mb-6 p-4 sm:p-5"
        style={{
          background:
            'linear-gradient(135deg, rgba(14,165,233,0.065) 0%, rgba(14,165,233,0.02) 60%, transparent 100%)',
          border: '1px solid rgba(14,165,233,0.13)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Decorative ambient blob */}
        <div
          className="absolute top-0 right-0 w-44 h-44 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(14,165,233,0.1) 0%, transparent 70%)',
            animation: 'ts-glow-hdr 4s ease-in-out infinite',
          }}
        />

        {/* Top row: icon + title + actions */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Calendar icon */}
            <div className="relative">
              <div
                className="p-2.5 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.08))',
                  border: '1px solid rgba(14,165,233,0.28)',
                  boxShadow: '0 0 20px rgba(14,165,233,0.12)',
                }}
              >
                <Calendar
                  className="w-[18px] h-[18px] text-sky-400"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(14,165,233,0.5))' }}
                />
              </div>
              {/* Notification dot */}
              {totalCount > 0 && completedCount < totalCount && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 bg-sky-400"
                  style={{ boxShadow: '0 0 7px rgba(14,165,233,0.7)' }}
                />
              )}
            </div>

            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight tracking-tight">
                Today&apos;s Schedule
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400/80 mt-0.5 font-medium">
                {dateLabel}
              </p>
            </div>
          </div>

          {/* Right: progress ring + refresh + view all */}
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <div className="relative w-9 h-9 hidden sm:block">
                <svg width="36" height="36" viewBox="0 0 32 32" className="-rotate-90">
                  <circle
                    cx="16" cy="16" r="12"
                    fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"
                  />
                  <circle
                    cx="16" cy="16" r="12"
                    fill="none"
                    stroke="url(#ts-prog-grad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progressPct / 100)}
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                  />
                  <defs>
                    <linearGradient id="ts-prog-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white tabular-nums">
                  {progressPct}
                </span>
              </div>
            )}

            {onRefresh && (
              <motion.button
                type="button"
                aria-label="Refresh schedule"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRefresh(); }}
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </motion.button>
            )}

            <Link
              href="/activity"
              className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
              style={{
                background: 'rgba(14,165,233,0.07)',
                border: '1px solid rgba(14,165,233,0.14)',
              }}
            >
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

       
      </div>

      {/* ══════════════════════════════════════════
          TIMELINE BODY
      ══════════════════════════════════════════ */}
      <div>
        {/* Skeleton loading */}
        {todayData === null && (
          <div>{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} index={i} />)}</div>
        )}

        {/* Rest day */}
        {todayData?.isRestDay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-2xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(99,102,241,0.03) 100%)',
              border: '1px solid rgba(139,92,246,0.15)',
              boxShadow: '0 0 40px rgba(139,92,246,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div className="p-8 text-center">
              <motion.div
                className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center"
                style={{ boxShadow: '0 0 28px rgba(139,92,246,0.15)', animation: 'ts-float 3s ease-in-out infinite' }}
              >
                <Sparkles
                  className="w-7 h-7 text-purple-400"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.5))' }}
                />
              </motion.div>
              <h3 className="text-base font-bold text-white mb-1.5">Rest Day</h3>
              <p className="text-sm text-slate-400 mb-4">Take time to rest, recover, and recharge.</p>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}
              >
                <Moon className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-purple-300">Recovery Day</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TIMELINE ACTIVITIES ── */}
        {todayData && !todayData.isRestDay && todayData.activities.length > 0 && (
          <div>
            {todayData.activities.map((activity, index) => {
              const isLast      = index === todayData.activities.length - 1;
              const isCurrent   = index === currentActivityIndex;
              const isCompleted = activity.status === 'completed';
              const cfg         = getTC(activity.type);

              // Connector line colour from this node down to the next
              const connectorBg = isCompleted
                ? 'linear-gradient(180deg, #10b981, #059669)'
                : isCurrent
                  ? `linear-gradient(180deg, ${cfg.color} 0%, rgba(30,41,59,0.25) 100%)`
                  : 'rgba(30,41,59,0.4)';

              return (
                <div key={activity.id} className="flex gap-3">
                  {/* Left: timeline column */}
                  <div
                    className="flex flex-col items-center w-6 shrink-0"
                    style={{ paddingTop: '14px' }}
                  >
                    <TimelineNode
                      isCompleted={isCompleted}
                      isCurrent={isCurrent}
                      cfg={cfg}
                    />
                    {!isLast && (
                      <div
                        className="w-0.5 flex-1 rounded-full mt-1.5"
                        style={{
                          background: connectorBg,
                          minHeight: '12px',
                          opacity: isCompleted ? 1 : 0.5,
                        }}
                      />
                    )}
                  </div>

                  {/* Right: activity card */}
                  <div
                    className="flex-1 min-w-0"
                    style={{ paddingBottom: isLast ? 0 : '10px' }}
                  >
                    <ActivityCard
                      activity={activity}
                      index={index}
                      isCompleted={isCompleted}
                      isCurrent={isCurrent}
                      isExpanded={expandedId === activity.id}
                      cfg={cfg}
                      onToggle={() =>
                        setExpandedId(expandedId === activity.id ? null : activity.id)
                      }
                      onComplete={(e) => {
                        e.stopPropagation();
                        onActivityComplete(activity.id);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {todayData && !todayData.isRestDay && todayData.activities.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 text-center rounded-2xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 100%)',
              border: '1px solid rgba(255,255,255,0.065)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <motion.div
              className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
              style={{ animation: 'ts-float 3s ease-in-out infinite' }}
            >
              <Star className="w-7 h-7 text-slate-600" />
            </motion.div>
            <p className="text-sm text-slate-400 mb-2">No activities scheduled for today</p>
            <Link
              href="/dashboard?tab=plans"
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-0.5 transition-colors"
            >
              Create a plan <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        )}
      </div>

    </div>
  );
}