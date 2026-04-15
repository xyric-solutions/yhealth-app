'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFetch } from '@/hooks/use-fetch';
import { useApiMutation } from '@/hooks/use-api-mutation';
import {
  Brain,
  Heart,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Loader2,
  RefreshCw,
  Info,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/whoop/DateRangePicker';
import { validateAndAdjustDateRange } from '@/lib/utils/date-range-validation';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

// ============================================
// TYPES
// ============================================

interface StressLevel {
  level: 0 | 1 | 2 | 3;
  label: 'Low' | 'Mild' | 'Moderate' | 'High';
  score: number;
  description: string;
}

interface StressSignals {
  hrv: number | null;
  hrvBaseline: number | null;
  hrvDeviation: number | null;
  rhr: number | null;
  rhrBaseline: number | null;
  rhrDeviation: number | null;
  recoveryScore: number | null;
  strain: number | null;
  confidence: number;
}

interface StressLoadType {
  type: 'physical' | 'non_exercise' | 'mixed' | 'unknown';
  label: string;
  description: string;
}

interface StressTrend {
  date: string;
  level: number;
  score: number;
  hrv: number | null;
  rhr: number | null;
  recovery: number | null;
  strain: number | null;
  loadType: string;
}

interface StressInsight {
  type: 'positive' | 'warning' | 'neutral' | 'suggestion';
  message: string;
  priority: number;
}

interface StressAnalysis {
  current: {
    level: StressLevel;
    signals: StressSignals;
    loadType: StressLoadType;
    timestamp: string;
  };
  baseline: {
    hrvMedian: number | null;
    hrvRange: { min: number; max: number } | null;
    rhrMedian: number | null;
    rhrRange: { min: number; max: number } | null;
    recoveryAvg: number | null;
    daysOfData: number;
  };
  trends: {
    daily: StressTrend[];
    weeklyAvg: number | null;
    trend: 'improving' | 'worsening' | 'stable';
  };
  insights: StressInsight[];
  suggestions: string[];
  disclaimer: string;
}

// ============================================
// CONSTANTS
// ============================================

const STRESS_LEVEL_COLORS = {
  0: { bg: 'from-emerald-500/20 to-green-600/20', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'rgba(16, 185, 129, 0.3)' },
  1: { bg: 'from-blue-500/20 to-cyan-600/20', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'rgba(59, 130, 246, 0.3)' },
  2: { bg: 'from-amber-500/20 to-orange-600/20', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'rgba(245, 158, 11, 0.3)' },
  3: { bg: 'from-red-500/20 to-rose-600/20', border: 'border-red-500/30', text: 'text-red-400', glow: 'rgba(239, 68, 68, 0.3)' },
};

const LOAD_TYPE_ICONS = {
  physical: Activity,
  non_exercise: Brain,
  mixed: Zap,
  unknown: AlertCircle,
};

// ============================================
// COMPONENT
// ============================================

export function StressMonitor() {
  // Date range state
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

  const [showInfo, setShowInfo] = useState(false);

  // Handle date range changes
  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    const validated = validateAndAdjustDateRange(range, true);
    setDateRange(validated);
  };

  // Build query string
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
    ? `/whoop/analytics/stress?${queryString}`
    : '/whoop/analytics/stress';

  // Fetch stress data
  const { data, isLoading, error, refetch } = useFetch<StressAnalysis>(endpoint, {
    immediate: true,
    deps: [dateRange.from?.toISOString(), dateRange.to?.toISOString()],
  });

  // Listen for refresh events from parent
  useEffect(() => {
    const handleRefresh = () => refetch();
    window.addEventListener('whoop-refresh-requested', handleRefresh);
    return () => window.removeEventListener('whoop-refresh-requested', handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mutation
  const { mutate: triggerSync, isLoading: isSyncing } = useApiMutation({
    onSuccess: () => {
      toast.success('Sync started! Data will appear shortly...');
      setTimeout(() => refetch(), 500);
    },
    onError: (error) => toast.error(error.message || 'Failed to sync data'),
  });

  const handleSync = () => triggerSync('/integrations/whoop/sync', {});

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!data?.trends.daily) return [];
    return data.trends.daily.map((t) => ({
      date: format(new Date(t.date), 'MMM d'),
      fullDate: t.date,
      score: t.score,
      level: t.level,
      hrv: t.hrv,
      rhr: t.rhr,
      recovery: t.recovery,
      strain: t.strain,
    }));
  }, [data]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-4" />
        <span>Analyzing stress signals...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 sm:p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            <div>
              <p className="text-[13px] sm:text-[14px] text-red-400 font-medium">Failed to load stress analysis</p>
              <p className="text-[13px] sm:text-[14px] text-red-300/70 mt-1">{error.message}</p>
            </div>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 sm:p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            <div>
              <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No stress data available</p>
              <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
                Connect your WHOOP device and sync data to see stress analysis.
              </p>
            </div>
          </div>
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync Data
          </Button>
        </div>
      </div>
    );
  }

  const { current, baseline, trends, insights, suggestions, disclaimer } = data;
  const levelColors = STRESS_LEVEL_COLORS[current.level.level];
  const LoadTypeIcon = LOAD_TYPE_ICONS[current.loadType.type];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Date Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <DateRangePicker dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowInfo(!showInfo)}
            variant="outline"
            size="sm"
            className="bg-background/50 backdrop-blur-sm border-border/50"
          >
            <Info className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="bg-background/50 backdrop-blur-sm border-border/50"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync
          </Button>
        </div>
      </div>

      {/* Info Panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4"
          >
            <p className="text-sm text-slate-300 mb-2">
              <strong>How Stress is Calculated</strong>
            </p>
            <p className="text-xs text-slate-400">
              Stress levels are calculated from your HRV (Heart Rate Variability), resting heart rate, and recovery
              score, compared to your personal 14-day baseline. Lower HRV and higher RHR relative to your baseline
              indicate elevated physiological stress.
            </p>
            <p className="text-xs text-slate-500 mt-2 italic">{disclaimer}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stress Level Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${levelColors.bg} backdrop-blur-xl border ${levelColors.border} p-5 sm:p-8`}
        style={{ boxShadow: `0 0 60px ${levelColors.glow}` }}
      >
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4 sm:mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  className={`p-3 rounded-2xl bg-gradient-to-br ${levelColors.bg} border ${levelColors.border}`}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Brain className={`w-7 h-7 ${levelColors.text}`} />
                </motion.div>
                <div>
                  <h3 className="text-[16px] sm:text-xl font-bold text-white">Stress Level</h3>
                  <p className="text-xs text-slate-400">Based on physiological signals</p>
                </div>
              </div>
            </div>

            {/* Load Type Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <LoadTypeIcon className="w-4 h-4 text-slate-300" />
              <span className="text-xs text-slate-300">{current.loadType.label}</span>
            </div>
          </div>

          {/* Stress Score Display */}
          <div className="flex items-center justify-center mb-5 sm:mb-8">
            <div className="relative">
              {/* Circular Progress */}
              <svg className="w-32 h-32 sm:w-48 sm:h-48 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                  fill="none"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  className={levelColors.text}
                  initial={{ strokeDasharray: '0 264' }}
                  animate={{ strokeDasharray: `${(current.level.score / 100) * 264} 264` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </svg>

              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className={`text-3xl sm:text-5xl font-black ${levelColors.text}`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                >
                  {current.level.level}
                </motion.span>
                <span className={`text-[16px] sm:text-lg font-semibold ${levelColors.text}`}>{current.level.label}</span>
                <span className="text-xs text-slate-400 mt-1">{current.level.score}/100</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-center text-[13px] sm:text-[14px] text-slate-300 max-w-md mx-auto">{current.level.description}</p>

          {/* Signal Confidence */}
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <div
                className={`w-2 h-2 rounded-full ${
                  current.signals.confidence > 0.7
                    ? 'bg-emerald-400'
                    : current.signals.confidence > 0.4
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
              <span className="text-xs text-slate-400">
                Signal Confidence: {Math.round(current.signals.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Signals Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* HRV */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-600/10 border border-purple-500/20 p-3 sm:p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-400">HRV</span>
          </div>
          <p className="text-[18px] sm:text-xl font-bold text-white">
            {current.signals.hrv ? `${current.signals.hrv.toFixed(0)}ms` : '--'}
          </p>
          {current.signals.hrvDeviation !== null && (
            <p
              className={`text-xs mt-1 ${
                current.signals.hrvDeviation > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {current.signals.hrvDeviation > 0 ? '-' : '+'}
              {Math.abs(current.signals.hrvDeviation).toFixed(0)}% vs baseline
            </p>
          )}
        </motion.div>

        {/* RHR */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl bg-gradient-to-br from-red-500/10 to-rose-600/10 border border-red-500/20 p-3 sm:p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-400">Resting HR</span>
          </div>
          <p className="text-[18px] sm:text-xl font-bold text-white">
            {current.signals.rhr ? `${current.signals.rhr} bpm` : '--'}
          </p>
          {current.signals.rhrDeviation !== null && (
            <p
              className={`text-xs mt-1 ${
                current.signals.rhrDeviation > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {current.signals.rhrDeviation > 0 ? '+' : ''}
              {current.signals.rhrDeviation.toFixed(0)}% vs baseline
            </p>
          )}
        </motion.div>

        {/* Recovery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-600/10 border border-emerald-500/20 p-3 sm:p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Recovery</span>
          </div>
          <p className="text-[18px] sm:text-xl font-bold text-white">
            {current.signals.recoveryScore !== null ? `${current.signals.recoveryScore}%` : '--'}
          </p>
          {baseline.recoveryAvg !== null && (
            <p className="text-xs mt-1 text-slate-400">Avg: {baseline.recoveryAvg}%</p>
          )}
        </motion.div>

        {/* Strain */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 p-3 sm:p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">Strain</span>
          </div>
          <p className="text-[18px] sm:text-xl font-bold text-white">
            {current.signals.strain !== null ? current.signals.strain.toFixed(1) : '--'}
          </p>
          <p className="text-xs mt-1 text-slate-400">/ 21.0</p>
        </motion.div>
      </div>

      {/* Trends Chart */}
      {chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-[16px] sm:text-[18px] font-semibold text-white">Stress Trends</h3>
              <div className="flex items-center gap-2 mt-1">
                {trends.trend === 'improving' && (
                  <>
                    <TrendingDown className="w-4 h-4 text-emerald-400" />
                    <span className="text-[13px] sm:text-[14px] text-emerald-400">Improving</span>
                  </>
                )}
                {trends.trend === 'worsening' && (
                  <>
                    <TrendingUp className="w-4 h-4 text-red-400" />
                    <span className="text-[13px] sm:text-[14px] text-red-400">Elevated</span>
                  </>
                )}
                {trends.trend === 'stable' && (
                  <>
                    <Minus className="w-4 h-4 text-slate-400" />
                    <span className="text-[13px] sm:text-[14px] text-slate-400">Stable</span>
                  </>
                )}
              </div>
            </div>
            {trends.weeklyAvg !== null && (
              <div className="text-right">
                <p className="text-[13px] sm:text-[14px] text-slate-400">Weekly Average</p>
                <p className="text-[16px] sm:text-xl font-bold text-white">{trends.weeklyAvg}</p>
              </div>
            )}
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="stressGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A855F7" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#A855F7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(31, 41, 55, 0.95)',
                  border: '1px solid rgba(55, 65, 81, 0.5)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)',
                }}
                labelStyle={{ color: '#E5E7EB', fontWeight: 600 }}
                formatter={(value) => [`${value ?? 0}`, 'Stress Score']}
              />
              <ReferenceLine y={25} stroke="#10B981" strokeDasharray="3 3" opacity={0.5} />
              <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="3 3" opacity={0.5} />
              <ReferenceLine y={75} stroke="#EF4444" strokeDasharray="3 3" opacity={0.5} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#A855F7"
                strokeWidth={2}
                fill="url(#stressGradient)"
                dot={{ r: 4, fill: '#A855F7', strokeWidth: 2, stroke: '#1F2937' }}
                activeDot={{ r: 6, fill: '#A855F7', strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Insights & Suggestions */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-4 sm:p-6"
        >
          <h3 className="text-[16px] sm:text-[18px] font-semibold text-white mb-3 sm:mb-4">Insights</h3>
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-xl ${
                  insight.type === 'positive'
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : insight.type === 'warning'
                    ? 'bg-amber-500/10 border border-amber-500/20'
                    : 'bg-slate-700/30 border border-slate-600/30'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 ${
                    insight.type === 'positive'
                      ? 'bg-emerald-400'
                      : insight.type === 'warning'
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                  }`}
                />
                <p className="text-[13px] sm:text-[14px] text-slate-300">{insight.message}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-4 sm:p-6"
        >
          <h3 className="text-[16px] sm:text-[18px] font-semibold text-white mb-3 sm:mb-4">Suggested Actions</h3>
          <div className="space-y-3">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20"
              >
                <ChevronRight className="w-4 h-4 text-purple-400 mt-0.5" />
                <p className="text-[13px] sm:text-[14px] text-slate-300">{suggestion}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Baseline Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-3 sm:p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className="text-[13px] sm:text-[14px] text-slate-400">14-Day Personal Baseline</span>
          </div>
          <span className="text-xs text-slate-500">{baseline.daysOfData} days of data</span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-3">
          <div>
            <p className="text-xs text-slate-500">HRV Median</p>
            <p className="text-[13px] sm:text-[14px] font-medium text-slate-300">
              {baseline.hrvMedian ? `${baseline.hrvMedian.toFixed(0)}ms` : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">RHR Median</p>
            <p className="text-[13px] sm:text-[14px] font-medium text-slate-300">
              {baseline.rhrMedian ? `${baseline.rhrMedian.toFixed(0)} bpm` : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Recovery Avg</p>
            <p className="text-[13px] sm:text-[14px] font-medium text-slate-300">
              {baseline.recoveryAvg ? `${baseline.recoveryAvg}%` : '--'}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
