/**
 * Visitor Service
 * Records visits and provides admin analytics (unique visitors per day, by country)
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface RecordVisitInput {
  visitorKey: string;
  countryCode: string | null;
  countryName: string | null;
  userId?: string | null;
}

export interface TimeSeriesPoint {
  date: string;
  uniqueVisitors: number;
  pageViews: number;
}

export interface CountryBreakdown {
  countryCode: string;
  countryName: string;
  uniqueVisitors: number;
}

export interface VisitorAnalyticsParams {
  startDate: Date;
  endDate: Date;
  groupBy?: 'day' | 'week';
}

export interface VisitorAnalyticsResult {
  timeSeries: TimeSeriesPoint[];
  byCountry: CountryBreakdown[];
  summary: {
    totalUniqueVisitors: number;
    totalPageViews: number;
    todayUnique: number;
    previousPeriodUnique: number;
  };
}

// ============================================
// RECORD VISIT
// ============================================

/**
 * Record a single visitor visit. One row per hit; uniqueness per day
 * is computed in getVisitorAnalytics via COUNT(DISTINCT visitor_key).
 */
export async function recordVisit(input: RecordVisitInput): Promise<void> {
  const { visitorKey, countryCode, countryName, userId } = input;
  await query(
    `INSERT INTO visitor_visits (visited_at, visitor_key, country_code, country_name, user_id, created_at)
     VALUES (NOW() AT TIME ZONE 'UTC', $1, $2, $3, $4, NOW() AT TIME ZONE 'UTC')`,
    [visitorKey, countryCode ?? null, countryName ?? null, userId ?? null]
  );
  logger.debug('[Visitor] Recorded visit', {
    visitorKey: visitorKey.substring(0, 8) + '…',
    countryCode: countryCode ?? 'unknown',
  });
}

// ============================================
// GET VISITOR ANALYTICS (ADMIN)
// ============================================

/**
 * Get analytics: time series (unique visitors + page views per day) and breakdown by country.
 * All dates in UTC.
 */
export async function getVisitorAnalytics(
  params: VisitorAnalyticsParams
): Promise<VisitorAnalyticsResult> {
  const { startDate, endDate, groupBy: _groupBy = 'day' } = params;
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  // Time series: per-day unique visitors and page views
  const timeSeriesResult = await query<{
    date: string;
    unique_visitors: string;
    page_views: string;
  }>(
    `SELECT
       (visited_at AT TIME ZONE 'UTC')::date::text AS date,
       COUNT(DISTINCT visitor_key)::text AS unique_visitors,
       COUNT(*)::text AS page_views
     FROM visitor_visits
     WHERE (visited_at AT TIME ZONE 'UTC')::date >= $1::date
       AND (visited_at AT TIME ZONE 'UTC')::date <= $2::date
     GROUP BY (visited_at AT TIME ZONE 'UTC')::date
     ORDER BY date ASC`,
    [start, end]
  );

  const timeSeries: TimeSeriesPoint[] = timeSeriesResult.rows.map((row) => ({
    date: row.date,
    uniqueVisitors: parseInt(row.unique_visitors, 10),
    pageViews: parseInt(row.page_views, 10),
  }));

  // By country: unique visitors per country in the same date range
  const byCountryResult = await query<{
    country_code: string;
    country_name: string | null;
    unique_visitors: string;
  }>(
    `SELECT
       COALESCE(country_code, 'XX') AS country_code,
       COALESCE(country_name, 'Unknown') AS country_name,
       COUNT(DISTINCT visitor_key)::text AS unique_visitors
     FROM visitor_visits
     WHERE (visited_at AT TIME ZONE 'UTC')::date >= $1::date
       AND (visited_at AT TIME ZONE 'UTC')::date <= $2::date
     GROUP BY country_code, country_name
     ORDER BY unique_visitors DESC`,
    [start, end]
  );

  const byCountry: CountryBreakdown[] = byCountryResult.rows.map((row) => ({
    countryCode: row.country_code,
    countryName: row.country_name ?? 'Unknown',
    uniqueVisitors: parseInt(row.unique_visitors, 10),
  }));

  // Summary: total unique and page views in range, today, and previous period
  const summaryResult = await query<{
    total_unique: string;
    total_views: string;
    today_unique: string;
    prev_unique: string;
  }>(
    `WITH range AS (
       SELECT $1::date AS start_d, $2::date AS end_d
     ),
     period AS (
       SELECT COUNT(DISTINCT visitor_key) AS total_unique,
              COUNT(*) AS total_views
       FROM visitor_visits, range
       WHERE (visited_at AT TIME ZONE 'UTC')::date >= range.start_d
         AND (visited_at AT TIME ZONE 'UTC')::date <= range.end_d
     ),
     today AS (
       SELECT COUNT(DISTINCT visitor_key) AS today_unique
       FROM visitor_visits, range
       WHERE (visited_at AT TIME ZONE 'UTC')::date = range.end_d
     ),
     prev AS (
       SELECT COUNT(DISTINCT visitor_key) AS prev_unique
       FROM visitor_visits, range
       WHERE (visited_at AT TIME ZONE 'UTC')::date >= range.start_d - (range.end_d - range.start_d + 1)
         AND (visited_at AT TIME ZONE 'UTC')::date < range.start_d
     )
     SELECT
       (SELECT total_unique FROM period)::text AS total_unique,
       (SELECT total_views FROM period)::text AS total_views,
       (SELECT today_unique FROM today)::text AS today_unique,
       (SELECT prev_unique FROM prev)::text AS prev_unique`,
    [start, end]
  );

  const row = summaryResult.rows[0];
  const summary = {
    totalUniqueVisitors: parseInt(row?.total_unique ?? '0', 10),
    totalPageViews: parseInt(row?.total_views ?? '0', 10),
    todayUnique: parseInt(row?.today_unique ?? '0', 10),
    previousPeriodUnique: parseInt(row?.prev_unique ?? '0', 10),
  };

  return { timeSeries, byCountry, summary };
}

export const visitorService = {
  recordVisit,
  getVisitorAnalytics,
};
