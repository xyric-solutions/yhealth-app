/**
 * @file Weekly Report Service
 * @description Aggregates 7 daily analysis reports into a weekly summary.
 * Generates narrative via LLM and stores in weekly_analysis_reports table.
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { modelFactory } from './model-factory.service.js';
import { normalizeComponentScores, type ComponentScores } from './ai-scoring.service.js';

// ============================================
// TYPES
// ============================================

export interface WeeklyReportSummary {
  avgTotalScore: number;
  avgComponentScores: ComponentScores;
  scoreTrend: 'improving' | 'stable' | 'declining';
  bestDay: { date: string; score: number } | null;
  worstDay: { date: string; score: number } | null;
  topInsights: string[];
  totalInsightsCount: number;
  totalRiskCount: number;
  contradictionCounts: { low: number; medium: number; high: number; critical: number };
  dailyReportCount: number;
}

export interface WeeklyReport {
  id: string;
  userId: string;
  weekEndDate: string;
  dailyReportIds: string[];
  summary: WeeklyReportSummary;
  narrative: string | null;
  generatedAt: string;
}

// ============================================
// SERVICE
// ============================================

class WeeklyReportService {
  private llm: BaseChatModel;
  private tableEnsured = false;

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'default',
      maxTokens: 800,
    });
  }

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS weekly_analysis_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          week_end_date DATE NOT NULL,
          daily_report_ids JSONB DEFAULT '[]',
          summary JSONB NOT NULL,
          narrative TEXT,
          generated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, week_end_date)
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_date
          ON weekly_analysis_reports(user_id, week_end_date DESC)
      `);
      this.tableEnsured = true;
    } catch (error) {
      logger.error('[WeeklyReport] Error ensuring table', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Generate a weekly report by aggregating 7 daily reports.
   */
  async generateWeeklyReport(userId: string, weekEndDate?: string): Promise<WeeklyReport | null> {
    await this.ensureTable();

    const endDate = weekEndDate || new Date().toISOString().split('T')[0];

    // Fetch daily reports for the week
    const dailyReportsResult = await query<{
      id: string;
      report_date: string;
      snapshot: Record<string, unknown>;
      insights: unknown[];
      risks: unknown[];
    }>(
      `SELECT id, report_date, snapshot, insights, risks
       FROM daily_analysis_reports
       WHERE user_id = $1
         AND report_date BETWEEN ($2::date - INTERVAL '6 days') AND $2::date
       ORDER BY report_date ASC`,
      [userId, endDate]
    );

    if (dailyReportsResult.rows.length < 3) {
      logger.debug('[WeeklyReport] Not enough daily reports for weekly summary', {
        userId: userId.slice(0, 8),
        count: dailyReportsResult.rows.length,
      });
      return null;
    }

    const dailyReportIds = dailyReportsResult.rows.map((r) => r.id);

    // Build summary
    const summary = await this.buildSummary(userId, endDate, dailyReportsResult.rows);

    // Generate narrative via LLM
    let narrative: string | null = null;
    try {
      narrative = await this.generateNarrative(summary);
    } catch (error) {
      logger.warn('[WeeklyReport] Narrative generation failed (non-fatal)', {
        userId: userId.slice(0, 8),
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Persist
    const result = await query<{ id: string; generated_at: string }>(
      `INSERT INTO weekly_analysis_reports (user_id, week_end_date, daily_report_ids, summary, narrative)
       VALUES ($1, $2::date, $3, $4, $5)
       ON CONFLICT (user_id, week_end_date) DO UPDATE SET
         daily_report_ids = EXCLUDED.daily_report_ids,
         summary = EXCLUDED.summary,
         narrative = EXCLUDED.narrative,
         generated_at = NOW()
       RETURNING id, generated_at`,
      [userId, endDate, JSON.stringify(dailyReportIds), JSON.stringify(summary), narrative]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId,
      weekEndDate: endDate,
      dailyReportIds,
      summary,
      narrative,
      generatedAt: row.generated_at,
    };
  }

  /**
   * Retrieve a stored weekly report.
   */
  async getWeeklyReport(userId: string, weekEndDate?: string): Promise<WeeklyReport | null> {
    await this.ensureTable();

    const sql = weekEndDate
      ? `SELECT * FROM weekly_analysis_reports WHERE user_id = $1 AND week_end_date = $2::date`
      : `SELECT * FROM weekly_analysis_reports WHERE user_id = $1 ORDER BY week_end_date DESC LIMIT 1`;
    const params = weekEndDate ? [userId, weekEndDate] : [userId];

    const result = await query<{
      id: string;
      user_id: string;
      week_end_date: string;
      daily_report_ids: string[];
      summary: WeeklyReportSummary;
      narrative: string | null;
      generated_at: string;
    }>(sql, params);

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      weekEndDate: row.week_end_date,
      dailyReportIds: typeof row.daily_report_ids === 'string' ? JSON.parse(row.daily_report_ids) : row.daily_report_ids,
      summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary,
      narrative: row.narrative,
      generatedAt: row.generated_at,
    };
  }

  /**
   * List weekly reports (paginated).
   */
  async getWeeklyHistory(
    userId: string,
    limit: number = 12
  ): Promise<Array<{ weekEndDate: string; avgScore: number; reportCount: number; generatedAt: string }>> {
    await this.ensureTable();

    const result = await query<{
      week_end_date: string;
      avg_score: number;
      report_count: number;
      generated_at: string;
    }>(
      `SELECT
         week_end_date,
         (summary->>'avgTotalScore')::numeric AS avg_score,
         (summary->>'dailyReportCount')::int AS report_count,
         generated_at
       FROM weekly_analysis_reports
       WHERE user_id = $1
       ORDER BY week_end_date DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((r) => ({
      weekEndDate: r.week_end_date,
      avgScore: parseFloat(r.avg_score as unknown as string) || 0,
      reportCount: parseInt(r.report_count as unknown as string, 10) || 0,
      generatedAt: r.generated_at,
    }));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async buildSummary(
    userId: string,
    endDate: string,
    reports: Array<{
      report_date: string;
      snapshot: Record<string, unknown>;
      insights: unknown[];
      risks: unknown[];
    }>
  ): Promise<WeeklyReportSummary> {
    const scores = reports.map((r) => {
      const snap = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
      return {
        date: r.report_date,
        totalScore: (snap.totalScore as number) || 0,
        componentScores: normalizeComponentScores((snap.componentScores as Record<string, number>) || {}),
      };
    });

    const totalScores = scores.map((s) => s.totalScore);
    const avgTotalScore = Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length);

    // Average component scores
    const avgComponentScores: ComponentScores = { workout: 0, nutrition: 0, wellbeing: 0, biometrics: 0, engagement: 0, consistency: 0 };
    for (const key of Object.keys(avgComponentScores) as Array<keyof ComponentScores>) {
      const values = scores.map((s) => s.componentScores[key] || 0);
      avgComponentScores[key] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }

    // Trend detection
    const first3Avg = totalScores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, totalScores.length);
    const last3Avg = totalScores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, totalScores.length);
    const delta = last3Avg - first3Avg;
    const scoreTrend: 'improving' | 'stable' | 'declining' = delta > 3 ? 'improving' : delta < -3 ? 'declining' : 'stable';

    // Best/worst days
    const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);
    const bestDay = sorted.length > 0 ? { date: sorted[0].date, score: sorted[0].totalScore } : null;
    const worstDay = sorted.length > 0 ? { date: sorted[sorted.length - 1].date, score: sorted[sorted.length - 1].totalScore } : null;

    // Aggregate insights
    const allInsights = reports.flatMap((r) => {
      const insights = typeof r.insights === 'string' ? JSON.parse(r.insights) : (r.insights || []);
      return insights;
    });
    const topInsights = allInsights
      .filter((i: { severity?: string }) => i.severity === 'warning' || i.severity === 'critical')
      .slice(0, 3)
      .map((i: { claim?: string }) => i.claim || '');

    const totalRiskCount = reports.reduce((sum, r) => {
      const risks = typeof r.risks === 'string' ? JSON.parse(r.risks) : (r.risks || []);
      return sum + risks.length;
    }, 0);

    return {
      avgTotalScore,
      avgComponentScores,
      scoreTrend,
      bestDay,
      worstDay,
      topInsights,
      totalInsightsCount: allInsights.length,
      totalRiskCount,
      contradictionCounts: await this.getContradictionCounts(userId, endDate),
      dailyReportCount: reports.length,
    };
  }

  private async getContradictionCounts(
    userId: string,
    endDate: string
  ): Promise<{ low: number; medium: number; high: number; critical: number }> {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    try {
      const result = await query<{ severity: string; count: string }>(
        `SELECT severity, COUNT(*)::text AS count
         FROM cross_pillar_contradictions
         WHERE user_id = $1
           AND detected_at >= ($2::date - INTERVAL '6 days')
           AND detected_at <= ($2::date + INTERVAL '1 day')
         GROUP BY severity`,
        [userId, endDate]
      );
      for (const row of result.rows) {
        const sev = row.severity as keyof typeof counts;
        if (sev in counts) {
          counts[sev] = parseInt(row.count, 10);
        }
      }
    } catch {
      // Table may not exist yet — return zeros
    }
    return counts;
  }

  private async generateNarrative(summary: WeeklyReportSummary): Promise<string> {
    const systemPrompt = `You are a concise health coach writing a weekly summary. Write 2-3 sentences: acknowledge the trend, highlight one key win, and give one focus area for next week. Be warm but direct. No bullet points.`;

    const data = `Score: ${summary.avgTotalScore}/100 (${summary.scoreTrend}). Components: Workout ${summary.avgComponentScores.workout}, Nutrition ${summary.avgComponentScores.nutrition}, Wellbeing ${summary.avgComponentScores.wellbeing}, Biometrics ${summary.avgComponentScores.biometrics}. Reports: ${summary.dailyReportCount}/7. Insights: ${summary.totalInsightsCount}. Risks: ${summary.totalRiskCount}. Best day: ${summary.bestDay?.date} (${summary.bestDay?.score}), Worst: ${summary.worstDay?.date} (${summary.worstDay?.score}).`;

    const response = await Promise.race([
      this.llm.invoke([new SystemMessage(systemPrompt), new HumanMessage(data)]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 10000)),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    return content.trim();
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const weeklyReportService = new WeeklyReportService();
export default weeklyReportService;
