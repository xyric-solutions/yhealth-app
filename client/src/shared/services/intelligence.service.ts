/**
 * @file Intelligence API Service
 * @description Client-side API service for Cross-Domain Intelligence (Epic 08)
 */

import { api, type ApiResponse } from '@/lib/api-client';
import type {
  DailyAnalysisReport,
  StoredContradiction,
  ContradictionSummary,
  DailyScore,
  ScoreTrendPoint,
  WeeklyReport,
  WeeklyHistoryItem,
  ReportHistoryItem,
  PredictionAccuracyStat,
  FormulaProgress,
  BestDayFormula,
} from '@shared/types/domain/intelligence';

export interface StoredCorrelation {
  id?: string;
  pattern_type?: string;
  headline?: string;
  insight?: string;
  correlation_strength?: number;
  confidence?: string;
  data_points?: number;
}

const BASE = '/v1/intelligence';

export const intelligenceService = {
  // Daily reports
  async getLatestReport(): Promise<ApiResponse<{ report: DailyAnalysisReport | null }>> {
    return api.get(BASE);
  },

  async getReportByDate(date: string): Promise<ApiResponse<{ report: DailyAnalysisReport | null }>> {
    return api.get(`${BASE}/report/${date}`);
  },

  async getReportHistory(limit = 30, offset = 0): Promise<ApiResponse<{ history: ReportHistoryItem[] }>> {
    return api.get(`${BASE}/history?limit=${limit}&offset=${offset}`);
  },

  // Contradictions
  async getActiveContradictions(): Promise<ApiResponse<{ contradictions: StoredContradiction[] }>> {
    return api.get(`${BASE}/contradictions`);
  },

  async getContradictionSummary(): Promise<ApiResponse<{ summary: ContradictionSummary }>> {
    return api.get(`${BASE}/contradictions/summary`);
  },

  async resolveContradiction(id: string): Promise<ApiResponse<Record<string, never>>> {
    return api.post(`${BASE}/contradictions/${id}/resolve`);
  },

  async dismissContradiction(id: string): Promise<ApiResponse<Record<string, never>>> {
    return api.post(`${BASE}/contradictions/${id}/dismiss`);
  },

  // Score
  async getScoreBreakdown(date?: string): Promise<ApiResponse<{ score: DailyScore | null; date: string }>> {
    const params = date ? `?date=${date}` : '';
    return api.get(`${BASE}/score/breakdown${params}`);
  },

  async getScoreTrend(days = 30): Promise<ApiResponse<{ trend: ScoreTrendPoint[]; days: number }>> {
    return api.get(`${BASE}/score/trend?days=${days}`);
  },

  // Correlations & Best Day
  async getCorrelations(): Promise<ApiResponse<{ correlations: StoredCorrelation[] }>> {
    return api.get(`${BASE}/correlations`);
  },

  async getBestDayFormula(): Promise<ApiResponse<{ bestDay: BestDayFormula | null }>> {
    return api.get(`${BASE}/best-day`);
  },

  async getBestDayProgress(date?: string): Promise<ApiResponse<{ progress: FormulaProgress }>> {
    const params = date ? `?date=${date}` : '';
    return api.get(`${BASE}/best-day/progress${params}`);
  },

  // Weekly reports
  async getWeeklyReport(weekEnd?: string): Promise<ApiResponse<{ report: WeeklyReport | null }>> {
    const params = weekEnd ? `?weekEnd=${weekEnd}` : '';
    return api.get(`${BASE}/weekly${params}`);
  },

  async getWeeklyHistory(limit = 12): Promise<ApiResponse<{ history: WeeklyHistoryItem[] }>> {
    return api.get(`${BASE}/weekly/history?limit=${limit}`);
  },

  // Predictions
  async getPredictionAccuracy(days = 30): Promise<ApiResponse<{ stats: PredictionAccuracyStat }>> {
    return api.get(`${BASE}/predictions/accuracy?days=${days}`);
  },

  // Feedback
  async submitInsightFeedback(
    insightId: string,
    reportDate: string,
    useful: boolean,
    comment?: string
  ): Promise<ApiResponse<Record<string, never>>> {
    return api.post(`${BASE}/insights/${insightId}/feedback`, { useful, reportDate, comment });
  },
};
