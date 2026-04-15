import { query } from '../database/pg.js';

// Generate data for last 12 months (default) - PostgreSQL version
export const generateLast12MonthData = async (tableName: string, dateColumn: string = 'created_at') => {
  const last12Months = [];
  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + 1);

  for (let i = 11; i >= 0; i--) {
    const endDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() - i * 28
    );

    const startDate = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate() - 28
    );

    const monthYear = endDate.toLocaleString("default", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE ${dateColumn} >= $1 AND ${dateColumn} < $2`,
      [startDate, endDate]
    );

    const count = parseInt(result.rows[0]?.count || '0', 10);
    last12Months.push({ month: monthYear, count });
  }
  return { last12Months };
};
  
// Generate data for specific year (monthly breakdown) - PostgreSQL version
export const generateYearlyData = async (tableName: string, year: string, dateColumn: string = 'created_at') => {
  const monthlyData = [];
  const targetYear = parseInt(year) || new Date().getFullYear();

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(targetYear, month, 1);
    const endDate = new Date(targetYear, month + 1, 1);

    const monthYear = startDate.toLocaleString("default", {
      month: "short",
      year: "numeric",
    });

    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE ${dateColumn} >= $1 AND ${dateColumn} < $2`,
      [startDate, endDate]
    );

    const count = parseInt(result.rows[0]?.count || '0', 10);
    monthlyData.push({ month: monthYear, count });
  }
  return { last12Months: monthlyData };
};
  
// Generate data for specific month (daily breakdown) - PostgreSQL version
export const generateMonthlyData = async (tableName: string, year: string, month: string, dateColumn: string = 'created_at') => {
  const dailyData = [];
  const targetYear = parseInt(year) || new Date().getFullYear();
  const targetMonth = parseInt(month) - 1 || new Date().getMonth(); // month is 0-indexed

  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const startDate = new Date(targetYear, targetMonth, day);
    const endDate = new Date(targetYear, targetMonth, day + 1);

    const dayLabel = startDate.toLocaleString("default", {
      day: "numeric",
      month: "short",
    });

    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE ${dateColumn} >= $1 AND ${dateColumn} < $2`,
      [startDate, endDate]
    );

    const count = parseInt(result.rows[0]?.count || '0', 10);
    dailyData.push({ month: dayLabel, count });
  }
  return { last12Months: dailyData };
};
  
// Generate data for custom date range - PostgreSQL version
export const generateCustomRangeData = async (tableName: string, startDate: string, endDate: string, dateColumn: string = 'created_at') => {
  const rangeData = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate days difference
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 31) {
    for (let i = 0; i < daysDiff; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + i);
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayLabel = currentDate.toLocaleString("default", {
        day: "numeric",
        month: "short",
      });

      const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE ${dateColumn} >= $1 AND ${dateColumn} < $2`,
        [currentDate, nextDate]
      );

      const count = parseInt(result.rows[0]?.count || '0', 10);
      rangeData.push({ month: dayLabel, count });
    }
  } else {
    // For longer ranges, show weekly breakdown
    const weeks = Math.ceil(daysDiff / 7);
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() + i * 7);
      let weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      if (weekEnd > end) weekEnd = new Date(end);

      const weekLabel = `Week ${i + 1} (${weekStart.toLocaleDateString(
        "default",
        {
          day: "numeric",
          month: "short",
        }
      )} - ${weekEnd.toLocaleDateString("default", {
        day: "numeric",
        month: "short",
      })})`;

      const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE ${dateColumn} >= $1 AND ${dateColumn} < $2`,
        [weekStart, weekEnd]
      );

      const count = parseInt(result.rows[0]?.count || '0', 10);
      rangeData.push({ month: weekLabel, count });
    }
  }

  return { last12Months: rangeData };
};

// Generate revenue time series data
export const generateRevenueTimeSeries = async (startDate: Date, endDate: Date) => {
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const timeSeries = [];

  if (daysDiff <= 31) {
    // Daily breakdown
    for (let i = 0; i < daysDiff; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const result = await query<{ revenue: string; count: string }>(
        `SELECT 
          COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue,
          COUNT(DISTINCT us.id) as count
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.created_at >= $1 AND us.created_at < $2
        AND us.status = 'active'`,
        [currentDate, nextDate]
      );

      timeSeries.push({
        date: currentDate.toISOString().split('T')[0],
        revenue: parseFloat(result.rows[0]?.revenue || '0'),
        count: parseInt(result.rows[0]?.count || '0', 10),
      });
    }
  } else {
    // Weekly breakdown
    const weeks = Math.ceil(daysDiff / 7);
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + i * 7);
      let weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (weekEnd > endDate) weekEnd = new Date(endDate);

      const result = await query<{ revenue: string; count: string }>(
        `SELECT 
          COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue,
          COUNT(DISTINCT us.id) as count
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.created_at >= $1 AND us.created_at < $2
        AND us.status = 'active'`,
        [weekStart, weekEnd]
      );

      timeSeries.push({
        date: weekStart.toISOString().split('T')[0],
        revenue: parseFloat(result.rows[0]?.revenue || '0'),
        count: parseInt(result.rows[0]?.count || '0', 10),
      });
    }
  }

  return timeSeries;
};

// Generate subscription distribution by plan
export const generateSubscriptionDistribution = async (startDate: Date, endDate: Date) => {
  const result = await query<{ plan_name: string; count: string; revenue: string }>(
    `SELECT 
      sp.name as plan_name,
      COUNT(us.id) as count,
      COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.created_at >= $1 AND us.created_at < $2
    AND us.status = 'active'
    GROUP BY sp.id, sp.name
    ORDER BY count DESC`,
    [startDate, endDate]
  );

  return result.rows.map(row => ({
    name: row.plan_name,
    count: parseInt(row.count, 10),
    revenue: parseFloat(row.revenue),
  }));
};
  