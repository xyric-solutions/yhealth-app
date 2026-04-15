"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Utensils,
  Calendar,
  Search,
  Loader2,
  RefreshCw,
  Edit3,
  Trash2,
  Flame,
  Beef,
  Wheat,
  Apple,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
} from "lucide-react";
import { nutritionService, type MealLog } from "@/src/shared/services";
import {
  format,
  isToday,
  isYesterday,
  parseISO,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay,
} from "date-fns";
import type { ClientMeal } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Transform helper
// ─────────────────────────────────────────────────────────────────────────────

function transformApiMealToClient(meal: MealLog): ClientMeal {
  const mealTypeToIcon: Record<string, "breakfast" | "lunch" | "dinner" | "snack"> = {
    breakfast: "breakfast",
    lunch: "lunch",
    dinner: "dinner",
    snack: "snack",
  };
  const eatenAt = new Date(meal.eatenAt);
  const hours = eatenAt.getHours().toString().padStart(2, "0");
  const minutes = eatenAt.getMinutes().toString().padStart(2, "0");
  const time = `${hours}:${minutes}`;

  return {
    id: meal.id,
    name: meal.mealName || meal.mealType,
    time,
    calories: meal.calories || 0,
    protein: meal.proteinGrams || 0,
    carbs: meal.carbsGrams || 0,
    fat: meal.fatGrams || 0,
    items: meal.foods || [],
    completed: true,
    icon: mealTypeToIcon[meal.mealType] || "snack",
    mealType: meal.mealType,
  };
}

function formatSmartDate(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d");
}

interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
}

interface MealHistoryTabProps {
  onEditMeal?: (meal: ClientMeal) => void;
  onDeleteMeal?: (mealId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function MealHistoryTab({ onEditMeal, onDeleteMeal }: MealHistoryTabProps) {
  // Default selected = yesterday
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = subDays(new Date(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Calendar month anchor — derive from selectedDate initially
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(subDays(new Date(), 1)));

  // Filter range — date pills at top (default = last 30 days)
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [searchQuery, setSearchQuery] = useState("");

  const [meals, setMeals] = useState<MealLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedMeals, setCompletedMeals] = useState<Set<string>>(new Set());

  // ───── Fetch ────────────────────────────────────────────────────────────
  // Single fetch strategy: fetch one month-wide window (or user-picked range
  // if it exceeds the month), then derive calendar summaries + selected-day
  // panel entirely client-side. No per-day fetch, no re-fetch on day click.

  const fetchRange = useMemo(() => {
    const monthStart = startOfMonth(monthAnchor);
    const monthEnd = endOfMonth(monthAnchor);
    const userStart = startOfDay(parseISO(startDate));
    const userEnd = endOfDay(parseISO(endDate));
    // Expand to whichever is wider, so the calendar always has its full month covered.
    const start = userStart < monthStart ? userStart : monthStart;
    const end = userEnd > monthEnd ? userEnd : monthEnd;
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  }, [monthAnchor, startDate, endDate]);

  const fetchMeals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await nutritionService.getMeals({
        startDate: fetchRange.start,
        endDate: fetchRange.end,
      });
      if (response.success && response.data) {
        setMeals(response.data.meals);
      }
    } catch (err) {
      console.error("Failed to fetch meal history:", err);
      setError("Failed to load meal history. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchRange.start, fetchRange.end]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  // ───── Completed meals persistence (checkbox state) ─────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("completedMeals");
    if (stored) {
      try {
        setCompletedMeals(new Set(JSON.parse(stored)));
      } catch {
        setCompletedMeals(new Set());
      }
    }
  }, []);

  useEffect(() => {
    if (meals.length > 0) {
      setCompletedMeals((_prev) => {
        const stored = localStorage.getItem("completedMeals");
        let storedIds = new Set<string>();
        if (stored) {
          try {
            storedIds = new Set(JSON.parse(stored));
          } catch {
            /* ignore */
          }
        }
        const allMealIds = new Set(meals.map((m) => m.id));
        const updated = new Set([...storedIds, ...allMealIds]);
        localStorage.setItem("completedMeals", JSON.stringify(Array.from(updated)));
        return updated;
      });
    }
  }, [meals]);

  const toggleMealCompletion = (mealId: string) => {
    setCompletedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      localStorage.setItem("completedMeals", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // ───── Derived data ─────────────────────────────────────────────────────
  const mealsByDate = useMemo(() => {
    const map = new Map<string, MealLog[]>();
    for (const meal of meals) {
      const date = format(parseISO(meal.eatenAt), "yyyy-MM-dd");
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(meal);
    }
    return map;
  }, [meals]);

  const totalsByDate = useMemo(() => {
    const map = new Map<string, DayTotals>();
    for (const [date, dateMeals] of mealsByDate.entries()) {
      map.set(
        date,
        dateMeals.reduce<DayTotals>(
          (acc, m) => ({
            calories: acc.calories + (m.calories || 0),
            protein: acc.protein + (m.proteinGrams || 0),
            carbs: acc.carbs + (m.carbsGrams || 0),
            fat: acc.fat + (m.fatGrams || 0),
            count: acc.count + 1,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 },
        ),
      );
    }
    return map;
  }, [mealsByDate]);

  // Calendar grid cells (padded to 7×N)
  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(monthAnchor);
    const monthEnd = endOfMonth(monthAnchor);
    const offset = monthStart.getDay(); // 0 = Sun
    const prevCells: Date[] = [];
    for (let i = offset; i > 0; i--) prevCells.push(subDays(monthStart, i));
    const monthCells = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const tailOffset = (7 - ((prevCells.length + monthCells.length) % 7)) % 7;
    const nextCells: Date[] = [];
    for (let i = 1; i <= tailOffset; i++) nextCells.push(new Date(monthEnd.getTime() + i * 86400000));
    return [...prevCells, ...monthCells, ...nextCells];
  }, [monthAnchor]);

  // Selected day's meals (filtered by search)
  const selectedDayMeals = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    const dayMeals = mealsByDate.get(key) || [];
    if (!searchQuery.trim()) return dayMeals;
    const q = searchQuery.toLowerCase();
    return dayMeals.filter(
      (m) =>
        m.mealName?.toLowerCase().includes(q) ||
        m.mealType.toLowerCase().includes(q) ||
        m.foods?.some((f) => f.name?.toLowerCase().includes(q)),
    );
  }, [mealsByDate, selectedDate, searchQuery]);

  // ───── Rendering ────────────────────────────────────────────────────────

  const handleToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
    setMonthAnchor(startOfMonth(today));
  };

  const dayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-[16px] sm:text-[18px] font-bold text-white tracking-tight">Meal History</h2>
          <p className="text-slate-400 text-[12px] sm:text-[13px] mt-0.5">View and manage your nutrition meal logs</p>
        </div>
      </div>

      {/* Filters — date range + search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Start Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">End Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={format(new Date(), "yyyy-MM-dd")}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by meal, type, or food..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-slate-500 text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Month nav bar */}
      <div className="rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
        <button
          onClick={handleToday}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[12px] font-semibold hover:bg-white/[0.08] transition-all"
        >
          Today
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonthAnchor((d) => subMonths(d, 1))}
            className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition-all"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-white font-bold text-[15px] sm:text-[16px] tracking-tight min-w-[140px] text-center">
            {format(monthAnchor, "MMMM yyyy")}
          </h3>
          <button
            onClick={() => setMonthAnchor((d) => addMonths(d, 1))}
            className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition-all"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={fetchMeals}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white transition-all text-[12px] font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-2">
          <X className="w-4 h-4 text-red-400" />
          <p className="text-red-300 text-[13px]">{error}</p>
          <button
            onClick={fetchMeals}
            className="ml-auto px-2.5 py-1 rounded-lg bg-red-500/20 text-red-200 text-[12px] font-semibold hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main grid: calendar (left, 2/3) + day panel (right, 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* ─── Calendar ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-4 sm:p-5"
        >
          {/* Weekday header */}
          <div className="grid grid-cols-7 mb-2">
            {dayLabels.map((d) => (
              <div key={d} className="text-center text-[10px] uppercase tracking-wider font-semibold text-slate-500 pb-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarCells.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const totals = totalsByDate.get(dayKey);
              const isCurrentMonth = isSameMonth(day, monthAnchor);
              const isSelected = isSameDay(day, selectedDate);
              const isTodayCell = isToday(day);
              const hasData = !!totals;

              return (
                <button
                  key={dayKey}
                  onClick={() => setSelectedDate(day)}
                  className={`relative flex flex-col items-stretch gap-1 min-h-[64px] sm:min-h-[72px] rounded-xl border p-1.5 sm:p-2 text-left transition-all ${
                    isSelected
                      ? "border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-500/10"
                      : isCurrentMonth
                      ? "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]"
                      : "border-transparent bg-transparent opacity-40 hover:opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] sm:text-[12px] font-bold ${
                        isSelected
                          ? "text-emerald-200"
                          : isTodayCell
                          ? "text-emerald-300"
                          : isCurrentMonth
                          ? "text-white"
                          : "text-slate-600"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {isTodayCell && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                    )}
                  </div>
                  {hasData && isCurrentMonth && (
                    <div className="mt-auto flex flex-wrap items-center gap-0.5 sm:gap-1">
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-orange-500/10 text-orange-500 text-[10px] font-semibold">
                        <Flame className="w-2.5 h-2.5" />{Math.round(totals.calories)}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-red-500/10 text-red-500 text-[10px] font-semibold">
                        <Beef className="w-2.5 h-2.5" />{Math.round(totals.protein)}g
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-semibold">
                        <Wheat className="w-2.5 h-2.5" />{Math.round(totals.carbs)}g
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-purple-500/10 text-purple-500 text-[10px] font-semibold">
                        <Apple className="w-2.5 h-2.5" />{Math.round(totals.fat)}g
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {isLoading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-slate-400 text-[12px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading meals...
            </div>
          )}
        </motion.div>

        {/* ─── Selected-day History Panel ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-4 sm:p-5 flex flex-col"
        >
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/[0.06]">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">History</p>
              <h3 className="text-white font-bold text-[15px] tracking-tight truncate">{formatSmartDate(selectedDate)}</h3>
            </div>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
              {selectedDayMeals.length}
            </span>
          </div>

          {selectedDayMeals.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-3">
                <Utensils className="w-5 h-5 text-emerald-300/70" />
              </div>
              <p className="text-[13px] font-semibold text-white mb-1">No meals logged</p>
              <p className="text-[11px] text-slate-500 max-w-[200px]">
                {searchQuery ? "No meals match your search on this date" : "Pick another date or log a meal to see it here"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto scrollbar-hide">
              {selectedDayMeals
                .slice()
                .sort((a, b) => new Date(a.eatenAt).getTime() - new Date(b.eatenAt).getTime())
                .map((meal) => {
                  const clientMeal = transformApiMealToClient(meal);
                  const isConsumed = completedMeals.has(meal.id);
                  return (
                    <motion.div
                      key={meal.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`group flex items-start gap-2.5 p-2.5 rounded-xl border transition-all ${
                        isConsumed
                          ? "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
                          : "bg-white/[0.01] border-white/[0.04] opacity-60 hover:opacity-80"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isConsumed}
                        onChange={() => toggleMealCompletion(meal.id)}
                        className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-800 accent-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-0 cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className={`text-[12px] font-semibold truncate ${isConsumed ? "text-white" : "text-slate-400 line-through"}`}>
                            {meal.mealName || meal.mealType}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-200 text-[10px]">
                            <Flame className="w-2.5 h-2.5" />
                            {meal.calories || 0}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-200 text-[10px]">
                            <Beef className="w-2.5 h-2.5" />
                            {Math.round(meal.proteinGrams || 0)}g
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-200 text-[10px]">
                            <Wheat className="w-2.5 h-2.5" />
                            {Math.round(meal.carbsGrams || 0)}g
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-200 text-[10px]">
                            <Apple className="w-2.5 h-2.5" />
                            {Math.round(meal.fatGrams || 0)}g
                          </span>
                        </div>
                      </div>
                      {(onEditMeal || onDeleteMeal) && (
                        <div className="flex items-center gap-1 shrink-0">
                          {onEditMeal && (
                            <button
                              onClick={() => onEditMeal(clientMeal)}
                              className="p-1 rounded-md bg-white/[0.04] text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/15 transition-colors"
                              title="Edit meal"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                          {onDeleteMeal && (
                            <button
                              onClick={() => onDeleteMeal(meal.id)}
                              className="p-1 rounded-md bg-white/[0.04] text-slate-400 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                              title="Delete meal"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
            </div>
          )}

          {/* Day total summary chips (only if any meals) */}
          {selectedDayMeals.length > 0 && (() => {
            const totals = selectedDayMeals.reduce(
              (acc, m) => ({
                calories: acc.calories + (m.calories || 0),
                protein: acc.protein + (m.proteinGrams || 0),
                carbs: acc.carbs + (m.carbsGrams || 0),
                fat: acc.fat + (m.fatGrams || 0),
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 },
            );
            return (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Day Total</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-200 text-[11px]">
                    <Flame className="w-2.5 h-2.5" />
                    {Math.round(totals.calories)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-200 text-[11px]">
                    <Beef className="w-2.5 h-2.5" />
                    {Math.round(totals.protein)}g
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-200 text-[11px]">
                    <Wheat className="w-2.5 h-2.5" />
                    {Math.round(totals.carbs)}g
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-200 text-[11px]">
                    <Apple className="w-2.5 h-2.5" />
                    {Math.round(totals.fat)}g
                  </span>
                </div>
              </div>
            );
          })()}
        </motion.div>
      </div>
    </div>
  );
}
