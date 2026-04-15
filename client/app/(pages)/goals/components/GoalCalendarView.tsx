"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface Goal {
  id: string;
  title: string;
  startDate: string;
  targetDate: string;
  durationWeeks: number;
}

interface CalendarDay {
  date: string;
  dayOfWeek: string;
  dayNumber: number;
  weekNumber: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  tracking?: {
    value: number | null;
    status: string;
  };
}

interface GoalCalendarViewProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  onDayClick: (date: string, day: CalendarDay) => void;
}

export function GoalCalendarView({
  isOpen,
  onClose,
  goal,
  onDayClick,
}: GoalCalendarViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [calendarData, setCalendarData] = useState<{
    days: CalendarDay[];
    startDate: string;
    endDate: string;
  } | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    if (isOpen && goal) {
      fetchCalendarData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, goal]);

  const fetchCalendarData = async () => {
    if (!goal) return;

    setIsLoading(true);
    try {
      const response = await api.get<{
        days: CalendarDay[];
        startDate: string;
        endDate: string;
      }>(`/assessment/goals/${goal.id}/calendar`);

      if (response.success && response.data) {
        setCalendarData(response.data);
        // Set current week to the first week with today or the current week
        const today = new Date().toISOString().split('T')[0];
        const todayDay = response.data.days.find((d) => d.date === today);
        if (todayDay) {
          setCurrentWeek(todayDay.weekNumber);
        }
      }
    } catch (err) {
      console.error("Failed to fetch calendar data:", err);
      toast.error("Failed to load calendar data");
    } finally {
      setIsLoading(false);
    }
  };

  const weeks = useMemo(() => {
    if (!calendarData) return [];
    
    const weeksMap = new Map<number, CalendarDay[]>();
    calendarData.days.forEach((day) => {
      const week = day.weekNumber;
      if (!weeksMap.has(week)) {
        weeksMap.set(week, []);
      }
      weeksMap.get(week)!.push(day);
    });

    return Array.from(weeksMap.entries())
      .map(([weekNumber, days]) => ({ weekNumber, days }))
      .sort((a, b) => a.weekNumber - b.weekNumber);
  }, [calendarData]);

  const currentWeekData = weeks.find((w) => w.weekNumber === currentWeek);
  const totalWeeks = weeks.length;

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "skipped":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getDayClassName = (day: CalendarDay) => {
    let className = "relative p-3 rounded-xl border transition-all cursor-pointer hover:scale-105 ";

    if (day.isToday) {
      className += "bg-cyan-500/20 border-cyan-500/50 ring-2 ring-cyan-500/30 ";
    } else if (day.isPast) {
      className += "bg-white/5 border-white/10 ";
    } else {
      className += "bg-white/5 border-white/10 opacity-60 ";
    }

    if (day.tracking) {
      if (day.tracking.status === "completed") {
        className += "bg-green-500/10 border-green-500/30 ";
      } else if (day.tracking.status === "skipped") {
        className += "bg-red-500/10 border-red-500/30 ";
      } else if (day.tracking.status === "pending") {
        className += "bg-yellow-500/10 border-yellow-500/30 ";
      }
    }

    return className;
  };

  if (!goal) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{goal.title}</h2>
                    <p className="text-sm text-slate-400">12-Week Calendar View</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Week Navigation */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <button
                  onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                  disabled={currentWeek === 1}
                  className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-400" />
                </button>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">Week {currentWeek} of {totalWeeks}</p>
                  <p className="text-sm text-slate-400">
                    {currentWeekData?.days[0] && new Date(currentWeekData.days[0].date).toLocaleDateString()} -{" "}
                    {currentWeekData?.days[currentWeekData.days.length - 1] &&
                      new Date(currentWeekData.days[currentWeekData.days.length - 1].date).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setCurrentWeek(Math.min(totalWeeks, currentWeek + 1))}
                  disabled={currentWeek === totalWeeks}
                  className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : currentWeekData ? (
                  <div className="space-y-4">
                    {/* Week Summary */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-400 mb-1">Week {currentWeek} Progress</p>
                          <p className="text-2xl font-bold text-white">
                            {currentWeekData.days.filter((d) => d.tracking?.status === "completed").length} /{" "}
                            {currentWeekData.days.length} days
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-400 mb-1">Completion Rate</p>
                          <p className="text-2xl font-bold text-cyan-400">
                            {Math.round(
                              (currentWeekData.days.filter((d) => d.tracking?.status === "completed").length /
                                currentWeekData.days.length) *
                                100
                            )}
                            %
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-3">
                      {/* Day Headers */}
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="text-center py-2">
                          <p className="text-xs font-medium text-slate-400">{day}</p>
                        </div>
                      ))}

                      {/* Days */}
                      {currentWeekData.days.map((day, index) => (
                        <motion.button
                          key={day.date}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.02 }}
                          onClick={() => onDayClick(day.date, day)}
                          className={getDayClassName(day)}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-sm font-semibold ${
                                  day.isToday ? "text-cyan-400" : "text-white"
                                }`}
                              >
                                {day.dayNumber}
                              </span>
                              {day.tracking && getStatusIcon(day.tracking.status)}
                            </div>
                            {day.tracking?.value !== null && day.tracking?.value !== undefined && (
                              <span className="text-xs text-slate-400">
                                {day.tracking.value}
                              </span>
                            )}
                          </div>
                          {day.isToday && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full" />
                          )}
                        </motion.button>
                      ))}
                    </div>

                    {/* Legend */}
                    <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-sm font-medium text-slate-300 mb-3">Legend</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30" />
                          <span className="text-xs text-slate-400">Completed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/30" />
                          <span className="text-xs text-slate-400">Pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/30" />
                          <span className="text-xs text-slate-400">Skipped</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-cyan-500/20 border border-cyan-500/50 ring-2 ring-cyan-500/30" />
                          <span className="text-xs text-slate-400">Today</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-400">No calendar data available</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

