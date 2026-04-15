"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
} from "lucide-react";
import {
  CalendarDay,
  DayWorkout,
} from "./types";
import { CircularProgress, MiniCircularProgress, DonutChart } from "./CircularProgress";

interface WorkoutCalendarProps {
  startDate: string;
  endDate?: string;
  durationWeeks: number;
  weeks?: Record<string, { days: Record<string, DayWorkout | null> }>;
  weeklySchedule?: Record<string, DayWorkout | null>;
  completedDates?: Set<string>;
  dailyProgress?: Record<string, number>;
  onDayClick?: (date: string, workout?: DayWorkout) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function WorkoutCalendar({
  startDate,
  endDate,
  durationWeeks,
  weeks,
  weeklySchedule,
  completedDates = new Set(),
  dailyProgress = {},
  onDayClick,
}: WorkoutCalendarProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const planStart = new Date(startDate);
    const planEnd = endDate ? new Date(endDate) : null;

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    for (let i = 0; i < startDayOfWeek; i++) {
      const paddingDate = new Date(currentYear, currentMonth, -startDayOfWeek + i + 1);
      days.push(createCalendarDay(paddingDate, planStart, planEnd, true));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      days.push(createCalendarDay(date, planStart, planEnd, false));
    }

    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const paddingDate = new Date(currentYear, currentMonth + 1, i);
      days.push(createCalendarDay(paddingDate, planStart, planEnd, true));
    }

    return days;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear, startDate, endDate]);

  function createCalendarDay(
    date: Date,
    planStart: Date,
    planEnd: Date | null,
    isPadding: boolean
  ): CalendarDay {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()];

    const dateNormalized = new Date(year, month, day);
    const planStartNormalized = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate());
    const daysSinceStart = Math.floor((dateNormalized.getTime() - planStartNormalized.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysSinceStart / 7) + 1;

    const isWithinPlan = dateNormalized >= planStartNormalized && (!planEnd || dateNormalized <= new Date(planEnd.getFullYear(), planEnd.getMonth(), planEnd.getDate())) && weekNumber <= durationWeeks && weekNumber > 0;

    let workout: DayWorkout | undefined;
    let isRestDay = true;

    if (isWithinPlan && !isPadding) {
      if (weeks && weeks[`week_${weekNumber}`]) {
        const weekPlan = weeks[`week_${weekNumber}`];
        const dayWorkout = weekPlan.days?.[dayOfWeek];
        if (dayWorkout) {
          workout = dayWorkout;
          isRestDay = false;
        }
      } else if (weeklySchedule && weeklySchedule[dayOfWeek]) {
        workout = weeklySchedule[dayOfWeek] || undefined;
        isRestDay = !workout;
      }
    }

    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;
    const isFuture = dateStr > todayStr;

    const progressFromDaily = dailyProgress[dateStr];
    const isCompleted = !isRestDay && (
      completedDates.has(dateStr) ||
      (progressFromDaily !== undefined && progressFromDaily >= 100)
    );

    return {
      date: dateStr,
      dayOfWeek,
      weekNumber: isWithinPlan ? weekNumber : 0,
      workout,
      isRestDay: isWithinPlan ? isRestDay : true,
      isCompleted,
      isPast,
      isToday,
      isFuture,
    };
  }

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const getProgress = (dateStr: string, isCompleted: boolean, workout?: DayWorkout) => {
    if (dailyProgress[dateStr] !== undefined) {
      return dailyProgress[dateStr];
    }
    if (isCompleted) return 100;
    if (!workout) return 0;
    return 0;
  };

  // Calculate month stats including category breakdowns for donut chart
  const monthStats = useMemo(() => {
    const inPlanDays = calendarDays.filter(d => d.weekNumber > 0 && new Date(d.date).getMonth() === currentMonth);
    const workoutDays = inPlanDays.filter(d => d.workout);
    const restDays = inPlanDays.filter(d => d.isRestDay);

    const completedWorkouts = workoutDays.filter(d => {
      if (d.isCompleted) return true;
      const progress = dailyProgress[d.date];
      return progress !== undefined && progress >= 100;
    }).length;

    const inProgressWorkouts = workoutDays.filter(d => {
      if (d.isCompleted) return false;
      const progress = dailyProgress[d.date];
      return progress !== undefined && progress > 0 && progress < 100;
    }).length;

    const notStartedWorkouts = workoutDays.filter(d => {
      if (d.isCompleted) return false;
      const progress = dailyProgress[d.date];
      return progress === undefined || progress === 0;
    }).length;

    const totalWorkouts = workoutDays.length;
    const totalDays = inPlanDays.length;
    const percentage = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;

    // Donut chart percentages (of total plan days)
    const completedPct = totalDays > 0 ? (completedWorkouts / totalDays) * 100 : 0;
    const inProgressPct = totalDays > 0 ? (inProgressWorkouts / totalDays) * 100 : 0;
    const notStartedPct = totalDays > 0 ? (notStartedWorkouts / totalDays) * 100 : 0;
    const restPct = totalDays > 0 ? (restDays.length / totalDays) * 100 : 0;

    return {
      completedWorkouts,
      inProgressWorkouts,
      notStartedWorkouts,
      restDays: restDays.length,
      totalWorkouts,
      percentage,
      completedPct,
      inProgressPct,
      notStartedPct,
      restPct,
    };
  }, [calendarDays, dailyProgress, currentMonth]);

  // Satisfaction label based on completion
  const satisfactionLabel = useMemo(() => {
    if (monthStats.percentage >= 80) return "Excellent";
    if (monthStats.percentage >= 60) return "Great";
    if (monthStats.percentage >= 40) return "Satisfied";
    if (monthStats.percentage >= 20) return "Getting There";
    return "Just Started";
  }, [monthStats.percentage]);

  const handleDayClick = (day: CalendarDay) => {
    onDayClick?.(day.date, day.workout);
  };

  const donutSegments = [
    { percentage: monthStats.completedPct, color: "#22c55e", label: "Completed (100%)" },
    { percentage: monthStats.inProgressPct, color: "#06b6d4", label: "In Progress" },
    { percentage: monthStats.notStartedPct, color: "#ef4444", label: "Not Started" },
    { percentage: monthStats.restPct, color: "#64748b", label: "Rest Day" },
  ];

  const donutDisplayPcts = [
    { pct: `${Math.round(monthStats.completedPct)}%`, color: "#22c55e", label: "Completed (100%)" },
    { pct: `${Math.round(monthStats.inProgressPct)}%`, color: "#06b6d4", label: "In Progress" },
    { pct: `${Math.round(monthStats.notStartedPct)}%`, color: "#ef4444", label: "Not Started" },
    { pct: `${Math.round(monthStats.restPct)}%`, color: "#64748b", label: "Rest Day" },
  ];

  return (
    <div className="space-y-4">
      {/* Month Header Bar */}
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-slate-700/50 px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          {/* Today Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={goToToday}
            className="px-4 py-1.5 text-sm font-medium text-teal-400 bg-teal-500/10 rounded-full border border-teal-500/30 hover:bg-teal-500/20 transition-colors whitespace-nowrap"
          >
            Today
          </motion.button>

          {/* Navigation + Title */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={goToPreviousMonth}
              className="w-8 h-8 rounded-full bg-teal-500/15 text-teal-400 flex items-center justify-center hover:bg-teal-500/25 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>

            <div className="text-center min-w-[160px]">
              <h2 className="text-xl font-bold text-white">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <p className="text-sm text-slate-400">
                {monthStats.completedWorkouts} of {monthStats.totalWorkouts} workouts completed
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={goToNextMonth}
              className="w-8 h-8 rounded-full bg-teal-500/15 text-teal-400 flex items-center justify-center hover:bg-teal-500/25 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Progress Ring */}
          <div className="hidden sm:block">
            <CircularProgress
              percentage={monthStats.percentage}
              size={60}
              strokeWidth={6}
              labelSize="sm"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Calendar Grid */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-3 sm:p-5 backdrop-blur-xl">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
            {WEEKDAY_LABELS.map((day) => (
              <div
                key={day}
                className="text-center text-[10px] sm:text-xs font-semibold text-slate-500 py-2 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarDays.map((day, index) => {
              const isCurrentMonth = new Date(day.date).getMonth() === currentMonth;
              const hasWorkout = !!day.workout && isCurrentMonth;
              const progress = getProgress(day.date, day.isCompleted, day.workout);
              const isInProgress = progress > 0 && progress < 100;

              return (
                <button
                  key={`${day.date}-${index}`}
                  onClick={() => handleDayClick(day)}
                  disabled={!isCurrentMonth || day.weekNumber === 0}
                  className={`
                    relative rounded-xl p-1.5 sm:p-2 transition-all flex flex-col items-start justify-between
                    min-h-[52px] sm:min-h-[68px]
                    ${!isCurrentMonth ? "opacity-15" : ""}
                    ${day.isToday && hasWorkout
                      ? "bg-teal-700/50 border border-teal-500/40 ring-1 ring-teal-500/30"
                      : day.isToday
                        ? "bg-teal-800/40 border border-teal-500/30 ring-1 ring-teal-500/30"
                        : hasWorkout
                          ? "bg-teal-900/40 border border-teal-800/30"
                          : day.isRestDay && day.weekNumber > 0 && isCurrentMonth
                            ? "bg-slate-800/30 border border-transparent"
                            : "bg-slate-800/20 border border-transparent"
                    }
                    ${isCurrentMonth && day.weekNumber > 0 ? "hover:brightness-125 cursor-pointer" : "cursor-default"}
                  `}
                >
                  {/* Day Number */}
                  <span
                    className={`
                      text-xs sm:text-sm font-semibold leading-none
                      ${day.isToday ? "text-teal-400" : isCurrentMonth ? "text-white" : "text-slate-600"}
                    `}
                  >
                    {new Date(day.date).getDate()}
                  </span>

                  {/* Bottom row: workout icon + mood indicator */}
                  {hasWorkout && isCurrentMonth && (
                    <div className="flex items-end justify-between w-full mt-auto">
                      {/* Workout icon */}
                      <Dumbbell className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />

                      {/* Mini circular progress */}
                      <MiniCircularProgress percentage={progress} size={27} />
                    </div>
                  )}

                  {/* Rest day: small icon */}
                  {day.isRestDay && day.weekNumber > 0 && isCurrentMonth && !day.workout && (
                    <div className="flex items-end justify-start w-full mt-auto">
                      <Dumbbell className="w-3 h-3 text-slate-600 opacity-40" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Legend Card */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4 sm:p-5 backdrop-blur-xl">
            <h4 className="text-sm font-semibold text-white mb-4">Legend</h4>

            {/* Donut Chart */}
            <div className="flex justify-center mb-5">
              <DonutChart
                segments={donutSegments}
                size={140}
                strokeWidth={14}
                centerLabel={satisfactionLabel}
                centerSubLabel="Progress"
              />
            </div>

            {/* Color Legend List */}
            <div className="space-y-2.5">
              {donutDisplayPcts.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-400">{item.label}</span>
                  </div>
                  <span className="text-slate-300 font-medium">{item.pct}</span>
                </div>
              ))}
            </div>
          </div>

          {/* This Month Card */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4 sm:p-5 backdrop-blur-xl">
            <h4 className="text-sm font-semibold text-white mb-3">This Month</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 sm:p-4 bg-teal-900/40 rounded-xl border border-teal-800/20">
                <p className="text-2xl sm:text-3xl font-bold text-teal-400">{monthStats.completedWorkouts}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Completed</p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-slate-700/30 rounded-xl border border-slate-600/20">
                <p className="text-2xl sm:text-3xl font-bold text-white">{monthStats.totalWorkouts - monthStats.completedWorkouts}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Remaining</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkoutCalendar;
