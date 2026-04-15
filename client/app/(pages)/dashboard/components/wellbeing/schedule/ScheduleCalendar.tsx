/**
 * @file ScheduleCalendar Component
 * @description Calendar view with schedule indicators and date navigation
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar as Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { scheduleService, type CalendarSchedule } from "@/src/shared/services/schedule.service";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useRouter } from "next/navigation";

interface ScheduleCalendarProps {
  onDateSelect?: (date: Date) => void;
}

export function ScheduleCalendar({ onDateSelect }: ScheduleCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [schedules, setSchedules] = useState<CalendarSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadSchedules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Update when month changes
  const handleMonthChange = (date: Date) => {
    setSelectedDate(date);
  };

  const loadSchedules = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

      const result = await scheduleService.getCalendarSchedules(
        format(monthStart, "yyyy-MM-dd"),
        format(monthEnd, "yyyy-MM-dd")
      );

      if (result.success && result.data) {
        setSchedules(result.data.schedules);
      } else {
        // If it's a database error about missing tables, show a friendly message
        const errorMsg = result.error?.message || "Failed to load schedules";
        if (errorMsg.includes("does not exist") || errorMsg.includes("relation")) {
          setError("Database tables not set up. Please run the migration.");
        } else {
          setError(errorMsg);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load schedules";
      if (errorMsg.includes("does not exist") || errorMsg.includes("relation")) {
        setError("Database tables not set up. Please run the migration.");
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    setSelectedDate(date);
    if (onDateSelect) {
      onDateSelect(date);
    } else {
      // Navigate to schedule detail page
      router.push(`/wellbeing/schedule/${format(date, "yyyy-MM-dd")}`);
    }
  };

  const getScheduleForDate = (date: Date): CalendarSchedule | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.find((s) => s.date === dateStr);
  };

  const modifiers = {
    hasSchedule: (date: Date) => {
      const schedule = getScheduleForDate(date);
      return schedule?.hasSchedule || false;
    },
  };

  const modifiersClassNames = {
    hasSchedule: "bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30",
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
          <button
            onClick={loadSchedules}
            className="ml-4 text-emerald-400 hover:text-emerald-300 underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            onMonthChange={handleMonthChange}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            className="rounded-xl border border-emerald-500/20 bg-slate-900/50 backdrop-blur-xl w-full"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4 w-full",
              month_caption: "flex justify-center pt-1 relative items-center mb-4",
              caption_label: "text-lg font-semibold text-white",
              nav: "space-x-1 flex items-center",
              button_previous: "h-8 w-8 bg-slate-800/50 hover:bg-slate-700/50 p-0 opacity-70 hover:opacity-100 text-emerald-400 hover:text-emerald-300 rounded-lg transition-all absolute left-1",
              button_next: "h-8 w-8 bg-slate-800/50 hover:bg-slate-700/50 p-0 opacity-70 hover:opacity-100 text-emerald-400 hover:text-emerald-300 rounded-lg transition-all absolute right-1",
              month_grid: "w-full border-collapse",
              weekdays: "flex mb-2",
              weekday: "text-slate-400 rounded-md w-full font-medium text-xs uppercase tracking-wider text-center",
              week: "flex w-full mt-1",
              day: "h-12 w-full text-center text-sm p-0 relative rounded-lg transition-all",
              day_button: "h-12 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-emerald-500/20 rounded-lg transition-all duration-200 flex items-center justify-center",
              day_selected: "bg-gradient-to-br from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 focus:bg-emerald-600 focus:text-white shadow-lg shadow-emerald-500/30",
              day_today: "bg-emerald-500/10 text-emerald-400 font-semibold border-2 border-emerald-500/50",
              day_outside: "day-outside text-slate-500 opacity-50",
              day_disabled: "text-slate-500 opacity-30 cursor-not-allowed",
              day_hidden: "invisible",
            }}
          />

          {/* Legend */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-6 mt-6 pt-6 border-t border-emerald-500/20 text-sm"
          >
            <div className="flex items-center gap-2">
              <motion.div 
                className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-slate-400">Has schedule</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/30" />
              <span className="text-slate-400">Selected date</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500/10 border-2 border-emerald-500/50" />
              <span className="text-slate-400">Today</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

