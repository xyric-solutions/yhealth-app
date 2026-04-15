"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  Calendar as CalendarIcon,
  ArrowLeft,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Timer,
  MapPin,
  Tag,
  MoreHorizontal,
  Pencil,
  Sun,
  Sunrise,
  Sunset,
  Moon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  isToday,
  isSameDay,
  parseISO,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
} from "date-fns";
import { DashboardLayout } from "@/components/layout";
import {
  scheduleService,
  type DailySchedule,
  type ScheduleItem,
  type CalendarSchedule,
} from "@/src/shared/services/schedule.service";
import { calendarApiService, type DayContext } from "@/src/shared/services/calendar.service";
import { ActivityFormModal } from "@/app/(pages)/dashboard/components/wellbeing/schedule/ActivityFormModal";
import { ApiError } from "@/lib/api-client";

// ============================================
// CONSTANTS
// ============================================

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  work: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", dot: "bg-blue-400" },
  prayer: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30", dot: "bg-violet-400" },
  meal: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-400" },
  exercise: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  health: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30", dot: "bg-rose-400" },
  personal: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30", dot: "bg-cyan-400" },
  social: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/30", dot: "bg-pink-400" },
  learning: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/30", dot: "bg-indigo-400" },
  default: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-400" },
};

function getCategoryStyle(category?: string) {
  if (!category) return CATEGORY_COLORS.default;
  return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.default;
}

function getTimeOfDayIcon(time: string) {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour >= 5 && hour < 12) return <Sunrise className="w-3.5 h-3.5" />;
  if (hour >= 12 && hour < 17) return <Sun className="w-3.5 h-3.5" />;
  if (hour >= 17 && hour < 21) return <Sunset className="w-3.5 h-3.5" />;
  return <Moon className="w-3.5 h-3.5" />;
}

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function getDuration(startTime: string, endTime?: string, durationMinutes?: number) {
  if (durationMinutes) {
    if (durationMinutes >= 60) {
      const h = Math.floor(durationMinutes / 60);
      const m = durationMinutes % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${durationMinutes}m`;
  }
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff > 0) {
      if (diff >= 60) {
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
      }
      return `${diff}m`;
    }
  }
  return null;
}

// ============================================
// LOADING
// ============================================

function ScheduleLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
    </div>
  );
}

// ============================================
// MINI CALENDAR
// ============================================

function MiniCalendar({
  selectedDate,
  onDateSelect,
  scheduleDates,
}: {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  scheduleDates: Set<string>;
}) {
  const [viewMonth, setViewMonth] = useState(selectedDate);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="select-none">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))}
          className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white">
          {format(viewMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))}
          className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekdays.map((day) => (
          <div key={day} className="text-center text-[10px] font-medium text-slate-500 uppercase tracking-wider py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const hasSchedule = scheduleDates.has(format(day, "yyyy-MM-dd"));

          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                onDateSelect(day);
                if (day.getMonth() !== viewMonth.getMonth()) {
                  setViewMonth(day);
                }
              }}
              className={`
                relative h-9 w-full flex items-center justify-center rounded-lg text-xs font-medium transition-all
                ${!isCurrentMonth ? "text-slate-600" : "text-slate-300 hover:text-white"}
                ${isSelected ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25" : "hover:bg-white/5"}
                ${isTodayDate && !isSelected ? "text-emerald-400 font-bold" : ""}
              `}
            >
              {day.getDate()}
              {hasSchedule && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// TIMELINE ITEM
// ============================================

function TimelineItem({ item, index, onEdit, onDelete }: { item: ScheduleItem; index: number; onEdit?: (item: ScheduleItem) => void; onDelete?: (itemId: string) => void }) {
  const style = getCategoryStyle(item.category);
  const duration = getDuration(item.startTime, item.endTime, item.durationMinutes);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group relative flex gap-4"
    >
      {/* Timeline Line + Dot */}
      <div className="flex flex-col items-center pt-2">
        <div className={`w-2 h-2 rounded-full ${style.dot} ring-2 ring-slate-900 z-10 shrink-0`} />
        <div className="w-px flex-1 bg-slate-700/40 min-h-[16px]" />
      </div>

      {/* Card */}
      <div
        className={`flex-1 mb-3 p-4 rounded-xl border ${style.border} bg-slate-800/40 hover:bg-slate-800/60 transition-all duration-200 group-hover:border-opacity-60`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-center gap-2 mb-1.5">
              {item.icon && <span className="text-base shrink-0">{item.icon}</span>}
              <h3 className="font-semibold text-white text-sm truncate">{item.title}</h3>
            </div>

            {/* Description */}
            {item.description && (
              <p className="text-xs text-slate-400 mb-2.5 line-clamp-2 leading-relaxed">{item.description}</p>
            )}

            {/* Meta Row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                {getTimeOfDayIcon(item.startTime)}
                <span className="font-medium">
                  {formatTime(item.startTime)}
                  {item.endTime && ` - ${formatTime(item.endTime)}`}
                </span>
              </div>
              {duration && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Timer className="w-3 h-3" />
                  <span>{duration}</span>
                </div>
              )}
              {item.category && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${style.bg} ${style.text}`}>
                  <Tag className="w-2.5 h-2.5" />
                  {item.category}
                </span>
              )}
            </div>
          </div>

          {/* 3-dot menu with Edit/Delete */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-8 z-50 w-36 rounded-xl border border-white/[0.08] py-1 shadow-xl"
                    style={{ background: '#14151f' }}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); onEdit?.(item); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit Activity
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onDelete?.(item.id); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// DAY STRIP (Week Navigation)
// ============================================

function DayStrip({
  selectedDate,
  onDateSelect,
  scheduleDates,
}: {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  scheduleDates: Set<string>;
}) {
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <button
        onClick={() => onDateSelect(subDays(selectedDate, 7))}
        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors shrink-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex-1 grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const hasSchedule = scheduleDates.has(format(day, "yyyy-MM-dd"));

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={`
                relative flex flex-col items-center py-2 px-1 rounded-xl transition-all
                ${isSelected
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : isTodayDate
                    ? "bg-white/5 text-emerald-400"
                    : "hover:bg-white/5 text-slate-400 hover:text-white"
                }
              `}
            >
              <span className="text-[10px] uppercase font-medium tracking-wider opacity-70">
                {format(day, "EEE")}
              </span>
              <span className={`text-lg font-bold mt-0.5 ${isSelected ? "text-white" : ""}`}>
                {format(day, "d")}
              </span>
              {hasSchedule && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onDateSelect(addDays(selectedDate, 7))}
        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptySchedule({ onCreateSchedule }: { onCreateSchedule: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center mb-4 border border-slate-600/50">
        <CalendarIcon className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">No activities scheduled</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-xs">
        Start planning your day by adding activities and tasks
      </p>
      <button
        onClick={onCreateSchedule}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20"
      >
        <Plus className="w-4 h-4" />
        Create Schedule
      </button>
    </motion.div>
  );
}

// ============================================
// STATS BAR
// ============================================

function StatsBar({ items }: { items: ScheduleItem[] }) {
  const totalMinutes = items.reduce((acc, item) => {
    if (item.durationMinutes) return acc + item.durationMinutes;
    if (item.startTime && item.endTime) {
      const [sh, sm] = item.startTime.split(":").map(Number);
      const [eh, em] = item.endTime.split(":").map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      return diff > 0 ? acc + diff : acc;
    }
    return acc;
  }, 0);

  const categories = new Set(items.map((i) => i.category).filter(Boolean));

  const stats = [
    { label: "Activities", value: items.length.toString() },
    { label: "Total Time", value: totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m` },
    { label: "Categories", value: categories.size.toString() },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center py-3 px-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="text-xl font-bold text-white">{stat.value}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mt-0.5">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// MAIN CONTENT
// ============================================

function ScheduleContent() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<DailySchedule | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [calendarSchedules, setCalendarSchedules] = useState<CalendarSchedule[]>([]);
  const [viewMode, setViewMode] = useState<"timeline" | "list">("timeline");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dayContext, setDayContext] = useState<DayContext | null>(null);
  const [editingActivity, setEditingActivity] = useState<ScheduleItem | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<Array<{ id: string; title: string; startTime: string; endTime: string; allDay: boolean; location: string | null }>>([]);

  const scheduleDates = useMemo(() => {
    const set = new Set<string>();
    calendarSchedules.forEach((s) => {
      if (s.hasSchedule) set.add(s.date);
    });
    return set;
  }, [calendarSchedules]);

  const loadSchedule = useCallback(async (date: Date) => {
    setIsLoadingSchedule(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const [result, ctxResult, eventsResult] = await Promise.all([
        scheduleService.getScheduleByDate(`${dateStr}?_t=${Date.now()}`),
        calendarApiService.getScheduleContext(dateStr).catch(() => null),
        calendarApiService.getCalendarEvents(dateStr, dateStr).catch(() => null),
      ]);
      if (result.success && result.data) {
        setSelectedSchedule(result.data.schedule);
      } else {
        setSelectedSchedule(null);
      }
      if (ctxResult?.success && ctxResult.data) {
        setDayContext(ctxResult.data);
      } else {
        setDayContext(null);
      }
      if (eventsResult?.success && eventsResult.data?.events) {
        setGoogleEvents(eventsResult.data.events);
      } else {
        setGoogleEvents([]);
      }
    } catch {
      setSelectedSchedule(null);
      setDayContext(null);
      setGoogleEvents([]);
    } finally {
      setIsLoadingSchedule(false);
    }
  }, []);

  const loadCalendarSchedules = useCallback(async (date: Date) => {
    try {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const result = await scheduleService.getCalendarSchedules(
        format(monthStart, "yyyy-MM-dd"),
        format(monthEnd, "yyyy-MM-dd")
      );
      if (result.success && result.data) {
        setCalendarSchedules(result.data.schedules);
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    loadSchedule(selectedDate);
    loadCalendarSchedules(selectedDate);
  }, [selectedDate, loadSchedule, loadCalendarSchedules]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCreateSchedule = async () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    try {
      const existingResult = await scheduleService.getScheduleByDate(dateStr);
      if (existingResult.success && existingResult.data?.schedule) {
        setSelectedSchedule(existingResult.data.schedule);
        return;
      }
      const result = await scheduleService.createSchedule({ schedule_date: dateStr });
      if (result.success && result.data) {
        setSelectedSchedule(result.data.schedule);
        loadCalendarSchedules(selectedDate);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof ApiError || err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("already exists")) {
        try {
          const existingResult = await scheduleService.getScheduleByDate(dateStr);
          if (existingResult.success && existingResult.data?.schedule) {
            setSelectedSchedule(existingResult.data.schedule);
          }
        } catch { /* silent */ }
      }
    }
  };

  const handleNavigateToEditor = () => {
    router.push(`/wellbeing/schedule/${format(selectedDate, "yyyy-MM-dd")}`);
  };

  // ── Activity Modal (Edit/Create) ──
  const handleEditActivity = useCallback((item: ScheduleItem) => {
    setEditingActivity(item);
    setShowActivityModal(true);
  }, []);

  const handleDeleteActivity = useCallback(async (itemId: string) => {
    if (!confirm('Delete this activity?')) return;
    try {
      await scheduleService.deleteScheduleItem(itemId);
      await loadSchedule(selectedDate);
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
  }, [selectedDate, loadSchedule]);

  const sortedItems = useMemo(() => {
    if (!selectedSchedule?.items) return [];
    return [...selectedSchedule.items].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [selectedSchedule]);

  // Group items by time-of-day
  const groupedItems = useMemo(() => {
    const groups: { label: string; icon: React.ReactNode; items: ScheduleItem[] }[] = [
      { label: "Morning", icon: <Sunrise className="w-4 h-4 text-amber-400" />, items: [] },
      { label: "Afternoon", icon: <Sun className="w-4 h-4 text-orange-400" />, items: [] },
      { label: "Evening", icon: <Sunset className="w-4 h-4 text-rose-400" />, items: [] },
      { label: "Night", icon: <Moon className="w-4 h-4 text-indigo-400" />, items: [] },
    ];

    sortedItems.forEach((item) => {
      const hour = parseInt(item.startTime.split(":")[0], 10);
      if (hour >= 5 && hour < 12) groups[0].items.push(item);
      else if (hour >= 12 && hour < 17) groups[1].items.push(item);
      else if (hour >= 17 && hour < 21) groups[2].items.push(item);
      else groups[3].items.push(item);
    });

    return groups.filter((g) => g.items.length > 0);
  }, [sortedItems]);

  return (
    <DashboardLayout activeTab="wellbeing">
      <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-[#0a0a0f]">
        {/* Top Bar */}
        <div className="shrink-0 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Row 1: Header */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/wellbeing")}
                  className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-white">Schedule</h1>
                  <p className="text-xs text-slate-500 hidden sm:block">
                    Plan your day with time-based activities
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Today Button */}
                {!isToday(selectedDate) && (
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
                  >
                    Today
                  </button>
                )}

                {/* View Toggle */}
                <div className="hidden sm:flex items-center bg-white/[0.03] rounded-lg border border-white/[0.06] p-0.5">
                  <button
                    onClick={() => setViewMode("timeline")}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === "timeline" ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>

                {/* Calendar Toggle (mobile) */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <CalendarIcon className="w-5 h-5" />
                </button>

                {/* Edit / Create */}
                <button
                  onClick={selectedSchedule ? handleNavigateToEditor : handleCreateSchedule}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20"
                >
                  {selectedSchedule ? (
                    <>
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Create</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Row 2: Day Strip */}
            <div className="pb-3">
              <DayStrip
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                scheduleDates={scheduleDates}
              />
            </div>
          </div>
        </div>

        {/* Main Content Area — 2-col grid on large, 1-col on small */}
        <div className="flex-1 overflow-y-auto" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* LEFT COLUMN — Calendar + Stats (full height) */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5 lg:sticky lg:top-6 lg:self-start"
              >
                {/* Mini Calendar Card — full height */}
                <div className="rounded-2xl border border-white/[0.06] p-6 sm:p-8 overflow-hidden min-h-[420px] flex flex-col justify-center" style={{ background: 'linear-gradient(145deg, #0f1219 0%, #0a0d14 100%)' }}>
                  <MiniCalendar
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    scheduleDates={scheduleDates}
                  />
                </div>

                {/* Stats Card */}
                {selectedSchedule && selectedSchedule.items.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'linear-gradient(145deg, #0f1219 0%, #0a0d14 100%)' }}>
                    <StatsBar items={selectedSchedule.items} />
                  </div>
                )}

                {/* Category Legend Card */}
                {selectedSchedule && selectedSchedule.items.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'linear-gradient(145deg, #0f1219 0%, #0a0d14 100%)' }}>
                    <h4 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-3">Categories</h4>
                    <div className="space-y-1">
                      {Array.from(new Set(selectedSchedule.items.map((i) => i.category).filter(Boolean))).map(
                        (cat) => {
                          const style = getCategoryStyle(cat);
                          const count = selectedSchedule.items.filter((i) => i.category === cat).length;
                          return (
                            <div key={cat} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                                  <span className="text-xs text-slate-300 capitalize">{cat}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium">{count}</span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                )}
              </motion.div>

              {/* RIGHT COLUMN — Schedule Content */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                {/* Stress Indicator Bar */}
                {dayContext && dayContext.totalItems > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 rounded-xl border border-white/[0.06] p-4"
                    style={{ background: 'linear-gradient(145deg, #0f1219 0%, #0a0d14 100%)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          dayContext.stressLevel === 'critical' ? 'bg-red-500 animate-pulse' :
                          dayContext.stressLevel === 'high' ? 'bg-orange-500' :
                          dayContext.stressLevel === 'medium' ? 'bg-amber-400' :
                          'bg-emerald-400'
                        }`} />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          {dayContext.stressLevel} stress
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {dayContext.busyHours}h busy · {dayContext.freeHours}h free
                      </span>
                    </div>
                    {/* Stress bar */}
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((dayContext.busyHours / 17) * 100, 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                          dayContext.stressLevel === 'critical' ? 'bg-gradient-to-r from-red-600 to-red-400' :
                          dayContext.stressLevel === 'high' ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
                          dayContext.stressLevel === 'medium' ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                          'bg-gradient-to-r from-emerald-600 to-emerald-400'
                        }`}
                      />
                    </div>
                    {/* AI Insight */}
                    <p className="text-[11px] text-slate-400 mt-2">
                      {dayContext.stressLevel === 'critical' || dayContext.stressLevel === 'high'
                        ? `Busy day — ${dayContext.backToBackCount} back-to-back items. Take breaks when you can.`
                        : dayContext.totalItems === 0
                        ? 'Free day! Great time for a workout or journaling.'
                        : dayContext.freeWindows.length > 0
                        ? `${dayContext.freeWindows.length} free window${dayContext.freeWindows.length > 1 ? 's' : ''} available — ${dayContext.freeWindows[0].startTime}–${dayContext.freeWindows[0].endTime} (${Math.round(dayContext.freeWindows[0].durationMinutes / 60 * 10) / 10}h)`
                        : 'Balanced day ahead.'}
                    </p>
                    {/* Special days */}
                    {dayContext.specialDays && dayContext.specialDays.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {dayContext.specialDays.map((sd) => (
                          <span key={sd.name} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20">
                            {sd.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Free Windows Quick View */}
                {dayContext && dayContext.freeWindows.length > 0 && !isLoadingSchedule && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
                  >
                    {dayContext.freeWindows.slice(0, 3).map((fw, i) => (
                      <button
                        key={i}
                        onClick={() => { setEditingActivity(null); setShowActivityModal(true); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] text-xs text-emerald-400 whitespace-nowrap flex-shrink-0 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        {fw.startTime}–{fw.endTime}
                        <span className="text-emerald-500/50">({Math.round(fw.durationMinutes / 60 * 10) / 10}h)</span>
                      </button>
                    ))}
                  </motion.div>
                )}

                <div className="rounded-2xl border border-white/[0.06] p-5 sm:p-6" style={{ background: 'linear-gradient(145deg, #0f1219 0%, #0a0d14 100%)' }}>
                  {/* Date Header + Action Buttons */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white">
                        {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE")}
                      </h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {format(selectedDate, "MMMM d, yyyy")}
                        {selectedSchedule && ` \u00B7 ${selectedSchedule.items.length} activities`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingActivity(null); setShowActivityModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Activity
                      </button>
                      {selectedSchedule && (
                        <button
                          onClick={handleNavigateToEditor}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs font-medium transition-colors border border-white/[0.08]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content */}
              <AnimatePresence mode="wait">
                {isLoadingSchedule ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center py-24"
                  >
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </motion.div>
                ) : !selectedSchedule || selectedSchedule.items.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                        <CalendarIcon className="w-6 h-6 text-slate-600" />
                      </div>
                      <h3 className="text-base font-semibold text-white mb-1">No activities scheduled</h3>
                      <p className="text-sm text-slate-500 mb-5 max-w-xs">Start planning your day by adding activities</p>
                      <button
                        onClick={() => { setEditingActivity(null); setShowActivityModal(true); }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Activity
                      </button>
                    </div>
                  </motion.div>
                ) : viewMode === "timeline" ? (
                  <motion.div
                    key="timeline"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {groupedItems.map((group) => (
                      <div key={group.label}>
                        {/* Group Header */}
                        <div className="flex items-center gap-2 mb-3">
                          {group.icon}
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            {group.label}
                          </span>
                          <div className="flex-1 h-px bg-white/[0.04]" />
                          <span className="text-[10px] text-slate-600 font-medium">
                            {group.items.length} {group.items.length === 1 ? "item" : "items"}
                          </span>
                        </div>

                        {/* Timeline Items */}
                        <div className="ml-1">
                          {group.items.map((item, idx) => (
                            <TimelineItem key={item.id} item={item} index={idx} onEdit={handleEditActivity} onDelete={handleDeleteActivity} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  /* List/Grid View */
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    {sortedItems.map((item, idx) => {
                      const style = getCategoryStyle(item.category);
                      const duration = getDuration(item.startTime, item.endTime, item.durationMinutes);
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className={`p-4 rounded-xl border ${style.border} bg-slate-800/40 hover:bg-slate-800/60 transition-all group`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {item.icon && <span className="text-base">{item.icon}</span>}
                            <h3 className="font-semibold text-white text-sm truncate flex-1">{item.title}</h3>
                            {item.category && (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${style.bg} ${style.text}`}>
                                {item.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(item.startTime)}
                              {item.endTime && ` - ${formatTime(item.endTime)}`}
                            </span>
                            {duration && (
                              <span className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {duration}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

                  {/* Google Calendar Events */}
                  {googleEvents.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Google Calendar</span>
                        <span className="text-[10px] text-slate-600">{googleEvents.length} event{googleEvents.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-2">
                        {googleEvents.map((event, idx) => {
                          const startDate = new Date(event.startTime);
                          const endDate = new Date(event.endTime);
                          const startStr = event.allDay ? 'All day' : `${String(startDate.getHours()).padStart(2,'0')}:${String(startDate.getMinutes()).padStart(2,'0')}`;
                          const endStr = event.allDay ? '' : `${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}`;
                          return (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04 }}
                              className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/[0.04] border border-blue-500/10 hover:bg-blue-500/[0.08] transition-colors"
                            >
                              <div className="w-1 h-8 rounded-full bg-blue-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">{event.title}</p>
                                <p className="text-[11px] text-slate-500">
                                  {startStr}{endStr ? ` – ${endStr}` : ''}
                                  {event.location ? ` · ${event.location}` : ''}
                                </p>
                              </div>
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20 shrink-0">
                                Google
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

            </div>{/* end grid */}
          </div>{/* end max-w container */}
        </div>{/* end overflow wrapper */}
      </div>

      {/* ── Activity Form Modal (Full Edit/Create) ── */}
      <ActivityFormModal
        isOpen={showActivityModal}
        onClose={() => { setShowActivityModal(false); setEditingActivity(null); }}
        activity={editingActivity}
        onSave={async () => {
          setShowActivityModal(false);
          setEditingActivity(null);
          await loadSchedule(selectedDate);
        }}
        scheduleId={selectedSchedule?.id}
      />
    </DashboardLayout>
  );
}

export default function SchedulePageContent() {
  return (
    <Suspense fallback={<ScheduleLoading />}>
      <ScheduleContent />
    </Suspense>
  );
}
