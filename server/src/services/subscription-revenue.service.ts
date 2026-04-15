/**
 * Subscription Revenue Analytics Service
 * Provides revenue analytics by different time periods
 */

import { query } from '../database/pg.js';

export interface RevenueStats {
  total: number;
  period: 'week' | 'month' | 'quarter' | 'year' | 'lifetime';
  startDate: Date;
  endDate: Date;
  breakdown: Array<{
    date: string;
    revenue: number;
    subscriptions: number;
  }>;
  byPlan: Array<{
    planName: string;
    revenue: number;
    subscriptions: number;
  }>;
}

export async function getRevenueStats(period: 'week' | 'month' | 'quarter' | 'year' | 'lifetime'): Promise<RevenueStats> {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  
  let startDate: Date;
  
  switch (period) {
    case 'week':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 3);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'lifetime':
      startDate = new Date(0); // Beginning of time
      break;
    default:
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
  }

  // Get total revenue - sum all active subscriptions (for lifetime, count all; for periods, count those active during period)
  let totalRevenueQuery = '';
  if (period === 'lifetime') {
    totalRevenueQuery = `
      SELECT COALESCE(SUM(sp.amount_cents), 0) / 100.0 as total
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'active'
    `;
  } else {
    // For time periods, count subscriptions that were active during the period
    totalRevenueQuery = `
      SELECT COALESCE(SUM(sp.amount_cents), 0) / 100.0 as total
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'active'
      AND (
        (us.current_period_start IS NULL OR us.current_period_start <= $2)
        AND (us.current_period_end IS NULL OR us.current_period_end >= $1)
        OR us.created_at >= $1 AND us.created_at <= $2
      )
    `;
  }
  
  const totalRevenueResult = await query<{ total: string }>(
    totalRevenueQuery,
    period === 'lifetime' ? [] : [startDate, endDate]
  );

  const total = parseFloat(totalRevenueResult.rows[0]?.total || '0');

  // Get breakdown by date - count subscriptions created in each period
  let breakdownQuery = '';
  if (period === 'week') {
    breakdownQuery = `
      SELECT 
        (us.created_at AT TIME ZONE 'UTC')::date::text as date,
        COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue,
        COUNT(*)::int as subscriptions
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.created_at >= $1 AND us.created_at <= $2
      AND us.status = 'active'
      GROUP BY (us.created_at AT TIME ZONE 'UTC')::date
      ORDER BY date ASC
    `;
  } else if (period === 'month') {
    breakdownQuery = `
      SELECT 
        TO_CHAR(us.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date,
        COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue,
        COUNT(*)::int as subscriptions
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.created_at >= $1 AND us.created_at <= $2
      AND us.status = 'active'
      GROUP BY TO_CHAR(us.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY date ASC
    `;
  } else if (period === 'lifetime') {
    breakdownQuery = `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', us.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') as date,
        COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue,
        COUNT(*)::int as subscriptions
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'active'
      GROUP BY DATE_TRUNC('month', us.created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `;
  } else {
    // For quarter, year - group by week
    breakdownQuery = `
      SELECT 
        TO_CHAR(DATE_TRUNC('week', us.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') as date,
        COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue,
        COUNT(*)::int as subscriptions
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.created_at >= $1 AND us.created_at <= $2
      AND us.status = 'active'
      GROUP BY DATE_TRUNC('week', us.created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `;
  }

  const breakdownResult = await query<{ date: string; revenue: string; subscriptions: string }>(
    breakdownQuery,
    period === 'lifetime' ? [] : [startDate, endDate]
  );

  const breakdown = breakdownResult.rows.map(row => ({
    date: row.date,
    revenue: parseFloat(row.revenue || '0'),
    subscriptions: parseInt(row.subscriptions || '0', 10),
  }));

  // Get breakdown by plan
  let byPlanQuery = '';
  if (period === 'lifetime') {
    byPlanQuery = `
      SELECT 
        sp.name as plan_name,
        COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue,
        COUNT(*)::int as subscriptions
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.status = 'active'
       GROUP BY sp.name
       ORDER BY revenue DESC
    `;
  } else {
    byPlanQuery = `
      SELECT 
        sp.name as plan_name,
        COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue,
        COUNT(*)::int as subscriptions
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.created_at >= $1 AND us.created_at <= $2
       AND us.status = 'active'
       GROUP BY sp.name
       ORDER BY revenue DESC
    `;
  }
  
  const byPlanResult = await query<{ plan_name: string; revenue: string; subscriptions: string }>(
    byPlanQuery,
    period === 'lifetime' ? [] : [startDate, endDate]
  );

  const byPlan = byPlanResult.rows.map(row => ({
    planName: row.plan_name,
    revenue: parseFloat(row.revenue || '0'),
    subscriptions: parseInt(row.subscriptions || '0', 10),
  }));

  return {
    total,
    period,
    startDate,
    endDate,
    breakdown,
    byPlan,
  };
}

