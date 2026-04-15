/**
 * @file Progress Calculation Utilities
 * @description Utility functions for calculating progress metrics, trends, and analytics
 */

import { format, parseISO, subDays, startOfWeek } from 'date-fns';

export interface WeightRecord {
  date: string;
  weightKg: number;
}

export interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  averageWeight: number;
  workouts: number;
  streak: number;
}

export interface MonthlyData {
  month: string;
  year: number;
  averageWeight: number;
  workouts: number;
  totalDays: number;
  loggedDays: number;
}

/**
 * Calculate BMI from weight and height
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * Get BMI category
 */
export function getBMICategory(bmi: number): {
  category: 'Underweight' | 'Normal' | 'Overweight' | 'Obese';
  color: string;
} {
  if (bmi < 18.5) return { category: 'Underweight', color: 'text-blue-400' };
  if (bmi < 25) return { category: 'Normal', color: 'text-emerald-400' };
  if (bmi < 30) return { category: 'Overweight', color: 'text-orange-400' };
  return { category: 'Obese', color: 'text-red-400' };
}

/**
 * Filter data by date range
 */
export function filterByDateRange<T extends { date: string }>(
  data: T[],
  days: number | null
): T[] {
  if (!days) return data;
  
  const cutoffDate = subDays(new Date(), days);
  return data.filter((item) => {
    const itemDate = parseISO(item.date);
    return itemDate >= cutoffDate;
  });
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(
  data: WeightRecord[],
  windowSize: number = 7
): Array<{ date: string; average: number }> {
  if (data.length === 0) return [];
  
  const sorted = [...data].sort((a, b) => 
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
  
  const result: Array<{ date: string; average: number }> = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(sorted.length, i + Math.ceil(windowSize / 2));
    const window = sorted.slice(start, end);
    
    const average = window.reduce((sum, item) => sum + item.weightKg, 0) / window.length;
    result.push({
      date: sorted[i].date,
      average: Math.round(average * 10) / 10,
    });
  }
  
  return result;
}

/**
 * Group weight data by week
 */
export function groupByWeek(data: WeightRecord[]): WeeklyData[] {
  if (data.length === 0) return [];
  
  try {
    const sorted = [...data].sort((a, b) => 
      parseISO(a.date).getTime() - parseISO(b.date).getTime()
    );
    
    const weeks = new Map<string, { weights: number[]; weekStart: Date; weekEnd: Date }>();
    
    sorted.forEach((item) => {
      try {
        const date = parseISO(item.date);
        const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        if (!weeks.has(weekKey)) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          weeks.set(weekKey, {
            weights: [],
            weekStart,
            weekEnd,
          });
        }
        
        weeks.get(weekKey)!.weights.push(item.weightKg);
      } catch (err) {
        console.warn('[groupByWeek] Error processing item:', item, err);
      }
    });
    
    if (weeks.size === 0) return [];
    
    return Array.from(weeks.entries()).map(([, weekData]) => {
      if (weekData.weights.length === 0) return null;
      return {
        weekStart: format(weekData.weekStart, 'yyyy-MM-dd'),
        weekEnd: format(weekData.weekEnd, 'yyyy-MM-dd'),
        averageWeight: weekData.weights.reduce((sum, w) => sum + w, 0) / weekData.weights.length,
        workouts: 0, // Will be filled from workouts data
        streak: 0, // Will be filled from streak data
      };
    }).filter((week): week is WeeklyData => week !== null);
  } catch (error) {
    console.error('[groupByWeek] Error grouping data:', error);
    return [];
  }
}

/**
 * Group weight data by month
 */
export function groupByMonth(data: WeightRecord[]): MonthlyData[] {
  if (data.length === 0) return [];
  
  const sorted = [...data].sort((a, b) => 
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
  
  const months = new Map<string, { weights: number[]; month: number; year: number; dates: Set<string> }>();
  
  sorted.forEach((item) => {
    const date = parseISO(item.date);
    const monthKey = format(date, 'yyyy-MM');
    
    if (!months.has(monthKey)) {
      months.set(monthKey, {
        weights: [],
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        dates: new Set(),
      });
    }
    
    const monthData = months.get(monthKey)!;
    monthData.weights.push(item.weightKg);
    monthData.dates.add(item.date);
  });
  
  return Array.from(months.entries()).map(([, monthData]) => {
    const firstDay = new Date(monthData.year, monthData.month - 1, 1);
    const lastDay = new Date(monthData.year, monthData.month, 0);
    const totalDays = lastDay.getDate();
    
    return {
      month: format(firstDay, 'MMMM'),
      year: monthData.year,
      averageWeight: monthData.weights.reduce((sum, w) => sum + w, 0) / monthData.weights.length,
      workouts: 0, // Will be filled from workouts data
      totalDays,
      loggedDays: monthData.dates.size,
    };
  });
}

/**
 * Calculate average weekly change
 */
export function calculateWeeklyChange(data: WeightRecord[]): number | null {
  if (data.length < 2) return null;
  
  const sorted = [...data].sort((a, b) => 
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
  
  const weeks = groupByWeek(sorted);
  if (weeks.length < 2) return null;
  
  const changes: number[] = [];
  for (let i = 1; i < weeks.length; i++) {
    changes.push(weeks[i].averageWeight - weeks[i - 1].averageWeight);
  }
  
  return changes.reduce((sum, change) => sum + change, 0) / changes.length;
}

/**
 * Calculate consistency score (days logged per week)
 */
export function calculateConsistencyScore(data: WeightRecord[], weeks: number = 4): number {
  const recent = filterByDateRange(data, weeks * 7);
  const uniqueDates = new Set(recent.map((item) => item.date));
  const daysLogged = uniqueDates.size;
  const totalDays = weeks * 7;
  
  return Math.round((daysLogged / totalDays) * 100);
}

/**
 * Project goal achievement date
 */
export function projectGoalDate(
  currentWeight: number,
  targetWeight: number,
  weeklyChange: number
): Date | null {
  if (!weeklyChange || weeklyChange === 0) return null;
  
  const weightDifference = targetWeight - currentWeight;
  const weeksNeeded = Math.abs(weightDifference / weeklyChange);
  const daysNeeded = Math.ceil(weeksNeeded * 7);
  
  return new Date(Date.now() + daysNeeded * 24 * 60 * 60 * 1000);
}

/**
 * Calculate percentage of goal achieved
 */
export function calculateGoalProgress(
  currentValue: number,
  startingValue: number,
  targetValue: number
): number {
  if (!targetValue || targetValue === startingValue) return 0;
  
  const totalChange = targetValue - startingValue;
  const currentChange = currentValue - startingValue;
  
  const percentage = (currentChange / totalChange) * 100;
  return Math.max(0, Math.min(100, Math.round(percentage * 10) / 10));
}

/**
 * Format date for display
 */
export function formatDateForDisplay(date: string, formatType: 'short' | 'long' = 'short'): string {
  const parsed = parseISO(date);
  if (formatType === 'short') {
    return format(parsed, 'MMM d');
  }
  return format(parsed, 'MMM d, yyyy');
}

/**
 * Get time period label
 */
export function getTimePeriodLabel(days: number | null): string {
  if (!days) return 'All Time';
  if (days === 7) return 'Last 7 Days';
  if (days === 30) return 'Last 30 Days';
  if (days === 90) return 'Last 90 Days';
  if (days === 180) return 'Last 6 Months';
  if (days === 365) return 'Last Year';
  return `${days} Days`;
}

