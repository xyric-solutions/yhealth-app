/**
 * @file Dashboard feature barrel export
 *
 * Usage:
 * import {
 *   DashboardTabs,
 *   useDashboardApi,
 *   DASHBOARD_TABS,
 *   OverviewTab,
 * } from '@/src/features/dashboard';
 */

// Components
export { DashboardTabs } from './components';

// Tabs
export {
  OverviewTab,
  GoalsTab,
  ActivityTab,
  AchievementsTab,
  NotificationsTab,
  PreferencesTab,
  SettingsTab,
  ProfileTab,
} from './tabs';

// Hooks
export { useDashboardApi } from './hooks';

// Constants
export { DASHBOARD_TABS } from './constants/tabs';

// Types
export type {
  TabId,
  TabConfig,
  DashboardState,
  OverviewTabProps,
  Activity,
  Plan,
  TodayData,
  WeeklySummary,
} from './types';
