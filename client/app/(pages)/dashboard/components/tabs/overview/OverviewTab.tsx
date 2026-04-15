'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api-client';
import type {
  Plan,
  TodayData,
  WeeklySummary,
  DashboardStats,
  WeeklyActivityData,
  HealthMetrics,
  QuickLogModalState,
} from './types';
import { StatsCards } from './StatsCards';
import { TodaySchedule } from './TodaySchedule';
import { WeeklyChart, type ActivityPeriod } from './WeeklyChart';
import { CurrentPlanCard } from './CurrentPlanCard';
import { WeeklyFocus } from './WeeklyFocus';
import { WaterIntakeWidget, XPLevelWidget, StreakWidget, StreakMilestoneModal } from '../../gamification';
import { useStreak } from '@/hooks/use-streak';
import { EmotionTrendsWidget } from '../../wellbeing';
import { AnalyticsTab } from './AnalyticsTab';
import { ScoringTab } from './ScoringTab';
import { AlarmsTab } from '../alarms/AlarmsTab';
import { RefreshCw, LayoutDashboard, BarChart3, Award, Bell } from 'lucide-react';
import { WeatherWidget } from './WeatherWidget';
import { StatusWidget } from './widgets/StatusWidget';
import { UnifiedHealthDashboard } from './widgets/UnifiedHealthDashboard';
import type { EnhancedHealthMetrics } from './widgets/UnifiedHealthDashboard';
import { DashboardCard } from './widgets/DashboardCard';
import { DashboardUnderlineTabs } from '../../DashboardUnderlineTabs';

interface OverviewTabProps {
  plan: Plan | null;
  todayData: TodayData | null;
  weeklySummary: WeeklySummary | null;
  weekCompletionRate: number;
  onActivityComplete: (activityId: string) => void;
  onRefresh?: () => void;
}

// Animated Tab Content Wrapper
function TabContent({ children, tabId }: { children: React.ReactNode; tabId: string }) {
  return (
    <motion.div
      key={tabId}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  );
}

export function OverviewTab({
  plan,
  todayData,
  weeklySummary,
  weekCompletionRate,
  onActivityComplete,
  onRefresh,
}: OverviewTabProps) {
  // Streak system
  const { milestone, dismissMilestone } = useStreak();

  // State for dynamic data
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivityData | null>(null);
  const [_healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [enhancedHealthMetrics, setEnhancedHealthMetrics] = useState<EnhancedHealthMetrics | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<ActivityPeriod>('current');
  const [_isLoggingQuickAction, setIsLoggingQuickAction] = useState(false);

  // Fetch dashboard stats
  const fetchDashboardStats = useCallback(async () => {
    try {
      const response = await api.get<DashboardStats>('/stats/dashboard');
      if (response.success && response.data) {
        setDashboardStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  }, []);

  // Fetch weekly activity data
  const fetchWeeklyActivity = useCallback(async (week: ActivityPeriod) => {
    try {
      const response = await api.get<WeeklyActivityData>('/stats/weekly-activity', {
        params: { week },
      });
      if (response.success && response.data) {
        setWeeklyActivity(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch weekly activity:', err);
    }
  }, []);

  // Fetch health metrics
  const fetchHealthMetrics = useCallback(async () => {
    try {
      const response = await api.get<{ metrics: HealthMetrics }>('/stats/health-metrics');
      if (response.success && response.data) {
        setHealthMetrics(response.data.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch health metrics:', err);
    }
  }, []);

  // Fetch enhanced health metrics
  const fetchEnhancedHealthMetrics = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await api.get<EnhancedHealthMetrics>(`/stats/enhanced-health-metrics?tz=${encodeURIComponent(tz)}`);
      if (response.success && response.data) {
        setEnhancedHealthMetrics(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch enhanced health metrics:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      setIsLoadingStats(true);
      await Promise.all([
        fetchDashboardStats(),
        fetchWeeklyActivity('current'),
        fetchHealthMetrics(),
        fetchEnhancedHealthMetrics(),
      ]);
      if (isMounted) {
        setIsLoadingStats(false);
      }
    };
    fetchAll();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-refresh enhanced health metrics
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchEnhancedHealthMetrics();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const pollInterval = setInterval(() => {
      fetchEnhancedHealthMetrics();
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [fetchEnhancedHealthMetrics]);

  // Refetch weekly activity when selection changes
  useEffect(() => {
    fetchWeeklyActivity(selectedWeek);
  }, [selectedWeek]);

  // Update water state directly from API response — no refetch needed
  const updateWaterFromResponse = useCallback((log: { mlConsumed: number; targetMl: number }) => {
    setEnhancedHealthMetrics((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        water: {
          consumed: log.mlConsumed,
          target: log.targetMl || prev.water.target,
        },
      };
    });
  }, []);

  // Handle add water
  const handleAddWater = async () => {
    try {
      const response = await api.post<{ log: { glassesConsumed: number; mlConsumed: number; targetMl: number } }>('/water/add-glass');
      if (response.success && response.data?.log) {
        updateWaterFromResponse(response.data.log);
      }
    } catch (err) {
      console.error('Failed to add water:', err);
    }
  };

  // Handle remove water
  const handleRemoveWater = async () => {
    try {
      const response = await api.post<{ log: { glassesConsumed: number; mlConsumed: number; targetMl: number } }>('/water/remove', { amountMl: 250 });
      if (response.success && response.data?.log) {
        updateWaterFromResponse(response.data.log);
      }
    } catch (err) {
      console.error('Failed to remove water:', err);
    }
  };

  // Computed values
  const completedToday = todayData?.completedCount || 0;
  const totalToday = todayData?.totalCount || 0;
  const todayProgress = totalToday > 0 ? (completedToday / totalToday) * 100 : 0;

  const currentStreak = dashboardStats?.streak.current || 0;
  const weekChange = dashboardStats?.weekProgress.change || 0;
  const effectiveWeekRate = dashboardStats?.weekProgress.rate ?? weekCompletionRate;

  // Tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'scoring' | 'alarms'>('dashboard');

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { id: 'scoring' as const, label: 'Scoring', icon: Award },
    { id: 'alarms' as const, label: 'Alarms', icon: Bell },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header: Title + Weather */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Overview</h1>
        <WeatherWidget />
      </motion.div>

      {/* Tab Bar: underline + icon (shared Workouts-style) */}
      <DashboardUnderlineTabs
        layoutId="overviewSubTabUnderline"
        tabs={tabs}
        activeId={activeTab}
        onTabChange={(id) => setActiveTab(id as typeof activeTab)}
        trailing={
          onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh now</span>
            </button>
          ) : undefined
        }
      />

      {/* Tab Content with AnimatePresence */}
      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <TabContent key="dashboard" tabId="dashboard">
            <div className="space-y-6">
              {/* Health Metrics Dashboard */}
              <UnifiedHealthDashboard
                data={enhancedHealthMetrics || {
                  steps: { value: null, target: 10000 },
                  whoopAge: { value: null, chronologicalAge: null },
                  water: { consumed: 0, target: 8 },
                  calories: { consumed: 0, burned: 0, target: 2200 },
                  nutrition: {
                    macros: { protein: 0, carbs: 0, fats: 0 },
                    targets: { protein: 150, carbs: 200, fats: 65 },
                  },
                  heartRate: {
                    current: null,
                    resting: null,
                    history: [],
                  },
                  analytics: {
                    weeklyAvg: 0,
                    consistencyScore: 0,
                    dataPoints: 0,
                    trend: 'stable' as const,
                  },
                }}
                isLoading={isLoadingStats}
                onAddWater={handleAddWater}
                onRemoveWater={handleRemoveWater}
              />

              {/* Main Content Grid */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column - Schedule & Chart */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Today's Schedule */}
                  <DashboardCard accent="sky" padding="none">
                    <TodaySchedule
                      todayData={todayData}
                      plan={plan}
                      onActivityComplete={onActivityComplete}
                      onRefresh={onRefresh}
                    />
                  </DashboardCard>

                  {/* Weekly Overview Chart */}
                  <DashboardCard accent="emerald" padding="none">
                    <WeeklyChart
                      weeklyActivity={weeklyActivity}
                      selectedWeek={selectedWeek}
                      onWeekChange={setSelectedWeek}
                    />
                  </DashboardCard>
                </div>

                {/* Right Column - Widgets */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  <StatusWidget />
                  <StreakWidget />
                  <EmotionTrendsWidget compact />
                  {plan && <CurrentPlanCard plan={plan} />}
                  <WeeklyFocus weeklySummary={weeklySummary} />
                </motion.div>
              </div>
            </div>
          </TabContent>
        )}

        {activeTab === 'analytics' && (
          <TabContent key="analytics" tabId="analytics">
            <div className="glass-premium rounded-3xl p-6">
              <AnalyticsTab />
            </div>
          </TabContent>
        )}

        {activeTab === 'scoring' && (
          <TabContent key="scoring" tabId="scoring">
            <div className="glass-premium rounded-3xl p-6">
              <ScoringTab />
            </div>
          </TabContent>
        )}

        {activeTab === 'alarms' && (
          <TabContent key="alarms" tabId="alarms">
            <div className="glass-premium rounded-3xl p-6">
              <AlarmsTab />
            </div>
          </TabContent>
        )}
      </AnimatePresence>

      {/* Streak Milestone Celebration */}
      <StreakMilestoneModal milestone={milestone} onDismiss={dismissMilestone} />
    </div>
  );
}
