/**
 * @file Dashboard tabs configuration
 */

import {
  LayoutDashboard,
  Target,
  Settings,
  Sliders,
  Activity,
  Trophy,
  User,
  Bell,
} from 'lucide-react';
import { createElement } from 'react';
import type { TabConfig } from '../types';

export const DASHBOARD_TABS: TabConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: createElement(LayoutDashboard, { className: 'w-4 h-4' }),
    color: 'from-blue-500 to-purple-500',
  },
  {
    id: 'goals',
    label: 'Goals',
    icon: createElement(Target, { className: 'w-4 h-4' }),
    color: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: createElement(Activity, { className: 'w-4 h-4' }),
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'achievements',
    label: 'Achievements',
    icon: createElement(Trophy, { className: 'w-4 h-4' }),
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: createElement(Bell, { className: 'w-4 h-4' }),
    color: 'from-indigo-500 to-purple-500',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: createElement(User, { className: 'w-4 h-4' }),
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: createElement(Sliders, { className: 'w-4 h-4' }),
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: createElement(Settings, { className: 'w-4 h-4' }),
    color: 'from-slate-500 to-slate-600',
  },
];
