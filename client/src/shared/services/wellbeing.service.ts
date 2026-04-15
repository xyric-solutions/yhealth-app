/**
 * @file Wellbeing API Service
 * @description Client-side API service for all wellbeing features
 */

import { api, type ApiResponse } from '@/lib/api-client';
import type {
  MoodLog,
  EnergyLog,
  JournalEntry,
  Habit,
  HabitLog,
  WellbeingRoutine,
  RoutineCompletion,
  MindfulnessPractice,
  BreathingTest,
  BreathingTimelineData,
  BreathingStats,
  BreathingTestType,
  EmotionTag,
  MoodEmoji,
  WellbeingMode,
  JournalPromptCategory,
  HabitTrackingType,
  DailyCheckin,
  CheckinTag,
  LifeGoal,
  LifeGoalCategory,
  LifeGoalMilestone,
  LifeGoalCheckin,
  LifeGoalDashboard,
  DailyIntention,
  JournalGoalLink,
  JournalingMode,
  TriggerCategory,
  CheckinType,
  DayComparison,
  BehavioralPattern,
  LessonLearned,
  LessonDomain,
  VoiceJournalSession,
  VoiceJournalTurnResponse,
  VoiceJournalSummary,
  GoalAction,
  GoalDecomposition,
  GoalActionResponseType,
} from '@shared/types/domain/wellbeing';

// ============================================
// MOOD SERVICE
// ============================================

export interface CreateMoodLogRequest {
  mood_emoji?: MoodEmoji;
  descriptor?: string;
  happiness_rating?: number;
  energy_rating?: number;
  stress_rating?: number;
  anxiety_rating?: number;
  emotion_tags?: EmotionTag[];
  context_note?: string;
  mode: WellbeingMode;
  logged_at?: string;
  transition_trigger?: string;
  trigger_category?: TriggerCategory;
}

export interface MoodLogsResponse {
  logs: MoodLog[];
  total: number;
  page: number;
  limit: number;
}

export interface MoodTimelineResponse {
  timeline: Array<{
    date: string;
    moodEmoji?: MoodEmoji;
    averageRating?: number;
    emotionTags: EmotionTag[];
  }>;
}

export interface MoodPatternsResponse {
  patterns: {
    timeOfDay: {
      morning: number;
      afternoon: number;
      evening: number;
      night: number;
    };
    dominantEmotions: Array<{ tag: EmotionTag; frequency: number }>;
    averageRatings: {
      happiness?: number;
      energy?: number;
      stress?: number;
      anxiety?: number;
    };
  };
}

export const moodService = {
  async createLog(data: CreateMoodLogRequest): Promise<ApiResponse<{ moodLog: MoodLog }>> {
    return api.post('/v1/wellbeing/mood', data);
  },

  async getLogs(params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<MoodLogsResponse>> {
    return api.get('/v1/wellbeing/mood', { params });
  },

  async getTimeline(startDate: string, endDate: string): Promise<ApiResponse<MoodTimelineResponse>> {
    return api.get('/v1/wellbeing/mood/timeline', {
      params: { startDate, endDate },
    });
  },

  async getPatterns(days: number = 30): Promise<ApiResponse<MoodPatternsResponse>> {
    return api.get('/v1/wellbeing/mood/patterns', {
      params: { days },
    });
  },

  async getTransitions(date: string): Promise<ApiResponse<{ transitions: MoodLog[] }>> {
    return api.get(`/v1/wellbeing/mood/transitions/${date}`);
  },

  async getTransitionPatterns(days: number = 30): Promise<ApiResponse<{ patterns: Array<{ triggerCategory: TriggerCategory; avgRating: number; count: number }> }>> {
    return api.get('/v1/wellbeing/mood/transition-patterns', {
      params: { days },
    });
  },
};

// ============================================
// ENERGY SERVICE
// ============================================

export interface CreateEnergyLogRequest {
  energy_rating: number;
  context_tag?: string;
  context_note?: string;
  logged_at?: string;
}

export interface EnergyLogsResponse {
  logs: EnergyLog[];
  total: number;
  page: number;
  limit: number;
}

export interface EnergyTimelineResponse {
  timeline: Array<{
    timestamp: string;
    energyRating: number;
    contextTag?: string;
  }>;
}

export interface EnergyPatternsResponse {
  patterns: {
    timeOfDay: {
      morning: number;
      afternoon: number;
      evening: number;
      night: number;
    };
    averageByContext: Array<{
      context: string;
      averageRating: number;
      count: number;
    }>;
  };
}

export const energyService = {
  async createLog(data: CreateEnergyLogRequest): Promise<ApiResponse<{ energyLog: EnergyLog }>> {
    return api.post('/v1/wellbeing/energy', data);
  },

  async getLogs(params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<EnergyLogsResponse>> {
    return api.get('/v1/wellbeing/energy', { params });
  },

  async getLogById(id: string): Promise<ApiResponse<{ energyLog: EnergyLog }>> {
    return api.get(`/v1/wellbeing/energy/${id}`);
  },

  async updateLog(id: string, data: Partial<CreateEnergyLogRequest>): Promise<ApiResponse<{ energyLog: EnergyLog }>> {
    return api.put(`/v1/wellbeing/energy/${id}`, data);
  },

  async deleteLog(id: string): Promise<ApiResponse<null>> {
    return api.delete(`/v1/wellbeing/energy/${id}`);
  },

  async getTimeline(startDate: string, endDate: string): Promise<ApiResponse<EnergyTimelineResponse>> {
    return api.get('/v1/wellbeing/energy/timeline', {
      params: { startDate, endDate },
    });
  },

  async getPatterns(days: number = 30): Promise<ApiResponse<EnergyPatternsResponse>> {
    return api.get('/v1/wellbeing/energy/patterns', {
      params: { days },
    });
  },
};

// ============================================
// JOURNAL SERVICE
// ============================================

export interface JournalPrompt {
  id: string;
  text: string;
  category: JournalPromptCategory;
  description?: string;
}

export interface CreateJournalEntryRequest {
  prompt: string;
  prompt_category?: JournalPromptCategory;
  prompt_id?: string;
  entry_text: string;
  mode: WellbeingMode;
  voice_entry?: boolean;
  duration_seconds?: number;
  logged_at?: string;
  // Enhanced journaling fields
  checkin_id?: string;
  journaling_mode?: JournalingMode;
  ai_generated_prompt?: boolean;
}

export interface JournalEntriesResponse {
  entries: JournalEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface JournalStreakResponse {
  streak: {
    currentStreak: number;
    longestStreak: number;
    streakStartDate?: string;
  };
}

export const journalService = {
  async getPrompts(limit: number = 3): Promise<ApiResponse<{ prompts: JournalPrompt[] }>> {
    return api.get('/v1/wellbeing/journal/prompts', {
      params: { limit },
    });
  },

  async createEntry(data: CreateJournalEntryRequest): Promise<ApiResponse<{ entry: JournalEntry }>> {
    return api.post('/v1/wellbeing/journal', data);
  },

  async getEntries(params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    category?: JournalPromptCategory;
  }): Promise<ApiResponse<JournalEntriesResponse>> {
    return api.get('/v1/wellbeing/journal', { params });
  },

  async getEntry(id: string): Promise<ApiResponse<{ entry: JournalEntry }>> {
    return api.get(`/v1/wellbeing/journal/${id}`);
  },

  async updateEntry(id: string, data: Partial<CreateJournalEntryRequest>): Promise<ApiResponse<{ entry: JournalEntry }>> {
    return api.put(`/v1/wellbeing/journal/${id}`, data);
  },

  async deleteEntry(id: string): Promise<ApiResponse<void>> {
    return api.delete(`/v1/wellbeing/journal/${id}`);
  },

  async getStreak(): Promise<ApiResponse<JournalStreakResponse>> {
    return api.get('/v1/wellbeing/journal/streak');
  },
};

// ============================================
// DAILY CHECK-IN SERVICE
// ============================================

export const dailyCheckinService = {
  async createOrUpdate(data: {
    mood_score?: number;
    energy_score?: number;
    sleep_quality?: number;
    stress_score?: number;
    tags?: CheckinTag[];
    day_summary?: string;
    checkin_type?: CheckinType;
    predicted_mood?: number;
    predicted_energy?: number;
    known_stressors?: string[];
    day_rating?: number;
    went_well?: string[];
    didnt_go_well?: string[];
    evening_lessons?: string[];
    tomorrow_focus?: string;
    screen_time_minutes?: number;
  }): Promise<ApiResponse<{ checkin: DailyCheckin }>> {
    return api.post('/v1/journal/checkin', data);
  },

  async getToday(type?: CheckinType): Promise<ApiResponse<{ checkin: DailyCheckin | null; hasCheckedIn: boolean }>> {
    return api.get('/v1/journal/checkin/today', { params: type ? { type } : undefined });
  },

  async getMorning(date?: string): Promise<ApiResponse<{ checkin: DailyCheckin | null }>> {
    return api.get('/v1/journal/checkin/morning', { params: date ? { date } : undefined });
  },

  async getEvening(date?: string): Promise<ApiResponse<{ checkin: DailyCheckin | null }>> {
    return api.get('/v1/journal/checkin/evening', { params: date ? { date } : undefined });
  },

  async getComparison(date?: string): Promise<ApiResponse<{ comparison: DayComparison | null }>> {
    return api.get('/v1/journal/checkin/comparison', { params: date ? { date } : undefined });
  },

  async getHistory(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    type?: CheckinType;
  }): Promise<ApiResponse<{ checkins: DailyCheckin[]; total: number; page: number; limit: number }>> {
    return api.get('/v1/journal/checkin/history', { params });
  },

  async getStreak(): Promise<ApiResponse<{ streak: { currentStreak: number; longestStreak: number } }>> {
    return api.get('/v1/journal/checkin/streak');
  },
};

// ============================================
// LIFE GOALS SERVICE
// ============================================

export const lifeGoalsService = {
  async createGoal(data: {
    category: LifeGoalCategory;
    title: string;
    description?: string;
    motivation?: string;
    tracking_method?: string;
    target_value?: number;
    target_unit?: string;
    detection_keywords?: string[];
    is_primary?: boolean;
  }): Promise<ApiResponse<{ goal: LifeGoal }>> {
    return api.post('/v1/journal/goals', data);
  },

  async getGoals(params?: {
    status?: string;
    category?: LifeGoalCategory;
  }): Promise<ApiResponse<{ goals: LifeGoal[] }>> {
    return api.get('/v1/journal/goals', { params });
  },

  async getGoal(id: string): Promise<ApiResponse<{ goal: LifeGoal }>> {
    return api.get(`/v1/journal/goals/${id}`);
  },

  async updateGoal(id: string, data: Partial<{
    category: LifeGoalCategory;
    title: string;
    description: string;
    motivation: string;
    tracking_method: string;
    target_value: number;
    target_unit: string;
    detection_keywords: string[];
    is_primary: boolean;
    status: string;
    current_value: number;
    progress: number;
  }>): Promise<ApiResponse<{ goal: LifeGoal }>> {
    return api.put(`/v1/journal/goals/${id}`, data);
  },

  async deleteGoal(id: string): Promise<ApiResponse<void>> {
    return api.delete(`/v1/journal/goals/${id}`);
  },

  async getGoalEntries(id: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ entries: JournalGoalLink[]; total: number }>> {
    return api.get(`/v1/journal/goals/${id}/entries`, { params });
  },

  async setIntention(data: {
    intention_text: string;
    checkin_id?: string;
    sort_order?: number;
    domain?: string;
  }): Promise<ApiResponse<{ intention: DailyIntention }>> {
    return api.post('/v1/journal/intentions', data);
  },

  async bulkSetIntentions(data: {
    intentions: Array<{ intentionText: string; domain?: string }>;
    checkin_id?: string;
  }): Promise<ApiResponse<{ intentions: DailyIntention[] }>> {
    return api.post('/v1/journal/intentions/bulk', data);
  },

  async getTodayIntention(): Promise<ApiResponse<{ intention: DailyIntention | null }>> {
    return api.get('/v1/journal/intentions/today');
  },

  async getTodayIntentions(): Promise<ApiResponse<{ intentions: DailyIntention[] }>> {
    return api.get('/v1/journal/intentions/today');
  },

  async getFulfillmentRate(days: number = 30): Promise<ApiResponse<{ rate: number; total: number; fulfilled: number }>> {
    return api.get('/v1/journal/intentions/fulfillment-rate', { params: { days } });
  },

  async updateIntention(id: string, data: {
    fulfilled?: boolean;
    reflection?: string;
  }): Promise<ApiResponse<{ intention: DailyIntention }>> {
    return api.put(`/v1/journal/intentions/${id}`, data);
  },

  // Milestones
  async createMilestone(goalId: string, data: {
    title: string;
    description?: string;
    target_date?: string;
    target_value?: number;
    sort_order?: number;
  }): Promise<ApiResponse<{ milestone: LifeGoalMilestone }>> {
    return api.post(`/v1/journal/goals/${goalId}/milestones`, data);
  },

  async getMilestones(goalId: string): Promise<ApiResponse<{ milestones: LifeGoalMilestone[] }>> {
    return api.get(`/v1/journal/goals/${goalId}/milestones`);
  },

  async updateMilestone(milestoneId: string, data: Partial<{
    title: string;
    description: string;
    target_date: string;
    target_value: number;
    current_value: number;
    sort_order: number;
    completed: boolean;
  }>): Promise<ApiResponse<{ milestone: LifeGoalMilestone }>> {
    return api.put(`/v1/journal/milestones/${milestoneId}`, data);
  },

  async completeMilestone(milestoneId: string): Promise<ApiResponse<{ milestone: LifeGoalMilestone }>> {
    return api.post(`/v1/journal/milestones/${milestoneId}/complete`);
  },

  async deleteMilestone(milestoneId: string): Promise<ApiResponse<void>> {
    return api.delete(`/v1/journal/milestones/${milestoneId}`);
  },

  // Check-ins
  async createCheckin(goalId: string, data: {
    progress_value?: number;
    note?: string;
    mood_about_goal?: number;
  }): Promise<ApiResponse<{ checkin: LifeGoalCheckin }>> {
    return api.post(`/v1/journal/goals/${goalId}/checkins`, data);
  },

  async getCheckins(goalId: string, limit?: number): Promise<ApiResponse<{ checkins: LifeGoalCheckin[] }>> {
    return api.get(`/v1/journal/goals/${goalId}/checkins`, { params: { limit } });
  },

  async getCheckinStreak(goalId: string): Promise<ApiResponse<{ streak: number }>> {
    return api.get(`/v1/journal/goals/${goalId}/checkins/streak`);
  },

  // Dashboard aggregate
  async getGoalDashboard(goalId: string): Promise<ApiResponse<{ dashboard: LifeGoalDashboard }>> {
    return api.get(`/v1/journal/goals/${goalId}/dashboard`);
  },

  // Goal Actions
  async getGoalActions(goalId: string): Promise<ApiResponse<{ actions: GoalAction[] }>> {
    return api.get(`/v1/journal/goals/${goalId}/actions`);
  },

  async decomposeGoal(goalId: string): Promise<ApiResponse<{ decomposition: GoalDecomposition }>> {
    return api.post(`/v1/journal/goals/${goalId}/decompose`);
  },

  async respondToAction(
    goalId: string,
    actionId: string,
    responseType: GoalActionResponseType,
    editedData?: { title?: string; description?: string },
  ): Promise<ApiResponse<void>> {
    return api.post(`/v1/journal/goals/${goalId}/actions/${actionId}/respond`, {
      responseType,
      ...editedData,
    });
  },

  async completeAction(goalId: string, actionId: string): Promise<ApiResponse<void>> {
    return api.post(`/v1/journal/goals/${goalId}/actions/${actionId}/complete`);
  },

  // AI-powered goal generation from onboarding assessment
  async generateGoalsFromAssessment(
    answers: Array<{ question: string; answer: string }>,
    motivationTier: string,
  ): Promise<Array<{ title: string; category: string; actions: string[] }>> {
    type GoalSuggestion = { title: string; category: string; actions: string[] };
    const res: ApiResponse<GoalSuggestion[]> = await api.post('/v1/journal/goals/from-assessment', {
      answers,
      motivationTier,
    });
    return res.data ?? [];
  },

  // Set motivation profile during onboarding
  async setMotivationProfile(declaredTier: string): Promise<void> {
    await api.post('/v1/journal/motivation-profile', { tier: declaredTier });
  },
};

// ============================================
// HABIT SERVICE
// ============================================

export interface CreateHabitRequest {
  habit_name: string;
  category?: string;
  tracking_type: HabitTrackingType;
  frequency: 'daily' | 'weekly' | 'custom';
  specific_days?: string[];
  description?: string;
  target_value?: number;
  unit?: string;
  reminder_enabled?: boolean;
  reminder_time?: string;
}

export interface UpdateHabitRequest extends Partial<CreateHabitRequest> {
  is_active?: boolean;
  is_archived?: boolean;
}

export interface CreateHabitLogRequest {
  completed: boolean;
  value?: number;
  note?: string;
  log_date?: string;
}

export interface HabitAnalyticsResponse {
  analytics: {
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    streakStartDate?: string;
    lastCompleted?: string;
    totalCompletions: number;
    totalDays: number;
    correlations?: Array<{
      metric: string;
      correlation: number;
      insight?: string;
    }>;
  };
}

export const habitService = {
  async getHabits(includeArchived: boolean = false): Promise<ApiResponse<{ habits: Habit[] }>> {
    return api.get('/v1/wellbeing/habits', {
      params: { includeArchived },
    });
  },

  async createHabit(data: CreateHabitRequest): Promise<ApiResponse<{ habit: Habit }>> {
    return api.post('/v1/wellbeing/habits', data);
  },

  async getHabit(id: string): Promise<ApiResponse<{ habit: Habit }>> {
    return api.get(`/v1/wellbeing/habits/${id}`);
  },

  async updateHabit(id: string, data: UpdateHabitRequest): Promise<ApiResponse<{ habit: Habit }>> {
    return api.put(`/v1/wellbeing/habits/${id}`, data);
  },

  async deleteHabit(id: string): Promise<ApiResponse<void>> {
    return api.delete(`/v1/wellbeing/habits/${id}`);
  },

  async logCompletion(
    id: string,
    data: CreateHabitLogRequest
  ): Promise<ApiResponse<{ habitLog: HabitLog }>> {
    return api.post(`/v1/wellbeing/habits/${id}/log`, data);
  },

  async getLogs(id: string, days: number = 30): Promise<ApiResponse<{ logs: HabitLog[] }>> {
    return api.get(`/v1/wellbeing/habits/${id}/logs`, {
      params: { days },
    });
  },

  async getAnalytics(id: string, days: number = 30): Promise<ApiResponse<HabitAnalyticsResponse>> {
    return api.get(`/v1/wellbeing/habits/${id}/analytics`, {
      params: { days },
    });
  },
};

// ============================================
// ROUTINE SERVICE
// ============================================

export interface RoutineTemplate {
  name: string;
  type: 'morning' | 'evening' | 'custom';
  steps: Array<{
    step: string;
    durationMin: number;
    order: number;
    instructions?: string;
  }>;
  description: string;
}

export interface CreateRoutineRequest {
  routine_name: string;
  routine_type: 'morning' | 'evening' | 'custom';
  steps: Array<{
    step: string;
    duration_min: number;
    order: number;
    instructions?: string;
  }>;
  frequency?: 'daily' | 'weekdays' | 'weekends' | 'custom';
  specific_days?: string[];
  trigger_time?: string;
  template_id?: string;
}

export interface CompleteRoutineRequest {
  steps_completed: Array<{
    step: string;
    completed: boolean;
    completed_at?: string;
  }>;
  started_at?: string;
  completed_at?: string;
}

export interface RoutineProgressResponse {
  progress: {
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    completions: RoutineCompletion[];
  };
}

export const routineService = {
  async getTemplates(): Promise<ApiResponse<{ templates: RoutineTemplate[] }>> {
    return api.get('/v1/wellbeing/routines/templates');
  },

  async createRoutine(data: CreateRoutineRequest): Promise<ApiResponse<{ routine: WellbeingRoutine }>> {
    return api.post('/v1/wellbeing/routines', data);
  },

  async getRoutines(includeArchived: boolean = false): Promise<ApiResponse<{ routines: WellbeingRoutine[] }>> {
    return api.get('/v1/wellbeing/routines', {
      params: { includeArchived },
    });
  },

  async getRoutine(id: string): Promise<ApiResponse<{ routine: WellbeingRoutine }>> {
    return api.get(`/v1/wellbeing/routines/${id}`);
  },

  async completeRoutine(
    id: string,
    data: CompleteRoutineRequest
  ): Promise<ApiResponse<{ completion: RoutineCompletion }>> {
    return api.post(`/v1/wellbeing/routines/${id}/complete`, data);
  },

  async getProgress(id: string, days: number = 30): Promise<ApiResponse<RoutineProgressResponse>> {
    return api.get(`/v1/wellbeing/routines/${id}/progress`, {
      params: { days },
    });
  },
};

// ============================================
// MINDFULNESS SERVICE
// ============================================

export interface LogPracticeRequest {
  practice_name: string;
  practice_category: 'breathing' | 'meditation' | 'movement' | 'quick_reset' | 'evening';
  actual_duration_minutes?: number;
  effectiveness_rating?: number;
  context?: string;
  note?: string;
}

export const mindfulnessService = {
  async getPractices(): Promise<ApiResponse<{ practices: MindfulnessPractice[] }>> {
    return api.get('/v1/wellbeing/mindfulness/practices');
  },

  async getRecommendation(
    context?: 'high_stress' | 'low_energy' | 'low_mood' | 'poor_sleep'
  ): Promise<ApiResponse<{ practice: MindfulnessPractice | null }>> {
    return api.get('/v1/wellbeing/mindfulness/recommend', {
      params: context ? { context } : undefined,
    });
  },

  async logPractice(data: LogPracticeRequest): Promise<ApiResponse<{ practice: MindfulnessPractice }>> {
    return api.post('/v1/wellbeing/mindfulness/log', data);
  },

  async getHistory(limit: number = 20): Promise<ApiResponse<{ history: MindfulnessPractice[] }>> {
    return api.get('/v1/wellbeing/mindfulness/history', {
      params: { limit },
    });
  },
};

// ============================================
// BREATHING SERVICE
// ============================================

export interface CreateBreathingTestRequest {
  test_type: BreathingTestType;
  pattern_name?: string;
  breath_hold_duration_seconds?: number;
  total_cycles_completed?: number;
  total_duration_seconds: number;
  average_inhale_duration?: number;
  average_exhale_duration?: number;
  average_hold_duration?: number;
  consistency_score?: number;
  difficulty_rating?: number;
  notes?: string;
  started_at: string;
}

export interface BreathingTestsResponse {
  tests: BreathingTest[];
  total: number;
  page: number;
  limit: number;
}

export interface BreathingTimelineResponse {
  timeline: BreathingTimelineData[];
}

export interface BreathingStatsResponse {
  stats: BreathingStats;
}

export const breathingService = {
  async saveTest(data: CreateBreathingTestRequest): Promise<ApiResponse<{ breathingTest: BreathingTest }>> {
    return api.post('/v1/wellbeing/breathing', data);
  },

  async getTests(params?: {
    startDate?: string;
    endDate?: string;
    testType?: BreathingTestType;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<BreathingTestsResponse>> {
    return api.get('/v1/wellbeing/breathing', { params });
  },

  async getTestById(id: string): Promise<ApiResponse<{ breathingTest: BreathingTest }>> {
    return api.get(`/v1/wellbeing/breathing/${id}`);
  },

  async deleteTest(id: string): Promise<ApiResponse<null>> {
    return api.delete(`/v1/wellbeing/breathing/${id}`);
  },

  async getTimeline(startDate: string, endDate: string): Promise<ApiResponse<BreathingTimelineResponse>> {
    return api.get('/v1/wellbeing/breathing/timeline', {
      params: { startDate, endDate },
    });
  },

  async getStats(days: number = 30): Promise<ApiResponse<BreathingStatsResponse>> {
    return api.get('/v1/wellbeing/breathing/stats', {
      params: { days },
    });
  },
};

// ============================================
// BEHAVIORAL PATTERN SERVICE
// ============================================

export const behavioralPatternService = {
  async getActive(): Promise<ApiResponse<{ patterns: BehavioralPattern[] }>> {
    return api.get('/v1/wellbeing/behavioral-patterns');
  },

  async acknowledge(id: string): Promise<ApiResponse<void>> {
    return api.post(`/v1/wellbeing/behavioral-patterns/${id}/acknowledge`);
  },

  async dismiss(id: string): Promise<ApiResponse<void>> {
    return api.post(`/v1/wellbeing/behavioral-patterns/${id}/dismiss`);
  },
};

// ============================================
// LESSONS LEARNED SERVICE
// ============================================

export const lessonsService = {
  async getAll(params?: {
    domain?: LessonDomain;
    confirmed?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ lessons: LessonLearned[]; total: number; page: number; limit: number }>> {
    return api.get('/v1/journal/lessons', { params });
  },

  async confirm(id: string): Promise<ApiResponse<{ lesson: LessonLearned }>> {
    return api.post(`/v1/journal/lessons/${id}/confirm`);
  },

  async dismiss(id: string): Promise<ApiResponse<void>> {
    return api.post(`/v1/journal/lessons/${id}/dismiss`);
  },

  async getReminders(): Promise<ApiResponse<{ lessons: LessonLearned[] }>> {
    return api.get('/v1/journal/lessons/reminders');
  },

  async search(q: string): Promise<ApiResponse<{ lessons: LessonLearned[] }>> {
    return api.get('/v1/journal/lessons/search', { params: { q } });
  },

  async markReminded(id: string): Promise<ApiResponse<void>> {
    return api.post(`/v1/journal/lessons/${id}/reminded`);
  },
};

// ============================================
// VOICE JOURNAL SERVICE
// ============================================

export const voiceJournalService = {
  async startSession(): Promise<ApiResponse<{ session: VoiceJournalSession }>> {
    return api.post('/v1/journal/voice/start');
  },

  async getActiveSession(): Promise<ApiResponse<{ session: VoiceJournalSession | null }>> {
    return api.get('/v1/journal/voice/active');
  },

  async submitVoiceTurn(sessionId: string, audioBlob: Blob): Promise<ApiResponse<VoiceJournalTurnResponse>> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    return api.post(`/v1/journal/voice/${sessionId}/turn`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async submitTextTurn(sessionId: string, text: string): Promise<ApiResponse<VoiceJournalTurnResponse>> {
    return api.post(`/v1/journal/voice/${sessionId}/text-turn`, { text });
  },

  async generateSummary(sessionId: string): Promise<ApiResponse<{ summary: VoiceJournalSummary }>> {
    return api.post(`/v1/journal/voice/${sessionId}/summarize`);
  },

  async approveAndSave(sessionId: string, editedText?: string): Promise<ApiResponse<{ journalEntryId: string }>> {
    return api.post(`/v1/journal/voice/${sessionId}/approve`, { editedText });
  },

  async abandonSession(sessionId: string): Promise<ApiResponse<void>> {
    return api.post(`/v1/journal/voice/${sessionId}/abandon`);
  },
};

// ============================================
// INSIGHTS SERVICE
// ============================================

export interface InsightCorrelation {
  id: string;
  patternType: string;
  headline: string;
  insight: string;
  correlationStrength: number;
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low';
  evidence: Record<string, unknown>;
  windowDays: number;
  computedAt: string;
}

export const insightsService = {
  async getCorrelations(): Promise<ApiResponse<{ correlations: InsightCorrelation[] }>> {
    return api.get('/v1/wellbeing/insights/correlations');
  },

  async dismissInsight(id: string): Promise<ApiResponse<void>> {
    return api.post(`/v1/wellbeing/insights/${id}/dismiss`);
  },

  async getThemes(): Promise<ApiResponse<{ themes: ThemeInsightData[] }>> {
    return api.get('/v1/wellbeing/insights/themes');
  },

  async computeNow(days: number = 30): Promise<ApiResponse<{ correlationsFound: number; themesFound: number; windowDays: number }>> {
    return api.post(`/v1/wellbeing/insights/compute?days=${days}`);
  },
};

export interface ThemeInsightData {
  theme: string;
  frequency: number;
  percentage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  coOccurrences?: string[];
}
