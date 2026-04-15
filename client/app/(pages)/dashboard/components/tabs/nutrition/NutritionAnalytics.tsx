"use client";

import { useState, useEffect, useCallback } from "react";
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
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Calendar,
  Loader2,
  LineChart as LineChartIcon,
  BarChart2,
  Layers,
  Flame,
  Beef,
  Wheat,
  Apple,
} from "lucide-react";
import { nutritionService, type MealLog } from "@/src/shared/services";

interface DailyNutritionData {
  date: string;           // YYYY-MM-DD
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsCount: number;
}

interface NutritionAnalyticsData {
  dailyData: DailyNutritionData[];
  totals: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    averageCalories: number;
    averageProtein: number;
    averageCarbs: number;
    averageFat: number;
  };
}

type ChartMode = 'line' | 'bar' | 'area';

export function NutritionAnalytics() {
  const [data, setData] = useState<NutritionAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [chartMode, setChartMode] = useState<ChartMode>('line');
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Fetch meals for the date range
      const response = await nutritionService.getMeals({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      if (!response.success || !response.data?.meals) {
        setError('Failed to fetch nutrition data');
        setIsLoading(false);
        return;
      }

      const meals: MealLog[] = response.data.meals;

      // Group meals by date
      const mealsByDate = new Map<string, MealLog[]>();
      meals.forEach((meal) => {
        const mealDate = new Date(meal.eatenAt);
        const dateKey = mealDate.toISOString().split('T')[0];
        if (!mealsByDate.has(dateKey)) {
          mealsByDate.set(dateKey, []);
        }
        mealsByDate.get(dateKey)!.push(meal);
      });

      // Process daily data
      const dailyData: DailyNutritionData[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayMeals = mealsByDate.get(dateKey) || [];
        
        const dayTotals = dayMeals.reduce(
          (acc, meal) => ({
            calories: acc.calories + (meal.calories || 0),
            protein: acc.protein + (meal.proteinGrams || 0),
            carbs: acc.carbs + (meal.carbsGrams || 0),
            fat: acc.fat + (meal.fatGrams || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        dailyData.push({
          date: dateKey,
          calories: Math.round(dayTotals.calories),
          protein: Math.round(dayTotals.protein),
          carbs: Math.round(dayTotals.carbs),
          fat: Math.round(dayTotals.fat),
          mealsCount: dayMeals.length,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate totals and averages
      const totals = dailyData.reduce(
        (acc, day) => ({
          totalCalories: acc.totalCalories + day.calories,
          totalProtein: acc.totalProtein + day.protein,
          totalCarbs: acc.totalCarbs + day.carbs,
          totalFat: acc.totalFat + day.fat,
        }),
        { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
      );

      const daysWithData = dailyData.filter(d => d.mealsCount > 0).length || 1;
      const totalsData: NutritionAnalyticsData['totals'] = {
        ...totals,
        averageCalories: Math.round(totals.totalCalories / daysWithData),
        averageProtein: Math.round(totals.totalProtein / daysWithData),
        averageCarbs: Math.round(totals.totalCarbs / daysWithData),
        averageFat: Math.round(totals.totalFat / daysWithData),
      };

      setData({
        dailyData,
        totals: totalsData,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(errorMessage);
      console.error('[NutritionAnalytics] Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const ChartComponent = ({ mode }: { mode: ChartMode }) => {
    if (!data) return null;

    const chartData = data.dailyData.map(day => ({
      ...day,
      dateLabel: formatDate(day.date),
    }));

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (mode) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="dateLabel" 
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="calories" 
              stroke="#F97316" 
              strokeWidth={2}
              name="Calories"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="protein" 
              stroke="#EF4444" 
              strokeWidth={2}
              name="Protein (g)"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="carbs" 
              stroke="#F59E0B" 
              strokeWidth={2}
              name="Carbs (g)"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="fat" 
              stroke="#A855F7" 
              strokeWidth={2}
              name="Fat (g)"
              dot={{ r: 3 }}
            />
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="dateLabel" 
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar dataKey="calories" fill="#F97316" name="Calories" />
            <Bar dataKey="protein" fill="#EF4444" name="Protein (g)" />
            <Bar dataKey="carbs" fill="#F59E0B" name="Carbs (g)" />
            <Bar dataKey="fat" fill="#A855F7" name="Fat (g)" />
          </BarChart>
        );
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="dateLabel" 
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="calories" 
              stackId="1"
              stroke="#F97316" 
              fill="#F97316" 
              fillOpacity={0.6}
              name="Calories"
            />
            <Area 
              type="monotone" 
              dataKey="protein" 
              stackId="2"
              stroke="#EF4444" 
              fill="#EF4444" 
              fillOpacity={0.6}
              name="Protein (g)"
            />
            <Area 
              type="monotone" 
              dataKey="carbs" 
              stackId="3"
              stroke="#F59E0B" 
              fill="#F59E0B" 
              fillOpacity={0.6}
              name="Carbs (g)"
            />
            <Area 
              type="monotone" 
              dataKey="fat" 
              stackId="4"
              stroke="#A855F7" 
              fill="#A855F7" 
              fillOpacity={0.6}
              name="Fat (g)"
            />
          </AreaChart>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-4 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.dailyData.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-8 text-center">
        <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h4 className="text-white font-medium mb-2">No nutrition data available</h4>
        <p className="text-slate-400 text-sm">Start logging meals to see your nutrition analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h3 className="text-[16px] sm:text-[18px] font-bold text-white tracking-tight">Nutrition Analytics</h3>
          <p className="text-[11px] sm:text-[12px] text-slate-400 mt-0.5">Trends & performance across your meal log</p>
        </div>
        <div className="flex gap-1 w-full sm:w-auto bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {(['7d', '30d', '90d', '1y'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-semibold transition-all ${
                timeRange === range
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Flame, label: "Avg Calories", value: data.totals.averageCalories, unit: "kcal/day", accent: "orange", color: "text-orange-300" },
          { icon: Beef, label: "Avg Protein", value: `${data.totals.averageProtein}g`, unit: "per day", accent: "red", color: "text-red-300" },
          { icon: Wheat, label: "Avg Carbs", value: `${data.totals.averageCarbs}g`, unit: "per day", accent: "amber", color: "text-amber-300" },
          { icon: Apple, label: "Avg Fat", value: `${data.totals.averageFat}g`, unit: "per day", accent: "purple", color: "text-purple-300" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          const bgMap: Record<string, string> = {
            orange: "bg-orange-500/10 border-orange-500/20",
            red: "bg-red-500/10 border-red-500/20",
            amber: "bg-amber-500/10 border-amber-500/20",
            purple: "bg-purple-500/10 border-purple-500/20",
          };
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-4 sm:p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${bgMap[stat.accent]}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className={`text-lg sm:text-2xl font-bold tracking-tight ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{stat.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{stat.unit}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-4 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[14px] sm:text-[15px] text-white font-semibold flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
              <LineChartIcon className="w-3.5 h-3.5 text-emerald-300" />
            </span>
            Daily Nutrition Trends
          </h4>
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
            {([
              { mode: 'line' as const, Icon: LineChartIcon, title: "Line Chart" },
              { mode: 'bar' as const, Icon: BarChart2, title: "Bar Chart" },
              { mode: 'area' as const, Icon: Layers, title: "Area Chart" },
            ]).map(({ mode, Icon, title }) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`p-1.5 rounded transition-all ${
                  chartMode === mode
                    ? 'bg-emerald-600 text-white shadow shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title={title}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320} className="sm:!h-[440px]">
          <ChartComponent mode={chartMode} />
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}

