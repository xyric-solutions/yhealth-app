'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Eye,
  TrendingUp,
  Globe,
  BarChart3,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api-client';
import { format, subDays } from 'date-fns';
import { GlobalReachGlobe } from './GlobalReachGlobe';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

interface TimeSeriesPoint {
  date: string;
  uniqueVisitors: number;
  pageViews: number;
}

interface CountryBreakdown {
  countryCode: string;
  countryName: string;
  uniqueVisitors: number;
}

interface VisitorAnalyticsData {
  timeSeries: TimeSeriesPoint[];
  byCountry: CountryBreakdown[];
  summary: {
    totalUniqueVisitors: number;
    totalPageViews: number;
    todayUnique: number;
    previousPeriodUnique: number;
  };
}

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

const tooltipContentStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#fff',
};

function getDefaultCustomRange(): { start: string; end: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = subDays(end, 30);
  start.setHours(0, 0, 0, 0);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export default function AdminAnalyticsPageContent() {
  const [data, setData] = useState<VisitorAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [presetIndex, setPresetIndex] = useState(1); // 30 days default; -1 = custom
  const [customRange, setCustomRange] = useState(getDefaultCustomRange);
  const [showCompare, setShowCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);

  const { startDate, endDate } = useMemo(() => {
    if (presetIndex >= 0) {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const days = PRESETS[presetIndex].days;
      const start = subDays(end, days);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }
    let start = customRange.start;
    let end = customRange.end;
    if (!start || !end) {
      const def = getDefaultCustomRange();
      start = start || def.start;
      end = end || def.end;
    }
    if (start > end) [start, end] = [end, start];
    return { startDate: start, endDate: end };
  }, [presetIndex, customRange.start, customRange.end]);

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setIsLoading(true);
      try {
        const res = await api.get<VisitorAnalyticsData>(
          `/admin/analytics/visitors?startDate=${startDate}&endDate=${endDate}`
        );
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError('Failed to load analytics');
        }
      } catch {
        setError('Failed to load analytics');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate]);

  const comparisonChange = useMemo(() => {
    if (!data?.summary) return 0;
    const { totalUniqueVisitors, previousPeriodUnique } = data.summary;
    if (previousPeriodUnique === 0) return totalUniqueVisitors > 0 ? 100 : 0;
    return Math.round(
      ((totalUniqueVisitors - previousPeriodUnique) / previousPeriodUnique) * 100
    );
  }, [data?.summary]);

  const dateRangeLabel = useMemo(() => {
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      return `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`;
    } catch {
      return `${startDate} – ${endDate}`;
    }
  }, [startDate, endDate]);

  if (isLoading && !data) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-40 rounded-2xl bg-slate-800/60" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-slate-800/60" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-2xl bg-slate-800/60" />
        <Skeleton className="h-80 rounded-2xl bg-slate-800/60" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-2xl bg-slate-800/60" />
          <Skeleton className="h-72 rounded-2xl bg-slate-800/60" />
        </div>
        <Skeleton className="h-96 rounded-2xl bg-slate-800/60" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 p-8 text-center">
        <p className="text-slate-400">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 text-emerald-400 hover:text-emerald-300"
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalUniqueVisitors: 0,
    totalPageViews: 0,
    todayUnique: 0,
    previousPeriodUnique: 0,
  };
  const timeSeries = data?.timeSeries ?? [];
  const byCountry = data?.byCountry ?? [];

  const kpiCards = [
    {
      title: 'Unique visitors (period)',
      value: summary.totalUniqueVisitors,
      icon: Users,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Page views (period)',
      value: summary.totalPageViews,
      icon: Eye,
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
    },
    {
      title: "Today's unique",
      value: summary.todayUnique,
      icon: TrendingUp,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Vs previous period',
      value: comparisonChange,
      suffix: '%',
      icon: BarChart3,
      color: comparisonChange >= 0 ? 'text-emerald-400' : 'text-rose-400',
      bgColor: comparisonChange >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10',
      previousValue: showCompare ? summary.previousPeriodUnique : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header + date range + compare */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-sky-600 p-6 md:p-8"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Visitor Analytics
                </h1>
                <p className="text-emerald-100/80 text-sm mt-0.5">
                  Unique visitors per day and by country
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/10 overflow-hidden">
                <Calendar className="h-4 w-4 text-white/80 ml-3" />
                {PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPresetIndex(i)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      presetIndex === i
                        ? 'bg-white/20 text-white'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <Popover open={customPopoverOpen} onOpenChange={setCustomPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`px-3 py-2 text-sm font-medium transition-colors border-l border-white/10 ${
                        presetIndex === -1
                          ? 'bg-white/20 text-white'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      Custom
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 bg-slate-900 border-slate-700" align="end">
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label className="text-slate-200">From</Label>
                        <Input
                          type="date"
                          value={customRange.start}
                          onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                          className="bg-slate-800 border-slate-600 text-white"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-slate-200">To</Label>
                        <Input
                          type="date"
                          value={customRange.end}
                          onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                          className="bg-slate-800 border-slate-600 text-white"
                        />
                      </div>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-500"
                        onClick={() => {
                          setPresetIndex(-1);
                          setCustomPopoverOpen(false);
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/90">
                <Switch
                  id="compare-period"
                  checked={showCompare}
                  onCheckedChange={setShowCompare}
                />
                <label htmlFor="compare-period" className="cursor-pointer">
                  Compare to previous period
                </label>
              </div>
            </div>
          </div>
          <p className="text-emerald-100/70 text-sm">
            Data for {dateRangeLabel}
            {isLoading && data && <span className="ml-2 text-white/80">(Updating…)</span>}
          </p>
        </div>
      </motion.div>

      {/* Global Reach — rotating 3D Earth */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm overflow-hidden"
      >
        <div className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/60">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              Global Reach
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">Real-time customer distribution</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-slate-400">Countries: </span>
              <span className="font-semibold text-white">{byCountry.length}</span>
            </div>
            <div>
              <span className="text-slate-400">Visits: </span>
              <span className="font-semibold text-white">{summary.totalPageViews}</span>
            </div>
          </div>
        </div>
        <div className="relative">
          {isLoading && data ? (
            <Skeleton className="h-[420px] w-full rounded-none bg-slate-800/40" />
          ) : (
            <GlobalReachGlobe
              byCountry={byCountry}
              totalCountries={byCountry.length}
              totalVisits={summary.totalPageViews}
              className="w-full"
            />
          )}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pointer-events-none">
            <span>Drag to rotate • Scroll to zoom • Click markers for details</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> High (50+)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" /> Medium (20–50)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Growing (1–20)</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="flex items-center gap-3 rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm px-4 py-3"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {card.value}
                {(card as { suffix?: string }).suffix ?? ''}
              </p>
              <p className="text-xs text-slate-400">{card.title}</p>
              {'previousValue' in card && card.previousValue !== undefined && (
                <p className="text-xs text-slate-500 mt-0.5">Previous period: {card.previousValue}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Area chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
      >
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Unique visitors over time (area)
        </h3>
        {isLoading && data ? (
          <Skeleton className="h-[320px] w-full rounded-lg bg-slate-800/60" />
        ) : timeSeries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[320px] text-slate-400 gap-2">
            <BarChart3 className="w-12 h-12 opacity-50" />
            <p className="text-sm">No data for this range</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={timeSeries}>
              <defs>
                <linearGradient id="visitorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={12}
                tick={{ fill: '#94a3b8' }}
                tickFormatter={(v) => (v ? format(new Date(v), 'MMM d') : v)}
              />
              <YAxis stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelFormatter={(v) => (v ? format(new Date(v), 'PPP') : v)}
              />
              <Area
                type="monotone"
                dataKey="uniqueVisitors"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#visitorGradient)"
                name="Unique visitors"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Line + Bar row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            Visitor trend (line)
          </h3>
          {isLoading && data ? (
            <Skeleton className="h-[280px] w-full rounded-lg bg-slate-800/60" />
          ) : timeSeries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[280px] text-slate-400 gap-2">
              <TrendingUp className="w-12 h-12 opacity-50" />
              <p className="text-sm">No data for this range</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  tickFormatter={(v) => (v ? format(new Date(v), 'MMM d') : v)}
                />
                <YAxis stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  labelFormatter={(v) => (v ? format(new Date(v), 'PPP') : v)}
                />
                <Line
                  type="monotone"
                  dataKey="uniqueVisitors"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ fill: '#38bdf8', r: 3 }}
                  name="Unique visitors"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            Visitors by day (bar)
          </h3>
          {isLoading && data ? (
            <Skeleton className="h-[280px] w-full rounded-lg bg-slate-800/60" />
          ) : timeSeries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[280px] text-slate-400 gap-2">
              <BarChart3 className="w-12 h-12 opacity-50" />
              <p className="text-sm">No data for this range</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  tickFormatter={(v) => (v ? format(new Date(v), 'MMM d') : v)}
                />
                <YAxis stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  labelFormatter={(v) => (v ? format(new Date(v), 'PPP') : v)}
                />
                <Bar
                  dataKey="uniqueVisitors"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  name="Unique visitors"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* By country */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
      >
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          Visitors by country
        </h3>
        {isLoading && data ? (
          <Skeleton className="h-[320px] w-full rounded-lg bg-slate-800/60" />
        ) : byCountry.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-slate-400 gap-2">
            <Globe className="w-12 h-12 opacity-50" />
            <p className="text-sm">No country data in this period.</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={byCountry.slice(0, 15)}
                layout="vertical"
                margin={{ left: 80, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} />
                <YAxis
                  type="category"
                  dataKey="countryName"
                  stroke="#94a3b8"
                  fontSize={12}
                  tick={{ fill: '#94a3b8' }}
                  width={76}
                />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Bar
                  dataKey="uniqueVisitors"
                  fill="#10b981"
                  radius={[0, 6, 6, 0]}
                  name="Unique visitors"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700/60">
                    <th className="text-left py-2 font-medium">Country</th>
                    <th className="text-right py-2 font-medium">Code</th>
                    <th className="text-right py-2 font-medium">Unique visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {byCountry.map((row, i) => (
                    <tr
                      key={`${row.countryCode}-${i}`}
                      className="border-b border-slate-800/60 text-slate-300"
                    >
                      <td className="py-2">{row.countryName}</td>
                      <td className="text-right py-2">{row.countryCode}</td>
                      <td className="text-right py-2 font-medium text-white">
                        {row.uniqueVisitors}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
