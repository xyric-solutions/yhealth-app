'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Calendar, ChevronDown } from 'lucide-react';
import type { WeeklyActivityData } from './types';

export type ActivityPeriod = 'current' | 'last' | 'month' | 'year' | 'lifetime';

interface WeeklyChartProps {
  weeklyActivity: WeeklyActivityData | null;
  selectedWeek: ActivityPeriod;
  onWeekChange: (week: ActivityPeriod) => void;
}

const periodLabels: Record<ActivityPeriod, string> = {
  current: 'This Week',
  last: 'Last Week',
  month: 'This Month',
  year: 'This Year',
  lifetime: 'All Time',
};

const BAR_MAX_HEIGHT_DESKTOP = 180;
const BAR_MAX_HEIGHT_MOBILE = 140;
const GRID_LINES = [100, 75, 50, 25] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBarGradient(rate: number, isToday: boolean): string {
  if (isToday) return 'from-sky-500 to-cyan-400';
  if (rate >= 70) return 'from-emerald-500 to-emerald-400';
  if (rate >= 40) return 'from-amber-500 to-amber-400';
  if (rate > 0) return 'from-orange-500 to-orange-400';
  return 'from-slate-700 to-slate-700';
}

function getBarGlow(rate: number, isToday: boolean): string {
  if (isToday) return '0 0 18px rgba(14,165,233,0.45), 0 0 6px rgba(14,165,233,0.25)';
  if (rate >= 70) return '0 0 14px rgba(16,185,129,0.35), 0 0 4px rgba(16,185,129,0.2)';
  if (rate >= 40) return '0 0 10px rgba(245,158,11,0.25)';
  return 'none';
}

// ---------------------------------------------------------------------------
// BarColumn
// ---------------------------------------------------------------------------

function BarColumn({
  day,
  completionRate,
  isToday,
  completed,
  total,
  index,
  isHovered,
  onHover,
}: {
  day: string;
  completionRate: number;
  isToday: boolean;
  completed: number;
  total: number;
  index: number;
  isHovered: boolean;
  onHover: (hovered: boolean) => void;
}) {
  const rate = Math.min(100, Math.max(0, completionRate));
  const isEmpty = total === 0;
  const heightPercent = isEmpty ? 0 : Math.max(rate, 4);
  const dotCount = Math.min(total, 5);

  return (
    <div
      className="relative flex-1 max-w-[48px] flex flex-col items-center"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && !isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="absolute -top-[68px] left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="px-3 py-2 rounded-xl bg-slate-800/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl">
              <p className="text-xs font-semibold text-white whitespace-nowrap">
                {completed}/{total} completed
              </p>
              <p className="text-[11px] text-slate-400 whitespace-nowrap">
                {Math.round(rate)}% completion
              </p>
            </div>
            {/* Arrow */}
            <div className="mx-auto w-2 h-2 rotate-45 bg-slate-800/90 border-b border-r border-white/[0.08] -mt-1" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion dots */}
      <div className="flex gap-0.5 mb-1.5 h-3 items-end">
        {dotCount > 0 &&
          Array.from({ length: dotCount }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i < completed ? 'bg-emerald-400' : 'bg-slate-600/60'
              }`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 + index * 0.08 + i * 0.04, type: 'spring', stiffness: 300 }}
            />
          ))}
      </div>

      {/* Bar track */}
      <div
        className="relative w-full flex items-end justify-center"
        style={{ height: `clamp(${BAR_MAX_HEIGHT_MOBILE}px, 18vw, ${BAR_MAX_HEIGHT_DESKTOP}px)` }}
      >
        {/* Ghost track */}
        <div className="absolute inset-x-1 bottom-0 top-0 rounded-t-lg bg-white/[0.03]" />

        {/* Animated bar */}
        <motion.div
          className={`
            relative w-full mx-1 rounded-t-lg overflow-hidden
            bg-gradient-to-t ${getBarGradient(rate, isToday)}
            ${isToday ? 'ring-1 ring-sky-400/30' : ''}
          `}
          style={{
            boxShadow: isHovered || isToday ? getBarGlow(rate, isToday) : 'none',
          }}
          initial={{ height: 0 }}
          animate={{ height: `${heightPercent}%` }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 20,
            delay: index * 0.08,
          }}
        >
          {/* Top highlight edge */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-white/25 rounded-t-lg" />

          {/* Shimmer sweep */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              repeatDelay: 4,
              ease: 'linear',
              delay: 1 + index * 0.15,
            }}
          />

          {/* Inner glow (today only) */}
          {isToday && (
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-sky-400/10 to-cyan-300/15" />
          )}
        </motion.div>
      </div>

      {/* Day label */}
      <span
        className={`
          mt-2 text-xs select-none transition-colors duration-200
          ${isToday ? 'text-sky-400 font-bold' : 'text-slate-500 font-medium'}
          ${isHovered && !isToday ? 'text-slate-300' : ''}
        `}
      >
        {day}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeekSelector
// ---------------------------------------------------------------------------

function WeekSelector({
  selected,
  onChange,
}: {
  selected: ActivityPeriod;
  onChange: (week: ActivityPeriod) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const periods: ActivityPeriod[] = ['current', 'last', 'month', 'year', 'lifetime'];

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded-full
          bg-white/[0.05] border border-white/[0.08]
          text-sm text-slate-300 hover:text-white hover:bg-white/[0.08]
          transition-colors backdrop-blur-sm
        "
      >
        <Calendar className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-xs sm:text-sm font-medium">{periodLabels[selected]}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="
                absolute top-full right-0 mt-2 w-40 z-20
                rounded-xl bg-slate-800/95 border border-white/[0.08]
                shadow-2xl backdrop-blur-xl overflow-hidden
              "
            >
              {periods.map((period) => (
                <motion.button
                  key={period}
                  onClick={() => {
                    onChange(period);
                    setIsOpen(false);
                  }}
                  whileHover={{ x: 3, backgroundColor: 'rgba(255,255,255,0.05)' }}
                  className={`
                    w-full px-4 py-2.5 text-left text-sm transition-colors
                    ${selected === period ? 'text-sky-400 bg-white/[0.04]' : 'text-slate-300 hover:text-white'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span>{periodLabels[period]}</span>
                    {selected === period && (
                      <motion.div
                        layoutId="weekSelectorDot"
                        className="w-1.5 h-1.5 rounded-full bg-sky-400"
                      />
                    )}
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

const SKELETON_HEIGHTS = [45, 70, 55, 80, 35, 60, 50];

function ChartSkeleton() {
  return (
    <div className="flex items-end justify-between gap-2 sm:gap-3 pl-9 pr-1 sm:pr-2" style={{ height: 180 }}>
      {SKELETON_HEIGHTS.map((h, i) => (
        <div key={i} className="flex-1 max-w-[48px] flex flex-col items-center gap-2">
          <div
            className="w-full mx-1 rounded-t-lg bg-slate-700/40 animate-pulse"
            style={{ height: `${h}%` }}
          />
          <div className="w-6 h-3 rounded bg-slate-700/40 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeeklyChart (main export)
// ---------------------------------------------------------------------------

export function WeeklyChart({ weeklyActivity, selectedWeek, onWeekChange }: WeeklyChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleHover = useCallback(
    (index: number) => (hovered: boolean) => {
      setHoveredIndex(hovered ? index : null);
    },
    [],
  );

  const defaultDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days =
    weeklyActivity?.days ||
    defaultDays.map((day) => ({
      day,
      date: '',
      completed: 0,
      total: 0,
      completionRate: 0,
      isToday: false,
    }));

  const totalCompleted = days.reduce((s, d) => s + d.completed, 0);
  const totalActivities = days.reduce((s, d) => s + d.total, 0);
  const successRate = totalActivities > 0 ? Math.round((totalCompleted / totalActivities) * 100) : 0;

  const isLoading = weeklyActivity === null;

  return (
    <div className="p-4 sm:p-5">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 sm:mb-6">
        <div className="flex items-center gap-3">
          <motion.div
            className="p-2 rounded-xl bg-sky-500/[0.12] ring-1 ring-sky-500/20"
            whileHover={{ scale: 1.1, rotate: -5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <BarChart3 className="w-5 h-5 text-sky-500" />
          </motion.div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
              Weekly Activity
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Your daily completion progress</p>
          </div>
        </div>
        <WeekSelector selected={selectedWeek} onChange={onWeekChange} />
      </div>

      {/* ── Chart area ─────────────────────────────────────── */}
      {isLoading ? (
        <ChartSkeleton />
      ) : (
        <div className="relative flex flex-col gap-6">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 ">
            {GRID_LINES.map((pct) => (
              <div
                key={pct}
                className="flex items-center gap-2"
                style={{ position: 'absolute', top: `${100 - pct}%`, left: 0, right: 0 }}
              >
                <span className="text-[10px] text-slate-600/70 w-7 text-right tabular-nums">
                  {pct}%
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                />
              </div>
            ))}
          </div>

          {/* Bars */}
          <div className="relative flex items-end justify-between gap-1.5 sm:gap-3 pl-9 pr-1 sm:pr-2 z-10 ">
            {days.map((d, i) => (
              <BarColumn
                key={d.day}
                day={d.day}
                completionRate={d.total > 0 ? d.completionRate : 0}
                isToday={d.isToday}
                completed={d.completed}
                total={d.total}
                index={i}
                isHovered={hoveredIndex === i}
                onHover={handleHover(i)}
              />
            ))}
          </div>
        </div>
      )}

     
    </div>
  );
}
