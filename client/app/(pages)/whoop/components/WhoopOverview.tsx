'use client';

import { useState, useEffect } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/whoop/DateRangePicker';
import { validateAndAdjustDateRange, MAX_DATE_RANGE_DAYS } from '@/lib/utils/date-range-validation';

export function WhoopOverview() {
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

  // Handle date range changes with validation
  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    const validated = validateAndAdjustDateRange(range, true);
    setDateRange(validated);
  };

  // Build query string with date range
  const buildQueryString = () => {
    const validatedRange = validateAndAdjustDateRange(dateRange, false);
    const params = new URLSearchParams();
    if (validatedRange.from) {
      params.append('startDate', validatedRange.from.toISOString().split('T')[0]);
    }
    if (validatedRange.to) {
      params.append('endDate', validatedRange.to.toISOString().split('T')[0]);
    }
    return params.toString();
  };

  const queryString = buildQueryString();
  const endpoint = queryString 
    ? `/whoop/analytics/overview?${queryString}`
    : '/whoop/analytics/overview';

  const { data, isLoading, error, refetch } = useFetch<{
    trends: {
      recovery7d: number[] | Array<{ date: string; value: number }>;
      sleep7d: number[] | Array<{ date: string; value: number }>;
      strain7d: number[] | Array<{ date: string; value: number }>;
    };
  }>(endpoint, {
    immediate: true,
    deps: [dateRange.from?.toISOString(), dateRange.to?.toISOString()], // Refetch when date range changes
  });

  // Listen for refresh events from parent (visibility change, manual refresh)
  useEffect(() => {
    const handleRefresh = () => refetch();
    window.addEventListener('whoop-refresh-requested', handleRefresh);
    return () => window.removeEventListener('whoop-refresh-requested', handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { mutate: triggerSync, isLoading: isSyncing } = useApiMutation({
    onSuccess: () => {
      toast.success('Sync started! Data will appear shortly...');
      // Refetch after a short delay to get new data
      setTimeout(() => {
        refetch();
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync data');
    },
  });

  const handleRetry = async () => {
    try {
      await refetch();
      toast.success('Refreshing trends...');
    } catch {
      toast.error('Failed to refresh trends');
    }
  };

  const handleSync = () => {
    triggerSync('/integrations/whoop/sync', {});
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Range Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSync}
            variant="outline"
            size="sm"
            disabled={isSyncing}
            className="bg-background/50 backdrop-blur-sm border-border/50 hover:bg-accent/50 transition-all"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Data
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400 mb-2" />
          <span>Loading trends...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 sm:p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              <div>
                <p className="text-[13px] sm:text-[14px] text-red-400 font-medium">Failed to load trends</p>
                <p className="text-[13px] sm:text-[14px] text-red-300/70 mt-1">
                  {error.message || 'Unable to fetch WHOOP trends. Please check your connection and try again.'}
                </p>
                {error.message?.includes('90 days') && (
                  <p className="text-xs text-red-300/50 mt-2">
                    💡 Tip: Date range is automatically limited to {MAX_DATE_RANGE_DAYS} days. The range has been adjusted.
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={() => {
                // Auto-adjust date range if error is about 90 days
                if (error.message?.includes('90 days') && dateRange.from && dateRange.to) {
                  const adjusted = validateAndAdjustDateRange(dateRange, true);
                  setDateRange(adjusted);
                }
                handleRetry();
              }}
              variant="outline"
              size="sm"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      ) : !data ? (
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 sm:p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              <div>
                <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No trend data available</p>
                <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
                  Unable to load WHOOP trends. Please try refreshing.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSync}
                variant="outline"
                size="sm"
                disabled={isSyncing}
                className="bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync Data'}
              </Button>
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
                className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      ) : !data.trends || 
          ((!data.trends.recovery7d || (Array.isArray(data.trends.recovery7d) && data.trends.recovery7d.length === 0)) &&
           (!data.trends.sleep7d || (Array.isArray(data.trends.sleep7d) && data.trends.sleep7d.length === 0)) &&
           (!data.trends.strain7d || (Array.isArray(data.trends.strain7d) && data.trends.strain7d.length === 0))) ? (
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 sm:p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              <div>
                <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No trend data available</p>
                <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
                  WHOOP data hasn&apos;t been synced yet. Your device is connected, but no historical data has been received. This usually means:
                  <br />• Data sync may take a few minutes after connecting
                  <br />• Make sure your WHOOP device is actively tracking and syncing
                  <br />• Historical data will appear once your device syncs
                  <br />• Try refreshing or check back later
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSync}
                variant="outline"
                size="sm"
                disabled={isSyncing}
                className="bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync Data'}
              </Button>
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
                className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      ) : (() => {
        // Check if all trends are empty (all zeros or empty)
        const hasData = (data.trends.recovery7d && Array.isArray(data.trends.recovery7d) && data.trends.recovery7d.length > 0 && data.trends.recovery7d.some(v => (typeof v === 'number' ? v > 0 : (v as { value: number }).value > 0))) ||
                        (data.trends.sleep7d && Array.isArray(data.trends.sleep7d) && data.trends.sleep7d.length > 0 && data.trends.sleep7d.some(v => (typeof v === 'number' ? v > 0 : (v as { value: number }).value > 0))) ||
                        (data.trends.strain7d && Array.isArray(data.trends.strain7d) && data.trends.strain7d.length > 0 && data.trends.strain7d.some(v => (typeof v === 'number' ? v > 0 : (v as { value: number }).value > 0)));

        if (!hasData) {
          return (
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 sm:p-6 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  <div>
                    <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No trend data available</p>
                    <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
                      No data points found for the selected date range. Make sure your WHOOP device is syncing data regularly.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSync}
                    variant="outline"
                    size="sm"
                    disabled={isSyncing}
                    className="bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {isSyncing ? 'Syncing...' : 'Sync Data'}
                  </Button>
                  <Button
                    onClick={handleRetry}
                    variant="outline"
                    size="sm"
                    className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        // Create chart data from trends - merge all data by date
        const dateMap = new Map<string, { recovery: number; sleep: number; strain: number; date: Date }>();
        
        // Get date range for generating dates when data is just numbers
        const validatedRange = validateAndAdjustDateRange(dateRange, false);
        const startDate = validatedRange.from || getDefaultDateRange().from;
        const endDate = validatedRange.to || getDefaultDateRange().to;
        
        // Helper to get date for index when data is just numbers
        const getDateForIndex = (index: number, total: number): Date => {
          if (total === 0) return startDate;
          const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const daysPerPoint = daysDiff / Math.max(1, total - 1);
          const date = new Date(startDate);
          date.setDate(date.getDate() + Math.round(index * daysPerPoint));
          return date;
        };
        
        // Process recovery data
        data.trends.recovery7d.forEach((item, index) => {
          let date: Date;
          let value: number;
          
          if (typeof item === 'number') {
            value = item;
            date = getDateForIndex(index, data.trends.recovery7d.length);
          } else {
            value = item.value;
            date = new Date(item.date);
          }
          
          const key = date.toISOString().split('T')[0];
          if (!dateMap.has(key)) {
            dateMap.set(key, { recovery: 0, sleep: 0, strain: 0, date });
          }
          dateMap.get(key)!.recovery = value;
        });
        
        // Process sleep data
        data.trends.sleep7d.forEach((item, index) => {
          let date: Date;
          let value: number;
          
          if (typeof item === 'number') {
            value = item;
            date = getDateForIndex(index, data.trends.sleep7d.length);
          } else {
            value = item.value;
            date = new Date(item.date);
          }
          
          const key = date.toISOString().split('T')[0];
          if (!dateMap.has(key)) {
            dateMap.set(key, { recovery: 0, sleep: 0, strain: 0, date });
          }
          dateMap.get(key)!.sleep = value;
        });
        
        // Process strain data
        data.trends.strain7d.forEach((item, index) => {
          let date: Date;
          let value: number;
          
          if (typeof item === 'number') {
            value = item;
            date = getDateForIndex(index, data.trends.strain7d.length);
          } else {
            value = item.value;
            date = new Date(item.date);
          }
          
          const key = date.toISOString().split('T')[0];
          if (!dateMap.has(key)) {
            dateMap.set(key, { recovery: 0, sleep: 0, strain: 0, date });
          }
          dateMap.get(key)!.strain = value;
        });
        
        // Convert to array and sort by date
        const chartData = Array.from(dateMap.values())
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((item) => ({
            date: format(item.date, 'MMM d'),
            fullDate: item.date,
            recovery: item.recovery || 0,
            sleep: item.sleep ? Math.round((item.sleep / 60) * 10) / 10 : 0, // Convert minutes to hours
            strain: item.strain || 0,
          }));

        return (
          <div className="relative rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 p-4 sm:p-8 transition-all duration-500 hover:from-white/15 hover:to-white/10 hover:shadow-2xl hover:shadow-purple-500/20 group">
            {/* Decorative gradient overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                <div>
                  <h3 className="text-[18px] sm:text-[20px] font-bold mb-1 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Trends
                  </h3>
                  <p className="text-[13px] sm:text-[14px] text-slate-400">Historical performance metrics</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-xs text-red-300 font-medium">Recovery</span>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-xs text-blue-300 font-medium">Sleep</span>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                      <span className="text-xs text-purple-300 font-medium">Strain</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={280}>
                <LineChart 
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="strainGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A855F7" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#A855F7" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#374151" 
                    opacity={0.3}
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={{ stroke: '#374151' }}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={{ stroke: '#374151' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(31, 41, 55, 0.95)',
                      border: '1px solid rgba(55, 65, 81, 0.5)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                      padding: '12px',
                    }}
                    labelStyle={{ color: '#E5E7EB', fontWeight: 600, marginBottom: '8px' }}
                    itemStyle={{ color: '#E5E7EB', padding: '4px 0' }}
                    cursor={{ stroke: '#6366F1', strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                    formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="recovery"
                    stroke="#EF4444"
                    strokeWidth={3}
                    name="Recovery"
                    dot={{ r: 5, fill: '#EF4444', strokeWidth: 2, stroke: '#1F2937' }}
                    activeDot={{ r: 8, fill: '#EF4444', strokeWidth: 2, stroke: '#1F2937' }}
                    strokeLinecap="round"
                    animationDuration={1000}
                  />
                  <Line
                    type="monotone"
                    dataKey="sleep"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    name="Sleep (hrs)"
                    dot={{ r: 5, fill: '#3B82F6', strokeWidth: 2, stroke: '#1F2937' }}
                    activeDot={{ r: 8, fill: '#3B82F6', strokeWidth: 2, stroke: '#1F2937' }}
                    strokeLinecap="round"
                    animationDuration={1000}
                  />
                  <Line
                    type="monotone"
                    dataKey="strain"
                    stroke="#A855F7"
                    strokeWidth={3}
                    name="Strain"
                    dot={{ r: 5, fill: '#A855F7', strokeWidth: 2, stroke: '#1F2937' }}
                    activeDot={{ r: 8, fill: '#A855F7', strokeWidth: 2, stroke: '#1F2937' }}
                    strokeLinecap="round"
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
