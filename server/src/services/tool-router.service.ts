/**
 * @file Tool Router Service
 * @description Intent-based tool routing to reduce tool count per request
 *
 * Problem: Loading 163 tools causes 3.6s TTFT
 * Solution: Route to 15-25 tools per request based on user intent
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { logger } from './logger.service.js';

// ============================================
// INTENT TYPES
// ============================================

export type ToolIntent =
  | 'meals'        // Food logging, recipes, nutrition
  | 'workouts'     // Exercise plans, workout logs
  | 'goals'        // Goal setting and tracking
  | 'schedules'    // Daily schedules, calendar
  | 'wellbeing'    // Mood, stress, journal, energy, habits
  | 'progress'     // Weight, measurements, body tracking
  | 'water'        // Water intake tracking
  | 'shopping'     // Shopping lists
  | 'reminders'    // Scheduled reminders
  | 'integrations' // Third-party integrations (Whoop, etc.)
  | 'competitions' // Competitions, challenges, leaderboards
  | 'emotional'    // Emotional check-ins, mental recovery
  | 'gamification' // XP, levels, streaks, achievements
  | 'personal'     // Personal life context (occupation, family, routine)
  | 'music'        // Music playback, playlists, Spotify/Pulse
  | 'status'       // Activity status (sick, traveling, injured, etc.)
  | 'general';     // Profile, preferences, general queries

// ============================================
// TOOL GROUPS
// ============================================

/**
 * Maps intents to tool name prefixes/patterns
 * Used to filter tools based on detected intent
 */
export const TOOL_GROUPS: Record<ToolIntent, string[]> = {
  meals: [
    // Semantic managers
    'mealManager',
    'recipeManager',
    'dietPlanManager',
    // Read-only helpers
    'getUserMealLogs',
    'getUserRecipes',
    'getUserDietPlans',
    'getUserActivePlans',
  ],

  workouts: [
    'workoutManager',
    'scheduleManager', // Needed for rescheduling missed workouts
    'getUserWorkoutPlans',
    'getUserWorkoutLogs',
    'getUserActivePlans',
    'checkWorkoutProgress',
  ],

  goals: [
    'goalManager',
    'getUserGoals',
    'getUserActivePlans',
    'getUserProgress',
  ],

  schedules: [
    'scheduleManager',
    'getUserSchedules',
    'getScheduleByDate',
    'getUserTasks',
  ],

  wellbeing: [
    'moodManager',
    'stressManager',
    'journalManager',
    'voiceJournalManager',
    'energyManager',
    'habitManager',
    'scheduleManager',
    'getScheduleByDate',
    'getUserMoodTrends',
    'getUserActivityLogsWithMood',
    'createDailyCheckin',
    'getTodayCheckin',
    'getCheckinHistory',
    'getCheckinStreak',
    'getJournalInsights',
  ],

  progress: [
    'progressManager',
    'getUserProgress',
  ],

  water: [
    'waterIntakeManager',
    'getWaterIntakeLogs',
    'addWaterEntry',
  ],

  shopping: [
    // No dedicated manager yet - uses general tools
    'getUserActivePlans',
  ],

  reminders: [
    // No dedicated manager yet - uses scheduleManager
    'scheduleManager',
    'getUserTasks',
  ],

  integrations: [
    'getUserIntegrations',
    'whoopAnalyticsManager',
  ],

  competitions: [
    'competitionManager',
    'getUserActivePlans',
  ],

  emotional: [
    'emotionalCheckinManager',
    'mentalRecoveryManager',
    'moodManager',
  ],

  gamification: [
    'gamificationManager',
    'getUserActivePlans',
  ],

  personal: [
    'personalContextManager',
    'getUserProfile',
    'getUserPreferences',
  ],

  status: [
    'statusManager',
    'activityStatusUpdater',
    'statusHistoryViewer',
    'planAdjustmentManager',
  ],

  general: [
    // Always available - core read tools
    'getUserActivePlans',
    'getUserProfile',
    'getUserPreferences',
    'getUserProgress',
    'getUserGoals',
    'getUserMoodTrends',
    'getUserTasks',
    'getScheduleByDate',
    'scheduleManager', // Always available — system prompt references it for many scenarios
    'gamificationManager',
    'mentalRecoveryManager',
    'personalContextManager', // Always available — AI can save personal facts anytime
    'whoopAnalyticsManager', // Always available — WHOOP data queries for health coaching
  ],

  music: [
    'musicManager',
  ],
};

// ============================================
// INTENT CLASSIFICATION
// ============================================

/**
 * Intent keywords for fast classification
 * Maps common phrases to intents
 */
const INTENT_KEYWORDS: Record<ToolIntent, string[]> = {
  meals: [
    'meal', 'food', 'eat', 'ate', 'eating', 'breakfast', 'lunch', 'dinner',
    'snack', 'recipe', 'cook', 'cooking', 'nutrition', 'calories', 'calorie',
    'macro', 'protein', 'carb', 'fat', 'diet plan', 'meal plan', 'hungry',
  ],

  workouts: [
    'workout', 'exercise', 'gym', 'training', 'train', 'lift', 'lifting',
    'cardio', 'run', 'running', 'fitness', 'strength', 'muscle', 'reps',
    'sets', 'weight training', 'hiit', 'yoga', 'stretch', 'warm up',
  ],

  goals: [
    'goal', 'target', 'objective', 'aim', 'achieve', 'progress toward',
    'milestone', 'deadline', 'reach', 'accomplish',
  ],

  schedules: [
    'schedule', 'calendar', 'plan my day', 'daily plan', 'agenda',
    'appointment', 'time', 'when', 'today', 'tomorrow', 'routine',
    'prayer', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha',
    'morning routine', 'evening routine', 'daily routine',
  ],

  wellbeing: [
    'mood', 'feeling', 'feel', 'emotion', 'stress', 'stressed', 'anxious',
    'anxiety', 'journal', 'journaling', 'journling', 'journl', 'diary', 'energy', 'tired', 'exhausted', 'habit',
    'mental', 'wellbeing', 'wellness', 'happy', 'sad', 'angry', 'calm',
    'check-in', 'checkin', 'check in', 'daily checkin', 'daily check-in',
    'reflection', 'reflections', 'insights', 'constellation', 'stars',
    'voice journal', 'voice entry', 'speak', 'record', 'voice reflection',
  ],

  progress: [
    'weight', 'weigh', 'measurement', 'body', 'bmi', 'body fat', 'progress',
    'track', 'tracking', 'photo', 'picture', 'before after',
  ],

  water: [
    'water', 'hydration', 'hydrate', 'drink', 'drinking', 'thirsty', 'fluid',
    'glass', 'bottle', 'ml', 'oz', 'ounce', 'liter',
  ],

  shopping: [
    'shopping', 'shop', 'grocery', 'groceries', 'buy', 'purchase', 'list',
    'ingredients', 'store',
  ],

  reminders: [
    'reminder', 'remind', 'alert', 'notification', 'notify', 'alarm',
  ],

  integrations: [
    'whoop', 'fitbit', 'apple health', 'garmin', 'strava', 'integration',
    'connect', 'sync', 'import', 'device', 'wearable', 'watch',
    'hrv', 'recovery score', 'strain score', 'sleep stages', 'spo2',
    'resting heart rate', 'biometrics', 'recovery trend', 'sleep trend',
    'sleep quality', 'skin temp', 'heart rate variability',
  ],

  competitions: [
    'competition', 'compete', 'challenge', 'leaderboard', 'rank', 'ranking',
    'tournament', 'contest', 'versus', 'vs',
  ],

  emotional: [
    'emotional', 'checkin', 'check-in', 'recovery score', 'mental recovery',
    'screening', 'emotional health', 'mental health score',
  ],

  gamification: [
    'xp', 'level', 'achievement', 'badge', 'streak', 'points',
    'gamification', 'level up', 'experience', 'reward',
  ],

  personal: [
    'personal', 'family', 'married', 'wife', 'husband', 'kids', 'children',
    'job', 'work', 'office', 'occupation', 'career', 'schedule',
    'cook', 'cooking', 'kitchen', 'budget', 'money', 'afford',
    'live', 'living', 'apartment', 'house', 'home',
    'hobby', 'hobbies', 'interests', 'relationship',
  ],

  music: [
    'music', 'song', 'songs', 'play music', 'playing', 'playlist', 'track',
    'listen', 'spotify', 'pause music', 'stop music', 'next song',
    'skip', 'volume', 'turn up', 'turn down', 'louder', 'quieter', 'mute',
    'beats', 'tune', 'tunes', 'audio', 'soundscape', 'pulse',
  ],

  status: [
    'status', 'sick', 'injured', 'traveling', 'vacation', 'rest day',
    'activity status', 'feeling sick', 'hurt', 'recovery day', 'on leave',
    'under the weather', 'not feeling well',
  ],

  general: [], // Fallback - no specific keywords
};

/**
 * Classify user message intent using keyword matching
 * Returns primary intent + any secondary intents detected
 */
export function classifyIntent(message: string): { primary: ToolIntent; secondary: ToolIntent[] } {
  const lowerMessage = message.toLowerCase();
  const intentScores: Record<ToolIntent, number> = {
    meals: 0,
    workouts: 0,
    goals: 0,
    schedules: 0,
    wellbeing: 0,
    progress: 0,
    water: 0,
    shopping: 0,
    reminders: 0,
    integrations: 0,
    competitions: 0,
    emotional: 0,
    gamification: 0,
    personal: 0,
    music: 0,
    status: 0,
    general: 0,
  };

  // Score each intent based on keyword matches
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        // Longer keywords get higher weight
        intentScores[intent as ToolIntent] += keyword.length;
      }
    }
  }

  // Fuzzy fallback: if no strong match, check for partial keyword matches (min 4 chars)
  // This catches misspellings like "journling" matching "journal" via shared prefix "journ"
  const hasStrongMatch = Object.values(intentScores).some(s => s >= 4);
  if (!hasStrongMatch) {
    const words = lowerMessage.split(/\s+/);
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (keyword.length < 4) continue;
        const prefix = keyword.substring(0, Math.max(4, Math.floor(keyword.length * 0.7)));
        if (words.some(w => w.startsWith(prefix) || prefix.startsWith(w.substring(0, 4)))) {
          intentScores[intent as ToolIntent] += Math.floor(keyword.length * 0.5);
        }
      }
    }
  }

  // Sort intents by score
  const sortedIntents = Object.entries(intentScores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([intent]) => intent as ToolIntent);

  // Return primary and secondary intents
  const primary = sortedIntents[0] || 'general';
  const secondary = sortedIntents.slice(1, 3); // Up to 2 secondary intents

  logger.debug('[ToolRouter] Intent classified', {
    message: message.substring(0, 100),
    primary,
    secondary,
    scores: intentScores,
  });

  return { primary, secondary };
}

// ============================================
// TOOL FILTERING
// ============================================

/**
 * Filter tools based on detected intent
 * Returns tools relevant to primary + secondary intents + general tools
 */
export function filterToolsByIntent(
  allTools: DynamicStructuredTool[],
  intent: { primary: ToolIntent; secondary: ToolIntent[] }
): DynamicStructuredTool[] {
  // Collect tool names for all relevant intents
  const relevantToolNames = new Set<string>();

  // Add primary intent tools
  TOOL_GROUPS[intent.primary].forEach(name => relevantToolNames.add(name));

  // Add secondary intent tools
  intent.secondary.forEach(secondaryIntent => {
    TOOL_GROUPS[secondaryIntent].forEach(name => relevantToolNames.add(name));
  });

  // Always include general + status tools
  TOOL_GROUPS.general.forEach(name => relevantToolNames.add(name));
  TOOL_GROUPS.status.forEach(name => relevantToolNames.add(name));

  // Filter tools
  const filteredTools = allTools.filter(tool => relevantToolNames.has(tool.name));

  logger.debug('[ToolRouter] Tools filtered', {
    totalTools: allTools.length,
    filteredCount: filteredTools.length,
    primaryIntent: intent.primary,
    secondaryIntents: intent.secondary,
    toolNames: filteredTools.map(t => t.name),
  });

  return filteredTools;
}

// ============================================
// TOOL CACHE
// ============================================

// Cache tools per user to avoid rebuilding on every request
const toolCache = new Map<string, { tools: DynamicStructuredTool[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached tools for a user, or create new ones
 */
export function getCachedTools(
  userId: string,
  createFn: () => DynamicStructuredTool[]
): DynamicStructuredTool[] {
  const cached = toolCache.get(userId);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    logger.debug('[ToolRouter] Using cached tools', { userId, toolCount: cached.tools.length });
    return cached.tools;
  }

  try {
    const tools = createFn();
    toolCache.set(userId, { tools, timestamp: now });
    logger.debug('[ToolRouter] Created and cached tools', { userId, toolCount: tools.length });
    return tools;
  } catch (error) {
    logger.error('[ToolRouter] CRITICAL: Failed to create tools', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
    });
    // Return stale cache if available, otherwise empty array (chat still works, just no tools)
    return cached?.tools || [];
  }
}

/**
 * Clear cache for a specific user (e.g., after preference changes)
 */
export function clearToolCache(userId?: string): void {
  if (userId) {
    toolCache.delete(userId);
  } else {
    toolCache.clear();
  }
}

// ============================================
// MAIN ROUTING FUNCTION
// ============================================

/**
 * Get tools for a user message
 * Uses intent classification + caching for optimal performance
 */
export function getToolsForMessage(
  userId: string,
  message: string,
  createAllTools: () => DynamicStructuredTool[]
): DynamicStructuredTool[] {
  // Get or create cached tools
  const allTools = getCachedTools(userId, createAllTools);

  // Classify intent
  const intent = classifyIntent(message);

  // Filter tools by intent
  const tools = filterToolsByIntent(allTools, intent);

  logger.info('[ToolRouter] Tools selected for message', {
    userId,
    messagePreview: message.substring(0, 50),
    intent: intent.primary,
    toolCount: tools.length,
    reduction: `${allTools.length} → ${tools.length}`,
  });

  return tools;
}

// ============================================
// SERVICE EXPORT
// ============================================

export const toolRouterService = {
  classifyIntent,
  filterToolsByIntent,
  getCachedTools,
  clearToolCache,
  getToolsForMessage,
  TOOL_GROUPS,
};
