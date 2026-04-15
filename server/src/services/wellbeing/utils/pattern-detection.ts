/**
 * @file Pattern Detection Utilities
 * @description Algorithms for detecting patterns in wellbeing data
 */

/**
 * Calculate correlation coefficient between two arrays of numbers
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    return 0;
  }

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * Detect time-of-day patterns in data
 */
export interface TimeOfDayPattern {
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  averageValue: number;
  dataPoints: number;
}

export function detectTimeOfDayPattern(
  timestamps: string[],
  values: number[]
): TimeOfDayPattern[] {
  const patterns: Map<string, { sum: number; count: number }> = new Map();

  timestamps.forEach((timestamp, index) => {
    const date = new Date(timestamp);
    const hour = date.getUTCHours();

    let period: string;
    if (hour >= 6 && hour < 12) {
      period = 'morning';
    } else if (hour >= 12 && hour < 17) {
      period = 'afternoon';
    } else if (hour >= 17 && hour < 22) {
      period = 'evening';
    } else {
      period = 'night';
    }

    const current = patterns.get(period) || { sum: 0, count: 0 };
    current.sum += values[index];
    current.count += 1;
    patterns.set(period, current);
  });

  return Array.from(patterns.entries()).map(([period, data]) => ({
    period: period as TimeOfDayPattern['period'],
    averageValue: data.sum / data.count,
    dataPoints: data.count,
  }));
}

/**
 * Calculate trend (improving, stable, declining)
 */
export function calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
  if (values.length < 2) {
    return 'stable';
  }

  // Use linear regression to determine trend
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = values;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Threshold for considering a trend significant
  const threshold = 0.1;

  if (slope > threshold) {
    return 'improving';
  } else if (slope < -threshold) {
    return 'declining';
  } else {
    return 'stable';
  }
}

/**
 * Detect streak in boolean array (e.g., habit completions)
 */
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  streakStartDate?: string;
}

export function calculateStreak(dates: string[], completed: boolean[]): StreakInfo {
  if (dates.length === 0 || completed.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Sort dates (most recent first)
  const sorted = dates
    .map((date, index) => ({ date, completed: completed[index] }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let streakStartDate: string | undefined;

  for (const item of sorted) {
    if (item.completed) {
      tempStreak++;
      if (currentStreak === 0) {
        streakStartDate = item.date;
      }
    } else {
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      tempStreak = 0;
    }
  }

  currentStreak = tempStreak;
  if (tempStreak > longestStreak) {
    longestStreak = tempStreak;
  }

  return {
    currentStreak,
    longestStreak,
    streakStartDate,
  };
}

