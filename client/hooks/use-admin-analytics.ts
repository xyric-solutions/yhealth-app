'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { format, subDays } from 'date-fns';

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
    timeSeries: Array<{ date: string; uniqueVisitors: number }>;
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

export interface DateRange {
  start: string;
  end: string;
}

function getDefaultDateRange(): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = subDays(end, 30);
  start.setHours(0, 0, 0, 0);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export function useAdminAnalytics(initialDateRange?: DateRange) {
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange || getDefaultDateRange());
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await api.get<AnalyticsOverview>(
        `/admin/analytics/overview?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );

      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError('Failed to load analytics data');
        setData(null);
      }
    } catch (err) {
      setError('Failed to load analytics data');
      setData(null);
      console.error('Analytics fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.start, dateRange.end]);

  const updateDateRange = (newRange: DateRange) => {
    setDateRange(newRange);
  };

  const refetch = () => {
    fetchAnalytics();
  };

  return {
    data,
    isLoading,
    error,
    dateRange,
    updateDateRange,
    refetch,
  };
}

