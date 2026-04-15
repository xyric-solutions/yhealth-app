/**
 * @file Report Generation Service
 * @description Comprehensive report generation with PDF/CSV export capabilities
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface ReportPeriod {
  type: 'week' | 'month' | 'quarter' | 'year';
  startDate: Date;
  endDate: Date;
  days: number;
}

export interface ReportSummary {
  period: string;
  totalActivities: number;
  completedActivities: number;
  completionRate: number;
  averageScore: number;
  improvementAreas: string[];
  achievements: string[];
  totalWorkouts: number;
  totalMeals: number;
  totalSleepHours: number;
  averageMood: number;
  mentalRecoveryScore: number;
}

export interface WeeklyReport {
  week: string;
  completed: number;
  total: number;
  score: number;
  workouts: number;
  meals: number;
}

export interface CategoryPerformance {
  category: string;
  completed: number;
  total: number;
  averageScore: number;
  trend: 'up' | 'down' | 'stable';
}

export interface GoalProgress {
  goal: string;
  progress: number;
  target: number;
  status: 'on-track' | 'behind' | 'ahead';
  percentage: number;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  recommendation: string;
  action: string;
  impact: string;
}

export interface HealthTrend {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  unit: string;
}

export interface ComprehensiveReport {
  summary: ReportSummary;
  weeklyReport: WeeklyReport[];
  categoryPerformance: CategoryPerformance[];
  goalProgress: GoalProgress[];
  recommendations: Recommendation[];
  healthTrends: HealthTrend[];
  emotionAnalysis?: {
    dominantEmotions: Array<{ emotion: string; count: number; percentage: number }>;
    emotionTrend: 'improving' | 'stable' | 'declining';
  };
  callHistory?: {
    totalCalls: number;
    averageDuration: number;
    purposes: Record<string, number>;
  };
}

// ============================================
// SERVICE
// ============================================

class ReportGenerationService {
  /**
   * Calculate report period dates
   */
  calculatePeriod(periodType: 'week' | 'month' | 'quarter' | 'year'): ReportPeriod {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date();
    let days = 0;

    switch (periodType) {
      case 'week':
        days = 7;
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        days = 30;
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'quarter':
        days = 90;
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'year':
        days = 365;
        startDate.setDate(endDate.getDate() - 365);
        break;
    }

    startDate.setHours(0, 0, 0, 0);

    return {
      type: periodType,
      startDate,
      endDate,
      days,
    };
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(userId: string, periodType: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<ComprehensiveReport> {
    const period = this.calculatePeriod(periodType);
    
    try {
      // Get all data in parallel
      const [
        summary,
        weeklyReport,
        categoryPerformance,
        goalProgress,
        healthTrends,
        emotionAnalysis,
        callHistory,
      ] = await Promise.all([
        this.getSummary(userId, period),
        this.getWeeklyReport(userId, period),
        this.getCategoryPerformance(userId, period),
        this.getGoalProgress(userId),
        this.getHealthTrends(userId, period),
        this.getEmotionAnalysis(userId, period),
        this.getCallHistory(userId, period),
      ]);

      // Generate recommendations based on data
      const recommendations = this.generateRecommendations({
        summary,
        categoryPerformance,
        goalProgress,
        healthTrends,
      });

      return {
        summary,
        weeklyReport,
        categoryPerformance,
        goalProgress,
        recommendations,
        healthTrends,
        emotionAnalysis,
        callHistory,
      };
    } catch (error) {
      logger.error('[ReportGeneration] Error generating report', { error, userId, periodType });
      throw error;
    }
  }

  /**
   * Get summary statistics
   */
  private async getSummary(userId: string, period: ReportPeriod): Promise<ReportSummary> {
    // Activity summary
    const activityResult = await query<{ completed: string; total: string; avg_score: string }>(
      `SELECT
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         COUNT(*) as total,
         AVG(CASE WHEN status = 'completed' THEN 100 ELSE 0 END) as avg_score
       FROM activity_logs
       WHERE user_id = $1
       AND scheduled_date >= $2
       AND scheduled_date <= $3`,
      [userId, period.startDate, period.endDate]
    );

    const activityRow = activityResult.rows[0];
    const totalActivities = parseInt(activityRow?.total || '0');
    const completedActivities = parseInt(activityRow?.completed || '0');
    const completionRate = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;
    const averageScore = parseFloat(activityRow?.avg_score || '0');

    // Workout count
    const workoutResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM activity_logs
       WHERE user_id = $1
       AND scheduled_date >= $2
       AND scheduled_date <= $3
       AND (activity_id ILIKE '%workout%' OR activity_id ILIKE '%exercise%' OR activity_id ILIKE '%fitness%')
       AND status = 'completed'`,
      [userId, period.startDate, period.endDate]
    );
    const totalWorkouts = parseInt(workoutResult.rows[0]?.count || '0');

    // Meal count
    const mealResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM meal_logs
       WHERE user_id = $1
       AND eaten_at >= $2
       AND eaten_at <= $3`,
      [userId, period.startDate, period.endDate]
    );
    const totalMeals = parseInt(mealResult.rows[0]?.count || '0');

    // Sleep hours - calculate from activity_logs with sleep-related activities
    // Note: activity_status_history doesn't have sleep_hours column
    const sleepResult = await query<{ total_hours: string }>(
      `SELECT COALESCE(SUM(COALESCE(duration, 0) / 60.0), 0) as total_hours
       FROM activity_logs
       WHERE user_id = $1
       AND scheduled_date >= $2
       AND scheduled_date <= $3
       AND (activity_id ILIKE '%sleep%' OR activity_id ILIKE '%rest%')
       AND status = 'completed'`,
      [userId, period.startDate, period.endDate]
    );
    const totalSleepHours = parseFloat(sleepResult.rows[0]?.total_hours || '0');

    // Average mood
    const moodResult = await query<{ avg_mood: string }>(
      `SELECT COALESCE(AVG(mood), 0) as avg_mood
       FROM activity_status_history
       WHERE user_id = $1
       AND status_date >= $2
       AND status_date <= $3
       AND mood IS NOT NULL`,
      [userId, period.startDate, period.endDate]
    );
    const averageMood = parseFloat(moodResult.rows[0]?.avg_mood || '0');

    // Mental recovery score (handle if table doesn't exist yet)
    let mentalRecoveryScore = 0;
    try {
      const recoveryResult = await query<{ avg_score: string }>(
        `SELECT COALESCE(AVG(recovery_score), 0) as avg_score
         FROM mental_recovery_scores
         WHERE user_id = $1
         AND score_date >= $2
         AND score_date <= $3`,
        [userId, period.startDate, period.endDate]
      );
      mentalRecoveryScore = parseFloat(recoveryResult.rows[0]?.avg_score || '0');
    } catch (error: any) {
      // Table might not exist yet, use default value
      if (error?.code === '42P01') {
        logger.debug('[ReportGeneration] mental_recovery_scores table not found, using default');
      } else {
        throw error;
      }
    }

    // Identify improvement areas and achievements
    const improvementAreas: string[] = [];
    const achievements: string[] = [];

    if (completionRate < 70) {
      improvementAreas.push('Activity completion rate is below target');
    }
    if (averageMood < 3) {
      improvementAreas.push('Mood tracking shows room for improvement');
    }
    if (totalSleepHours / period.days < 7) {
      improvementAreas.push('Sleep duration could be improved');
    }

    if (completionRate >= 90) {
      achievements.push('Excellent activity completion rate');
    }
    if (totalWorkouts >= period.days * 0.3) {
      achievements.push('Consistent workout routine');
    }
    if (mentalRecoveryScore >= 80) {
      achievements.push('Strong mental recovery scores');
    }

    return {
      period: `${period.type.charAt(0).toUpperCase() + period.type.slice(1)} Report`,
      totalActivities,
      completedActivities,
      completionRate,
      averageScore,
      improvementAreas,
      achievements,
      totalWorkouts,
      totalMeals,
      totalSleepHours,
      averageMood,
      mentalRecoveryScore,
    };
  }

  /**
   * Get weekly breakdown
   */
  private async getWeeklyReport(userId: string, period: ReportPeriod): Promise<WeeklyReport[]> {
    // Use CTE to avoid GROUP BY issues with subqueries
    const result = await query<{ week: string; completed: string; total: string; score: string; workouts: string; meals: string }>(
      `WITH weekly_meals AS (
         SELECT 
           TO_CHAR(eaten_at, 'YYYY-WW') as week,
           COUNT(*) as meal_count
         FROM meal_logs
         WHERE user_id = $1
         AND eaten_at >= $2
         AND eaten_at <= $3
         GROUP BY TO_CHAR(eaten_at, 'YYYY-WW')
       )
       SELECT
         TO_CHAR(al.scheduled_date, 'YYYY-WW') as week,
         SUM(CASE WHEN al.status = 'completed' THEN 1 ELSE 0 END) as completed,
         COUNT(*) as total,
         AVG(CASE WHEN al.status = 'completed' THEN 100 ELSE 0 END) as score,
         SUM(CASE WHEN (al.activity_id ILIKE '%workout%' OR al.activity_id ILIKE '%exercise%') AND al.status = 'completed' THEN 1 ELSE 0 END) as workouts,
         COALESCE(wm.meal_count, 0) as meals
       FROM activity_logs al
       LEFT JOIN weekly_meals wm ON TO_CHAR(al.scheduled_date, 'YYYY-WW') = wm.week
       WHERE al.user_id = $1
       AND al.scheduled_date >= $2
       AND al.scheduled_date <= $3
       GROUP BY TO_CHAR(al.scheduled_date, 'YYYY-WW'), wm.meal_count
       ORDER BY week ASC`,
      [userId, period.startDate, period.endDate]
    );

    return result.rows.map(row => ({
      week: row.week,
      completed: parseInt(row.completed),
      total: parseInt(row.total),
      score: Math.round(parseFloat(row.score)),
      workouts: parseInt(row.workouts),
      meals: parseInt(row.meals),
    }));
  }

  /**
   * Get category performance
   */
  private async getCategoryPerformance(userId: string, period: ReportPeriod): Promise<CategoryPerformance[]> {
    // Get current period
    const currentResult = await query<{ category: string; completed: string; total: string; avg_score: string }>(
      `SELECT
         CASE 
           WHEN activity_id ILIKE '%workout%' OR activity_id ILIKE '%exercise%' OR activity_id ILIKE '%fitness%' THEN 'workout'
           WHEN activity_id ILIKE '%meal%' OR activity_id ILIKE '%food%' OR activity_id ILIKE '%nutrition%' THEN 'meal'
           WHEN activity_id ILIKE '%sleep%' THEN 'sleep_routine'
           WHEN activity_id ILIKE '%mindfulness%' OR activity_id ILIKE '%meditation%' THEN 'mindfulness'
           WHEN activity_id ILIKE '%habit%' THEN 'habit'
           WHEN activity_id ILIKE '%check%' OR activity_id ILIKE '%checkin%' THEN 'check_in'
           WHEN activity_id ILIKE '%reflection%' THEN 'reflection'
           WHEN activity_id ILIKE '%learning%' OR activity_id ILIKE '%learn%' THEN 'learning'
           ELSE 'other'
         END as category,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         COUNT(*) as total,
         AVG(CASE WHEN status = 'completed' THEN 100 ELSE 0 END) as avg_score
       FROM activity_logs
       WHERE user_id = $1
       AND scheduled_date >= $2
       AND scheduled_date <= $3
       GROUP BY category`,
      [userId, period.startDate, period.endDate]
    );

    // Get previous period for trend comparison
    const previousStart = new Date(period.startDate);
    previousStart.setDate(previousStart.getDate() - period.days);
    const previousEnd = new Date(period.startDate);

    const previousResult = await query<{ category: string; completed: string; total: string }>(
      `SELECT
         CASE 
           WHEN activity_id ILIKE '%workout%' OR activity_id ILIKE '%exercise%' OR activity_id ILIKE '%fitness%' THEN 'workout'
           WHEN activity_id ILIKE '%meal%' OR activity_id ILIKE '%food%' OR activity_id ILIKE '%nutrition%' THEN 'meal'
           WHEN activity_id ILIKE '%sleep%' THEN 'sleep_routine'
           WHEN activity_id ILIKE '%mindfulness%' OR activity_id ILIKE '%meditation%' THEN 'mindfulness'
           WHEN activity_id ILIKE '%habit%' THEN 'habit'
           WHEN activity_id ILIKE '%check%' OR activity_id ILIKE '%checkin%' THEN 'check_in'
           WHEN activity_id ILIKE '%reflection%' THEN 'reflection'
           WHEN activity_id ILIKE '%learning%' OR activity_id ILIKE '%learn%' THEN 'learning'
           ELSE 'other'
         END as category,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         COUNT(*) as total
       FROM activity_logs
       WHERE user_id = $1
       AND scheduled_date >= $2
       AND scheduled_date <= $3
       GROUP BY category`,
      [userId, previousStart, previousEnd]
    );

    const previousMap = new Map(
      previousResult.rows.map(row => [
        row.category,
        { completed: parseInt(row.completed), total: parseInt(row.total) },
      ])
    );

    return currentResult.rows.map(row => {
      const currentCompleted = parseInt(row.completed);
      const currentTotal = parseInt(row.total);
      const currentRate = currentTotal > 0 ? currentCompleted / currentTotal : 0;

      const previous = previousMap.get(row.category);
      const previousRate = previous ? (previous.total > 0 ? previous.completed / previous.total : 0) : 0;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (currentRate > previousRate + 0.05) trend = 'up';
      else if (currentRate < previousRate - 0.05) trend = 'down';

      return {
        category: row.category,
        completed: currentCompleted,
        total: currentTotal,
        averageScore: Math.round(parseFloat(row.avg_score)),
        trend,
      };
    });
  }

  /**
   * Get goal progress
   */
  private async getGoalProgress(userId: string): Promise<GoalProgress[]> {
    const result = await query<{ goal: string; progress: string; target: string; status: string }>(
      `SELECT
         title as goal,
         progress,
         target_value as target,
         status
       FROM user_goals
       WHERE user_id = $1
       AND status IN ('active', 'draft')
       ORDER BY is_primary DESC, created_at DESC
       LIMIT 10`,
      [userId]
    );

    return result.rows.map(row => {
      const progress = parseFloat(row.progress || '0');
      const target = parseFloat(row.target || '1');
      const percentage = target > 0 ? (progress / target) * 100 : 0;
      let status: 'on-track' | 'behind' | 'ahead' = 'on-track';
      if (percentage >= 100) status = 'ahead';
      else if (percentage < 70) status = 'behind';

      return {
        goal: row.goal,
        progress,
        target,
        status,
        percentage: Math.round(percentage),
      };
    });
  }

  /**
   * Get health trends
   */
  private async getHealthTrends(userId: string, period: ReportPeriod): Promise<HealthTrend[]> {
    const trends: HealthTrend[] = [];

    // Weight trend
    const weightResult = await query<{ current: string; previous: string }>(
      `SELECT
         (SELECT value->>'weight' FROM progress_records WHERE user_id = $1 AND record_type = 'weight' AND record_date <= $3 ORDER BY record_date DESC LIMIT 1)::numeric as current,
         (SELECT value->>'weight' FROM progress_records WHERE user_id = $1 AND record_type = 'weight' AND record_date < $2 ORDER BY record_date DESC LIMIT 1)::numeric as previous`,
      [userId, period.startDate, period.endDate]
    );
    if (weightResult.rows[0]?.current && weightResult.rows[0]?.previous) {
      const current = parseFloat(weightResult.rows[0].current);
      const previous = parseFloat(weightResult.rows[0].previous);
      trends.push({
        metric: 'Weight',
        current,
        previous,
        change: current - previous,
        trend: current > previous ? 'up' : current < previous ? 'down' : 'stable',
        unit: 'kg',
      });
    }

    // Mood trend
    const moodResult = await query<{ current: string; previous: string }>(
      `SELECT
         COALESCE(AVG(mood), 0) as current
       FROM activity_status_history
       WHERE user_id = $1
       AND status_date >= $2
       AND status_date <= $3
       AND mood IS NOT NULL`,
      [userId, period.startDate, period.endDate]
    );
    const previousStart = new Date(period.startDate);
    previousStart.setDate(previousStart.getDate() - period.days);
    const previousEnd = new Date(period.startDate);
    const previousMoodResult = await query<{ previous: string }>(
      `SELECT COALESCE(AVG(mood), 0) as previous
       FROM activity_status_history
       WHERE user_id = $1
       AND status_date >= $2
       AND status_date < $3
       AND mood IS NOT NULL`,
      [userId, previousStart, previousEnd]
    );
    if (moodResult.rows[0]?.current && previousMoodResult.rows[0]?.previous) {
      const current = parseFloat(moodResult.rows[0].current);
      const previous = parseFloat(previousMoodResult.rows[0].previous);
      trends.push({
        metric: 'Mood',
        current,
        previous,
        change: current - previous,
        trend: current > previous ? 'up' : current < previous ? 'down' : 'stable',
        unit: '/5',
      });
    }

    // Mental recovery score trend (handle if table doesn't exist yet)
    try {
      const recoveryResult = await query<{ current: string; previous: string }>(
        `SELECT
           COALESCE(AVG(recovery_score), 0) as current
         FROM mental_recovery_scores
         WHERE user_id = $1
         AND score_date >= $2
         AND score_date <= $3`,
        [userId, period.startDate, period.endDate]
      );
      const previousRecoveryResult = await query<{ previous: string }>(
        `SELECT COALESCE(AVG(recovery_score), 0) as previous
         FROM mental_recovery_scores
         WHERE user_id = $1
         AND score_date >= $2
         AND score_date < $3`,
        [userId, previousStart, previousEnd]
      );
      if (recoveryResult.rows[0]?.current && previousRecoveryResult.rows[0]?.previous) {
        const current = parseFloat(recoveryResult.rows[0].current);
        const previous = parseFloat(previousRecoveryResult.rows[0].previous);
        trends.push({
          metric: 'Mental Recovery',
          current,
          previous,
          change: current - previous,
          trend: current > previous ? 'up' : current < previous ? 'down' : 'stable',
          unit: '/100',
        });
      }
    } catch (error: any) {
      // Table might not exist yet, skip this trend
      if (error?.code === '42P01') {
        logger.debug('[ReportGeneration] mental_recovery_scores table not found, skipping trend');
      } else {
        throw error;
      }
    }

    return trends;
  }

  /**
   * Get emotion analysis
   */
  private async getEmotionAnalysis(userId: string, period: ReportPeriod): Promise<ComprehensiveReport['emotionAnalysis']> {
    const result = await query<{ emotion: string; count: string }>(
      `SELECT
         emotion_category as emotion,
         COUNT(*) as count
       FROM emotion_logs
       WHERE user_id = $1
       AND timestamp >= $2
       AND timestamp <= $3
       GROUP BY emotion_category
       ORDER BY count DESC`,
      [userId, period.startDate, period.endDate]
    );

    const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    if (total === 0) return undefined;

    const dominantEmotions = result.rows.slice(0, 5).map(row => ({
      emotion: row.emotion,
      count: parseInt(row.count),
      percentage: Math.round((parseInt(row.count) / total) * 100),
    }));

    // Determine trend (simplified - compare first half vs second half)
    const midPoint = new Date(period.startDate.getTime() + (period.endDate.getTime() - period.startDate.getTime()) / 2);
    const firstHalf = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM emotion_logs
       WHERE user_id = $1
       AND timestamp >= $2
       AND timestamp < $3
       AND emotion_category IN ('happy', 'calm', 'excited')`,
      [userId, period.startDate, midPoint]
    );
    const secondHalf = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM emotion_logs
       WHERE user_id = $1
       AND timestamp >= $2
       AND timestamp <= $3
       AND emotion_category IN ('happy', 'calm', 'excited')`,
      [userId, midPoint, period.endDate]
    );

    const firstPositive = parseInt(firstHalf.rows[0]?.count || '0');
    const secondPositive = parseInt(secondHalf.rows[0]?.count || '0');
    let emotionTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (secondPositive > firstPositive * 1.1) emotionTrend = 'improving';
    else if (secondPositive < firstPositive * 0.9) emotionTrend = 'declining';

    return {
      dominantEmotions,
      emotionTrend,
    };
  }

  /**
   * Get call history summary
   */
  private async getCallHistory(userId: string, period: ReportPeriod): Promise<ComprehensiveReport['callHistory']> {
    const result = await query<{ total: string; avg_duration: string; purposes: string }>(
      `SELECT
         COUNT(*) as total,
         COALESCE(AVG(call_duration), 0) as avg_duration,
         jsonb_object_agg(COALESCE(call_purpose, 'general_health'), 1) FILTER (WHERE call_purpose IS NOT NULL) as purposes
       FROM voice_calls
       WHERE user_id = $1
       AND initiated_at >= $2
       AND initiated_at <= $3
       AND status = 'ended'`,
      [userId, period.startDate, period.endDate]
    );

    const purposeResult = await query<{ purpose: string; count: string }>(
      `SELECT
         COALESCE(call_purpose, 'general_health') as purpose,
         COUNT(*) as count
       FROM voice_calls
       WHERE user_id = $1
       AND initiated_at >= $2
       AND initiated_at <= $3
       AND status = 'ended'
       GROUP BY call_purpose`,
      [userId, period.startDate, period.endDate]
    );

    const purposes: Record<string, number> = {};
    purposeResult.rows.forEach(row => {
      purposes[row.purpose] = parseInt(row.count);
    });

    return {
      totalCalls: parseInt(result.rows[0]?.total || '0'),
      averageDuration: Math.round(parseFloat(result.rows[0]?.avg_duration || '0')),
      purposes,
    };
  }

  /**
   * Generate recommendations based on data
   */
  private generateRecommendations(data: {
    summary: ReportSummary;
    categoryPerformance: CategoryPerformance[];
    goalProgress: GoalProgress[];
    healthTrends: HealthTrend[];
  }): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Low completion rate
    if (data.summary.completionRate < 70) {
      recommendations.push({
        priority: 'high',
        category: 'Activity',
        recommendation: 'Your activity completion rate is below target. Focus on consistency.',
        action: 'Set smaller, achievable daily goals and use reminders.',
        impact: 'Improving completion rate will accelerate progress toward your goals.',
      });
    }

    // Poor sleep
    if (data.summary.totalSleepHours / (data.summary.period === 'week' ? 7 : data.summary.period === 'month' ? 30 : data.summary.period === 'quarter' ? 90 : 365) < 7) {
      recommendations.push({
        priority: 'high',
        category: 'Sleep',
        recommendation: 'Sleep duration is below recommended 7-9 hours per night.',
        action: 'Establish a consistent bedtime routine and limit screen time before bed.',
        impact: 'Better sleep will improve recovery, mood, and overall performance.',
      });
    }

    // Declining mood
    const moodTrend = data.healthTrends.find(t => t.metric === 'Mood');
    if (moodTrend && moodTrend.trend === 'down') {
      recommendations.push({
        priority: 'medium',
        category: 'Mental Health',
        recommendation: 'Your mood trend shows a decline. Consider stress management strategies.',
        action: 'Try mindfulness exercises, regular breaks, and social connections.',
        impact: 'Improving mood will enhance motivation and overall wellbeing.',
      });
    }

    // Behind on goals
    const behindGoals = data.goalProgress.filter(g => g.status === 'behind');
    if (behindGoals.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Goals',
        recommendation: `${behindGoals.length} goal(s) are behind schedule. Review and adjust targets.`,
        action: 'Break down goals into smaller milestones and celebrate progress.',
        impact: 'Realistic goal adjustment maintains motivation and progress.',
      });
    }

    // Low workout frequency
    const workoutCategory = data.categoryPerformance.find(c => c.category === 'workout');
    if (workoutCategory && workoutCategory.completed < 3) {
      recommendations.push({
        priority: 'medium',
        category: 'Fitness',
        recommendation: 'Workout frequency is low. Aim for at least 3 workouts per week.',
        action: 'Schedule workouts in your calendar and start with shorter sessions.',
        impact: 'Regular exercise improves physical and mental health significantly.',
      });
    }

    return recommendations;
  }

  /**
   * Generate PDF report (placeholder - would use a PDF library like pdfkit or puppeteer)
   */
  async generatePDF(report: ComprehensiveReport, _userId: string): Promise<Buffer> {
    // TODO: Implement PDF generation using pdfkit or puppeteer
    // For now, return a JSON representation
    const reportJson = JSON.stringify(report, null, 2);
    return Buffer.from(reportJson, 'utf-8');
  }

  /**
   * Generate CSV report
   */
  async generateCSV(report: ComprehensiveReport): Promise<string> {
    const lines: string[] = [];
    
    // Summary
    lines.push('Summary');
    lines.push(`Period,${report.summary.period}`);
    lines.push(`Total Activities,${report.summary.totalActivities}`);
    lines.push(`Completed Activities,${report.summary.completedActivities}`);
    lines.push(`Completion Rate,${report.summary.completionRate}%`);
    lines.push(`Average Score,${report.summary.averageScore}`);
    lines.push('');

    // Weekly Report
    lines.push('Weekly Report');
    lines.push('Week,Completed,Total,Score,Workouts,Meals');
    report.weeklyReport.forEach(week => {
      lines.push(`${week.week},${week.completed},${week.total},${week.score},${week.workouts},${week.meals}`);
    });
    lines.push('');

    // Category Performance
    lines.push('Category Performance');
    lines.push('Category,Completed,Total,Average Score,Trend');
    report.categoryPerformance.forEach(cat => {
      lines.push(`${cat.category},${cat.completed},${cat.total},${cat.averageScore},${cat.trend}`);
    });
    lines.push('');

    // Goal Progress
    lines.push('Goal Progress');
    lines.push('Goal,Progress,Target,Status,Percentage');
    report.goalProgress.forEach(goal => {
      lines.push(`${goal.goal},${goal.progress},${goal.target},${goal.status},${goal.percentage}%`);
    });

    return lines.join('\n');
  }
}

export const reportGenerationService = new ReportGenerationService();

