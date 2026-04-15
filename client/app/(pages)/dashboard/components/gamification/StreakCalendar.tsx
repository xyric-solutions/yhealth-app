'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarMonth, CalendarDay } from '@/src/shared/services/streak.service';

// ============================================
// TYPES & HELPERS
// ============================================

interface StreakCalendarProps {
  data: CalendarMonth | null;
  onLoadMonth: (month: string) => void;
  isLoading?: boolean;
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const STATUS_COLORS: Record<CalendarDay['status'], string> = {
  active: 'bg-emerald-500/80',
  frozen: 'bg-blue-400/60',
  broken: 'bg-red-400/60',
  none: 'bg-zinc-800/40',
};

const STATUS_LABELS: Record<CalendarDay['status'], string> = {
  active: 'Active',
  frozen: 'Frozen',
  broken: 'Broken',
  none: 'No activity',
};

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getAdjacentMonth(monthStr: string, offset: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Build a grid of day cells for a month, including leading empty cells
 * to align the first day of the month to the correct weekday column.
 */
function buildCalendarGrid(
  monthStr: string,
  days: CalendarDay[],
): (CalendarDay | null)[] {
  const [year, month] = monthStr.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  // getDay() returns 0=Sun, we want Mon=0
  const startOffset = (firstDay.getDay() + 6) % 7;

  const dayMap = new Map<string, CalendarDay>();
  for (const d of days) {
    dayMap.set(d.date, d);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const grid: (CalendarDay | null)[] = [];

  // Leading empty cells
  for (let i = 0; i < startOffset; i++) {
    grid.push(null);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const existing = dayMap.get(dateStr);
    grid.push(
      existing ?? {
        date: dateStr,
        status: 'none',
        activities: [],
        streakDay: 0,
      },
    );
  }

  return grid;
}

// ============================================
// DAY CELL
// ============================================

function DayCell({
  day,
  isToday,
  index,
}: {
  day: CalendarDay;
  isToday: boolean;
  index: number;
}) {
  const dayNum = parseInt(day.date.split('-')[2], 10);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: index * 0.012,
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={`
        relative w-9 h-9 rounded-lg flex items-center justify-center text-xs font-medium transition-colors
        ${STATUS_COLORS[day.status]}
        ${isToday ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-[#0a0a14]' : ''}
        ${day.status === 'active' ? 'text-white' : ''}
        ${day.status === 'frozen' ? 'text-blue-100' : ''}
        ${day.status === 'broken' ? 'text-red-100' : ''}
        ${day.status === 'none' ? 'text-slate-600' : ''}
      `}
      role="gridcell"
      aria-label={`${day.date}: ${STATUS_LABELS[day.status]}${day.activities.length > 0 ? ` (${day.activities.join(', ')})` : ''}`}
    >
      {dayNum}
      {day.status === 'active' && day.streakDay > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-300" />
      )}
    </motion.div>
  );
}

// ============================================
// SKELETON
// ============================================

function CalendarSkeleton() {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="w-6 h-6 rounded bg-white/[0.04]" />
        <div className="w-32 h-4 rounded bg-white/[0.04]" />
        <div className="w-6 h-6 rounded bg-white/[0.04]" />
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="h-4 flex items-center justify-center">
            <span className="text-[10px] text-slate-600">{h}</span>
          </div>
        ))}
      </div>
      {/* Grid skeleton */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }, (_, i) => (
          <div
            key={i}
            className="w-9 h-9 rounded-lg bg-white/[0.03] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StreakCalendar({ data, onLoadMonth, isLoading = false }: StreakCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<string>(
    data?.month ?? getCurrentMonth(),
  );
  const today = getTodayISO();
  const isFutureMonth = currentMonth > getCurrentMonth();

  // Navigate months
  const goToPrevMonth = () => {
    const prev = getAdjacentMonth(currentMonth, -1);
    setCurrentMonth(prev);
    onLoadMonth(prev);
  };

  const goToNextMonth = () => {
    if (isFutureMonth) return;
    const next = getAdjacentMonth(currentMonth, 1);
    setCurrentMonth(next);
    onLoadMonth(next);
  };

  // Load the initial month on mount
  useEffect(() => {
    onLoadMonth(currentMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build grid
  const grid = useMemo(() => {
    if (!data || data.month !== currentMonth) return [];
    return buildCalendarGrid(currentMonth, data.days);
  }, [data, currentMonth]);

  const summary = data?.summary;
  const isCurrentMonthData = data?.month === currentMonth;

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 sm:p-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-slate-400 hover:text-white"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-white">
          {formatMonthLabel(currentMonth)}
        </h3>
        <button
          onClick={goToNextMonth}
          disabled={isFutureMonth}
          className={`p-1.5 rounded-lg transition-colors ${
            isFutureMonth
              ? 'text-slate-700 cursor-not-allowed'
              : 'hover:bg-white/[0.06] text-slate-400 hover:text-white'
          }`}
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Loading or Grid */}
      {isLoading || !isCurrentMonthData ? (
        <CalendarSkeleton />
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1.5 mb-2" role="row">
            {DAY_HEADERS.map((header) => (
              <div
                key={header}
                className="h-5 flex items-center justify-center"
                role="columnheader"
              >
                <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                  {header}
                </span>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Streak calendar">
            {grid.map((cell, idx) =>
              cell ? (
                <DayCell
                  key={cell.date}
                  day={cell}
                  isToday={cell.date === today}
                  index={idx}
                />
              ) : (
                <div key={`empty-${idx}`} className="w-9 h-9" role="presentation" />
              ),
            )}
          </div>

          {/* Summary row */}
          {summary && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
              <SummaryDot color="bg-emerald-500/80" label="active" count={summary.activeDays} />
              <SummaryDot color="bg-blue-400/60" label="frozen" count={summary.frozenDays} />
              <SummaryDot color="bg-red-400/60" label="broken" count={summary.brokenDays} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// SUMMARY DOT
// ============================================

function SummaryDot({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${color}`} aria-hidden="true" />
      <span className="text-[10px] text-slate-500">
        {count} {label}
      </span>
    </div>
  );
}
