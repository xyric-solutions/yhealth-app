/**
 * Emotion Analytics Chart Utilities
 * Reusable utilities for processing emotion data for charting
 */

import { format, parseISO, startOfDay, eachDayOfInterval, subDays } from "date-fns";
import type { EmotionLog, EmotionCategory } from "@/src/shared/services/emotion.service";
import { getEmotionColor, getEmotionEmoji, getEmotionLabel } from "@/src/shared/services/emotion.service";

export interface EmotionChartDataPoint {
  date: string;
  dateFormatted: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  dominantEmotion: EmotionCategory | null;
  confidenceAvg: number;
  emotionCounts: Record<EmotionCategory, number>;
}

export interface EmotionDistributionData {
  category: EmotionCategory;
  count: number;
  percentage: number;
  color: string;
  emoji: string;
}

/**
 * Classify emotion sentiment for aggregation
 */
function getEmotionSentiment(category: EmotionCategory): 'positive' | 'negative' | 'neutral' {
  const positive: EmotionCategory[] = ['happy', 'calm', 'excited'];
  const negative: EmotionCategory[] = ['sad', 'angry', 'anxious', 'stressed', 'distressed'];
  
  if (positive.includes(category)) return 'positive';
  if (negative.includes(category)) return 'negative';
  return 'neutral';
}

/**
 * Get dominant emotion from counts
 */
function getDominantEmotion(
  emotionCounts: Record<EmotionCategory, number>
): EmotionCategory | null {
  const entries = Object.entries(emotionCounts) as [EmotionCategory, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 && sorted[0][1] > 0 ? sorted[0][0] : null;
}

/**
 * Prepare chart data from emotion logs (daily aggregation)
 */
export function prepareEmotionChartData(
  logs: EmotionLog[],
  days: number = 14
): EmotionChartDataPoint[] {
  if (!logs || logs.length === 0) return [];

  try {
    const today = startOfDay(new Date());
    const startDate = subDays(today, days - 1);
    const dateRange = eachDayOfInterval({ start: startDate, end: today });

    // Group logs by date
    const logsByDate = new Map<string, EmotionLog[]>();
    
    logs.forEach((log) => {
      try {
        const logDate = startOfDay(parseISO(log.timestamp));
        const dateKey = format(logDate, 'yyyy-MM-dd');
        
        if (!logsByDate.has(dateKey)) {
          logsByDate.set(dateKey, []);
        }
        logsByDate.get(dateKey)!.push(log);
      } catch {
        // Skip invalid dates
      }
    });

    // Build chart data points
    const dataPoints: EmotionChartDataPoint[] = dateRange.map((date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const dayLogs = logsByDate.get(dateKey) || [];

      // Count emotions by sentiment
      let positive = 0;
      let negative = 0;
      let neutral = 0;
      let confidenceSum = 0;
      const emotionCounts: Record<EmotionCategory, number> = {
        happy: 0,
        sad: 0,
        angry: 0,
        anxious: 0,
        calm: 0,
        stressed: 0,
        excited: 0,
        tired: 0,
        neutral: 0,
        distressed: 0,
      };

      dayLogs.forEach((log) => {
        const sentiment = getEmotionSentiment(log.category);
        if (sentiment === 'positive') positive++;
        else if (sentiment === 'negative') negative++;
        else neutral++;

        emotionCounts[log.category] = (emotionCounts[log.category] || 0) + 1;
        confidenceSum += log.confidence;
      });

      const total = dayLogs.length;
      const confidenceAvg = total > 0 ? confidenceSum / total : 0;

      return {
        date: dateKey,
        dateFormatted: format(date, 'MMM d'),
        positive,
        negative,
        neutral,
        total,
        dominantEmotion: getDominantEmotion(emotionCounts),
        confidenceAvg,
        emotionCounts,
      };
    });

    return dataPoints;
  } catch (error) {
    console.error('[prepareEmotionChartData] Error processing logs:', error);
    return [];
  }
}

/**
 * Calculate emotion distribution from logs
 */
export function calculateEmotionDistribution(
  logs: EmotionLog[]
): EmotionDistributionData[] {
  if (!logs || logs.length === 0) return [];

  const counts: Record<EmotionCategory, number> = {
    happy: 0,
    sad: 0,
    angry: 0,
    anxious: 0,
    calm: 0,
    stressed: 0,
    excited: 0,
    tired: 0,
    neutral: 0,
    distressed: 0,
  };

  logs.forEach((log) => {
    counts[log.category] = (counts[log.category] || 0) + 1;
  });

  const total = logs.length;
  if (total === 0) return [];

  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category: category as EmotionCategory,
      count,
      percentage: (count / total) * 100,
      color: getEmotionColor(category as EmotionCategory),
      emoji: getEmotionEmoji(category as EmotionCategory),
      label: getEmotionLabel(category as EmotionCategory),
    }));
}

/**
 * Calculate overall statistics from chart data
 */
export function calculateEmotionStats(
  chartData: EmotionChartDataPoint[]
): {
  totalLogs: number;
  avgConfidence: number;
  positiveDays: number;
  negativeDays: number;
  neutralDays: number;
  dominantEmotion: EmotionCategory | null;
} {
  if (chartData.length === 0) {
    return {
      totalLogs: 0,
      avgConfidence: 0,
      positiveDays: 0,
      negativeDays: 0,
      neutralDays: 0,
      dominantEmotion: null,
    };
  }

  const nonZeroData = chartData.filter((d) => d.total > 0);
  if (nonZeroData.length === 0) {
    return {
      totalLogs: 0,
      avgConfidence: 0,
      positiveDays: 0,
      negativeDays: 0,
      neutralDays: 0,
      dominantEmotion: null,
    };
  }

  const totalLogs = nonZeroData.reduce((sum, d) => sum + d.total, 0);
  const avgConfidence =
    nonZeroData.reduce((sum, d) => sum + d.confidenceAvg, 0) / nonZeroData.length;
  const positiveDays = nonZeroData.filter((d) => d.positive > d.negative && d.positive > d.neutral).length;
  const negativeDays = nonZeroData.filter((d) => d.negative > d.positive && d.negative > d.neutral).length;
  const neutralDays = nonZeroData.filter((d) => d.neutral >= d.positive && d.neutral >= d.negative).length;

  // Get most common dominant emotion
  const dominantEmotions = nonZeroData
    .map((d) => d.dominantEmotion)
    .filter((e): e is EmotionCategory => e !== null);
  
  const dominantCounts: Record<EmotionCategory, number> = {
    happy: 0,
    sad: 0,
    angry: 0,
    anxious: 0,
    calm: 0,
    stressed: 0,
    excited: 0,
    tired: 0,
    neutral: 0,
    distressed: 0,
  };

  dominantEmotions.forEach((emotion) => {
    dominantCounts[emotion]++;
  });

  const dominantEmotion = getDominantEmotion(dominantCounts);

  return {
    totalLogs,
    avgConfidence,
    positiveDays,
    negativeDays,
    neutralDays,
    dominantEmotion,
  };
}

