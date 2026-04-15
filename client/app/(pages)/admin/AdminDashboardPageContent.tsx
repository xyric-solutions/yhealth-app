'use client';

import { motion } from 'framer-motion';
import {
  Users,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  MessageSquare,
  Video,
  MessageCircle,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { AnalyticsMetricCard } from '@/components/admin/AnalyticsMetricCard';
import { RevenueAreaChart } from '@/components/admin/charts/RevenueAreaChart';
import { UserGrowthLineChart } from '@/components/admin/charts/UserGrowthLineChart';
import { SubscriptionBarChart } from '@/components/admin/charts/SubscriptionBarChart';
import { PlanDistributionPieChart } from '@/components/admin/charts/PlanDistributionPieChart';
import { VisitorTrendChart } from '@/components/admin/charts/VisitorTrendChart';
import { BlogEngagementChart } from '@/components/admin/charts/BlogEngagementChart';
import { useAdminAnalytics } from '@/hooks/use-admin-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalReachGlobe } from './analytics/GlobalReachGlobe';

export default function AdminDashboardPageContent() {
  const { data, isLoading, error, dateRange, updateDateRange } = useAdminAnalytics();

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

  const metricCards = [
    {
      title: 'Total Users',
      value: data?.users.total ?? 0,
      icon: Users,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      trend: data?.users.growthRate ? { value: data.users.growthRate, isPositive: data.users.growthRate >= 0 } : undefined,
      delay: 0.1,
    },
    {
      title: 'Active Subscriptions',
      value: data?.subscriptions.active ?? 0,
      icon: CreditCard,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      delay: 0.15,
    },
    {
      title: 'Total Revenue',
      value: data?.revenue.total ?? 0,
      icon: DollarSign,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      prefix: '$',
      suffix: '',
      delay: 0.2,
    },
    {
      title: 'Unique Visitors',
      value: data?.visitors.unique ?? 0,
      icon: Eye,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      delay: 0.25,
    },
    {
      title: 'Total Blogs',
      value: data?.blogs.total ?? 0,
      icon: FileText,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      delay: 0.3,
    },
    {
      title: 'Contacts',
      value: data?.contacts.total ?? 0,
      icon: MessageSquare,
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      delay: 0.35,
    },
    {
      title: 'Webinar Registrations',
      value: data?.webinars.registrations ?? 0,
      icon: Video,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      delay: 0.4,
    },
    {
      title: 'Community Posts',
      value: data?.community.posts ?? 0,
      icon: MessageCircle,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      delay: 0.45,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Header with Date Filter */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-sky-600 p-6 md:p-8"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <LayoutDashboard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  Analytics Dashboard
                </h1>
                <p className="text-emerald-100/80 text-sm md:text-base mt-1">
                  Comprehensive insights into your platform performance
                </p>
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <DateRangeFilter value={dateRange} onChange={updateDateRange} />
        </div>
      </motion.div>

      {/* Loading State */}
      {isLoading && !data && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl bg-slate-800/60" />
            ))}
          </div>
          <Skeleton className="h-[420px] rounded-2xl bg-slate-800/60" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[320px] rounded-2xl bg-slate-800/60" />
            <Skeleton className="h-[320px] rounded-2xl bg-slate-800/60" />
          </div>
        </div>
      )}

      {/* Metric Cards */}
      {data && (
        <>
          <div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            style={{ perspective: '1000px' }}
          >
            {metricCards.map((card) => (
              <AnalyticsMetricCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
                bgColor={card.bgColor}
                trend={card.trend}
                prefix={card.prefix}
                suffix={card.suffix}
                isLoading={isLoading}
                delay={card.delay}
              />
            ))}
          </div>

          {/* Revenue Area Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
          >
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Revenue Trend (Area Chart)
            </h3>
            <RevenueAreaChart data={data.revenue.timeSeries} isLoading={isLoading} />
          </motion.div>

          {/* Charts Row 1: User Growth & Subscriptions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
            >
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                User Growth (Line Chart)
              </h3>
              <UserGrowthLineChart data={data.users.timeSeries} isLoading={isLoading} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
            >
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                Subscriptions Over Time (Bar Chart)
              </h3>
              <SubscriptionBarChart data={data.subscriptions.timeSeries} isLoading={isLoading} />
            </motion.div>
          </div>

          {/* Global Reach Globe - Full Width with Enhanced Design */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/60 border border-slate-800/60 backdrop-blur-xl p-6 md:p-8 overflow-hidden relative group"
          >
            {/* Animated background gradients */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                animate={{
                  background: [
                    'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
                    'radial-gradient(circle at 80% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)',
                    'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
                  ],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }}
              />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30"
                  >
                    <Eye className="w-5 h-5 text-purple-400" />
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      Global Visitor Reach
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">Interactive world map visualization</p>
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                  className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-slate-300 bg-slate-800/40 rounded-lg px-4 py-2 border border-slate-700/50"
                >
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50"
                    />
                    <span>High (50+)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                      className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50"
                    />
                    <span>Medium (20-50)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                      className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50"
                    />
                    <span>Growing (1-20)</span>
                  </div>
                </motion.div>
              </div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="rounded-xl overflow-hidden border border-slate-700/50 bg-slate-950/50 backdrop-blur-sm"
              >
                <GlobalReachGlobe
                  byCountry={data.visitors.byCountry || []}
                  totalCountries={data.visitors.countries}
                  totalVisits={data.visitors.total}
                  className="rounded-xl overflow-hidden"
                />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/40 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Countries Reached</p>
                    <p className="text-lg font-bold text-white">{data.visitors.countries}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/40 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
                    <Users className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Unique Visitors</p>
                    <p className="text-lg font-bold text-white">{data.visitors.unique.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/40 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                    <Eye className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total Page Views</p>
                    <p className="text-lg font-bold text-white">{data.visitors.pageViews.toLocaleString()}</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Charts Row 2: Plan Distribution & Visitor Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
            >
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-400" />
                Subscription Plan Distribution (Pie Chart)
              </h3>
              <PlanDistributionPieChart 
                data={data.subscriptions.byPlan.map(plan => ({ 
                  name: plan.name, 
                  value: plan.count, 
                  revenue: plan.revenue 
                }))} 
                isLoading={isLoading} 
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
            >
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-400" />
                Visitor Trends (Area Chart)
              </h3>
              <VisitorTrendChart
                data={data.visitors.timeSeries}
                isLoading={isLoading}
              />
            </motion.div>
          </div>

          {/* Blog Engagement Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6"
          >
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-400" />
              Blog Engagement (Bar Chart)
            </h3>
            <BlogEngagementChart data={data.blogs.timeSeries} isLoading={isLoading} />
          </motion.div>

          {/* Additional Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-4"
            >
              <p className="text-xs text-slate-400 mb-1">Monthly Recurring Revenue</p>
              <p className="text-2xl font-bold text-white">${data.revenue.monthly.toFixed(2)}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-4"
            >
              <p className="text-xs text-slate-400 mb-1">Churn Rate</p>
              <p className="text-2xl font-bold text-white">{data.subscriptions.churnRate}%</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-4"
            >
              <p className="text-xs text-slate-400 mb-1">Blog Views</p>
              <p className="text-2xl font-bold text-white">{data.blogs.views.toLocaleString()}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-4"
            >
              <p className="text-xs text-slate-400 mb-1">Webinar Attendance Rate</p>
              <p className="text-2xl font-bold text-white">{data.webinars.attendanceRate}%</p>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
