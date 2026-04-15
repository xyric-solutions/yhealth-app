'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown, Minus, Heart, Activity, Moon, Zap, ChevronLeft, ChevronRight, Thermometer, Droplet, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/whoop/DateRangePicker';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { validateAndAdjustDateRange, MAX_DATE_RANGE_DAYS } from '@/lib/utils/date-range-validation';

interface StageSummary {
  // Standard field names
  total_sleep_time_milli?: number;
  awake_time_milli?: number;
  light_sleep_time_milli?: number;
  slow_wave_sleep_time_milli?: number;
  rem_sleep_time_milli?: number;
  // Alternative WHOOP API field name variations
  total_in_bed_time_milli?: number;
  sleep_duration_milli?: number;
  total_light_sleep_time_milli?: number;
  total_slow_wave_sleep_time_milli?: number;
  deep_sleep_time_milli?: number;
  total_deep_sleep_time_milli?: number;
  total_rem_sleep_time_milli?: number;
  total_awake_time_milli?: number;
}

interface Cycle {
  id: number;
  start: string;
  end: string;
  timezone_offset: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  };
  sleep?: {
    start?: string;
    end?: string;
    score?: {
      sleep_performance_percentage?: number;
      sleep_efficiency_percentage?: number;
      sleep_consistency_percentage?: number;
      sleep_needed?: {
        baseline_milliseconds?: number;
        need_from_sleep_debt_milliseconds?: number;
        need_from_recent_strain_milliseconds?: number;
        need_from_recent_nap_milliseconds?: number;
      };
      respiratory_rate?: number;
      stage_summary?: StageSummary;
    };
    stage_summary?: StageSummary;
  };
  recovery?: {
    score?: {
      recovery_score?: number;
      resting_heart_rate?: number;
      hrv_rmssd_milli?: number;
      spo2_percentage?: number;
      skin_temp_celsius?: number;
      cardiovascular_load?: number;
      respiratory_load?: number;
    };
  };
}

interface CyclesData {
  cycles: Cycle[];
}

interface MetricAverage {
  recovery: number;
  rhr: number;
  hrv: number;
  sleepPerformance: number;
  sleepEfficiency: number;
  strain: number;
  calories: number;
  maxHR: number;
  avgHR: number;
  spo2: number;
  skinTemp: number;
  respiratoryRate: number;
  inBedTime: number;
  totalSleep: number;
  lightSleep: number;
  deepSleep: number;
  remSleep: number;
}

interface CycleRow {
  cycle: Cycle;
  recovery: number | null;
  rhr: number | null;
  hrv: number | null;
  sleepPerformance: number | null;
  sleepEfficiency: number | null;
  strain: number | null;
  calories: number | null;
  maxHR: number | null;
  avgHR: number | null;
  spo2: number | null;
  skinTemp: number | null;
  respiratoryRate: number | null;
  sleepOnset: string | null;
  wakeOnset: string | null;
  inBedTime: number | null; // minutes
  totalSleep: number | null; // minutes
  lightSleep: number | null; // minutes
  deepSleep: number | null; // minutes
  remSleep: number | null; // minutes
}

export function RecoveriesTable() {
  const getDefaultDateRange = () => {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 21); // 3 weeks (21 days)
    startDate.setHours(0, 0, 0, 0);
    return { from: startDate, to: endDate };
  };

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(
    getDefaultDateRange()
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Handle date range changes with validation and reset pagination
  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    const validated = validateAndAdjustDateRange(range, true);
    setDateRange(validated);
    // Reset to page 1 when date range changes
    setCurrentPage(1);
  };

  // Always validate date range before using it - this ensures we never send invalid ranges
  const getValidatedDateRange = () => {
    if (!dateRange.from || !dateRange.to) {
      return getDefaultDateRange();
    }
    // Always validate - this is the critical safety check
    return validateAndAdjustDateRange(dateRange, false);
  };

  // Update state if validation adjusted the range (use effect to avoid render issues)
  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      const validatedRange = validateAndAdjustDateRange(dateRange, false);
      const originalDays = Math.ceil(
        (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
      );
      const validatedDays = Math.ceil(
        ((validatedRange.to?.getTime() ?? Date.now()) - (validatedRange.from?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24)
      );
      
      // If range was adjusted, update state
      if (originalDays > MAX_DATE_RANGE_DAYS && validatedDays <= MAX_DATE_RANGE_DAYS) {
        if (validatedRange.from && validatedRange.to &&
            (validatedRange.from.getTime() !== dateRange.from.getTime() || 
            validatedRange.to.getTime() !== dateRange.to.getTime())) {
          setDateRange(validatedRange);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.from?.toISOString(), dateRange.to?.toISOString()]);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    
    // Always get validated date range (no caching, always fresh validation)
    const validatedRange = getValidatedDateRange();
    
    if (validatedRange.from && validatedRange.to) {
      // When date range is provided, don't send days parameter
      // The controller will use the date range instead
      // Only send the dates to ensure the filter works correctly
      const safeStartDate = validatedRange.from.toISOString().split('T')[0];
      const safeEndDate = validatedRange.to.toISOString().split('T')[0];
      
      params.append('startDate', safeStartDate);
      params.append('endDate', safeEndDate);
    } else {
      // Fallback to default 21 days (3 weeks) if no range
      params.append('days', '21');
    }
    
    return params.toString();
  };

  // Memoize query string to prevent unnecessary rebuilds
  const queryString = useMemo(() => {
    return buildQueryString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.from?.toISOString(), dateRange.to?.toISOString()]);

  const endpoint = `/whoop/analytics/cycles?${queryString}`;

  const { data, isLoading, error, refetch } = useFetch<CyclesData>(endpoint, {
    immediate: true,
    deps: [queryString], // Use queryString as dependency to refetch when it changes
  });

  useEffect(() => {
    const handleTabChange = (event: CustomEvent<{ tab: string }>) => {
      if (event.detail.tab === 'recoveries') {
        refetch();
      }
    };

    window.addEventListener('whoop-tab-changed', handleTabChange as EventListener);
    
    const timeoutId = setTimeout(() => {
      refetch();
    }, 150);
    
    return () => {
      window.removeEventListener('whoop-tab-changed', handleTabChange as EventListener);
      clearTimeout(timeoutId);
    };
  }, [refetch]);

  const handleRetry = async () => {
    try {
      await refetch();
      toast.success('Refreshing recoveries data...');
    } catch (_err) {
      toast.error('Failed to refresh recoveries data');
    }
  };

  // Calculate averages and prepare cycle rows
  const processCycles = (): { rows: CycleRow[]; averages: MetricAverage } | null => {
    if (!data?.cycles || data.cycles.length === 0) return null;

    const rows: CycleRow[] = [];
    const totals = {
      recovery: 0,
      rhr: 0,
      hrv: 0,
      sleepPerformance: 0,
      sleepEfficiency: 0,
      strain: 0,
      calories: 0,
      maxHR: 0,
      avgHR: 0,
      spo2: 0,
      skinTemp: 0,
      respiratoryRate: 0,
      inBedTime: 0,
      totalSleep: 0,
      lightSleep: 0,
      deepSleep: 0,
      remSleep: 0,
      counts: {
        recovery: 0,
        rhr: 0,
        hrv: 0,
        sleepPerformance: 0,
        sleepEfficiency: 0,
        strain: 0,
        calories: 0,
        maxHR: 0,
        avgHR: 0,
        spo2: 0,
        skinTemp: 0,
        respiratoryRate: 0,
        inBedTime: 0,
        totalSleep: 0,
        lightSleep: 0,
        deepSleep: 0,
        remSleep: 0,
      },
    };

    data.cycles.forEach((cycle) => {
      // Extract recovery data - handle both direct API response and normalized data
      // Recovery data structure: cycle.recovery.score.{recovery_score, resting_heart_rate, hrv_rmssd_milli, spo2_percentage, skin_temp_celsius}
      const recovery = cycle.recovery?.score?.recovery_score ?? null;
      const rhr = cycle.recovery?.score?.resting_heart_rate ?? null;
      // HRV is in milliseconds in API, keep in milliseconds for display (not converting to seconds)
      const hrv = cycle.recovery?.score?.hrv_rmssd_milli ?? null; // Keep in milliseconds
      
      // Extract sleep data
      const sleepPerformance = cycle.sleep?.score?.sleep_performance_percentage || null;
      const sleepEfficiency = cycle.sleep?.score?.sleep_efficiency_percentage || null;
      
      // Extract strain/cycle score data
      const strain = cycle.score?.strain || null;
      const calories = cycle.score?.kilojoule ? cycle.score.kilojoule / 4.184 : null; // Convert kJ to kcal
      const maxHR = cycle.score?.max_heart_rate || null;
      const avgHR = cycle.score?.average_heart_rate || null;
      
      // Extract recovery metrics
      // WHOOP API returns: spo2_percentage and skin_temp_celsius in recovery.score
      const spo2 = cycle.recovery?.score?.spo2_percentage ?? null;
      const skinTemp = cycle.recovery?.score?.skin_temp_celsius ?? null;
      
      // Extract sleep respiratory rate
      const respiratoryRate = cycle.sleep?.score?.respiratory_rate || null;
      
      // Sleep timing
      const sleepOnset = cycle.sleep?.start || null;
      const wakeOnset = cycle.sleep?.end || null;
      
      // Calculate in-bed time and sleep durations
      let inBedTime: number | null = null;
      let totalSleep: number | null = null;
      let lightSleep: number | null = null;
      let deepSleep: number | null = null;
      let remSleep: number | null = null;
      
      if (cycle.sleep?.start && cycle.sleep?.end) {
        const sleepStart = new Date(cycle.sleep.start);
        const sleepEnd = new Date(cycle.sleep.end);
        inBedTime = Math.round((sleepEnd.getTime() - sleepStart.getTime()) / (1000 * 60)); // minutes
      }
      
      // Extract sleep stage data - check multiple possible WHOOP API field structures
      // WHOOP API can return stage_summary at different locations and with different field names
      const stageSummary = cycle.sleep?.stage_summary
        || cycle.sleep?.score?.stage_summary
        || null;

      if (stageSummary) {
        // Total sleep: try multiple field name variations
        const totalSleepMilli = stageSummary.total_sleep_time_milli
          || stageSummary.total_in_bed_time_milli
          || stageSummary.sleep_duration_milli
          || null;
        totalSleep = totalSleepMilli ? Math.round(totalSleepMilli / (1000 * 60)) : null;

        // Light sleep: WHOOP API uses 'total_light_sleep_time_milli' or 'light_sleep_time_milli'
        const lightSleepMilli = stageSummary.light_sleep_time_milli
          || stageSummary.total_light_sleep_time_milli
          || null;
        lightSleep = lightSleepMilli ? Math.round(lightSleepMilli / (1000 * 60)) : null;

        // Deep sleep (slow wave): WHOOP API uses 'slow_wave_sleep_time_milli' or 'total_slow_wave_sleep_time_milli'
        const deepSleepMilli = stageSummary.slow_wave_sleep_time_milli
          || stageSummary.total_slow_wave_sleep_time_milli
          || stageSummary.deep_sleep_time_milli
          || stageSummary.total_deep_sleep_time_milli
          || null;
        deepSleep = deepSleepMilli ? Math.round(deepSleepMilli / (1000 * 60)) : null;

        // REM sleep: WHOOP API uses 'rem_sleep_time_milli' or 'total_rem_sleep_time_milli'
        const remSleepMilli = stageSummary.rem_sleep_time_milli
          || stageSummary.total_rem_sleep_time_milli
          || null;
        remSleep = remSleepMilli ? Math.round(remSleepMilli / (1000 * 60)) : null;

        // Calculate total sleep from stages if not available directly
        if (totalSleep === null && (lightSleep !== null || deepSleep !== null || remSleep !== null)) {
          totalSleep = (lightSleep || 0) + (deepSleep || 0) + (remSleep || 0);
        }
      }

      rows.push({
        cycle,
        recovery,
        rhr,
        hrv,
        sleepPerformance,
        sleepEfficiency,
        strain,
        calories,
        maxHR,
        avgHR,
        spo2,
        skinTemp,
        respiratoryRate,
        sleepOnset,
        wakeOnset,
        inBedTime,
        totalSleep,
        lightSleep,
        deepSleep,
        remSleep,
      });

      // Accumulate for averages
      if (recovery !== null) {
        totals.recovery += recovery;
        totals.counts.recovery++;
      }
      if (rhr !== null) {
        totals.rhr += rhr;
        totals.counts.rhr++;
      }
      if (hrv !== null) {
        totals.hrv += hrv;
        totals.counts.hrv++;
      }
      if (sleepPerformance !== null) {
        totals.sleepPerformance += sleepPerformance;
        totals.counts.sleepPerformance++;
      }
      if (sleepEfficiency !== null) {
        totals.sleepEfficiency += sleepEfficiency;
        totals.counts.sleepEfficiency++;
      }
      if (strain !== null) {
        totals.strain += strain;
        totals.counts.strain++;
      }
      if (calories !== null) {
        totals.calories += calories;
        totals.counts.calories++;
      }
      if (maxHR !== null) {
        totals.maxHR += maxHR;
        totals.counts.maxHR++;
      }
      if (avgHR !== null) {
        totals.avgHR += avgHR;
        totals.counts.avgHR++;
      }
      if (spo2 !== null) {
        totals.spo2 += spo2;
        totals.counts.spo2++;
      }
      if (skinTemp !== null) {
        totals.skinTemp += skinTemp;
        totals.counts.skinTemp++;
      }
      if (respiratoryRate !== null) {
        totals.respiratoryRate += respiratoryRate;
        totals.counts.respiratoryRate++;
      }
      if (inBedTime !== null) {
        totals.inBedTime += inBedTime;
        totals.counts.inBedTime++;
      }
      if (totalSleep !== null) {
        totals.totalSleep += totalSleep;
        totals.counts.totalSleep++;
      }
      if (lightSleep !== null) {
        totals.lightSleep += lightSleep;
        totals.counts.lightSleep++;
      }
      if (deepSleep !== null) {
        totals.deepSleep += deepSleep;
        totals.counts.deepSleep++;
      }
      if (remSleep !== null) {
        totals.remSleep += remSleep;
        totals.counts.remSleep++;
      }
    });

    const averages: MetricAverage = {
      recovery: totals.counts.recovery > 0 ? totals.recovery / totals.counts.recovery : 0,
      rhr: totals.counts.rhr > 0 ? totals.rhr / totals.counts.rhr : 0,
      hrv: totals.counts.hrv > 0 ? totals.hrv / totals.counts.hrv : 0,
      sleepPerformance: totals.counts.sleepPerformance > 0 ? totals.sleepPerformance / totals.counts.sleepPerformance : 0,
      sleepEfficiency: totals.counts.sleepEfficiency > 0 ? totals.sleepEfficiency / totals.counts.sleepEfficiency : 0,
      strain: totals.counts.strain > 0 ? totals.strain / totals.counts.strain : 0,
      calories: totals.counts.calories > 0 ? totals.calories / totals.counts.calories : 0,
      maxHR: totals.counts.maxHR > 0 ? totals.maxHR / totals.counts.maxHR : 0,
      avgHR: totals.counts.avgHR > 0 ? totals.avgHR / totals.counts.avgHR : 0,
      spo2: totals.counts.spo2 > 0 ? totals.spo2 / totals.counts.spo2 : 0,
      skinTemp: totals.counts.skinTemp > 0 ? totals.skinTemp / totals.counts.skinTemp : 0,
      respiratoryRate: totals.counts.respiratoryRate > 0 ? totals.respiratoryRate / totals.counts.respiratoryRate : 0,
      inBedTime: totals.counts.inBedTime > 0 ? totals.inBedTime / totals.counts.inBedTime : 0,
      totalSleep: totals.counts.totalSleep > 0 ? totals.totalSleep / totals.counts.totalSleep : 0,
      lightSleep: totals.counts.lightSleep > 0 ? totals.lightSleep / totals.counts.lightSleep : 0,
      deepSleep: totals.counts.deepSleep > 0 ? totals.deepSleep / totals.counts.deepSleep : 0,
      remSleep: totals.counts.remSleep > 0 ? totals.remSleep / totals.counts.remSleep : 0,
    };

    return { rows, averages };
  };

  const processedData = processCycles();

  // Pagination calculations
  const totalRows = processedData?.rows.length || 0;
  const totalPages = Math.ceil(totalRows / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRows = processedData?.rows.slice(startIndex, endIndex) || [];

  // Reset to page 1 when data changes or date range changes
  useEffect(() => {
    setCurrentPage(1);
  }, [processedData?.rows.length, queryString]);

  const getTrendIndicator = (value: number | null, average: number, higherIsBetter: boolean = true) => {
    if (value === null || average === 0) {
      return { icon: Minus, color: 'text-slate-500', diff: 0 };
    }

    const diff = ((value - average) / average) * 100;
    const isBetter = higherIsBetter ? diff > 0 : diff < 0;
    const isWorse = higherIsBetter ? diff < 0 : diff > 0;

    if (Math.abs(diff) < 1) {
      // Within 1% - consider it similar
      return { icon: Minus, color: 'text-slate-500', diff };
    }

    if (isBetter) {
      return { icon: TrendingUp, color: 'text-green-400', diff };
    } else if (isWorse) {
      return { icon: TrendingDown, color: 'text-orange-400', diff };
    }

    return { icon: Minus, color: 'text-slate-500', diff };
  };

  const formatTimezone = (offset: string) => {
    if (!offset) return 'N/A';
    // Convert offset like "-05:00" to "UTC-05:00"
    return offset.startsWith('-') || offset.startsWith('+') ? `UTC${offset}` : offset;
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === 0) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h${mins > 0 ? `${mins}m` : ''}`;
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '--';
    try {
      return format(new Date(dateString), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return '--';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        </div>
        <div className="rounded-xl bg-red-500/10 backdrop-blur-sm border border-red-500/20 p-4 sm:p-6 transition-all duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              <div>
                <p className="text-[13px] sm:text-[14px] text-red-400 font-medium">Failed to load recoveries data</p>
                <p className="text-[13px] sm:text-[14px] text-red-300/70 mt-1">
                  {error.message || 'Unable to fetch recoveries data. Please check your connection and try again.'}
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
      </div>
    );
  }

  if (!processedData || processedData.rows.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        </div>
        <div className="rounded-xl bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 p-4 sm:p-6 transition-all duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              <div>
                <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No recoveries data available</p>
                <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
                  No recovery data found for the selected date range. Make sure your WHOOP device is syncing data regularly.
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
      </div>
    );
  }

  const { averages } = processedData;
  const isCurrentlyActive = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    return end > now;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Range Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
      </div>

      {/* Description */}
      <div className="rounded-xl bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 p-3 sm:p-4">
        <p className="text-[13px] sm:text-[14px] text-blue-300/90 leading-relaxed">
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          <strong className="text-blue-400">WHOOP measures "physiological cycles"</strong> instead of 24-hour days: a cycle is measured from the moment you fall asleep one night to when you fall asleep the next. Average values for the selected time range are displayed in the header of each column. 
          <span className="inline-flex items-center gap-1 mx-1">
            <TrendingUp className="w-3 h-3 text-green-400" />
          </span>
          Green arrows indicate better than average, 
          <span className="inline-flex items-center gap-1 mx-1">
            <TrendingDown className="w-3 h-3 text-orange-400" />
          </span>
          orange arrows indicate worse than average.
        </p>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-slate-800/50">
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Cycle start time
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Cycle end time
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Timezone
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Heart className="w-3 h-3" />
                    Recovery {averages.recovery > 0 ? `${Math.round(averages.recovery)}%` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Heart className="w-3 h-3" />
                    RHR {averages.rhr > 0 ? `${Math.round(averages.rhr)} bpm` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Activity className="w-3 h-3" />
                    HRV {averages.hrv > 0 ? `${Math.round(averages.hrv)}ms` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" />
                    Sleep perf. {averages.sleepPerformance > 0 ? `${Math.round(averages.sleepPerformance)}%` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" />
                    Sleep efficiency {averages.sleepEfficiency > 0 ? `${Math.round(averages.sleepEfficiency)}%` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3" />
                    Day strain {averages.strain > 0 ? `${averages.strain.toFixed(1)}` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Activity className="w-3 h-3" />
                    Calories {averages.calories > 0 ? `${Math.round(averages.calories).toLocaleString()}` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Heart className="w-3 h-3" />
                    Max HR {averages.maxHR > 0 ? `${Math.round(averages.maxHR)} bpm` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Heart className="w-3 h-3" />
                    Avg HR {averages.avgHR > 0 ? `${Math.round(averages.avgHR)} bpm` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Thermometer className="w-3 h-3" />
                    Skin temp. {averages.skinTemp > 0 ? `${averages.skinTemp.toFixed(1)} °C` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Droplet className="w-3 h-3" />
                    SpO2 {averages.spo2 > 0 ? `${averages.spo2.toFixed(1)}%` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Wind className="w-3 h-3" />
                    Resp. rate {averages.respiratoryRate > 0 ? `${averages.respiratoryRate.toFixed(1)} rpm` : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Sleep onset
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Wake onset
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" />
                    In bed {averages.inBedTime > 0 ? formatDuration(averages.inBedTime) : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" />
                    Total sleep {averages.totalSleep > 0 ? formatDuration(averages.totalSleep) : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" />
                    Light sleep {averages.lightSleep > 0 ? formatDuration(averages.lightSleep) : ''}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1">
                    <Moon className="w-3 h-3" />
                    Deep sleep {averages.deepSleep > 0 ? formatDuration(averages.deepSleep) : ''}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedRows.map((row, index) => {
                const cycle = row.cycle;
                const cycleStart = new Date(cycle.start);
                const cycleEnd = new Date(cycle.end);
                const isActive = isCurrentlyActive(cycle.end);

                const recoveryTrend = getTrendIndicator(row.recovery, averages.recovery, true);
                const rhrTrend = getTrendIndicator(row.rhr, averages.rhr, false); // Lower is better
                const hrvTrend = getTrendIndicator(row.hrv, averages.hrv, true);
                const sleepPerfTrend = getTrendIndicator(row.sleepPerformance, averages.sleepPerformance, true);
                const sleepEffTrend = getTrendIndicator(row.sleepEfficiency, averages.sleepEfficiency, true);
                const strainTrend = getTrendIndicator(row.strain, averages.strain, false); // Lower is better for strain
                const caloriesTrend = getTrendIndicator(row.calories, averages.calories, false); // Context-dependent
                const maxHRTrend = getTrendIndicator(row.maxHR, averages.maxHR, false); // Lower is better
                const avgHRTrend = getTrendIndicator(row.avgHR, averages.avgHR, false); // Lower is better
                const skinTempTrend = getTrendIndicator(row.skinTemp, averages.skinTemp, true); // Higher is better (within normal range)
                const spo2Trend = getTrendIndicator(row.spo2, averages.spo2, true); // Higher is better
                const respiratoryRateTrend = getTrendIndicator(row.respiratoryRate, averages.respiratoryRate, false); // Lower is better
                const inBedTrend = getTrendIndicator(row.inBedTime, averages.inBedTime, true); // Higher is better
                const totalSleepTrend = getTrendIndicator(row.totalSleep, averages.totalSleep, true); // Higher is better
                const lightSleepTrend = getTrendIndicator(row.lightSleep, averages.lightSleep, false); // Lower is better (more deep/REM is better)
                const deepSleepTrend = getTrendIndicator(row.deepSleep, averages.deepSleep, true); // Higher is better

                return (
                  <motion.tr
                    key={cycle.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`hover:bg-white/5 transition-colors ${
                      isActive ? 'bg-green-500/10 border-l-2 border-l-green-500' : ''
                    }`}
                  >
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-white whitespace-nowrap">
                      {format(cycleStart, 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-white whitespace-nowrap">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-green-400 font-medium">
                          Currently active
                        </span>
                      ) : (
                        format(cycleEnd, 'yyyy-MM-dd HH:mm:ss')
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-slate-400 whitespace-nowrap">
                      {formatTimezone(cycle.timezone_offset)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.recovery !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{Math.round(row.recovery)}%</span>
                          <recoveryTrend.icon className={`w-4 h-4 ${recoveryTrend.color}`} />
                          <span className={`text-xs ${recoveryTrend.color}`}>
                            {recoveryTrend.diff > 0 ? '+' : ''}{recoveryTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.rhr !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{Math.round(row.rhr)}</span>
                          <span className="text-slate-400 text-xs">bpm</span>
                          <rhrTrend.icon className={`w-4 h-4 ${rhrTrend.color}`} />
                          <span className={`text-xs ${rhrTrend.color}`}>
                            {rhrTrend.diff > 0 ? '+' : ''}{rhrTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.hrv !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{Math.round(row.hrv)}</span>
                          <span className="text-slate-400 text-xs">ms</span>
                          <hrvTrend.icon className={`w-4 h-4 ${hrvTrend.color}`} />
                          <span className={`text-xs ${hrvTrend.color}`}>
                            {hrvTrend.diff > 0 ? '+' : ''}{hrvTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.sleepPerformance !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{Math.round(row.sleepPerformance)}%</span>
                          <sleepPerfTrend.icon className={`w-4 h-4 ${sleepPerfTrend.color}`} />
                          <span className={`text-xs ${sleepPerfTrend.color}`}>
                            {sleepPerfTrend.diff > 0 ? '+' : ''}{sleepPerfTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.sleepEfficiency !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{Math.round(row.sleepEfficiency)}%</span>
                          <sleepEffTrend.icon className={`w-4 h-4 ${sleepEffTrend.color}`} />
                          <span className={`text-xs ${sleepEffTrend.color}`}>
                            {sleepEffTrend.diff > 0 ? '+' : ''}{sleepEffTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.strain !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{row.strain.toFixed(1)}</span>
                          <strainTrend.icon className={`w-4 h-4 ${strainTrend.color}`} />
                          <span className={`text-xs ${strainTrend.color}`}>
                            {strainTrend.diff > 0 ? '+' : ''}{strainTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.calories !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{Math.round(row.calories).toLocaleString()}</span>
                          <caloriesTrend.icon className={`w-4 h-4 ${caloriesTrend.color}`} />
                          <span className={`text-xs ${caloriesTrend.color}`}>
                            {caloriesTrend.diff > 0 ? '+' : ''}{caloriesTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.maxHR !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{Math.round(row.maxHR)}</span>
                          <span className="text-slate-400 text-xs">bpm</span>
                          <maxHRTrend.icon className={`w-4 h-4 ${maxHRTrend.color}`} />
                          <span className={`text-xs ${maxHRTrend.color}`}>
                            {maxHRTrend.diff > 0 ? '+' : ''}{maxHRTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.avgHR !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{Math.round(row.avgHR)}</span>
                          <span className="text-slate-400 text-xs">bpm</span>
                          <avgHRTrend.icon className={`w-4 h-4 ${avgHRTrend.color}`} />
                          <span className={`text-xs ${avgHRTrend.color}`}>
                            {avgHRTrend.diff > 0 ? '+' : ''}{avgHRTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.skinTemp !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{row.skinTemp.toFixed(1)}</span>
                          <span className="text-slate-400 text-xs">°C</span>
                          <skinTempTrend.icon className={`w-4 h-4 ${skinTempTrend.color}`} />
                          <span className={`text-xs ${skinTempTrend.color}`}>
                            {skinTempTrend.diff > 0 ? '+' : ''}{skinTempTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.spo2 !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{row.spo2.toFixed(1)}</span>
                          <span className="text-slate-400 text-xs">%</span>
                          <spo2Trend.icon className={`w-4 h-4 ${spo2Trend.color}`} />
                          <span className={`text-xs ${spo2Trend.color}`}>
                            {spo2Trend.diff > 0 ? '+' : ''}{spo2Trend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.respiratoryRate !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{row.respiratoryRate.toFixed(1)}</span>
                          <span className="text-slate-400 text-xs">rpm</span>
                          <respiratoryRateTrend.icon className={`w-4 h-4 ${respiratoryRateTrend.color}`} />
                          <span className={`text-xs ${respiratoryRateTrend.color}`}>
                            {respiratoryRateTrend.diff > 0 ? '+' : ''}{respiratoryRateTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-white whitespace-nowrap">
                      {formatDateTime(row.sleepOnset)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-white whitespace-nowrap">
                      {formatDateTime(row.wakeOnset)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.inBedTime !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{formatDuration(row.inBedTime)}</span>
                          <inBedTrend.icon className={`w-4 h-4 ${inBedTrend.color}`} />
                          <span className={`text-xs ${inBedTrend.color}`}>
                            {inBedTrend.diff > 0 ? '+' : ''}{inBedTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.totalSleep !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{formatDuration(row.totalSleep)}</span>
                          <totalSleepTrend.icon className={`w-4 h-4 ${totalSleepTrend.color}`} />
                          <span className={`text-xs ${totalSleepTrend.color}`}>
                            {totalSleepTrend.diff > 0 ? '+' : ''}{totalSleepTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.lightSleep !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{formatDuration(row.lightSleep)}</span>
                          <lightSleepTrend.icon className={`w-4 h-4 ${lightSleepTrend.color}`} />
                          <span className={`text-xs ${lightSleepTrend.color}`}>
                            {lightSleepTrend.diff > 0 ? '+' : ''}{lightSleepTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-sm text-center">
                      {row.deepSleep !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-white font-medium">{formatDuration(row.deepSleep)}</span>
                          <deepSleepTrend.icon className={`w-4 h-4 ${deepSleepTrend.color}`} />
                          <span className={`text-xs ${deepSleepTrend.color}`}>
                            {deepSleepTrend.diff > 0 ? '+' : ''}{deepSleepTrend.diff.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3 sm:px-4 py-3 sm:py-4 border-t border-white/10 bg-slate-800/30"
          >
            {/* Items per page selector */}
            <div className="flex items-center gap-3">
              <span className="text-[13px] sm:text-[14px] text-slate-400">Rows per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-700/50 border border-white/10 text-white text-[13px] sm:text-[14px] focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-[13px] sm:text-[14px] text-slate-400">
                {startIndex + 1}-{Math.min(endIndex, totalRows)} of {totalRows}
              </span>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-slate-700/50 border-white/10 text-white hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {(() => {
                  const pages: (number | string)[] = [];
                  const maxVisible = 5;
                  
                  if (totalPages <= maxVisible) {
                    // Show all pages if total is less than max visible
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    // Always show first page
                    pages.push(1);
                    
                    if (currentPage > 3) {
                      pages.push('...');
                    }
                    
                    // Show pages around current page
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    
                    for (let i = start; i <= end; i++) {
                      if (i !== 1 && i !== totalPages) {
                        pages.push(i);
                      }
                    }
                    
                    if (currentPage < totalPages - 2) {
                      pages.push('...');
                    }
                    
                    // Always show last page
                    if (totalPages > 1) {
                      pages.push(totalPages);
                    }
                  }
                  
                  return pages.map((page, idx) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">
                          ...
                        </span>
                      );
                    }
                    
                    const pageNum = page as number;
                    const isActive = pageNum === currentPage;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`
                          min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-all duration-200
                          ${isActive
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-slate-700/50 border border-white/10 text-slate-300 hover:bg-slate-600/50 hover:text-white'
                          }
                        `}
                      >
                        {pageNum}
                      </button>
                    );
                  });
                })()}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="bg-slate-700/50 border-white/10 text-white hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

