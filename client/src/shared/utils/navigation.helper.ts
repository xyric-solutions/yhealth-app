/**
 * Navigation Helper
 * Maps page names to tab IDs and provides navigation functions
 */

import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export type TabId = 
  | 'overview' 
  | 'goals' 
  | 'plans' 
  | 'workouts' 
  | 'nutrition' 
  | 'progress' 
  | 'activity' 
  | 'activity-status'
  | 'achievements' 
  | 'ai-coach' 
  | 'voice-assistant' 
  | 'voice-call' 
  | 'notifications' 
  | 'chat-history' 
  | 'preferences' 
  | 'settings' 
  | 'profile';

// Map page names to tab IDs
const PAGE_TO_TAB: Record<string, TabId> = {
  // Workout related
  'workout': 'workouts',
  'workouts': 'workouts',
  'workout page': 'workouts',
  'workouts page': 'workouts',
  'exercise': 'workouts',
  'exercises': 'workouts',
  'fitness': 'workouts',
  
  // Nutrition related
  'nutrition': 'nutrition',
  'nutrition page': 'nutrition',
  'meal': 'nutrition',
  'meals': 'nutrition',
  'meal page': 'nutrition',
  'meals page': 'nutrition',
  'diet': 'nutrition',
  'diet page': 'nutrition',
  'food': 'nutrition',
  
  // Progress related
  'progress': 'progress',
  'progress page': 'progress',
  'tracking': 'progress',
  'stats': 'progress',
  'statistics': 'progress',
  
  // Plans related
  'plan': 'plans',
  'plans': 'plans',
  'plan page': 'plans',
  'plans page': 'plans',
  'schedule': 'plans',
  
  // Goals related
  'goal': 'goals',
  'goals': 'goals',
  'goal page': 'goals',
  'goals page': 'goals',
  
  // Activity related
  'activity': 'activity',
  'activities': 'activity',
  'activity page': 'activity',
  'activities page': 'activity',
  
  // Achievements related
  'achievement': 'achievements',
  'achievements': 'achievements',
  'achievement page': 'achievements',
  'achievements page': 'achievements',
  
  // Dashboard/Overview
  'overview': 'overview',
  'dashboard': 'overview',
  'home': 'overview',
  'main': 'overview',
};

/**
 * Normalize page name to tab ID
 */
export function normalizePageName(pageName: string): TabId | null {
  const normalized = pageName.toLowerCase().trim();
  
  // Direct match
  if (PAGE_TO_TAB[normalized]) {
    return PAGE_TO_TAB[normalized];
  }
  
  // Partial match
  for (const [key, tabId] of Object.entries(PAGE_TO_TAB)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return tabId;
    }
  }
  
  return null;
}

/**
 * Navigate to a tab/page in the dashboard
 */
export function navigateToTab(router: AppRouterInstance, tabId: TabId, params?: Record<string, string>): void {
  if (tabId === 'ai-coach') {
    router.push('/ai-coach');
  } else if (tabId === 'activity-status') {
    router.push('/activity-status');
  } else {
    const queryString = params 
      ? '?' + new URLSearchParams(params).toString()
      : '';
    router.push(`/dashboard?tab=${tabId}${queryString}`);
  }
}

/**
 * Navigate by page name - handles both dashboard tabs and standalone pages
 */
export function navigateToPage(router: AppRouterInstance, pageName: string, params?: Record<string, string>): boolean {
  const normalized = pageName.toLowerCase().trim();
  
  // Handle wellbeing sub-pages (they have slashes) - must check before standalone pages
  if (normalized.startsWith('wellbeing/')) {
    const path = `/${normalized}`;
    const queryString = params 
      ? '?' + new URLSearchParams(params).toString()
      : '';
    router.push(`${path}${queryString}`);
    return true;
  }
  
  // Handle standalone pages (check BEFORE dashboard tabs to prioritize standalone routes)
  const standalonePages: Record<string, string> = {
    'wellbeing': '/wellbeing',  // Standalone route, not a dashboard tab
    'whoop': '/whoop',
    'chat': '/chat',
    'chat-history': '/chat-history',
    'notifications': '/notifications',
    'settings': '/settings',
    'profile': '/profile',
    'workouts': '/workouts',
    'nutrition': '/nutrition',
    'progress': '/progress',
    'goals': '/goals',
    'activity': '/activity',
    'activity-status': '/activity-status',
    'achievements': '/achievements',
    'ai-coach': '/ai-coach',
  };
  
  // Check exact match first
  if (standalonePages[normalized]) {
    const path = standalonePages[normalized];
    const queryString = params 
      ? '?' + new URLSearchParams(params).toString()
      : '';
    router.push(`${path}${queryString}`);
    return true;
  }
  
  // Check for partial matches in standalone pages (e.g., "wellbeing page" -> "wellbeing")
  for (const [key, path] of Object.entries(standalonePages)) {
    if (normalized.includes(key) && (normalized === key || normalized.includes(`${key} page`) || normalized.includes(`${key} tab`))) {
      const queryString = params 
        ? '?' + new URLSearchParams(params).toString()
        : '';
      router.push(`${path}${queryString}`);
      return true;
    }
  }
  
  // Try dashboard tab navigation (only if not a standalone page)
  const tabId = normalizePageName(pageName);
  if (tabId) {
    navigateToTab(router, tabId, params);
    return true;
  }
  
  return false;
}

