/**
 * @file Domain types barrel export
 */

// Goal types
export type {
  GoalCategory,
  HealthPillar,
  GoalStatus,
  GoalTimeline,
  Goal,
  SuggestedGoal,
} from './goal';

// Plan types
export type {
  PlanStatus,
  ActivityType,
  ActivityLogStatus,
  DayOfWeek,
  Activity,
  WeeklyFocus,
  Plan,
  TodayData,
  WeeklySummary,
  ActivityLog,
} from './plan';

// User types
export type {
  UserRole,
  Gender,
  AuthProvider,
  OnboardingStatus,
  User,
} from './user';

// Assessment types
export type {
  AssessmentType,
  QuestionType,
  AssessmentQuestion,
  AssessmentOption,
  AssessmentResponse,
  AssessmentResult,
  AssessmentInsight,
} from './assessment';

// Integration types
export type {
  IntegrationProvider,
  SyncStatus,
  DataType,
  Integration,
} from './integration';

// Preferences types
export type {
  NotificationChannel,
  CoachingStyle,
  CoachingIntensity,
  ConsentType,
  NotificationPreferences,
  CoachingPreferences,
  UserPreferences,
} from './preferences';
