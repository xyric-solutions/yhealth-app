'use client';

import { useState, useEffect } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/whoop/DateRangePicker';
import { Skeleton } from '@/components/ui/skeleton';

export function StrainChart() {
  // Initialize with last 7 days by default
  const getDefaultDateRange = () => {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    return { from: startDate, to: endDate };
  };

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(
    getDefaultDateRange()
  );

  // Build query string with date range
  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.append('days', '30'); // Default
    if (dateRange.from) {
      params.append('startDate', dateRange.from.toISOString().split('T')[0]);
    }
    if (dateRange.to) {
      params.append('endDate', dateRange.to.toISOString().split('T')[0]);
    }
    return params.toString();
  };

  const queryString = buildQueryString();
  const endpoint = `/whoop/analytics/strain?${queryString}`;

  const { data, isLoading, error, refetch } = useFetch<{
    trends: Array<{
      date: string;
      strain_score: number;
      strain_score_normalized: number;
      avg_heart_rate_bpm: number;
    }>;
  }>(endpoint, {
    immediate: true,
    deps: [dateRange.from?.toISOString(), dateRange.to?.toISOString()], // Refetch when date range changes
  });

  // Listen for refresh events from parent
  useEffect(() => {
    const handleRefresh = () => refetch();
    window.addEventListener('whoop-refresh-requested', handleRefresh);
    return () => window.removeEventListener('whoop-refresh-requested', handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = async () => {
    try {
      await refetch();
      toast.success('Refreshing strain data...');
    } catch (_err) {
      toast.error('Failed to refresh strain data');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Range Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[280px] sm:h-[400px] w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-500/10 backdrop-blur-sm border border-red-500/20 p-4 sm:p-6 transition-all duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              <div>
                <p className="text-[13px] sm:text-[14px] text-red-400 font-medium">Failed to load strain data</p>
                <p className="text-[13px] sm:text-[14px] text-red-300/70 mt-1">
                  {error.message || 'Unable to fetch strain trends. Please check your connection and try again.'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      ) : !data || !data.trends || data.trends.length === 0 ? (
        <div className="rounded-xl bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 p-4 sm:p-6 transition-all duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              <div>
                <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No strain data available</p>
                <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
                  No strain data found for the selected date range. Make sure your WHOOP device is syncing data regularly.
                </p>
              </div>
            </div>
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 sm:p-6 transition-all duration-300 hover:bg-white/10 hover:shadow-lg">
          <h3 className="text-[16px] sm:text-[18px] font-semibold text-white mb-3 sm:mb-4">Strain Patterns</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.trends.map((item) => ({
              date: format(parseISO(item.date), 'MMM d'),
              strain: item.strain_score,
              normalized: item.strain_score_normalized,
              hr: item.avg_heart_rate_bpm,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  backdropFilter: 'blur(10px)',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="strain"
                stroke="#A855F7"
                strokeWidth={2}
                name="Strain Score"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="normalized"
                stroke="#EC4899"
                strokeWidth={2}
                name="Normalized (%)"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="hr"
                stroke="#F59E0B"
                strokeWidth={2}
                name="Avg HR (bpm)"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
