/**
 * Admin Analytics Service
 * Aggregates comprehensive analytics data for admin dashboard
 */

import { query } from '../database/pg.js';
import {
  generateCustomRangeData,
  generateRevenueTimeSeries,
  generateSubscriptionDistribution,
} from '../utils/analyticsGenerator.js';

export interface AnalyticsOverview {
  users: {
    total: number;
    active: number;
    new: number;
    growthRate: number;
    timeSeries: Array<{ date: string; count: number }>;
  };
  subscriptions: {
    active: number;
    total: number;
    revenue: number;
    mrr: number;
    churnRate: number;
    byPlan: Array<{ name: string; count: number; revenue: number }>;
    timeSeries: Array<{ date: string; count: number; revenue: number }>;
  };
  revenue: {
    total: number;
    monthly: number;
    timeSeries: Array<{ date: string; revenue: number }>;
  };
    visitors: {
      total: number;
      unique: number;
      pageViews: number;
      countries: number;
      byCountry: Array<{ countryCode: string; countryName: string; uniqueVisitors: number }>;
      timeSeries: Array<{ date: string; unique: number; pageViews: number }>;
    };
  blogs: {
    total: number;
    published: number;
    views: number;
    engagement: number;
    timeSeries: Array<{ date: string; views: number }>;
  };
  contacts: {
    total: number;
    pending: number;
    resolved: number;
    avgResponseTime: number;
  };
  webinars: {
    total: number;
    registrations: number;
    attendance: number;
    attendanceRate: number;
  };
  community: {
    posts: number;
    replies: number;
    engagement: number;
  };
}

export async function getAnalyticsOverview(
  startDate: Date,
  endDate: Date
): Promise<AnalyticsOverview> {
  // Calculate previous period for growth rate
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const previousStartDate = new Date(startDate);
  previousStartDate.setDate(previousStartDate.getDate() - periodDays);
  const previousEndDate = new Date(startDate);

  // Users analytics
  const [usersTotal, usersActive, usersNew, usersPrevious] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) as count FROM users'),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users 
       WHERE last_login >= $1 AND last_login <= $2`,
      [startDate, endDate]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users 
       WHERE created_at >= $1 AND created_at < $2`,
      [previousStartDate, previousEndDate]
    ),
  ]);

  const usersTotalCount = parseInt(usersTotal.rows[0]?.count || '0', 10);
  const usersActiveCount = parseInt(usersActive.rows[0]?.count || '0', 10);
  const usersNewCount = parseInt(usersNew.rows[0]?.count || '0', 10);
  const usersPreviousCount = parseInt(usersPrevious.rows[0]?.count || '0', 10);
  const usersGrowthRate =
    usersPreviousCount > 0
      ? Math.round(((usersNewCount - usersPreviousCount) / usersPreviousCount) * 100)
      : usersNewCount > 0 ? 100 : 0;

  const usersTimeSeriesData = await generateCustomRangeData('users', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
  
  // Format users time series with proper dates
  const usersTimeSeries = usersTimeSeriesData.last12Months.map((item, index) => {
    // Try to parse the date from the month label, or use a calculated date
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const intervalDays = daysDiff <= 31 ? 1 : 7;
    const itemDate = new Date(startDate);
    itemDate.setDate(itemDate.getDate() + index * intervalDays);
    return {
      date: itemDate.toISOString().split('T')[0],
      count: item.count,
    };
  });

  // Subscriptions analytics
  const [subsActive, subsTotal, subsRevenue, subsMRR] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_subscriptions 
       WHERE status = 'active' AND created_at <= $1`,
      [endDate]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_subscriptions 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ),
    query<{ revenue: string }>(
      `SELECT COALESCE(SUM(sp.amount_cents), 0) / 100.0 as revenue
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.created_at >= $1 AND us.created_at <= $2
       AND us.status = 'active'`,
      [startDate, endDate]
    ),
    query<{ mrr: string }>(
      `SELECT COALESCE(SUM(CASE WHEN sp.interval = 'month' THEN sp.amount_cents ELSE sp.amount_cents / 12 END), 0) / 100.0 as mrr
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.status = 'active'`,
      []
    ),
  ]);

  const subsActiveCount = parseInt(subsActive.rows[0]?.count || '0', 10);
  const subsTotalCount = parseInt(subsTotal.rows[0]?.count || '0', 10);
  const subsRevenueTotal = parseFloat(subsRevenue.rows[0]?.revenue || '0');
  const subsMRRValue = parseFloat(subsMRR.rows[0]?.mrr || '0');

  // Calculate churn rate (simplified: canceled in period / active at start)
  const [churned, activeAtStart] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_subscriptions 
       WHERE status = 'canceled' AND canceled_at >= $1 AND canceled_at <= $2`,
      [startDate, endDate]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_subscriptions 
       WHERE status = 'active' AND created_at < $1`,
      [startDate]
    ),
  ]);

  const churnedCount = parseInt(churned.rows[0]?.count || '0', 10);
  const activeAtStartCount = parseInt(activeAtStart.rows[0]?.count || '0', 10);
  const churnRate = activeAtStartCount > 0 ? Math.round((churnedCount / activeAtStartCount) * 100) : 0;

  const subsByPlan = await generateSubscriptionDistribution(startDate, endDate);
  const subsTimeSeries = await generateRevenueTimeSeries(startDate, endDate);

  // Revenue analytics
  const revenueTimeSeries = subsTimeSeries.map(item => ({
    date: item.date,
    revenue: item.revenue,
  }));

  // Visitors analytics (from visitor_visits table)
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const [visitorsTotal, visitorsUnique, visitorsPageViews, visitorsCountries, visitorsByCountry, visitorsTimeSeries] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM visitor_visits 
       WHERE (visited_at AT TIME ZONE 'UTC')::date >= $1::date 
       AND (visited_at AT TIME ZONE 'UTC')::date <= $2::date`,
      [startDateStr, endDateStr]
    ).catch(() => ({ rows: [{ count: '0' }] })),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT visitor_key) as count FROM visitor_visits 
       WHERE (visited_at AT TIME ZONE 'UTC')::date >= $1::date 
       AND (visited_at AT TIME ZONE 'UTC')::date <= $2::date`,
      [startDateStr, endDateStr]
    ).catch(() => ({ rows: [{ count: '0' }] })),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM visitor_visits 
       WHERE (visited_at AT TIME ZONE 'UTC')::date >= $1::date 
       AND (visited_at AT TIME ZONE 'UTC')::date <= $2::date`,
      [startDateStr, endDateStr]
    ).catch(() => ({ rows: [{ count: '0' }] })),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT country_code) as count FROM visitor_visits 
       WHERE (visited_at AT TIME ZONE 'UTC')::date >= $1::date 
       AND (visited_at AT TIME ZONE 'UTC')::date <= $2::date 
       AND country_code IS NOT NULL`,
      [startDateStr, endDateStr]
    ).catch(() => ({ rows: [{ count: '0' }] })),
    query<{ country_code: string; country_name: string | null; unique_visitors: string }>(
      `SELECT 
         COALESCE(country_code, 'XX') AS country_code,
         COALESCE(country_name, 'Unknown') AS country_name,
         COUNT(DISTINCT visitor_key)::text AS unique_visitors
       FROM visitor_visits
       WHERE (visited_at AT TIME ZONE 'UTC')::date >= $1::date 
       AND (visited_at AT TIME ZONE 'UTC')::date <= $2::date
       GROUP BY country_code, country_name
       ORDER BY unique_visitors DESC`,
      [startDateStr, endDateStr]
    ).catch(() => ({ rows: [] })),
    query<{ date: string; unique_visitors: string }>(
      `SELECT
         (visited_at AT TIME ZONE 'UTC')::date::text AS date,
         COUNT(DISTINCT visitor_key)::text AS unique_visitors
       FROM visitor_visits
       WHERE (visited_at AT TIME ZONE 'UTC')::date >= $1::date
         AND (visited_at AT TIME ZONE 'UTC')::date <= $2::date
       GROUP BY (visited_at AT TIME ZONE 'UTC')::date
       ORDER BY date ASC`,
      [startDateStr, endDateStr]
    ).catch(() => ({ rows: [] }))
  ]);

  // Blogs analytics
  const [blogsTotal, blogsPublished, blogsViews, blogsEngagement] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) as count FROM blogs'),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM blogs 
       WHERE status = 'published' AND published_at >= $1 AND published_at <= $2`,
      [startDate, endDate]
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(views), 0) as total FROM blogs 
       WHERE published_at >= $1 AND published_at <= $2`,
      [startDate, endDate]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM blog_reactions 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ),
  ]);

  const blogsTotalCount = parseInt(blogsTotal.rows[0]?.count || '0', 10);
  const blogsPublishedCount = parseInt(blogsPublished.rows[0]?.count || '0', 10);
  const blogsViewsTotal = parseInt(blogsViews.rows[0]?.total || '0', 10);
  const blogsEngagementCount = parseInt(blogsEngagement.rows[0]?.count || '0', 10);

  const blogsTimeSeriesData = await generateCustomRangeData('blogs', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], 'published_at');
  
  // Format blogs time series with proper dates
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const intervalDays = daysDiff <= 31 ? 1 : 7;
  const blogsTimeSeries = blogsTimeSeriesData.last12Months.map((item, index) => {
    const itemDate = new Date(startDate);
    itemDate.setDate(itemDate.getDate() + index * intervalDays);
    return {
      date: itemDate.toISOString().split('T')[0],
      views: item.count,
    };
  });

  // Contacts analytics
  const [contactsTotal, contactsPending, contactsResolved, contactsResponseTime] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM contact_submissions 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM contact_submissions 
       WHERE status IN ('new', 'read', 'in_progress') AND created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM contact_submissions 
       WHERE status = 'resolved' AND created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ),
    query<{ avg: string }>(
      `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0) as avg
       FROM contact_submissions 
       WHERE status = 'resolved' AND resolved_at >= $1 AND resolved_at <= $2`,
      [startDate, endDate]
    ),
  ]);

  // Webinars analytics
  const [webinarsTotal, webinarsRegistrations, webinarsAttendance] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM webinars 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ).catch(() => ({ rows: [{ count: '0' }] })),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM webinar_registrations 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ).catch(() => ({ rows: [{ count: '0' }] })),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM webinar_registrations 
       WHERE attended = true AND created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ).catch(() => ({ rows: [{ count: '0' }] })),
  ]);

  const webinarsTotalCount = parseInt(webinarsTotal.rows[0]?.count || '0', 10);
  const webinarsRegistrationsCount = parseInt(webinarsRegistrations.rows[0]?.count || '0', 10);
  const webinarsAttendanceCount = parseInt(webinarsAttendance.rows[0]?.count || '0', 10);
  const webinarsAttendanceRate =
    webinarsRegistrationsCount > 0
      ? Math.round((webinarsAttendanceCount / webinarsRegistrationsCount) * 100)
      : 0;

  // Community analytics
  const [communityPosts, communityReplies] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM community_posts 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ).catch(() => ({ rows: [{ count: '0' }] })),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM community_replies 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    ).catch(() => ({ rows: [{ count: '0' }] })),
  ]);

  const communityPostsCount = parseInt(communityPosts.rows[0]?.count || '0', 10);
  const communityRepliesCount = parseInt(communityReplies.rows[0]?.count || '0', 10);
  const communityEngagement = communityPostsCount + communityRepliesCount;

  return {
    users: {
      total: usersTotalCount,
      active: usersActiveCount,
      new: usersNewCount,
      growthRate: usersGrowthRate,
      timeSeries: usersTimeSeries,
    },
    subscriptions: {
      active: subsActiveCount,
      total: subsTotalCount,
      revenue: subsRevenueTotal,
      mrr: subsMRRValue,
      churnRate,
      byPlan: subsByPlan,
      timeSeries: subsTimeSeries,
    },
    revenue: {
      total: subsRevenueTotal,
      monthly: subsMRRValue,
      timeSeries: revenueTimeSeries,
    },
    visitors: {
      total: parseInt(visitorsTotal.rows[0]?.count || '0', 10),
      unique: parseInt(visitorsUnique.rows[0]?.count || '0', 10),
      pageViews: parseInt(visitorsPageViews.rows[0]?.count || '0', 10),
      countries: parseInt(visitorsCountries.rows[0]?.count || '0', 10),
      byCountry: visitorsByCountry.rows.map(row => ({
        countryCode: row.country_code,
        countryName: row.country_name || 'Unknown',
        uniqueVisitors: parseInt(row.unique_visitors, 10),
      })),
      timeSeries: visitorsTimeSeries.rows.map(row => ({
        date: row.date,
        unique: parseInt(row.unique_visitors, 10),
        pageViews: parseInt(row.unique_visitors, 10), // Using unique visitors as proxy for pageViews
      })),
    },
    blogs: {
      total: blogsTotalCount,
      published: blogsPublishedCount,
      views: blogsViewsTotal,
      engagement: blogsEngagementCount,
      timeSeries: blogsTimeSeries,
    },
    contacts: {
      total: parseInt(contactsTotal.rows[0]?.count || '0', 10),
      pending: parseInt(contactsPending.rows[0]?.count || '0', 10),
      resolved: parseInt(contactsResolved.rows[0]?.count || '0', 10),
      avgResponseTime: parseFloat(contactsResponseTime.rows[0]?.avg || '0'),
    },
    webinars: {
      total: webinarsTotalCount,
      registrations: webinarsRegistrationsCount,
      attendance: webinarsAttendanceCount,
      attendanceRate: webinarsAttendanceRate,
    },
    community: {
      posts: communityPostsCount,
      replies: communityRepliesCount,
      engagement: communityEngagement,
    },
  };
}

