/**
 * @file LangGraph Tools Service
 * @description Defines tools for LangGraph to query user data from database
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { workoutPlanService } from './workout-plan.service.js';
import { taskService } from './task.service.js';
import { workoutAlarmService } from './workout-alarm.service.js';
import { embeddingQueueService } from './embedding-queue.service.js';
import { JobPriorities } from '../config/queue.config.js';
import { moodService } from './wellbeing/mood.service.js';
import { stressService } from './stress.service.js';
import { journalService } from './wellbeing/journal.service.js';
import { dailyCheckinService } from './wellbeing/daily-checkin.service.js';
import { energyService } from './wellbeing/energy.service.js';
import { habitService } from './wellbeing/habit.service.js';
import { scheduleService, type DailySchedule } from './schedule.service.js';

// ============================================
// TOOL SCHEMAS
// ============================================

const GetUserWorkoutPlansSchema = z.object({
  status: z.string().optional().describe('Filter by status: active, completed, paused, archived'),
});

const GetUserWorkoutLogsSchema = z.object({
  planId: z.string().optional().describe('Filter by workout plan ID'),
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  limit: z.number().optional().describe('Maximum number of logs to return (default: 20)'),
});

const GetUserDietPlansSchema = z.object({
  status: z.string().optional().describe('Filter by status: active, completed, paused, archived'),
});

const GetUserMealLogsSchema = z.object({
  date: z.string().optional().describe('Specific date in ISO format (YYYY-MM-DD)'),
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
});

const GetUserTasksSchema = z.object({
  status: z.string().optional().describe('Filter by status: pending, in_progress, completed, cancelled'),
  category: z.string().optional().describe('Filter by category: health, fitness, nutrition, work, personal, general'),
  fromDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  toDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
});

const GetUserProgressSchema = z.object({
  type: z.string().optional().describe('Filter by record type: weight, measurements, body_fat, etc.'),
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
});

const GetUserActivePlansSchema = z.object({});

const GetUserActivityLogsWithMoodSchema = z.object({
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  limit: z.number().optional().describe('Maximum number of logs to return (default: 20)'),
});

const GetUserMoodTrendsSchema = z.object({
  days: z.number().optional().describe('Number of days to analyze (default: 14)'),
});

// Workout Reschedule Schemas
const CheckWorkoutProgressSchema = z.object({
  workoutPlanId: z.string().optional().describe('Specific workout plan ID to check (optional)'),
});

const RescheduleWorkoutTasksSchema = z.object({
  workoutPlanId: z.string().describe('Workout plan ID to reschedule tasks for'),
  policy: z.enum(['SLIDE_FORWARD', 'FILL_GAPS', 'DROP_OR_COMPRESS']).optional().describe('Rescheduling policy (default: FILL_GAPS)'),
});

// ============================================
// WELLBEING SCHEMAS
// ============================================

// Mood Schemas
const GetUserMoodLogsSchema = z.object({
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  page: z.number().optional().describe('Page number (default: 1)'),
  limit: z.number().optional().describe('Items per page (default: 50)'),
});

const CreateMoodLogSchema = z.object({
  moodEmoji: z.string().optional().describe('Mood emoji: 😊, 😐, 😟, 😡, 😰, 😴'),
  descriptor: z.string().optional().describe('Mood descriptor'),
  happinessRating: z.number().optional().describe('Happiness rating 1-10'),
  energyRating: z.number().optional().describe('Energy rating 1-10'),
  stressRating: z.number().optional().describe('Stress rating 1-10'),
  anxietyRating: z.number().optional().describe('Anxiety rating 1-10'),
  emotionTags: z.array(z.string()).optional().describe('Emotion tags array'),
  contextNote: z.string().optional().describe('Context note'),
  mode: z.enum(['light', 'deep']).describe('Mode: light or deep'),
  loggedAt: z.string().optional().describe('Timestamp in ISO format'),
});

const UpdateMoodLogSchema = z.object({
  logId: z.string().describe('Mood log ID (required)'),
  moodEmoji: z.string().optional(),
  descriptor: z.string().optional(),
  happinessRating: z.number().optional(),
  energyRating: z.number().optional(),
  stressRating: z.number().optional(),
  anxietyRating: z.number().optional(),
  emotionTags: z.array(z.string()).optional(),
  contextNote: z.string().optional(),
});

const DeleteMoodLogSchema = z.object({
  logId: z.string().describe('Mood log ID to delete (required)'),
});

const GetMoodTimelineSchema = z.object({
  startDate: z.string().describe('Start date in ISO format (YYYY-MM-DD) (required)'),
  endDate: z.string().describe('End date in ISO format (YYYY-MM-DD) (required)'),
});

const GetMoodPatternsSchema = z.object({
  days: z.number().optional().describe('Number of days to analyze (default: 30)'),
});

// Stress Schemas
const GetUserStressLogsSchema = z.object({
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  page: z.number().optional().describe('Page number (default: 1)'),
  limit: z.number().optional().describe('Items per page (default: 50)'),
});

const CreateStressLogSchema = z.object({
  stressRating: z.number().describe('Stress rating 1-10 (required)'),
  triggers: z.array(z.string()).optional().describe('Stress triggers array'),
  otherTrigger: z.string().optional().describe('Other trigger description'),
  note: z.string().optional().describe('Note'),
  checkInType: z.enum(['daily', 'on_demand']).describe('Check-in type'),
  clientRequestId: z.string().describe('Client request ID for idempotency (required)'),
  loggedAt: z.string().optional().describe('Timestamp in ISO format'),
});

const UpdateStressLogSchema = z.object({
  logId: z.string().describe('Stress log ID (required)'),
  stressRating: z.number().optional(),
  triggers: z.array(z.string()).optional(),
  otherTrigger: z.string().optional(),
  note: z.string().optional(),
});

const DeleteStressLogSchema = z.object({
  logId: z.string().describe('Stress log ID to delete (required)'),
});

const GetStressTrendsSchema = z.object({
  days: z.number().optional().describe('Number of days to analyze (default: 30)'),
});

// Journal Schemas
const GetUserJournalEntriesSchema = z.object({
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  page: z.number().optional().describe('Page number (default: 1)'),
  limit: z.number().optional().describe('Items per page (default: 50)'),
  category: z.string().optional().describe('Prompt category filter'),
});

const CreateJournalEntrySchema = z.object({
  prompt: z.string().describe('Journal prompt (required)'),
  promptCategory: z.string().optional().describe('Prompt category'),
  promptId: z.string().optional().describe('Prompt ID'),
  entryText: z.string().describe('Entry text (required)'),
  mode: z.enum(['light', 'deep']).describe('Mode: light or deep'),
  voiceEntry: z.boolean().optional().describe('Whether entry was voice recorded'),
  durationSeconds: z.number().optional().describe('Voice duration in seconds'),
  loggedAt: z.string().optional().describe('Timestamp in ISO format'),
});

const UpdateJournalEntrySchema = z.object({
  entryId: z.string().describe('Journal entry ID (required)'),
  entryText: z.string().optional(),
  prompt: z.string().optional(),
  promptCategory: z.string().optional(),
});

const DeleteJournalEntrySchema = z.object({
  entryId: z.string().describe('Journal entry ID to delete (required)'),
});

const GetJournalStreakSchema = z.object({});

// Daily Check-in Schemas
const CreateDailyCheckinSchema = z.object({
  moodScore: z.number().min(1).max(10).optional().describe('Mood score 1-10 (1=terrible, 10=amazing)'),
  energyScore: z.number().min(1).max(10).optional().describe('Energy score 1-10'),
  sleepQuality: z.number().min(1).max(5).optional().describe('Sleep quality 1-5 (1=terrible, 5=excellent)'),
  stressScore: z.number().min(1).max(10).optional().describe('Stress score 1-10 (1=none, 10=extreme)'),
  tags: z.array(z.string()).optional().describe('Tags: productive, social, spiritual, creative, challenging, restful, anxious, grateful, lonely, motivated, exhausted, peaceful'),
  daySummary: z.string().optional().describe('Brief summary of how the day is going'),
});

const GetTodayCheckinSchema = z.object({});

const GetCheckinHistorySchema = z.object({
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  limit: z.number().optional().describe('Max results (default: 30)'),
});

const GetCheckinStreakSchema = z.object({});

const GetJournalInsightsSchema = z.object({
  days: z.number().optional().describe('Number of days to analyze (default: 30)'),
});

// Energy Schemas
const GetUserEnergyLogsSchema = z.object({
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  page: z.number().optional().describe('Page number (default: 1)'),
  limit: z.number().optional().describe('Items per page (default: 50)'),
});

const CreateEnergyLogSchema = z.object({
  energyRating: z.number().describe('Energy rating 1-10 (required)'),
  contextTag: z.string().optional().describe('Context tag'),
  contextNote: z.string().optional().describe('Context note'),
  loggedAt: z.string().optional().describe('Timestamp in ISO format'),
});

const UpdateEnergyLogSchema = z.object({
  logId: z.string().describe('Energy log ID (required)'),
  energyRating: z.number().optional(),
  contextTag: z.string().optional(),
  contextNote: z.string().optional(),
});

const DeleteEnergyLogSchema = z.object({
  logId: z.string().describe('Energy log ID to delete (required)'),
});

const GetEnergyTimelineSchema = z.object({
  startDate: z.string().describe('Start date in ISO format (YYYY-MM-DD) (required)'),
  endDate: z.string().describe('End date in ISO format (YYYY-MM-DD) (required)'),
});

const GetEnergyPatternsSchema = z.object({
  days: z.number().optional().describe('Number of days to analyze (default: 30)'),
});

// Habits Schemas
const GetUserHabitsSchema = z.object({
  includeArchived: z.boolean().optional().describe('Include archived habits (default: false)'),
});

const CreateHabitSchema = z.object({
  habitName: z.string().describe('Habit name (required)'),
  category: z.string().optional().describe('Habit category'),
  trackingType: z.enum(['boolean', 'numeric', 'duration']).describe('Tracking type'),
  frequency: z.enum(['daily', 'weekly', 'custom']).describe('Frequency'),
  specificDays: z.array(z.string()).optional().describe('Specific days for custom frequency'),
  description: z.string().optional().describe('Description'),
  targetValue: z.number().optional().describe('Target value for numeric tracking'),
  unit: z.string().optional().describe('Unit for numeric tracking'),
  reminderEnabled: z.boolean().optional().describe('Enable reminders'),
  reminderTime: z.string().optional().describe('Reminder time in HH:MM format'),
});

const UpdateHabitSchema = z.object({
  habitId: z.string().describe('Habit ID (required)'),
  habitName: z.string().optional(),
  category: z.string().optional(),
  trackingType: z.enum(['boolean', 'numeric', 'duration']).optional(),
  frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
  specificDays: z.array(z.string()).optional(),
  description: z.string().optional(),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: z.string().optional(),
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

const DeleteHabitSchema = z.object({
  habitId: z.string().describe('Habit ID to delete (required)'),
});

const LogHabitCompletionSchema = z.object({
  habitId: z.string().describe('Habit ID (required)'),
  completed: z.boolean().describe('Whether habit was completed (required)'),
  value: z.number().optional().describe('Value for numeric tracking'),
  note: z.string().optional().describe('Note'),
  logDate: z.string().optional().describe('Date in ISO format (YYYY-MM-DD)'),
});

const GetHabitAnalyticsSchema = z.object({
  habitId: z.string().describe('Habit ID (required)'),
  days: z.number().optional().describe('Number of days to analyze (default: 30)'),
});

// Schedule Schemas
const GetUserSchedulesSchema = z.object({
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
});

const GetScheduleByDateSchema = z.object({
  date: z.string().optional().describe('Date in ISO format (YYYY-MM-DD). If not provided, will default to today\'s date. Optional - defaults to today.'),
});

const CreateScheduleItemInputSchema = z.object({
  title: z.string().describe('Item title (required)'),
  description: z.string().optional().describe('Item description'),
  startTime: z.string().describe('Start time in HH:mm format (required, e.g., "09:00" or "5:30 AM" - will be normalized automatically)'),
  endTime: z.string().optional().describe('End time in HH:mm format (e.g., "10:00" or "7:00 PM" - will be normalized automatically)'),
  durationMinutes: z.number().optional().describe('Duration in minutes (if endTime not provided)'),
  color: z.string().optional().describe('Color hex code (e.g., "#FF5733")'),
  icon: z.string().optional().describe('Icon name or emoji'),
  category: z.string().optional().describe('Category (e.g., "workout", "meal", "meeting")'),
  position: z.number().describe('Position in schedule (0-based, required)'),
  metadata: z.record(z.any()).optional().describe('Additional metadata'),
});

const CreateScheduleLinkInputSchema = z.object({
  sourceItemIndex: z.number().describe('Index of source item in items array (0-based)'),
  targetItemIndex: z.number().describe('Index of target item in items array (0-based)'),
  linkType: z.enum(['sequential', 'conditional', 'parallel']).optional().describe('Link type (default: sequential)'),
  delayMinutes: z.number().optional().describe('Delay in minutes between items (default: 0)'),
  conditions: z.record(z.any()).optional().describe('Conditions for conditional links'),
});

// Schema for schedule items within CreateDailyScheduleSchema (position is optional, will be auto-generated)
const CreateScheduleItemInputSchemaForSchedule = CreateScheduleItemInputSchema.extend({
  position: z.number().optional().describe('Position in schedule (0-based). If not provided, will be auto-generated based on item order in the array.'),
});

const CreateDailyScheduleSchema = z.object({
  scheduleDate: z.string().optional().describe('Schedule date in ISO format (YYYY-MM-DD). If not provided, will default to today\'s date. Optional - defaults to today.'),
  templateId: z.string().optional().describe('Template ID to use for the schedule (optional)'),
  name: z.string().optional().describe('Schedule name (optional)'),
  notes: z.string().optional().describe('Schedule notes (optional)'),
  items: z.array(z.union([
    CreateScheduleItemInputSchemaForSchedule,
    z.string().describe('Schedule item as string (e.g., "Breakfast at 7:00 a.m.") - will be parsed automatically')
  ])).optional().describe('Schedule items/activities to add to the schedule. Each item should be an object with title and startTime, or a string like "Activity at time" which will be parsed. Position will be auto-generated based on item order if not provided. When user describes activities with times (e.g., "workout at 9am", "lunch at 12pm"), create items for them.'),
  links: z.array(CreateScheduleLinkInputSchema).optional().describe('Links between schedule items. Use item indices from the items array (0-based). Create links when user mentions activities happening in sequence (e.g., "after workout, then shower") or connected activities. sourceItemIndex is the first item, targetItemIndex is the item that follows.'),
});

const UpdateDailyScheduleSchema = z.object({
  scheduleId: z.string().describe('Schedule ID (required)'),
  name: z.string().optional().describe('Schedule name'),
  notes: z.string().optional().describe('Schedule notes'),
});

const DeleteDailyScheduleSchema = z.object({
  scheduleId: z.string().describe('Schedule ID to delete (required)'),
});

const CreateScheduleItemSchema = z.object({
  scheduleId: z.string().describe('Schedule ID (required) or schedule date in YYYY-MM-DD format. If a date is provided and no schedule exists for that date, a new schedule will be created automatically.'),
  title: z.string().describe('Item title (required)'),
  description: z.string().optional().describe('Description'),
  startTime: z.string().describe('Start time in HH:mm format (required)'),
  endTime: z.string().optional().describe('End time in HH:mm format'),
  durationMinutes: z.number().optional().describe('Duration in minutes'),
  color: z.string().optional().describe('Color hex code'),
  icon: z.string().optional().describe('Icon name'),
  category: z.string().optional().describe('Category'),
  position: z.number().describe('Position in schedule (required)'),
  metadata: z.record(z.any()).optional().describe('Metadata object'),
});

const UpdateScheduleItemSchema = z.object({
  itemId: z.string().describe('Schedule item ID (required)'),
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationMinutes: z.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  position: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

const DeleteScheduleItemSchema = z.object({
  itemId: z.string().describe('Schedule item ID to delete (required)'),
});

const CreateScheduleLinkSchema = z.object({
  scheduleId: z.string().describe('Schedule ID (required)'),
  sourceItemId: z.string().describe('Source item ID (required)'),
  targetItemId: z.string().describe('Target item ID (required)'),
  linkType: z.enum(['sequential', 'conditional', 'parallel']).optional().describe('Link type'),
  delayMinutes: z.number().optional().describe('Delay in minutes'),
  conditions: z.record(z.any()).optional().describe('Conditions object'),
});

const DeleteScheduleLinkSchema = z.object({
  linkId: z.string().describe('Schedule link ID to delete (required)'),
});

// User Preferences Schemas
const CreateUserPreferencesSchema = z.object({
  coachingStyle: z.string().optional().describe('Coaching style: supportive, motivational, analytical, balanced'),
  coachingIntensity: z.string().optional().describe('Coaching intensity: gentle, moderate, intense'),
  preferredChannel: z.string().optional().describe('Preferred notification channel: push, email, sms, whatsapp'),
  checkInFrequency: z.string().optional().describe('Check-in frequency: daily, weekly, biweekly, monthly'),
  preferredCheckInTime: z.string().optional().describe('Preferred check-in time in HH:MM format'),
  aiUseEmojis: z.boolean().optional().describe('Whether AI should use emojis in responses'),
  aiFormalityLevel: z.string().optional().describe('AI formality level: casual, balanced, formal'),
  aiEncouragementLevel: z.string().optional().describe('AI encouragement level: low, medium, high'),
  focusAreas: z.array(z.string()).optional().describe('Focus areas array'),
  weightUnit: z.string().optional().describe('Weight unit: kg, lbs'),
  heightUnit: z.string().optional().describe('Height unit: cm, inches'),
  distanceUnit: z.string().optional().describe('Distance unit: km, miles'),
  language: z.string().optional().describe('Language code: en, ur, etc.'),
  timezone: z.string().optional().describe('Timezone string'),
  quietHoursEnabled: z.boolean().optional().describe('Enable quiet hours'),
  quietHoursStart: z.string().optional().describe('Quiet hours start time in HH:MM format'),
  quietHoursEnd: z.string().optional().describe('Quiet hours end time in HH:MM format'),
});

const UpdateUserPreferencesSchema = z.object({
  coachingStyle: z.string().optional(),
  coachingIntensity: z.string().optional(),
  preferredChannel: z.string().optional(),
  checkInFrequency: z.string().optional(),
  preferredCheckInTime: z.string().optional(),
  aiUseEmojis: z.boolean().optional(),
  aiFormalityLevel: z.string().optional(),
  aiEncouragementLevel: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
  weightUnit: z.string().optional(),
  heightUnit: z.string().optional(),
  distanceUnit: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  notificationChannels: z.record(z.boolean()).optional().describe('Notification channels object'),
  notificationTypes: z.record(z.any()).optional().describe('Notification types preferences'),
  maxNotificationsDay: z.number().optional(),
  maxNotificationsWeek: z.number().optional(),
});

// ============================================
// CRUD SCHEMAS
// ============================================

// Workout Plans
const CreateWorkoutPlanSchema = z.object({
  name: z.string().describe('Workout plan name (required)'),
  description: z.string().optional().describe('Plan description'),
  goalCategory: z.string().optional().describe('Goal category: weight_loss, muscle_building, etc.'),
  fitnessLevel: z.string().optional().describe('Fitness level: beginner, intermediate, advanced'),
  durationWeeks: z.number().optional().describe('Plan duration in weeks'),
  workoutsPerWeek: z.number().optional().describe('Number of workouts per week'),
  availableEquipment: z.array(z.string()).optional().describe('Available equipment list'),
  workoutLocation: z.string().optional().describe('Location: gym, home, outdoor'),
  weeklySchedule: z.record(z.any()).optional().describe('Weekly schedule (optional for simple plans)'),
  isActive: z.boolean().optional().describe('Set as active plan'),
});

const UpdateWorkoutPlanSchema = z.object({
  planId: z.string().describe('Workout plan ID (required)'),
  name: z.string().optional(),
  description: z.string().optional(),
  goalCategory: z.string().optional(),
  fitnessLevel: z.string().optional(),
  durationWeeks: z.number().optional(),
  workoutsPerWeek: z.number().optional(),
  availableEquipment: z.array(z.string()).optional(),
  workoutLocation: z.string().optional(),
  weeklySchedule: z.record(z.any()).optional(),
  status: z.string().optional(),
});

const DeleteWorkoutPlanSchema = z.object({
  planId: z.string().describe('Workout plan ID to delete (required)'),
});

// Workout Alarms
const CreateWorkoutAlarmSchema = z.object({
  workoutPlanId: z.string().optional().describe('Associated workout plan ID'),
  title: z.string().optional().describe('Alarm title'),
  message: z.string().optional().describe('Alarm message'),
  alarmTime: z.string().describe('Alarm time in HH:MM format (required)'),
  daysOfWeek: z.array(z.number()).optional().describe('Days of week (0=Sun, 1=Mon, ..., 6=Sat)'),
  notificationType: z.string().optional().describe('Notification type: push, email, sms, all'),
  soundEnabled: z.boolean().optional(),
  vibrationEnabled: z.boolean().optional(),
  snoozeMinutes: z.number().optional(),
});

const UpdateWorkoutAlarmSchema = z.object({
  alarmId: z.string().describe('Alarm ID (required)'),
  title: z.string().optional(),
  message: z.string().optional(),
  alarmTime: z.string().optional(),
  daysOfWeek: z.array(z.number()).optional(),
  isEnabled: z.boolean().optional(),
  notificationType: z.string().optional(),
  soundEnabled: z.boolean().optional(),
  vibrationEnabled: z.boolean().optional(),
  snoozeMinutes: z.number().optional(),
});

const DeleteWorkoutAlarmSchema = z.object({
  alarmId: z.string().describe('Alarm ID to delete (required)'),
});

// Recipes
const CreateRecipeSchema = z.object({
  name: z.string().describe('Recipe name (required)'),
  description: z.string().optional(),
  category: z.string().optional().describe('Category: breakfast, lunch, dinner, snack, dessert, other'),
  cuisine: z.string().optional(),
  servings: z.number().optional(),
  caloriesPerServing: z.number().optional(),
  proteinGrams: z.number().optional(),
  carbsGrams: z.number().optional(),
  fatGrams: z.number().optional(),
  fiberGrams: z.number().optional(),
  ingredients: z.array(z.any()).optional().describe('Ingredients array'),
  instructions: z.array(z.any()).optional().describe('Instructions array'),
  prepTimeMinutes: z.number().optional(),
  cookTimeMinutes: z.number().optional(),
  totalTimeMinutes: z.number().optional(),
  tags: z.array(z.string()).optional(),
  dietaryFlags: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  difficulty: z.string().optional().describe('Difficulty: easy, medium, hard'),
});

const UpdateRecipeSchema = z.object({
  recipeId: z.string().describe('Recipe ID (required)'),
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  cuisine: z.string().optional(),
  servings: z.number().optional(),
  caloriesPerServing: z.number().optional(),
  proteinGrams: z.number().optional(),
  carbsGrams: z.number().optional(),
  fatGrams: z.number().optional(),
  fiberGrams: z.number().optional(),
  ingredients: z.array(z.any()).optional(),
  instructions: z.array(z.any()).optional(),
  prepTimeMinutes: z.number().optional(),
  cookTimeMinutes: z.number().optional(),
  totalTimeMinutes: z.number().optional(),
  tags: z.array(z.string()).optional(),
  dietaryFlags: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  difficulty: z.string().optional(),
  rating: z.number().optional(),
  isFavorite: z.boolean().optional(),
});

const DeleteRecipeSchema = z.object({
  recipeId: z.string().describe('Recipe ID to delete (required)'),
});

// Meal Logs
const CreateMealLogSchema = z.object({
  mealType: z.string().describe('Meal type: breakfast, lunch, dinner, snack (required)'),
  mealName: z.string().optional(),
  description: z.string().optional(),
  calories: z.number().optional(),
  proteinGrams: z.number().optional(),
  carbsGrams: z.number().optional(),
  fatGrams: z.number().optional(),
  fiberGrams: z.number().optional(),
  foods: z.array(z.any()).optional(),
  dietPlanId: z.string().optional(),
  eatenAt: z.string().optional().describe('Date/time in ISO format'),
  hungerBefore: z.number().optional(),
  satisfactionAfter: z.number().optional(),
  notes: z.string().optional(),
});

const UpdateMealLogSchema = z.object({
  mealId: z.string().describe('Meal log ID (required)'),
  mealType: z.string().optional(),
  mealName: z.string().optional(),
  description: z.string().optional(),
  calories: z.number().optional(),
  proteinGrams: z.number().optional(),
  carbsGrams: z.number().optional(),
  fatGrams: z.number().optional(),
  fiberGrams: z.number().optional(),
  foods: z.array(z.any()).optional(),
  eatenAt: z.string().optional(),
  hungerBefore: z.number().optional(),
  satisfactionAfter: z.number().optional(),
  notes: z.string().optional(),
});

const DeleteMealLogSchema = z.object({
  mealId: z.string().describe('Meal log ID to delete (required)'),
});

// Diet Plans
const CreateDietPlanSchema = z.object({
  name: z.string().describe('Diet plan name (required)'),
  description: z.string().optional(),
  goalCategory: z.string().optional().describe('Goal category: weight_loss, muscle_building, etc.'),
  dailyCalories: z.number().optional(),
  proteinGrams: z.number().optional(),
  carbsGrams: z.number().optional(),
  fatGrams: z.number().optional(),
  fiberGrams: z.number().optional(),
  dietaryPreferences: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  excludedFoods: z.array(z.string()).optional(),
  mealsPerDay: z.number().optional(),
  snacksPerDay: z.number().optional(),
  mealTimes: z.record(z.string()).optional().describe('Meal times object'),
  weeklyMeals: z.record(z.any()).optional().describe('Weekly meals structure'),
  isActive: z.boolean().optional(),
});

const UpdateDietPlanSchema = z.object({
  planId: z.string().describe('Diet plan ID (required)'),
  name: z.string().optional(),
  description: z.string().optional(),
  goalCategory: z.string().optional(),
  dailyCalories: z.number().optional(),
  proteinGrams: z.number().optional(),
  carbsGrams: z.number().optional(),
  fatGrams: z.number().optional(),
  fiberGrams: z.number().optional(),
  dietaryPreferences: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  excludedFoods: z.array(z.string()).optional(),
  mealsPerDay: z.number().optional(),
  snacksPerDay: z.number().optional(),
  mealTimes: z.record(z.string()).optional(),
  weeklyMeals: z.record(z.any()).optional(),
  status: z.string().optional(),
});

const DeleteDietPlanSchema = z.object({
  planId: z.string().describe('Diet plan ID to delete (required)'),
});

// Goals
const CreateGoalSchema = z.object({
  title: z.string().describe('Goal title (required)'),
  description: z.string().optional(),
  category: z.string().optional().describe('Goal category'),
  pillar: z.string().optional().describe('Health pillar: fitness, nutrition, sleep, etc.'),
  targetValue: z.number().optional(),
  targetUnit: z.string().optional(),
  currentValue: z.number().optional(),
  durationWeeks: z.number().optional(),
  motivation: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const UpdateGoalSchema = z.object({
  goalId: z.string().describe('Goal ID (required)'),
  title: z.string().optional(),
  description: z.string().optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  motivation: z.string().optional(),
  status: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const DeleteGoalSchema = z.object({
  goalId: z.string().describe('Goal ID to delete (required)'),
});

const GetGoalByIdSchema = z.object({
  goalId: z.string().describe('Goal ID to retrieve (required)'),
});

const GetGoalByNameSchema = z.object({
  name: z.string().describe('Goal title to search for (case-insensitive)'),
  exactMatch: z.boolean().optional().describe('If true, match exact title; if false, partial match'),
});

const GetGoalByDateSchema = z.object({
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  targetDate: z.string().optional().describe('Filter by target date in ISO format (YYYY-MM-DD)'),
});

const DeleteAllGoalsSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  status: z.string().optional().describe('Filter by status: active, completed, paused, archived'),
  category: z.string().optional().describe('Filter by goal category'),
});

const UpdateAllGoalsSchema = z.object({
  updates: z.object({
    status: z.string().optional(),
    currentValue: z.number().optional(),
    progress: z.number().optional(),
  }),
  filter: z.object({
    status: z.string().optional(),
    category: z.string().optional(),
    pillar: z.string().optional(),
  }).optional(),
});

// User Integrations Schemas
const GetUserIntegrationsSchema = z.object({
  provider: z.string().optional().describe('Filter by provider: google_fit, apple_health, fitbit, garmin, whoop, oura, strava'),
  status: z.string().optional().describe('Filter by status: pending, active, error, disconnected'),
});

const GetUserIntegrationByIdSchema = z.object({
  integrationId: z.string().describe('Integration ID to retrieve (required)'),
});

const GetUserIntegrationByProviderSchema = z.object({
  provider: z.string().describe('Provider name to search for (required)'),
});

const CreateUserIntegrationSchema = z.object({
  provider: z.string().describe('Integration provider: google_fit, apple_health, fitbit, garmin, whoop, oura, strava'),
  accessToken: z.string().describe('OAuth access token (required)'),
  refreshToken: z.string().optional().describe('OAuth refresh token'),
  tokenExpiry: z.string().optional().describe('Token expiry timestamp'),
  scopes: z.array(z.string()).optional().describe('OAuth scopes array'),
  isEnabled: z.boolean().optional().describe('Whether integration is enabled'),
  deviceInfo: z.record(z.any()).optional().describe('Device information JSON'),
});

const UpdateUserIntegrationSchema = z.object({
  integrationId: z.string().describe('Integration ID (required)'),
  status: z.string().optional().describe('Sync status: pending, active, error, disconnected'),
  isEnabled: z.boolean().optional().describe('Whether integration is enabled'),
  isPrimaryForDataTypes: z.array(z.string()).optional().describe('Data types this integration is primary for'),
  deviceInfo: z.record(z.any()).optional().describe('Device information JSON'),
});

const DeleteUserIntegrationSchema = z.object({
  integrationId: z.string().describe('Integration ID to delete (required)'),
});

const DeleteUserIntegrationByProviderSchema = z.object({
  provider: z.string().describe('Provider name to delete (required)'),
});

const DeleteAllUserIntegrationsSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  status: z.string().optional().describe('Filter by status'),
});

// Health Data Records Schemas
const GetHealthDataRecordsSchema = z.object({
  dataType: z.string().optional().describe('Filter by data type: steps, heart_rate, sleep, weight, etc.'),
  provider: z.string().optional().describe('Filter by provider: google_fit, apple_health, fitbit, etc.'),
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  limit: z.number().optional().describe('Maximum number of records to return (default: 50)'),
});

const GetHealthDataRecordByIdSchema = z.object({
  recordId: z.string().describe('Health data record ID to retrieve (required)'),
});

const CreateHealthDataRecordSchema = z.object({
  integrationId: z.string().describe('Integration ID that provided this data (required)'),
  provider: z.string().describe('Provider name: google_fit, apple_health, fitbit, etc.'),
  dataType: z.string().describe('Data type: steps, heart_rate, sleep, weight, calories, etc.'),
  recordedAt: z.string().describe('When the data was recorded (ISO timestamp)'),
  value: z.record(z.any()).describe('Data value as JSON object'),
  unit: z.string().describe('Unit of measurement'),
  sourcePriority: z.number().optional().describe('Source priority (higher = more trusted)'),
  isGoldenSource: z.boolean().optional().describe('Whether this is the golden source for this data type'),
  rawDataId: z.string().optional().describe('Reference to raw data source'),
});

const UpdateHealthDataRecordSchema = z.object({
  recordId: z.string().describe('Record ID (required)'),
  value: z.record(z.any()).optional().describe('Updated data value'),
  unit: z.string().optional().describe('Updated unit'),
  sourcePriority: z.number().optional(),
  isGoldenSource: z.boolean().optional(),
});

const DeleteHealthDataRecordSchema = z.object({
  recordId: z.string().describe('Record ID to delete (required)'),
});

const DeleteAllHealthDataRecordsSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  dataType: z.string().optional().describe('Filter by data type'),
  provider: z.string().optional().describe('Filter by provider'),
  startDate: z.string().optional().describe('Delete records from this date onwards'),
  endDate: z.string().optional().describe('Delete records up to this date'),
});

// User Plans Schemas
const GetUserPlansSchema = z.object({
  status: z.string().optional().describe('Filter by status: active, completed, paused, archived, draft'),
  goalCategory: z.string().optional().describe('Filter by goal category'),
  startDate: z.string().optional().describe('Filter plans starting from this date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('Filter plans ending by this date (YYYY-MM-DD)'),
});

const GetUserPlanByIdSchema = z.object({
  planId: z.string().describe('Plan ID to retrieve (required)'),
});

const GetUserPlanByNameSchema = z.object({
  name: z.string().describe('Plan name to search for (case-insensitive)'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const CreateUserPlanSchema = z.object({
  goalId: z.string().describe('Goal ID this plan is for (required)'),
  name: z.string().describe('Plan name (required)'),
  description: z.string().optional().describe('Plan description'),
  pillar: z.string().optional().describe('Health pillar: fitness, nutrition, sleep, etc.'),
  goalCategory: z.string().optional().describe('Goal category'),
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  durationWeeks: z.number().optional().describe('Plan duration in weeks'),
  activities: z.record(z.any()).optional().describe('Activities JSON structure'),
  weeklyFocuses: z.array(z.any()).optional().describe('Weekly focuses array'),
});

const UpdateUserPlanSchema = z.object({
  planId: z.string().describe('Plan ID (required)'),
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional().describe('Status: active, completed, paused, archived, draft'),
  currentWeek: z.number().optional(),
  overallProgress: z.number().optional(),
  activities: z.record(z.any()).optional(),
  weeklyFocuses: z.array(z.any()).optional(),
});

const DeleteUserPlanSchema = z.object({
  planId: z.string().describe('Plan ID to delete (required)'),
});

const DeleteAllUserPlansSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  status: z.string().optional().describe('Filter by status'),
});

const UpdateAllUserPlansSchema = z.object({
  updates: z.object({
    status: z.string().optional(),
    currentWeek: z.number().optional(),
    overallProgress: z.number().optional(),
  }),
  filter: z.object({
    status: z.string().optional(),
    goalCategory: z.string().optional(),
  }).optional(),
});

// Notifications Schemas
const GetNotificationsSchema = z.object({
  type: z.string().optional().describe('Filter by notification type'),
  isRead: z.boolean().optional().describe('Filter by read status'),
  priority: z.string().optional().describe('Filter by priority: low, normal, high, urgent'),
  startDate: z.string().optional().describe('Filter notifications from this date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('Filter notifications up to this date (YYYY-MM-DD)'),
  limit: z.number().optional().describe('Maximum number of notifications to return (default: 50)'),
});

const GetNotificationByIdSchema = z.object({
  notificationId: z.string().describe('Notification ID to retrieve (required)'),
});

const CreateNotificationSchema = z.object({
  type: z.string().describe('Notification type: achievement, goal_progress, reminder, system, etc.'),
  title: z.string().describe('Notification title (required)'),
  message: z.string().describe('Notification message (required)'),
  icon: z.string().optional().describe('Icon name or emoji'),
  imageUrl: z.string().optional().describe('Optional image URL'),
  actionUrl: z.string().optional().describe('Deep link URL'),
  actionLabel: z.string().optional().describe('CTA button text'),
  category: z.string().optional().describe('Custom category'),
  priority: z.string().optional().describe('Priority: low, normal, high, urgent'),
  relatedEntityType: z.string().optional().describe('Related entity type: goal, plan, achievement, etc.'),
  relatedEntityId: z.string().optional().describe('Related entity ID'),
  metadata: z.record(z.any()).optional().describe('Additional metadata JSON'),
  expiresAt: z.string().optional().describe('Expiration timestamp'),
});

const UpdateNotificationSchema = z.object({
  notificationId: z.string().describe('Notification ID (required)'),
  isRead: z.boolean().optional().describe('Mark as read'),
  isArchived: z.boolean().optional().describe('Archive notification'),
});

const DeleteNotificationSchema = z.object({
  notificationId: z.string().describe('Notification ID to delete (required)'),
});

const DeleteAllNotificationsSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  isRead: z.boolean().optional().describe('Filter by read status'),
  type: z.string().optional().describe('Filter by type'),
});

const MarkAllNotificationsReadSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag'),
});

// User Body Images Schemas
const GetUserBodyImagesSchema = z.object({
  imageType: z.string().optional().describe('Filter by image type: face, front, side, back'),
  captureContext: z.string().optional().describe('Filter by capture context: onboarding, progress, weekly_checkin'),
  startDate: z.string().optional().describe('Filter images from this date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('Filter images up to this date (YYYY-MM-DD)'),
});

const GetUserBodyImageByIdSchema = z.object({
  imageId: z.string().describe('Body image ID to retrieve (required)'),
});

const CreateUserBodyImageSchema = z.object({
  imageType: z.string().describe('Image type: face, front, side, back (required)'),
  imageKey: z.string().describe('R2 storage key for the image (required)'),
  captureContext: z.string().describe('Capture context: onboarding, progress, weekly_checkin (required)'),
  isEncrypted: z.boolean().optional().describe('Whether image is encrypted'),
});

const DeleteUserBodyImageSchema = z.object({
  imageId: z.string().describe('Body image ID to delete (required)'),
});

const DeleteAllUserBodyImagesSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  imageType: z.string().optional().describe('Filter by image type'),
  captureContext: z.string().optional().describe('Filter by capture context'),
});

// Workout Logs Schemas (enhancements)
const CreateWorkoutLogSchema = z.object({
  workoutPlanId: z.string().optional().describe('Associated workout plan ID'),
  scheduledDate: z.string().describe('Scheduled date in ISO format (YYYY-MM-DD) (required)'),
  scheduledDayOfWeek: z.string().optional().describe('Day of week: sunday, monday, etc.'),
  workoutName: z.string().optional().describe('Workout name'),
  startedAt: z.string().optional().describe('Start timestamp'),
  completedAt: z.string().optional().describe('Completion timestamp'),
  durationMinutes: z.number().optional().describe('Duration in minutes'),
  status: z.string().optional().describe('Status: pending, in_progress, completed, skipped'),
  exercisesCompleted: z.array(z.any()).optional().describe('Exercises completed JSON array'),
  difficultyRating: z.number().optional().describe('Difficulty rating 1-5'),
  energyLevel: z.number().optional().describe('Energy level 1-5'),
  moodAfter: z.number().optional().describe('Mood after workout 1-5'),
  notes: z.string().optional().describe('Notes'),
});

const UpdateWorkoutLogSchema = z.object({
  logId: z.string().describe('Workout log ID (required)'),
  status: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationMinutes: z.number().optional(),
  exercisesCompleted: z.array(z.any()).optional(),
  difficultyRating: z.number().optional(),
  energyLevel: z.number().optional(),
  moodAfter: z.number().optional(),
  notes: z.string().optional(),
});

const GetWorkoutLogByIdSchema = z.object({
  logId: z.string().describe('Workout log ID to retrieve (required)'),
});

const GetWorkoutLogByDateSchema = z.object({
  date: z.string().describe('Date in ISO format (YYYY-MM-DD) (required)'),
});

const DeleteWorkoutLogSchema = z.object({
  logId: z.string().describe('Workout log ID to delete (required)'),
});

const DeleteAllWorkoutLogsSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  planId: z.string().optional().describe('Filter by workout plan ID'),
  startDate: z.string().optional().describe('Delete logs from this date'),
  endDate: z.string().optional().describe('Delete logs up to this date'),
});

const UpdateAllWorkoutLogsSchema = z.object({
  updates: z.object({
    status: z.string().optional(),
    difficultyRating: z.number().optional(),
    energyLevel: z.number().optional(),
    moodAfter: z.number().optional(),
  }),
  filter: z.object({
    planId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
});

// Progress Records Schemas (enhancements)
const CreateProgressRecordSchema = z.object({
  recordDate: z.string().describe('Record date in ISO format (YYYY-MM-DD) (required)'),
  recordType: z.string().describe('Record type: weight, measurement, photo, body_composition (required)'),
  value: z.record(z.any()).describe('Value as JSON object (required)'),
  photoKeys: z.array(z.string()).optional().describe('Array of photo storage keys'),
  source: z.string().optional().describe('Source: manual, smart_scale, integration, ai_analysis'),
  sourceDevice: z.string().optional().describe('Source device name'),
  notes: z.string().optional().describe('Notes'),
});

const UpdateProgressRecordSchema = z.object({
  recordId: z.string().describe('Record ID (required)'),
  value: z.record(z.any()).optional().describe('Updated value JSON'),
  photoKeys: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const GetProgressRecordByIdSchema = z.object({
  recordId: z.string().describe('Progress record ID to retrieve (required)'),
});

const GetProgressRecordByDateSchema = z.object({
  date: z.string().describe('Date in ISO format (YYYY-MM-DD) (required)'),
  recordType: z.string().optional().describe('Filter by record type'),
});

const DeleteProgressRecordSchema = z.object({
  recordId: z.string().describe('Progress record ID to delete (required)'),
});

const DeleteAllProgressRecordsSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  recordType: z.string().optional().describe('Filter by record type'),
  startDate: z.string().optional().describe('Delete records from this date'),
  endDate: z.string().optional().describe('Delete records up to this date'),
});

const UpdateAllProgressRecordsSchema = z.object({
  updates: z.object({
    notes: z.string().optional(),
  }),
  filter: z.object({
    recordType: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
});

// Water Intake Logs Schemas
const GetWaterIntakeLogsSchema = z.object({
  date: z.string().optional().describe('Specific date in ISO format (YYYY-MM-DD)'),
  startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
});

const GetWaterIntakeLogByDateSchema = z.object({
  date: z.string().describe('Date in ISO format (YYYY-MM-DD) (required)'),
});

const CreateWaterIntakeLogSchema = z.object({
  logDate: z.string().optional().describe('Log date in ISO format (YYYY-MM-DD), defaults to today'),
  glassesConsumed: z.number().optional().describe('Number of glasses consumed (250ml each)'),
  mlConsumed: z.number().optional().describe('Milliliters consumed'),
  targetGlasses: z.number().optional().describe('Target glasses for the day'),
  targetMl: z.number().optional().describe('Target milliliters for the day'),
  entries: z.array(z.any()).optional().describe('Individual water entry timeline'),
});

const UpdateWaterIntakeLogSchema = z.object({
  logDate: z.string().describe('Log date in ISO format (YYYY-MM-DD) (required)'),
  glassesConsumed: z.number().optional(),
  mlConsumed: z.number().optional(),
  targetGlasses: z.number().optional(),
  targetMl: z.number().optional(),
  entries: z.array(z.any()).optional(),
});

const AddWaterEntrySchema = z.object({
  date: z.string().optional().describe('Date in ISO format (YYYY-MM-DD), defaults to today'),
  amountMl: z.number().describe('Amount of water in milliliters (required)'),
  type: z.string().optional().describe('Water type: water, sparkling, etc.'),
  time: z.string().optional().describe('Time in HH:MM format'),
});

const DeleteWaterIntakeLogSchema = z.object({
  logDate: z.string().describe('Log date in ISO format (YYYY-MM-DD) to delete (required)'),
});

const DeleteAllWaterIntakeLogsSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  startDate: z.string().optional().describe('Delete logs from this date'),
  endDate: z.string().optional().describe('Delete logs up to this date'),
});

// Shopping List Items Schemas
const GetShoppingListItemsSchema = z.object({
  category: z.string().optional().describe('Filter by category: produce, protein, dairy, grains, pantry, other'),
  isPurchased: z.boolean().optional().describe('Filter by purchased status'),
});

const GetShoppingListItemByIdSchema = z.object({
  itemId: z.string().describe('Shopping list item ID to retrieve (required)'),
});

const GetShoppingListItemByNameSchema = z.object({
  name: z.string().describe('Item name to search for (case-insensitive)'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const CreateShoppingListItemSchema = z.object({
  name: z.string().describe('Item name (required)'),
  quantity: z.string().optional().describe('Quantity: "2 lbs", "500g", "1 bunch"'),
  category: z.string().optional().describe('Category: produce, protein, dairy, grains, pantry, other'),
  notes: z.string().optional().describe('Additional notes'),
  calories: z.number().nullable().optional().describe('Estimated calories per item/portion (optional but recommended for nutrition tracking)'),
  source: z.string().optional().describe('Source: manual, ai_generated, diet_plan'),
  priority: z.number().optional().describe('Priority (higher = more important)'),
});

const UpdateShoppingListItemSchema = z.object({
  itemId: z.string().describe('Item ID (required)'),
  name: z.string().optional(),
  quantity: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  calories: z.number().nullable().optional().describe('Estimated calories per item/portion'),
  isPurchased: z.boolean().optional().describe('Mark as purchased'),
  priority: z.number().optional(),
});

const DeleteShoppingListItemSchema = z.object({
  itemId: z.string().describe('Item ID to delete (required)'),
});

const DeleteShoppingListItemByNameSchema = z.object({
  name: z.string().describe('Item name to delete'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const DeleteAllShoppingListItemsSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  category: z.string().optional().describe('Filter by category'),
  isPurchased: z.boolean().optional().describe('Filter by purchased status'),
});

const UpdateAllShoppingListItemsSchema = z.object({
  updates: z.object({
    isPurchased: z.boolean().optional(),
    category: z.string().optional(),
    priority: z.number().optional(),
  }),
  filter: z.object({
    category: z.string().optional(),
    isPurchased: z.boolean().optional(),
  }).optional(),
});

// Scheduled Reminders Schemas
const GetScheduledRemindersSchema = z.object({
  reminderType: z.string().optional().describe('Filter by type: meal, workout, water, medication, custom'),
  isEnabled: z.boolean().optional().describe('Filter by enabled status'),
});

const GetScheduledReminderByIdSchema = z.object({
  reminderId: z.string().describe('Reminder ID to retrieve (required)'),
});

const CreateScheduledReminderSchema = z.object({
  reminderType: z.string().describe('Reminder type: meal, workout, water, medication, custom (required)'),
  sourceType: z.string().optional().describe('Source type: diet_plan, workout_plan, manual'),
  sourceId: z.string().optional().describe('Source ID (diet_plan_id or workout_plan_id)'),
  title: z.string().describe('Reminder title (required)'),
  message: z.string().optional().describe('Reminder message'),
  icon: z.string().optional().describe('Icon name or emoji'),
  reminderTime: z.string().describe('Reminder time in HH:MM format (required)'),
  daysOfWeek: z.array(z.number()).optional().describe('Days of week array (0=Sun, 1=Mon, ..., 6=Sat)'),
  timezone: z.string().optional().describe('Timezone string'),
  notificationChannels: z.array(z.string()).optional().describe('Notification channels: push, email, sms'),
  advanceMinutes: z.number().optional().describe('Minutes before scheduled time to send'),
  repeatIfMissed: z.boolean().optional().describe('Repeat if missed'),
  snoozeMinutes: z.number().optional().describe('Snooze duration in minutes'),
  metadata: z.record(z.any()).optional().describe('Metadata JSON'),
});

const UpdateScheduledReminderSchema = z.object({
  reminderId: z.string().describe('Reminder ID (required)'),
  title: z.string().optional(),
  message: z.string().optional(),
  reminderTime: z.string().optional().describe('Reminder time in HH:MM format'),
  daysOfWeek: z.array(z.number()).optional(),
  isEnabled: z.boolean().optional().describe('Enable or disable reminder'),
  notificationChannels: z.array(z.string()).optional(),
  advanceMinutes: z.number().optional(),
  snoozeMinutes: z.number().optional(),
});

const DeleteScheduledReminderSchema = z.object({
  reminderId: z.string().describe('Reminder ID to delete (required)'),
});

const DeleteAllScheduledRemindersSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  reminderType: z.string().optional().describe('Filter by reminder type'),
  isEnabled: z.boolean().optional().describe('Filter by enabled status'),
});

// Get Recipes
const GetUserRecipesSchema = z.object({
  category: z.string().optional().describe('Filter by category: breakfast, lunch, dinner, snack, dessert, other'),
  favorite: z.boolean().optional().describe('Filter by favorite status'),
  name: z.string().optional().describe('Filter by recipe name (partial match)'),
});

// Operations by Name Schemas
const GetMealByNameSchema = z.object({
  name: z.string().describe('Meal name to search for (case-insensitive)'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const GetDietPlanByNameSchema = z.object({
  name: z.string().describe('Diet plan name to search for (case-insensitive)'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const GetRecipeByNameSchema = z.object({
  name: z.string().describe('Recipe name to search for (case-insensitive)'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const UpdateMealByNameSchema = UpdateMealLogSchema.omit({ mealId: true }).extend({
  name: z.string().describe('Meal name to find and update'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const UpdateDietPlanByNameSchema = UpdateDietPlanSchema.omit({ planId: true }).extend({
  name: z.string().describe('Diet plan name to find and update'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const UpdateRecipeByNameSchema = UpdateRecipeSchema.omit({ recipeId: true }).extend({
  name: z.string().describe('Recipe name to find and update'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const DeleteMealByNameSchema = z.object({
  name: z.string().describe('Meal name to delete'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const DeleteDietPlanByNameSchema = z.object({
  name: z.string().describe('Diet plan name to delete'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

const DeleteRecipeByNameSchema = z.object({
  name: z.string().describe('Recipe name to delete'),
  exactMatch: z.boolean().optional().describe('If true, match exact name; if false, partial match'),
});

// Bulk Operation Schemas
const DeleteAllMealsSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  dateRange: z.object({
    startDate: z.string().optional().describe('Start date in ISO format (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD)'),
  }).optional(),
  mealType: z.string().optional().describe('Filter by meal type (breakfast, lunch, dinner, snack)'),
});

const UpdateAllMealsSchema = z.object({
  updates: z.object({
    mealType: z.string().optional(),
    mealName: z.string().optional(),
    description: z.string().optional(),
    calories: z.number().optional(),
    proteinGrams: z.number().optional(),
    carbsGrams: z.number().optional(),
    fatGrams: z.number().optional(),
    fiberGrams: z.number().optional(),
    notes: z.string().optional(),
  }),
  filter: z.object({
    dateRange: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional(),
    mealType: z.string().optional(),
  }).optional(),
});

const DeleteAllDietPlansSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  status: z.string().optional().describe('Filter by status (active, draft, completed, archived)'),
});

const UpdateAllDietPlansSchema = z.object({
  updates: z.object({
    status: z.string().optional(),
    description: z.string().optional(),
    dailyCalories: z.number().optional(),
    mealsPerDay: z.number().optional(),
    snacksPerDay: z.number().optional(),
  }),
  filter: z.object({
    status: z.string().optional(),
    goalCategory: z.string().optional(),
  }).optional(),
});

const DeleteAllRecipesSchema = z.object({
  confirm: z.boolean().optional().describe('Confirmation flag (should be true for safety)'),
  category: z.string().optional().describe('Filter by category'),
  favorite: z.boolean().optional().describe('Filter by favorite status'),
});

const UpdateAllRecipesSchema = z.object({
  updates: z.object({
    category: z.string().optional(),
    difficulty: z.string().optional(),
    isFavorite: z.boolean().optional(),
    rating: z.number().optional(),
  }),
  filter: z.object({
    category: z.string().optional(),
    favorite: z.boolean().optional(),
  }).optional(),
});

// ============================================
// TOOL IMPLEMENTATIONS
// ============================================

/**
 * Get user's workout plans
 */
async function getUserWorkoutPlans(userId: string, params?: { status?: string }): Promise<string> {
  try {
    const plans = await workoutPlanService.getUserPlans(userId, params?.status);
    
    if (plans.length === 0) {
      return JSON.stringify({ message: 'No workout plans found', plans: [] });
    }

    const formatted = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      goalCategory: plan.goalCategory,
      status: plan.status,
      difficulty: plan.initialDifficultyLevel,
      workoutsPerWeek: plan.workoutsPerWeek,
      durationWeeks: plan.durationWeeks,
      progress: `${Math.round((plan.overallCompletionRate || 0) * 100)}%`,
      workoutsCompleted: plan.totalWorkoutsCompleted || 0,
      createdAt: plan.createdAt,
    }));

    return JSON.stringify({ plans: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting workout plans', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve workout plans' });
  }
}

/**
 * Get user's workout logs
 */
async function getUserWorkoutLogs(userId: string, params?: {
  planId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<string> {
  try {
    const result = await workoutPlanService.getWorkoutLogs(userId, {
      planId: params?.planId,
      startDate: params?.startDate,
      endDate: params?.endDate,
      limit: params?.limit || 20,
    });

    if (result.logs.length === 0) {
      return JSON.stringify({ message: 'No workout logs found', logs: [] });
    }

    const formatted = result.logs.map(log => ({
      id: log.id,
      workoutName: log.workoutName,
      scheduledDate: log.scheduledDate,
      durationMinutes: log.durationMinutes,
      exercisesCompleted: log.exercisesCompleted.length,
      difficultyRating: log.difficultyRating,
      energyLevel: log.energyLevel,
      status: log.status,
    }));

    return JSON.stringify({ logs: formatted, total: result.total }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting workout logs', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve workout logs' });
  }
}

/**
 * Get user's diet plans
 */
async function getUserDietPlans(userId: string, params?: { status?: string }): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM diet_plans WHERE user_id = $1`;
    const queryParams: (string | number)[] = [userId];
    
    if (params?.status) {
      sqlQuery += ` AND status = $2`;
      queryParams.push(params.status);
    }

    sqlQuery += ` ORDER BY created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No diet plans found', plans: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      goalCategory: row.goal_category,
      status: row.status,
      dailyCalories: row.daily_calories,
      macros: {
        protein: row.protein_grams,
        carbs: row.carbs_grams,
        fat: row.fat_grams,
        fiber: row.fiber_grams,
      },
      mealsPerDay: row.meals_per_day,
      snacksPerDay: row.snacks_per_day,
      adherenceRate: `${Math.round((row.adherence_rate || 0) * 100)}%`,
      createdAt: row.created_at,
    }));

    return JSON.stringify({ plans: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting diet plans', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve diet plans' });
  }
}

/**
 * Get user's meal logs
 */
async function getUserMealLogs(userId: string, params?: {
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM meal_logs WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];

    if (params?.date) {
      sqlQuery += ` AND DATE(eaten_at) = $2`;
      queryParams.push(params.date);
    } else if (params?.startDate && params?.endDate) {
      sqlQuery += ` AND DATE(eaten_at) >= $2 AND DATE(eaten_at) <= $3`;
      queryParams.push(params.startDate, params.endDate);
    } else if (!params?.date && !params?.startDate) {
      // Default to today
      sqlQuery += ` AND DATE(eaten_at) = CURRENT_DATE`;
    }

    sqlQuery += ` ORDER BY eaten_at ASC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No meal logs found', meals: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      mealType: row.meal_type,
      mealName: row.meal_name,
      eatenAt: row.eaten_at,
      calories: row.calories,
      macros: {
        protein: row.protein_grams,
        carbs: row.carbs_grams,
        fat: row.fat_grams,
        fiber: row.fiber_grams,
      },
      foods: row.foods || [],
    }));

    // Calculate totals
    const totals = formatted.reduce((acc, meal) => ({
      calories: acc.calories + (meal.calories || 0),
      protein: acc.protein + (meal.macros?.protein || 0),
      carbs: acc.carbs + (meal.macros?.carbs || 0),
      fat: acc.fat + (meal.macros?.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return JSON.stringify({ meals: formatted, totals, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting meal logs', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve meal logs' });
  }
}

/**
 * Get user's active plans (workout, diet, general)
 */
async function getUserActivePlans(userId: string): Promise<string> {
  try {
    const [workoutResult, dietResult, generalResult] = await Promise.all([
      query<{ id: string; name: string; status: string; created_at: Date }>(
        `SELECT id, name, status, created_at FROM workout_plans 
         WHERE user_id = $1 AND status = 'active' 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      ),
      query<{ id: string; name: string; status: string; created_at: Date }>(
        `SELECT id, name, status, created_at FROM diet_plans 
         WHERE user_id = $1 AND status = 'active' 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      ),
      query<{ id: string; name: string; status: string; created_at: Date }>(
        `SELECT id, name, status, created_at FROM user_plans 
         WHERE user_id = $1 AND status = 'active' 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      ),
    ]);

    const activePlans = {
      workoutPlan: workoutResult.rows.length > 0 ? {
        id: workoutResult.rows[0].id,
        name: workoutResult.rows[0].name,
        status: workoutResult.rows[0].status,
        createdAt: workoutResult.rows[0].created_at,
      } : null,
      dietPlan: dietResult.rows.length > 0 ? {
        id: dietResult.rows[0].id,
        name: dietResult.rows[0].name,
        status: dietResult.rows[0].status,
        createdAt: dietResult.rows[0].created_at,
      } : null,
      generalPlan: generalResult.rows.length > 0 ? {
        id: generalResult.rows[0].id,
        name: generalResult.rows[0].name,
        status: generalResult.rows[0].status,
        createdAt: generalResult.rows[0].created_at,
      } : null,
    };

    return JSON.stringify(activePlans, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting active plans', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve active plans' });
  }
}

/**
 * Get user's activity logs with mood data
 */
async function getUserActivityLogsWithMood(userId: string, params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<string> {
  try {
    let sqlQuery = `SELECT activity_name, scheduled_date, status, mood, notes 
                    FROM activity_logs 
                    WHERE user_id = $1`;
    const queryParams: (string | number)[] = [userId];

    if (params?.startDate) {
      sqlQuery += ` AND scheduled_date >= $2`;
      queryParams.push(params.startDate);
    } else {
      // Default to last 7 days
      sqlQuery += ` AND scheduled_date >= NOW() - INTERVAL '7 days'`;
    }

    if (params?.endDate) {
      const paramIndex = queryParams.length + 1;
      sqlQuery += ` AND scheduled_date <= $${paramIndex}`;
      queryParams.push(params.endDate);
    }

    sqlQuery += ` ORDER BY scheduled_date DESC`;
    
    if (params?.limit) {
      sqlQuery += ` LIMIT $${queryParams.length + 1}`;
      queryParams.push(params.limit);
    } else {
      sqlQuery += ` LIMIT 20`;
    }

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No activity logs found', logs: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      activityName: row.activity_name,
      scheduledDate: row.scheduled_date,
      status: row.status,
      mood: row.mood !== null ? `${row.mood}/5` : null,
      notes: row.notes,
    }));

    // Calculate mood statistics
    const moods = result.rows
      .filter((row: any) => row.mood !== null)
      .map((row: any) => row.mood);
    
    const moodStats = moods.length > 0 ? {
      average: (moods.reduce((a: number, b: number) => a + b, 0) / moods.length).toFixed(2),
      count: moods.length,
      min: Math.min(...moods),
      max: Math.max(...moods),
    } : null;

    return JSON.stringify({ 
      logs: formatted, 
      count: formatted.length,
      moodStats,
    }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting activity logs with mood', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve activity logs' });
  }
}

/**
 * Get user's mood trends over time
 */
async function getUserMoodTrends(userId: string, params?: { days?: number }): Promise<string> {
  try {
    const days = params?.days || 14;
    
    const result = await query<{
      scheduled_date: Date;
      mood: number;
    }>(
      `SELECT scheduled_date, mood 
       FROM activity_logs 
       WHERE user_id = $1 
       AND mood IS NOT NULL
       AND scheduled_date >= NOW() - INTERVAL '${days} days'
       ORDER BY scheduled_date ASC`,
      [userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ 
        message: 'No mood data found', 
        trend: null,
        average: null,
      });
    }

    const moods = result.rows.map(row => row.mood);
    const dates = result.rows.map(row => row.scheduled_date);

    // Calculate trend
    const firstHalf = moods.slice(0, Math.floor(moods.length / 2));
    const secondHalf = moods.slice(Math.floor(moods.length / 2));
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    let trend: 'improving' | 'stable' | 'declining';
    if (secondHalfAvg > firstHalfAvg + 0.3) {
      trend = 'improving';
    } else if (secondHalfAvg < firstHalfAvg - 0.3) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    const average = (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(2);

    return JSON.stringify({
      trend,
      average: parseFloat(average),
      dataPoints: result.rows.length,
      dateRange: {
        start: dates[0],
        end: dates[dates.length - 1],
      },
      recentMood: moods[moods.length - 1],
    }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting mood trends', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve mood trends' });
  }
}

/**
 * Get user's tasks
 */
async function getUserTasks(userId: string, params?: {
  status?: string;
  category?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<string> {
  try {
    const result = await taskService.getTasks(userId, {
      status: params?.status as any,
      category: params?.category as any,
      fromDate: params?.fromDate,
      toDate: params?.toDate,
      limit: 50,
    });

    if (result.tasks.length === 0) {
      return JSON.stringify({ message: 'No tasks found', tasks: [] });
    }

    const formatted = result.tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      status: task.status,
      scheduledAt: task.scheduledAt,
      completedAt: task.completedAt,
    }));

    return JSON.stringify({ tasks: formatted, total: result.total }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting tasks', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve tasks' });
  }
}

/**
 * Get user's progress records
 */
async function getUserProgress(userId: string, params?: {
  type?: string;
  startDate?: string;
  endDate?: string;
}): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM progress_records WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];

    if (params?.type) {
      sqlQuery += ` AND record_type = $2`;
      queryParams.push(params.type);
    }

    if (params?.startDate) {
      const paramIndex = queryParams.length + 1;
      sqlQuery += ` AND record_date >= $${paramIndex}`;
      queryParams.push(params.startDate);
    }

    if (params?.endDate) {
      const paramIndex = queryParams.length + 1;
      sqlQuery += ` AND record_date <= $${paramIndex}`;
      queryParams.push(params.endDate);
    }

    sqlQuery += ` ORDER BY record_date DESC LIMIT 50`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No progress records found', records: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      recordType: row.record_type,
      recordDate: row.record_date,
      value: row.value,
    }));

    return JSON.stringify({ records: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting progress', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve progress records' });
  }
}

/**
 * Get user's active goals
 */
async function getUserGoals(userId: string, params?: { status?: string; startDate?: string; endDate?: string }): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM user_goals WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params?.status) {
      sqlQuery += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    } else {
      sqlQuery += ` AND status = 'active'`;
    }

    if (params?.startDate) {
      sqlQuery += ` AND start_date >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params?.endDate) {
      sqlQuery += ` AND (target_date <= $${paramIndex} OR start_date <= $${paramIndex})`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY is_primary DESC, created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No goals found', goals: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      category: row.category,
      pillar: row.pillar,
      title: row.title,
      description: row.description,
      isPrimary: row.is_primary,
      targetValue: row.target_value,
      currentValue: row.current_value,
      targetUnit: row.target_unit,
      startDate: row.start_date,
      targetDate: row.target_date,
      status: row.status,
      progress: row.progress,
      motivation: row.motivation,
    }));

    return JSON.stringify({ goals: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting goals', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve goals' });
  }
}

/**
 * Get goal by ID
 */
async function getGoalById(userId: string, params: z.infer<typeof GetGoalByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM user_goals WHERE id = $1 AND user_id = $2`,
      [params.goalId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Goal not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      category: row.category,
      pillar: row.pillar,
      title: row.title,
      description: row.description,
      isPrimary: row.is_primary,
      targetValue: row.target_value,
      currentValue: row.current_value,
      targetUnit: row.target_unit,
      startDate: row.start_date,
      targetDate: row.target_date,
      status: row.status,
      progress: row.progress,
      motivation: row.motivation,
      milestones: row.milestones,
      durationWeeks: row.duration_weeks,
    };

    return JSON.stringify({ success: true, goal: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting goal by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve goal' });
  }
}

/**
 * Get goal by name (title)
 */
async function getGoalByName(userId: string, params: z.infer<typeof GetGoalByNameSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM user_goals WHERE user_id = $1`;
    const queryParams: string[] = [userId];

    if (params.exactMatch) {
      sqlQuery += ` AND LOWER(title) = LOWER($2)`;
      queryParams.push(params.name);
    } else {
      sqlQuery += ` AND LOWER(title) LIKE LOWER($2)`;
      queryParams.push(`%${params.name}%`);
    }

    sqlQuery += ` ORDER BY is_primary DESC, created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No goals found', goals: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      category: row.category,
      pillar: row.pillar,
      title: row.title,
      description: row.description,
      isPrimary: row.is_primary,
      targetValue: row.target_value,
      currentValue: row.current_value,
      status: row.status,
    }));

    return JSON.stringify({ goals: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting goal by name', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve goals' });
  }
}

/**
 * Get goals by date
 */
async function getGoalByDate(userId: string, params: z.infer<typeof GetGoalByDateSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM user_goals WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params.startDate) {
      sqlQuery += ` AND start_date >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params.endDate) {
      sqlQuery += ` AND target_date <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    if (params.targetDate) {
      sqlQuery += ` AND target_date = $${paramIndex}`;
      queryParams.push(params.targetDate);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY target_date ASC, created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No goals found for the specified date range', goals: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      startDate: row.start_date,
      targetDate: row.target_date,
      status: row.status,
      progress: row.progress,
    }));

    return JSON.stringify({ goals: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting goals by date', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve goals' });
  }
}

/**
 * Delete all goals
 */
async function deleteAllGoals(userId: string, params: z.infer<typeof DeleteAllGoalsSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all goals.' 
      });
    }

    let sqlQuery = `DELETE FROM user_goals WHERE user_id = $1`;
    const queryParams: (string | number)[] = [userId];
    let paramIndex = 2;

    if (params.status) {
      sqlQuery += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    if (params.category) {
      sqlQuery += ` AND category = $${paramIndex}`;
      queryParams.push(params.category);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} goal(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all goals', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete goals',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update all goals
 */
async function updateAllGoals(userId: string, params: z.infer<typeof UpdateAllGoalsSchema>): Promise<string> {
  try {
    let sqlQuery = `UPDATE user_goals SET `;
    const setClauses: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    // Build update clauses
    if (params.updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(params.updates.status);
      paramIndex++;
    }

    if (params.updates.currentValue !== undefined) {
      setClauses.push(`current_value = $${paramIndex}`);
      values.push(params.updates.currentValue);
      paramIndex++;
    }

    if (params.updates.progress !== undefined) {
      setClauses.push(`progress = $${paramIndex}`);
      values.push(params.updates.progress);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    sqlQuery += setClauses.join(', ');

    // Build WHERE clause
    sqlQuery += ` WHERE user_id = $${paramIndex}`;
    values.push(userId);
    paramIndex++;

    if (params.filter) {
      if (params.filter.status) {
        sqlQuery += ` AND status = $${paramIndex}`;
        values.push(params.filter.status);
        paramIndex++;
      }
      if (params.filter.category) {
        sqlQuery += ` AND category = $${paramIndex}`;
        values.push(params.filter.category);
        paramIndex++;
      }
      if (params.filter.pillar) {
        sqlQuery += ` AND pillar = $${paramIndex}`;
        values.push(params.filter.pillar);
        paramIndex++;
      }
    }

    const result = await query(sqlQuery, values);

    return JSON.stringify({
      success: true,
      message: `Updated ${result.rowCount || 0} goal(s)`,
      updatedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating all goals', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update goals',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get user's preferences
 */
async function getUserPreferences(userId: string): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM user_preferences WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No preferences found', preferences: null });
    }

    const prefs = result.rows[0];
    const formatted = {
      id: prefs.id,
      coachingStyle: prefs.coaching_style,
      coachingIntensity: prefs.coaching_intensity,
      preferredChannel: prefs.preferred_channel,
      checkInFrequency: prefs.check_in_frequency,
      preferredCheckInTime: prefs.preferred_check_in_time,
      aiUseEmojis: prefs.ai_use_emojis,
      aiFormalityLevel: prefs.ai_formality_level,
      aiEncouragementLevel: prefs.ai_encouragement_level,
      focusAreas: prefs.focus_areas || [],
      weightUnit: prefs.weight_unit,
      heightUnit: prefs.height_unit,
      distanceUnit: prefs.distance_unit,
      language: prefs.language,
      timezone: prefs.timezone,
      quietHoursEnabled: prefs.quiet_hours_enabled,
      quietHoursStart: prefs.quiet_hours_start,
      quietHoursEnd: prefs.quiet_hours_end,
      notificationChannels: prefs.notification_channels,
      maxNotificationsDay: prefs.max_notifications_day,
      maxNotificationsWeek: prefs.max_notifications_week,
    };

    return JSON.stringify({ preferences: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting preferences', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve preferences' });
  }
}

/**
 * Create user preferences (creates if doesn't exist, updates if exists)
 */
async function createUserPreferences(userId: string, params: z.infer<typeof CreateUserPreferencesSchema>): Promise<string> {
  try {
    // Check if preferences already exist
    const existing = await query(
      `SELECT id FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length > 0) {
      return JSON.stringify({ 
        success: false, 
        error: 'Preferences already exist. Use updateUserPreferences to modify them.',
        preferencesId: existing.rows[0].id 
      });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO user_preferences (
        user_id, coaching_style, coaching_intensity, preferred_channel,
        check_in_frequency, preferred_check_in_time,
        ai_use_emojis, ai_formality_level, ai_encouragement_level, focus_areas,
        weight_unit, height_unit, distance_unit, language, timezone,
        quiet_hours_enabled, quiet_hours_start, quiet_hours_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id`,
      [
        userId,
        params.coachingStyle || 'supportive',
        params.coachingIntensity || 'moderate',
        params.preferredChannel || 'push',
        params.checkInFrequency || 'daily',
        params.preferredCheckInTime || '09:00',
        params.aiUseEmojis ?? true,
        params.aiFormalityLevel || 'balanced',
        params.aiEncouragementLevel || 'medium',
        params.focusAreas || [],
        params.weightUnit || 'kg',
        params.heightUnit || 'cm',
        params.distanceUnit || 'km',
        params.language || 'en',
        params.timezone || 'UTC',
        params.quietHoursEnabled ?? true,
        params.quietHoursStart || '22:00',
        params.quietHoursEnd || '07:00',
      ]
    );

    return JSON.stringify({
      success: true,
      message: 'Preferences created successfully',
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating preferences', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create preferences',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update user preferences
 */
async function updateUserPreferences(userId: string, params: z.infer<typeof UpdateUserPreferencesSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Preferences not found. Use createUserPreferences first.' });
    }

    const fieldMapping: Record<string, string> = {
      coachingStyle: 'coaching_style',
      coachingIntensity: 'coaching_intensity',
      preferredChannel: 'preferred_channel',
      checkInFrequency: 'check_in_frequency',
      preferredCheckInTime: 'preferred_check_in_time',
      aiUseEmojis: 'ai_use_emojis',
      aiFormalityLevel: 'ai_formality_level',
      aiEncouragementLevel: 'ai_encouragement_level',
      focusAreas: 'focus_areas',
      weightUnit: 'weight_unit',
      heightUnit: 'height_unit',
      distanceUnit: 'distance_unit',
      language: 'language',
      timezone: 'timezone',
      quietHoursEnabled: 'quiet_hours_enabled',
      quietHoursStart: 'quiet_hours_start',
      quietHoursEnd: 'quiet_hours_end',
      maxNotificationsDay: 'max_notifications_day',
      maxNotificationsWeek: 'max_notifications_week',
    };

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        if (key === 'notificationChannels' || key === 'notificationTypes') {
          setClauses.push(`${key === 'notificationChannels' ? 'notification_channels' : 'notification_types'} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else if (key === 'focusAreas' && Array.isArray(value)) {
          setClauses.push(`${dbField} = $${paramIndex}`);
          values.push(value);
        } else {
          setClauses.push(`${dbField} = $${paramIndex}`);
          values.push(value as string | number | boolean | null);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE user_preferences SET ${setClauses.join(', ')}
       WHERE user_id = $${paramIndex}`,
      [...values, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating preferences', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update preferences',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete user preferences
 */
async function deleteUserPreferences(userId: string): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT id FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Preferences not found' });
    }

    await query(
      `DELETE FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Preferences deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting preferences', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete preferences',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// CRUD IMPLEMENTATIONS
// ============================================

/**
 * Create workout plan
 */
async function createWorkoutPlan(userId: string, params: z.infer<typeof CreateWorkoutPlanSchema>): Promise<string> {
  const warnings: string[] = [];
  try {
    if (!params.name?.trim()) {
      return JSON.stringify({ success: false, error: 'Workout plan name is required' });
    }

    // Valid goal categories from enum
    const validCategories = ['weight_loss', 'muscle_building', 'sleep_improvement', 'stress_wellness', 'energy_productivity', 'event_training', 'health_condition', 'habit_building', 'overall_optimization', 'custom'];
    
    let goalCategory = params.goalCategory || 'overall_optimization';
    // Validate and correct invalid goal category
    if (!validCategories.includes(goalCategory)) {
      warnings.push(`Invalid goal category '${goalCategory}', using 'overall_optimization'`);
      goalCategory = 'overall_optimization';
    }
    
    const fitnessLevel = params.fitnessLevel || 'beginner';
    const durationWeeks = params.durationWeeks || 4;
    const workoutsPerWeek = params.workoutsPerWeek || 3;
    const availableEquipment = params.availableEquipment || ['bodyweight'];
    const workoutLocation = params.workoutLocation || 'home';
    let weeklySchedule = params.weeklySchedule || {};

    // Check if exercises are missing from the schedule
    // A schedule has exercises if it has at least one day with exercises array containing items
    const hasExercises = weeklySchedule && 
      Object.keys(weeklySchedule).length > 0 && 
      Object.values(weeklySchedule).some((day: any) => {
        if (!day || typeof day !== 'object') return false;
        // Check for exercises array with at least one exercise
        if (Array.isArray(day.exercises) && day.exercises.length > 0) {
          // Verify exercises have required fields (exerciseId or name)
          return day.exercises.some((ex: any) => 
            (ex && typeof ex === 'object' && (ex.exerciseId || ex.name || ex.exercise_id))
          );
        }
        return false;
      });

    // If no exercises provided, automatically generate them using workout-plan service
    if (!hasExercises) {
      logger.info('[LangGraphTools] No exercises in weeklySchedule, generating automatically', {
        userId,
        workoutsPerWeek,
        goalCategory,
        fitnessLevel,
      });

      try {
        // Use workout-plan service to generate a plan with exercises
        const generatedPlan = await workoutPlanService.generatePlan({
          userId,
          goalCategory,
          fitnessLevel: fitnessLevel as 'beginner' | 'intermediate' | 'advanced',
          durationWeeks,
          workoutsPerWeek,
          availableEquipment,
          workoutLocation: workoutLocation as 'gym' | 'home' | 'outdoor',
          timePerWorkout: 45, // Default 45 minutes
        });

        // Use the generated schedule which includes exercises
        weeklySchedule = generatedPlan.weeklySchedule || {};

        const scheduleDays = Object.keys(weeklySchedule).length;
        const totalExercises = Object.values(weeklySchedule).reduce((acc: number, day: any) => {
          if (day?.exercises && Array.isArray(day.exercises)) return acc + day.exercises.length;
          return acc;
        }, 0);

        logger.info('[LangGraphTools] Generated exercises for workout plan', {
          userId,
          scheduleDays,
          totalExercises,
        });
      } catch (error) {
        logger.warn('[LangGraphTools] Failed to auto-generate exercises, using provided schedule', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with the provided schedule (might be empty, but that's better than failing)
      }
    } else {
    }


    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationWeeks * 7);

    // If setting as active, deactivate other plans
    if (params.isActive) {
      await query(
        `UPDATE workout_plans SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
    }

    // Serialize weeklySchedule - ensure exercises are properly included
    const scheduleJson = JSON.stringify(weeklySchedule);
    

    const result = await query<{ id: string; weekly_schedule: any }>(
      `INSERT INTO workout_plans (
        user_id, name, description, goal_category,
        initial_difficulty_level, duration_weeks, workouts_per_week,
        weekly_schedule, available_equipment, workout_location,
        start_date, end_date, status, ai_generated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::text[], $10, $11, $12, $13, $14)
      RETURNING id, weekly_schedule`,
      [
        userId,
        params.name.trim(),
        params.description || null,
        goalCategory,
        fitnessLevel,
        durationWeeks,
        workoutsPerWeek,
        scheduleJson, // Pass as JSON string, cast to jsonb in SQL
        availableEquipment,
        workoutLocation,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        params.isActive ? 'active' : 'draft',
        true,
      ]
    );

    const planId = result.rows[0].id;

    // Enqueue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'workout_plan',
      sourceId: planId,
      operation: 'create',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Workout plan created successfully',
      data: { id: planId, name: params.name },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating workout plan', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create workout plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update workout plan
 */
async function updateWorkoutPlan(userId: string, params: z.infer<typeof UpdateWorkoutPlanSchema>): Promise<string> {
  const warnings: string[] = [];
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM workout_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Workout plan not found or access denied' });
    }

    const fieldMapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      goalCategory: 'goal_category',
      fitnessLevel: 'initial_difficulty_level',
      durationWeeks: 'duration_weeks',
      workoutsPerWeek: 'workouts_per_week',
      weeklySchedule: 'weekly_schedule',
      availableEquipment: 'available_equipment',
      workoutLocation: 'workout_location',
      status: 'status',
    };

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      if (key === 'planId') continue;
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        if (dbField === 'weekly_schedule') {
          values.push(JSON.stringify(value));
        } else if (dbField === 'available_equipment') {
          values.push(value as string[]);
        } else {
          values.push(value as string | number | boolean | null);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    // If setting as active, deactivate other plans
    if (params.status === 'active') {
      await query(
        `UPDATE workout_plans SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND id != $2 AND status = 'active'`,
        [userId, params.planId]
      );
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE workout_plans SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.planId, userId]
    );

    // Enqueue embedding update
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'workout_plan',
      sourceId: params.planId,
      operation: 'update',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Workout plan updated successfully',
      data: { id: params.planId },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating workout plan', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update workout plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete workout plan
 */
async function deleteWorkoutPlan(userId: string, params: z.infer<typeof DeleteWorkoutPlanSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM workout_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Workout plan not found or access denied' });
    }

    // Enqueue embedding deletion BEFORE actual deletion
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'workout_plan',
      sourceId: params.planId,
      operation: 'delete',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding deletion', { error: err });
    });

    await query(
      `DELETE FROM workout_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Workout plan deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting workout plan', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete workout plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create workout alarm
 */
async function createWorkoutAlarm(userId: string, params: z.infer<typeof CreateWorkoutAlarmSchema>): Promise<string> {
  const warnings: string[] = [];
  try {
    if (!params.alarmTime) {
      return JSON.stringify({ success: false, error: 'Alarm time is required' });
    }

    // Validate workout plan if provided
    if (params.workoutPlanId) {
      const planCheck = await query(
        `SELECT id FROM workout_plans WHERE id = $1 AND user_id = $2`,
        [params.workoutPlanId, userId]
      );
      if (planCheck.rows.length === 0) {
        warnings.push(`Workout plan ${params.workoutPlanId} not found, creating alarm without plan reference`);
      }
    }

    const alarm = await workoutAlarmService.createAlarm(userId, {
      workoutPlanId: params.workoutPlanId,
      title: params.title,
      message: params.message,
      alarmTime: params.alarmTime,
      daysOfWeek: params.daysOfWeek,
      notificationType: params.notificationType as any,
      soundEnabled: params.soundEnabled,
      vibrationEnabled: params.vibrationEnabled,
      snoozeMinutes: params.snoozeMinutes,
    });

    return JSON.stringify({
      success: true,
      message: 'Workout alarm created successfully',
      data: { id: alarm.id, title: alarm.title, alarmTime: alarm.alarmTime },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating workout alarm', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create workout alarm',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update workout alarm
 */
async function updateWorkoutAlarm(userId: string, params: z.infer<typeof UpdateWorkoutAlarmSchema>): Promise<string> {
  try {
    const alarm = await workoutAlarmService.updateAlarm(userId, params.alarmId, {
      title: params.title,
      message: params.message,
      alarmTime: params.alarmTime,
      daysOfWeek: params.daysOfWeek,
      isEnabled: params.isEnabled,
      notificationType: params.notificationType as any,
      soundEnabled: params.soundEnabled,
      vibrationEnabled: params.vibrationEnabled,
      snoozeMinutes: params.snoozeMinutes,
    });

    if (!alarm) {
      return JSON.stringify({ success: false, error: 'Workout alarm not found or access denied' });
    }

    return JSON.stringify({
      success: true,
      message: 'Workout alarm updated successfully',
      data: { id: alarm.id, title: alarm.title },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating workout alarm', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update workout alarm',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete workout alarm
 */
async function deleteWorkoutAlarm(userId: string, params: z.infer<typeof DeleteWorkoutAlarmSchema>): Promise<string> {
  try {
    const deleted = await workoutAlarmService.deleteAlarm(userId, params.alarmId);

    if (!deleted) {
      return JSON.stringify({ success: false, error: 'Workout alarm not found or access denied' });
    }

    return JSON.stringify({
      success: true,
      message: 'Workout alarm deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting workout alarm', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete workout alarm',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create recipe
 */
async function createRecipe(userId: string, params: z.infer<typeof CreateRecipeSchema>): Promise<string> {
  const warnings: string[] = [];
  try {
    if (!params.name?.trim()) {
      return JSON.stringify({ success: false, error: 'Recipe name is required' });
    }

    const category = params.category || 'other';
    const servings = params.servings || 1;
    const difficulty = params.difficulty || 'medium';
    const ingredients = params.ingredients || [];
    const instructions = params.instructions || [];
    const tags = params.tags || [];
    const dietaryFlags = params.dietaryFlags || [];

    // Validate category
    const validCategories = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'other'];
    if (!validCategories.includes(category)) {
      warnings.push(`Invalid category '${category}', using 'other'`);
    }

    const result = await query<{ id: string }>(
      `INSERT INTO user_recipes (
        user_id, name, description, category, cuisine,
        servings, calories_per_serving, protein_grams, carbs_grams, fat_grams, fiber_grams,
        ingredients, instructions, prep_time_minutes, cook_time_minutes, total_time_minutes,
        tags, dietary_flags, difficulty, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING id`,
      [
        userId,
        params.name.trim(),
        params.description || null,
        category,
        params.cuisine || null,
        servings,
        params.caloriesPerServing || null,
        params.proteinGrams || null,
        params.carbsGrams || null,
        params.fatGrams || null,
        params.fiberGrams || null,
        JSON.stringify(ingredients),
        JSON.stringify(instructions),
        params.prepTimeMinutes || null,
        params.cookTimeMinutes || null,
        params.totalTimeMinutes || null,
        JSON.stringify(tags),
        JSON.stringify(dietaryFlags),
        difficulty,
        'ai_generated',
      ]
    );

    const recipeId = result.rows[0].id;

    return JSON.stringify({
      success: true,
      message: 'Recipe created successfully',
      data: { id: recipeId, name: params.name },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating recipe', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create recipe',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update recipe
 */
async function updateRecipe(userId: string, params: z.infer<typeof UpdateRecipeSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_recipes WHERE id = $1 AND user_id = $2`,
      [params.recipeId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Recipe not found or access denied' });
    }

    const fieldMapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      category: 'category',
      cuisine: 'cuisine',
      servings: 'servings',
      caloriesPerServing: 'calories_per_serving',
      proteinGrams: 'protein_grams',
      carbsGrams: 'carbs_grams',
      fatGrams: 'fat_grams',
      fiberGrams: 'fiber_grams',
      ingredients: 'ingredients',
      instructions: 'instructions',
      prepTimeMinutes: 'prep_time_minutes',
      cookTimeMinutes: 'cook_time_minutes',
      totalTimeMinutes: 'total_time_minutes',
      tags: 'tags',
      dietaryFlags: 'dietary_flags',
      imageUrl: 'image_url',
      difficulty: 'difficulty',
      rating: 'rating',
      isFavorite: 'is_favorite',
    };

    const jsonFields = ['ingredients', 'instructions', 'tags', 'dietary_flags'];

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      if (key === 'recipeId') continue;
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        if (jsonFields.includes(dbField)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value as string | number | boolean | null | object);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE user_recipes SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.recipeId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Recipe updated successfully',
      data: { id: params.recipeId },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating recipe', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update recipe',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete recipe
 */
async function deleteRecipe(userId: string, params: z.infer<typeof DeleteRecipeSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_recipes WHERE id = $1 AND user_id = $2`,
      [params.recipeId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Recipe not found or access denied' });
    }

    await query(
      `DELETE FROM user_recipes WHERE id = $1 AND user_id = $2`,
      [params.recipeId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Recipe deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting recipe', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete recipe',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create meal log
 */
async function createMealLog(userId: string, params: z.infer<typeof CreateMealLogSchema>): Promise<string> {
  const warnings: string[] = [];
  try {
    if (!params.mealType) {
      return JSON.stringify({ success: false, error: 'Meal type is required' });
    }

    // Validate diet plan if provided
    if (params.dietPlanId) {
      const planCheck = await query(
        `SELECT id FROM diet_plans WHERE id = $1 AND user_id = $2`,
        [params.dietPlanId, userId]
      );
      if (planCheck.rows.length === 0) {
        warnings.push(`Diet plan ${params.dietPlanId} not found, creating meal log without plan reference`);
      }
    }

    const eatenAt = params.eatenAt || new Date().toISOString();

    const result = await query<{ id: string }>(
      `INSERT INTO meal_logs (
        user_id, diet_plan_id, meal_type, meal_name, description,
        calories, protein_grams, carbs_grams, fat_grams, fiber_grams,
        foods, eaten_at, hunger_before, satisfaction_after, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        userId,
        params.dietPlanId || null,
        params.mealType,
        params.mealName || null,
        params.description || null,
        params.calories || null,
        params.proteinGrams || null,
        params.carbsGrams || null,
        params.fatGrams || null,
        params.fiberGrams || null,
        JSON.stringify(params.foods || []),
        eatenAt,
        params.hungerBefore || null,
        params.satisfactionAfter || null,
        params.notes || null,
      ]
    );

    const mealId = result.rows[0].id;

    // Enqueue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'meal_log',
      sourceId: mealId,
      operation: 'create',
      priority: JobPriorities.MEDIUM,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Meal log created successfully',
      data: { id: mealId, mealType: params.mealType },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating meal log', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create meal log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update meal log
 */
async function updateMealLog(userId: string, params: z.infer<typeof UpdateMealLogSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM meal_logs WHERE id = $1 AND user_id = $2`,
      [params.mealId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Meal log not found or access denied' });
    }

    const fieldMapping: Record<string, string> = {
      mealType: 'meal_type',
      mealName: 'meal_name',
      description: 'description',
      calories: 'calories',
      proteinGrams: 'protein_grams',
      carbsGrams: 'carbs_grams',
      fatGrams: 'fat_grams',
      fiberGrams: 'fiber_grams',
      foods: 'foods',
      eatenAt: 'eaten_at',
      hungerBefore: 'hunger_before',
      satisfactionAfter: 'satisfaction_after',
      notes: 'notes',
    };

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      if (key === 'mealId') continue;
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        if (dbField === 'foods') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value as string | number | boolean | null | object);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE meal_logs SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.mealId, userId]
    );

    // Enqueue embedding update
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'meal_log',
      sourceId: params.mealId,
      operation: 'update',
      priority: JobPriorities.MEDIUM,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Meal log updated successfully',
      data: { id: params.mealId },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating meal log', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update meal log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete meal log
 */
async function deleteMealLog(userId: string, params: z.infer<typeof DeleteMealLogSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM meal_logs WHERE id = $1 AND user_id = $2`,
      [params.mealId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Meal log not found or access denied' });
    }

    // Enqueue embedding deletion BEFORE actual deletion
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'meal_log',
      sourceId: params.mealId,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding deletion', { error: err });
    });

    await query(
      `DELETE FROM meal_logs WHERE id = $1 AND user_id = $2`,
      [params.mealId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Meal log deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting meal log', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete meal log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create diet plan
 */
async function createDietPlan(userId: string, params: z.infer<typeof CreateDietPlanSchema>): Promise<string> {
  const warnings: string[] = [];
  try {
    if (!params.name?.trim()) {
      return JSON.stringify({ success: false, error: 'Diet plan name is required' });
    }

    // Valid goal categories from enum
    const validCategories = ['weight_loss', 'muscle_building', 'sleep_improvement', 'stress_wellness', 'energy_productivity', 'event_training', 'health_condition', 'habit_building', 'overall_optimization', 'custom'];
    
    let goalCategory = params.goalCategory || 'overall_optimization';
    // Validate and correct invalid goal category
    if (!validCategories.includes(goalCategory)) {
      warnings.push(`Invalid goal category '${goalCategory}', using 'overall_optimization'`);
      goalCategory = 'overall_optimization';
    }
    
    const mealsPerDay = params.mealsPerDay || 3;
    const snacksPerDay = params.snacksPerDay || 2;
    const mealTimes = params.mealTimes || {};
    const weeklyMeals = params.weeklyMeals || {};
    const dietaryPreferences = params.dietaryPreferences || [];
    const allergies = params.allergies || [];
    const excludedFoods = params.excludedFoods || [];

    // If setting as active, deactivate other plans
    if (params.isActive) {
      await query(
        `UPDATE diet_plans SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
    }

    const result = await query<{ id: string }>(
      `INSERT INTO diet_plans (
        user_id, name, description, goal_category,
        daily_calories, protein_grams, carbs_grams, fat_grams, fiber_grams,
        dietary_preferences, allergies, excluded_foods,
        meals_per_day, snacks_per_day, meal_times, weekly_meals,
        status, ai_generated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id`,
      [
        userId,
        params.name.trim(),
        params.description || null,
        goalCategory,
        params.dailyCalories || null,
        params.proteinGrams || null,
        params.carbsGrams || null,
        params.fatGrams || null,
        params.fiberGrams || null,
        JSON.stringify(dietaryPreferences),
        JSON.stringify(allergies),
        JSON.stringify(excludedFoods),
        mealsPerDay,
        snacksPerDay,
        JSON.stringify(mealTimes),
        JSON.stringify(weeklyMeals),
        params.isActive ? 'active' : 'draft',
        true,
      ]
    );

    const planId = result.rows[0].id;

    // Enqueue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'diet_plan',
      sourceId: planId,
      operation: 'create',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Diet plan created successfully',
      data: { id: planId, name: params.name },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating diet plan', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create diet plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update diet plan
 */
async function updateDietPlan(userId: string, params: z.infer<typeof UpdateDietPlanSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM diet_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Diet plan not found or access denied' });
    }

    // Valid goal categories from enum
    const validCategories = ['weight_loss', 'muscle_building', 'sleep_improvement', 'stress_wellness', 'energy_productivity', 'event_training', 'health_condition', 'habit_building', 'overall_optimization', 'custom'];
    
    // Map common invalid values to valid enum values
    const goalCategoryMapping: Record<string, string> = {
      balanced: 'overall_optimization',
      'general health': 'overall_optimization',
      'general_health': 'overall_optimization',
      wellness: 'stress_wellness',
      fitness: 'muscle_building',
      nutrition: 'overall_optimization',
    };

    const fieldMapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      goalCategory: 'goal_category',
      dailyCalories: 'daily_calories',
      proteinGrams: 'protein_grams',
      carbsGrams: 'carbs_grams',
      fatGrams: 'fat_grams',
      fiberGrams: 'fiber_grams',
      dietaryPreferences: 'dietary_preferences',
      allergies: 'allergies',
      excludedFoods: 'excluded_foods',
      mealsPerDay: 'meals_per_day',
      snacksPerDay: 'snacks_per_day',
      mealTimes: 'meal_times',
      weeklyMeals: 'weekly_meals',
      status: 'status',
    };

    const jsonFields = ['dietary_preferences', 'allergies', 'excluded_foods', 'meal_times', 'weekly_meals'];

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      if (key === 'planId') continue;
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        
        // Validate and map goal_category
        if (dbField === 'goal_category') {
          let goalCategory = value as string;
          
          // Check if it's a valid enum value
          if (!validCategories.includes(goalCategory)) {
            // Try to map it
            const mapped = goalCategoryMapping[goalCategory.toLowerCase()];
            if (mapped) {
              goalCategory = mapped;
              logger.warn('[LangGraphTools] Mapped invalid goal_category in updateDietPlan', {
                userId,
                original: value,
                mapped: goalCategory,
              });
            } else {
              // Default to overall_optimization if no mapping found
              logger.warn('[LangGraphTools] Invalid goal_category in updateDietPlan, using default', {
                userId,
                original: value,
                default: 'overall_optimization',
              });
              goalCategory = 'overall_optimization';
            }
          }
          
          values.push(goalCategory);
        }
        // JSON fields need stringify
        else if (jsonFields.includes(dbField)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value as string | number | boolean | null | object);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    // If setting as active, deactivate other plans
    if (params.status === 'active') {
      await query(
        `UPDATE diet_plans SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND id != $2 AND status = 'active'`,
        [userId, params.planId]
      );
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE diet_plans SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.planId, userId]
    );

    // Enqueue embedding update
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'diet_plan',
      sourceId: params.planId,
      operation: 'update',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Diet plan updated successfully',
      data: { id: params.planId },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating diet plan', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update diet plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete diet plan
 */
async function deleteDietPlan(userId: string, params: z.infer<typeof DeleteDietPlanSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM diet_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Diet plan not found or access denied' });
    }

    // Enqueue embedding deletion BEFORE actual deletion
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'diet_plan',
      sourceId: params.planId,
      operation: 'delete',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding deletion', { error: err });
    });

    await query(
      `DELETE FROM diet_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Diet plan deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting diet plan', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete diet plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get user's recipes
 */
async function getUserRecipes(userId: string, params?: {
  category?: string;
  favorite?: boolean;
  name?: string;
}): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM user_recipes WHERE user_id = $1`;
    const queryParams: (string | boolean)[] = [userId];
    let paramIndex = 2;

    if (params?.category) {
      sqlQuery += ` AND category = $${paramIndex}`;
      queryParams.push(params.category);
      paramIndex++;
    }

    if (params?.favorite !== undefined) {
      sqlQuery += ` AND is_favorite = $${paramIndex}`;
      queryParams.push(params.favorite);
      paramIndex++;
    }

    if (params?.name) {
      sqlQuery += ` AND name ILIKE $${paramIndex}`;
      queryParams.push(`%${params.name}%`);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No recipes found', recipes: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      cuisine: row.cuisine,
      servings: row.servings,
      caloriesPerServing: row.calories_per_serving,
      macros: {
        protein: row.protein_grams,
        carbs: row.carbs_grams,
        fat: row.fat_grams,
        fiber: row.fiber_grams,
      },
      ingredients: row.ingredients || [],
      instructions: row.instructions || [],
      prepTimeMinutes: row.prep_time_minutes,
      cookTimeMinutes: row.cook_time_minutes,
      totalTimeMinutes: row.total_time_minutes,
      tags: row.tags || [],
      dietaryFlags: row.dietary_flags || [],
      difficulty: row.difficulty,
      rating: row.rating,
      isFavorite: row.is_favorite,
      timesMade: row.times_made,
      createdAt: row.created_at,
    }));

    return JSON.stringify({ recipes: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting recipes', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve recipes' });
  }
}

// ============================================
// OPERATIONS BY NAME
// ============================================

/**
 * Helper function to find meal by name
 */
async function findMealByName(userId: string, name: string, exactMatch: boolean = false): Promise<{ id: string; name: string }[]> {
  const searchPattern = exactMatch ? name : `%${name}%`;
  const result = await query(
    `SELECT id, meal_name as name FROM meal_logs 
     WHERE user_id = $1 AND meal_name ILIKE $2 
     ORDER BY eaten_at DESC`,
    [userId, searchPattern]
  );
  return result.rows.map((row: any) => ({ id: row.id, name: row.name }));
}

/**
 * Get meal by name
 */
async function getMealByName(userId: string, params: z.infer<typeof GetMealByNameSchema>): Promise<string> {
  try {
    const meals = await findMealByName(userId, params.name, params.exactMatch || false);
    
    if (meals.length === 0) {
      return JSON.stringify({ message: `No meal found with name "${params.name}"`, meals: [] });
    }

    if (meals.length > 1) {
      return JSON.stringify({
        message: `Multiple meals found with name "${params.name}". Please be more specific or use the meal ID.`,
        matches: meals.map(m => ({ id: m.id, name: m.name })),
        count: meals.length,
      });
    }

    // Get full meal details
    const result = await query(
      `SELECT * FROM meal_logs WHERE id = $1 AND user_id = $2`,
      [meals[0].id, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'Meal not found', meals: [] });
    }

    const meal = result.rows[0];
    const formatted = {
      id: meal.id,
      mealType: meal.meal_type,
      mealName: meal.meal_name,
      eatenAt: meal.eaten_at,
      calories: meal.calories,
      macros: {
        protein: meal.protein_grams,
        carbs: meal.carbs_grams,
        fat: meal.fat_grams,
        fiber: meal.fiber_grams,
      },
      foods: meal.foods || [],
      description: meal.description,
      notes: meal.notes,
    };

    return JSON.stringify({ meal: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting meal by name', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve meal' });
  }
}

/**
 * Update meal by name
 */
async function updateMealByName(userId: string, params: z.infer<typeof UpdateMealByNameSchema>): Promise<string> {
  try {
    const meals = await findMealByName(userId, params.name, params.exactMatch || false);
    
    if (meals.length === 0) {
      return JSON.stringify({ success: false, error: `No meal found with name "${params.name}"` });
    }

    if (meals.length > 1) {
      return JSON.stringify({
        success: false,
        error: `Multiple meals found with name "${params.name}". Please be more specific or use the meal ID.`,
        matches: meals.map(m => ({ id: m.id, name: m.name })),
      });
    }

    // Use the existing updateMealLog function with the found ID
    return await updateMealLog(userId, { ...params, mealId: meals[0].id } as any);
  } catch (error) {
    logger.error('[LangGraphTools] Error updating meal by name', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update meal',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete meal by name
 */
async function deleteMealByName(userId: string, params: z.infer<typeof DeleteMealByNameSchema>): Promise<string> {
  try {
    const meals = await findMealByName(userId, params.name, params.exactMatch || false);
    
    if (meals.length === 0) {
      return JSON.stringify({ success: false, error: `No meal found with name "${params.name}"` });
    }

    if (meals.length > 1) {
      return JSON.stringify({
        success: false,
        error: `Multiple meals found with name "${params.name}". Please be more specific or use the meal ID.`,
        matches: meals.map(m => ({ id: m.id, name: m.name })),
      });
    }

    // Use the existing deleteMealLog function with the found ID
    return await deleteMealLog(userId, { mealId: meals[0].id } as any);
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting meal by name', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete meal',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Helper function to find diet plan by name
 */
async function findDietPlanByName(userId: string, name: string, exactMatch: boolean = false): Promise<{ id: string; name: string }[]> {
  const searchPattern = exactMatch ? name : `%${name}%`;
  const result = await query(
    `SELECT id, name FROM diet_plans 
     WHERE user_id = $1 AND name ILIKE $2 
     ORDER BY created_at DESC`,
    [userId, searchPattern]
  );
  return result.rows.map((row: any) => ({ id: row.id, name: row.name }));
}

/**
 * Get diet plan by name
 */
async function getDietPlanByName(userId: string, params: z.infer<typeof GetDietPlanByNameSchema>): Promise<string> {
  try {
    const plans = await findDietPlanByName(userId, params.name, params.exactMatch || false);
    
    if (plans.length === 0) {
      return JSON.stringify({ message: `No diet plan found with name "${params.name}"`, plans: [] });
    }

    if (plans.length > 1) {
      return JSON.stringify({
        message: `Multiple diet plans found with name "${params.name}". Please be more specific or use the plan ID.`,
        matches: plans.map(p => ({ id: p.id, name: p.name })),
        count: plans.length,
      });
    }

    // Get full plan details
    const result = await query(
      `SELECT * FROM diet_plans WHERE id = $1 AND user_id = $2`,
      [plans[0].id, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'Diet plan not found', plans: [] });
    }

    const plan = result.rows[0];
    const formatted = {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      goalCategory: plan.goal_category,
      status: plan.status,
      dailyCalories: plan.daily_calories,
      macros: {
        protein: plan.protein_grams,
        carbs: plan.carbs_grams,
        fat: plan.fat_grams,
        fiber: plan.fiber_grams,
      },
      mealsPerDay: plan.meals_per_day,
      snacksPerDay: plan.snacks_per_day,
      adherenceRate: `${Math.round((plan.adherence_rate || 0) * 100)}%`,
      createdAt: plan.created_at,
    };

    return JSON.stringify({ plan: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting diet plan by name', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve diet plan' });
  }
}

/**
 * Update diet plan by name
 */
async function updateDietPlanByName(userId: string, params: z.infer<typeof UpdateDietPlanByNameSchema>): Promise<string> {
  try {
    const plans = await findDietPlanByName(userId, params.name, params.exactMatch || false);
    
    if (plans.length === 0) {
      return JSON.stringify({ success: false, error: `No diet plan found with name "${params.name}"` });
    }

    if (plans.length > 1) {
      return JSON.stringify({
        success: false,
        error: `Multiple diet plans found with name "${params.name}". Please be more specific or use the plan ID.`,
        matches: plans.map(p => ({ id: p.id, name: p.name })),
      });
    }

    // Use the existing updateDietPlan function with the found ID
    return await updateDietPlan(userId, { ...params, planId: plans[0].id } as any);
  } catch (error) {
    logger.error('[LangGraphTools] Error updating diet plan by name', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update diet plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete diet plan by name
 */
async function deleteDietPlanByName(userId: string, params: z.infer<typeof DeleteDietPlanByNameSchema>): Promise<string> {
  try {
    const plans = await findDietPlanByName(userId, params.name, params.exactMatch || false);
    
    if (plans.length === 0) {
      return JSON.stringify({ success: false, error: `No diet plan found with name "${params.name}"` });
    }

    if (plans.length > 1) {
      return JSON.stringify({
        success: false,
        error: `Multiple diet plans found with name "${params.name}". Please be more specific or use the plan ID.`,
        matches: plans.map(p => ({ id: p.id, name: p.name })),
      });
    }

    // Use the existing deleteDietPlan function with the found ID
    return await deleteDietPlan(userId, { planId: plans[0].id } as any);
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting diet plan by name', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete diet plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Helper function to find recipe by name
 */
async function findRecipeByName(userId: string, name: string, exactMatch: boolean = false): Promise<{ id: string; name: string }[]> {
  const searchPattern = exactMatch ? name : `%${name}%`;
  const result = await query(
    `SELECT id, name FROM user_recipes 
     WHERE user_id = $1 AND name ILIKE $2 
     ORDER BY created_at DESC`,
    [userId, searchPattern]
  );
  return result.rows.map((row: any) => ({ id: row.id, name: row.name }));
}

/**
 * Get recipe by name
 */
async function getRecipeByName(userId: string, params: z.infer<typeof GetRecipeByNameSchema>): Promise<string> {
  try {
    const recipes = await findRecipeByName(userId, params.name, params.exactMatch || false);
    
    if (recipes.length === 0) {
      return JSON.stringify({ message: `No recipe found with name "${params.name}"`, recipes: [] });
    }

    if (recipes.length > 1) {
      return JSON.stringify({
        message: `Multiple recipes found with name "${params.name}". Please be more specific or use the recipe ID.`,
        matches: recipes.map(r => ({ id: r.id, name: r.name })),
        count: recipes.length,
      });
    }

    // Get full recipe details
    const result = await query(
      `SELECT * FROM user_recipes WHERE id = $1 AND user_id = $2`,
      [recipes[0].id, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'Recipe not found', recipes: [] });
    }

    const recipe = result.rows[0];
    const formatted = {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
      cuisine: recipe.cuisine,
      servings: recipe.servings,
      caloriesPerServing: recipe.calories_per_serving,
      macros: {
        protein: recipe.protein_grams,
        carbs: recipe.carbs_grams,
        fat: recipe.fat_grams,
        fiber: recipe.fiber_grams,
      },
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      prepTimeMinutes: recipe.prep_time_minutes,
      cookTimeMinutes: recipe.cook_time_minutes,
      totalTimeMinutes: recipe.total_time_minutes,
      tags: recipe.tags || [],
      dietaryFlags: recipe.dietary_flags || [],
      difficulty: recipe.difficulty,
      rating: recipe.rating,
      isFavorite: recipe.is_favorite,
      timesMade: recipe.times_made,
      createdAt: recipe.created_at,
    };

    return JSON.stringify({ recipe: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting recipe by name', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve recipe' });
  }
}

/**
 * Update recipe by name
 */
async function updateRecipeByName(userId: string, params: z.infer<typeof UpdateRecipeByNameSchema>): Promise<string> {
  try {
    const recipes = await findRecipeByName(userId, params.name, params.exactMatch || false);
    
    if (recipes.length === 0) {
      return JSON.stringify({ success: false, error: `No recipe found with name "${params.name}"` });
    }

    if (recipes.length > 1) {
      return JSON.stringify({
        success: false,
        error: `Multiple recipes found with name "${params.name}". Please be more specific or use the recipe ID.`,
        matches: recipes.map(r => ({ id: r.id, name: r.name })),
      });
    }

    // Use the existing updateRecipe function with the found ID
    return await updateRecipe(userId, { ...params, recipeId: recipes[0].id } as any);
  } catch (error) {
    logger.error('[LangGraphTools] Error updating recipe by name', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update recipe',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete recipe by name
 */
async function deleteRecipeByName(userId: string, params: z.infer<typeof DeleteRecipeByNameSchema>): Promise<string> {
  try {
    const recipes = await findRecipeByName(userId, params.name, params.exactMatch || false);
    
    if (recipes.length === 0) {
      return JSON.stringify({ success: false, error: `No recipe found with name "${params.name}"` });
    }

    if (recipes.length > 1) {
      return JSON.stringify({
        success: false,
        error: `Multiple recipes found with name "${params.name}". Please be more specific or use the recipe ID.`,
        matches: recipes.map(r => ({ id: r.id, name: r.name })),
      });
    }

    // Use the existing deleteRecipe function with the found ID
    return await deleteRecipe(userId, { recipeId: recipes[0].id } as any);
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting recipe by name', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete recipe',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Delete all meals
 */
async function deleteAllMeals(userId: string, params: z.infer<typeof DeleteAllMealsSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({
        success: false,
        error: 'Confirmation required. Set confirm to true to delete all meals.',
      });
    }

    let sqlQuery = `DELETE FROM meal_logs WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params.dateRange?.startDate) {
      sqlQuery += ` AND DATE(eaten_at) >= $${paramIndex}`;
      queryParams.push(params.dateRange.startDate);
      paramIndex++;
    }

    if (params.dateRange?.endDate) {
      sqlQuery += ` AND DATE(eaten_at) <= $${paramIndex}`;
      queryParams.push(params.dateRange.endDate);
      paramIndex++;
    }

    if (params.mealType) {
      sqlQuery += ` AND meal_type = $${paramIndex}`;
      queryParams.push(params.mealType);
      paramIndex++;
    }

    // Get IDs before deletion for embedding cleanup
    const idsResult = await query(
      sqlQuery.replace('DELETE FROM', 'SELECT id FROM'),
      queryParams
    );
    const ids = idsResult.rows.map((row: any) => row.id);

    // Enqueue embedding deletions
    for (const id of ids) {
      await embeddingQueueService.enqueueEmbedding({
        userId,
        sourceType: 'meal_log',
        sourceId: id,
        operation: 'delete',
        priority: JobPriorities.MEDIUM,
      }).catch((err) => {
        logger.warn('[LangGraphTools] Failed to enqueue embedding deletion', { error: err });
      });
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `${result.rowCount || 0} meal(s) deleted successfully`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all meals', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete meals',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update all meals
 */
async function updateAllMeals(userId: string, params: z.infer<typeof UpdateAllMealsSchema>): Promise<string> {
  try {
    let sqlQuery = `UPDATE meal_logs SET `;
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      mealType: 'meal_type',
      mealName: 'meal_name',
      description: 'description',
      calories: 'calories',
      proteinGrams: 'protein_grams',
      carbsGrams: 'carbs_grams',
      fatGrams: 'fat_grams',
      fiberGrams: 'fiber_grams',
      notes: 'notes',
    };

    for (const [key, value] of Object.entries(params.updates)) {
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value as string | number | null);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    sqlQuery += setClauses.join(', ') + ` WHERE user_id = $${paramIndex}`;
    values.push(userId);
    paramIndex++;

    if (params.filter?.dateRange?.startDate) {
      sqlQuery += ` AND DATE(eaten_at) >= $${paramIndex}`;
      values.push(params.filter.dateRange.startDate);
      paramIndex++;
    }

    if (params.filter?.dateRange?.endDate) {
      sqlQuery += ` AND DATE(eaten_at) <= $${paramIndex}`;
      values.push(params.filter.dateRange.endDate);
      paramIndex++;
    }

    if (params.filter?.mealType) {
      sqlQuery += ` AND meal_type = $${paramIndex}`;
      values.push(params.filter.mealType);
      paramIndex++;
    }

    // Get IDs before update for embedding updates
    let idsQuery = `SELECT id FROM meal_logs WHERE user_id = $1`;
    const idsParams: (string | number | null)[] = [userId];
    let idsParamIndex = 2;
    
    if (params.filter?.dateRange?.startDate) {
      idsQuery += ` AND DATE(eaten_at) >= $${idsParamIndex}`;
      idsParams.push(params.filter.dateRange.startDate);
      idsParamIndex++;
    }
    
    if (params.filter?.dateRange?.endDate) {
      idsQuery += ` AND DATE(eaten_at) <= $${idsParamIndex}`;
      idsParams.push(params.filter.dateRange.endDate);
      idsParamIndex++;
    }
    
    if (params.filter?.mealType) {
      idsQuery += ` AND meal_type = $${idsParamIndex}`;
      idsParams.push(params.filter.mealType);
      idsParamIndex++;
    }
    
    const idsResult = await query(idsQuery, idsParams);
    const ids = idsResult.rows.map((row: any) => row.id);

    const result = await query(sqlQuery, values);

    // Enqueue embedding updates
    for (const id of ids) {
      await embeddingQueueService.enqueueEmbedding({
        userId,
        sourceType: 'meal_log',
        sourceId: id,
        operation: 'update',
        priority: JobPriorities.MEDIUM,
      }).catch((err) => {
        logger.warn('[LangGraphTools] Failed to enqueue embedding update', { error: err });
      });
    }

    return JSON.stringify({
      success: true,
      message: `${result.rowCount || 0} meal(s) updated successfully`,
      updatedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating all meals', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update meals',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all diet plans
 */
async function deleteAllDietPlans(userId: string, params: z.infer<typeof DeleteAllDietPlansSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({
        success: false,
        error: 'Confirmation required. Set confirm to true to delete all diet plans.',
      });
    }

    let sqlQuery = `DELETE FROM diet_plans WHERE user_id = $1`;
    const queryParams: string[] = [userId];
    let paramIndex = 2;

    if (params.status) {
      sqlQuery += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    // Get IDs before deletion for embedding cleanup
    const idsResult = await query(
      sqlQuery.replace('DELETE FROM', 'SELECT id FROM'),
      queryParams
    );
    const ids = idsResult.rows.map((row: any) => row.id);

    // Enqueue embedding deletions
    for (const id of ids) {
      await embeddingQueueService.enqueueEmbedding({
        userId,
        sourceType: 'diet_plan',
        sourceId: id,
        operation: 'delete',
        priority: JobPriorities.CRITICAL,
      }).catch((err) => {
        logger.warn('[LangGraphTools] Failed to enqueue embedding deletion', { error: err });
      });
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `${result.rowCount || 0} diet plan(s) deleted successfully`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all diet plans', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete diet plans',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update all diet plans
 */
async function updateAllDietPlans(userId: string, params: z.infer<typeof UpdateAllDietPlansSchema>): Promise<string> {
  try {
    let sqlQuery = `UPDATE diet_plans SET `;
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      status: 'status',
      description: 'description',
      dailyCalories: 'daily_calories',
      mealsPerDay: 'meals_per_day',
      snacksPerDay: 'snacks_per_day',
    };

    for (const [key, value] of Object.entries(params.updates)) {
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value as string | number | null);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    sqlQuery += setClauses.join(', ') + ` WHERE user_id = $${paramIndex}`;
    values.push(userId);
    paramIndex++;

    if (params.filter?.status) {
      sqlQuery += ` AND status = $${paramIndex}`;
      values.push(params.filter.status);
      paramIndex++;
    }

    if (params.filter?.goalCategory) {
      sqlQuery += ` AND goal_category = $${paramIndex}`;
      values.push(params.filter.goalCategory);
      paramIndex++;
    }

    // Get IDs before update for embedding updates
    let idsQuery = `SELECT id FROM diet_plans WHERE user_id = $1`;
    const idsParams: (string | number | null)[] = [userId];
    let idsParamIndex = 2;
    
    if (params.filter?.status) {
      idsQuery += ` AND status = $${idsParamIndex}`;
      idsParams.push(params.filter.status);
      idsParamIndex++;
    }
    
    if (params.filter?.goalCategory) {
      idsQuery += ` AND goal_category = $${idsParamIndex}`;
      idsParams.push(params.filter.goalCategory);
      idsParamIndex++;
    }
    
    const idsResult = await query(idsQuery, idsParams);
    const ids = idsResult.rows.map((row: any) => row.id);

    const result = await query(sqlQuery, values);

    // Enqueue embedding updates
    for (const id of ids) {
      await embeddingQueueService.enqueueEmbedding({
        userId,
        sourceType: 'diet_plan',
        sourceId: id,
        operation: 'update',
        priority: JobPriorities.CRITICAL,
      }).catch((err) => {
        logger.warn('[LangGraphTools] Failed to enqueue embedding update', { error: err });
      });
    }

    return JSON.stringify({
      success: true,
      message: `${result.rowCount || 0} diet plan(s) updated successfully`,
      updatedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating all diet plans', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update diet plans',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all recipes
 */
async function deleteAllRecipes(userId: string, params: z.infer<typeof DeleteAllRecipesSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({
        success: false,
        error: 'Confirmation required. Set confirm to true to delete all recipes.',
      });
    }

    let sqlQuery = `DELETE FROM user_recipes WHERE user_id = $1`;
    const queryParams: (string | boolean)[] = [userId];
    let paramIndex = 2;

    if (params.category) {
      sqlQuery += ` AND category = $${paramIndex}`;
      queryParams.push(params.category);
      paramIndex++;
    }

    if (params.favorite !== undefined) {
      sqlQuery += ` AND is_favorite = $${paramIndex}`;
      queryParams.push(params.favorite);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `${result.rowCount || 0} recipe(s) deleted successfully`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all recipes', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete recipes',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update all recipes
 */
async function updateAllRecipes(userId: string, params: z.infer<typeof UpdateAllRecipesSchema>): Promise<string> {
  try {
    let sqlQuery = `UPDATE user_recipes SET `;
    const setClauses: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      category: 'category',
      difficulty: 'difficulty',
      isFavorite: 'is_favorite',
      rating: 'rating',
    };

    for (const [key, value] of Object.entries(params.updates)) {
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value as string | number | boolean | null);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    sqlQuery += setClauses.join(', ') + ` WHERE user_id = $${paramIndex}`;
    values.push(userId);
    paramIndex++;

    if (params.filter?.category) {
      sqlQuery += ` AND category = $${paramIndex}`;
      values.push(params.filter.category);
      paramIndex++;
    }

    if (params.filter?.favorite !== undefined) {
      sqlQuery += ` AND is_favorite = $${paramIndex}`;
      values.push(params.filter.favorite);
      paramIndex++;
    }

    const result = await query(sqlQuery, values);

    return JSON.stringify({
      success: true,
      message: `${result.rowCount || 0} recipe(s) updated successfully`,
      updatedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating all recipes', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update recipes',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create goal
 */
async function createGoal(userId: string, params: z.infer<typeof CreateGoalSchema>): Promise<string> {
  const warnings: string[] = [];
  try {
    if (!params.title?.trim()) {
      return JSON.stringify({ success: false, error: 'Goal title is required' });
    }

    // Check existing goals count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM user_goals WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    const existingGoalsCount = parseInt(countResult.rows[0].count, 10);

    if (existingGoalsCount >= 3) {
      return JSON.stringify({
        success: false,
        error: 'Maximum 3 active goals allowed. Please complete or delete an existing goal first.',
      });
    }

    const category = params.category || 'overall_optimization';
    const pillar = params.pillar || 'fitness';
    const targetValue = params.targetValue || 100;
    const targetUnit = params.targetUnit || 'percent';
    const currentValue = params.currentValue || 0;
    const durationWeeks = params.durationWeeks || 4;
    const description = params.description || params.title;
    const motivation = params.motivation || 'Achieve your health goals!';

    // Calculate dates
    const startDate = new Date();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + durationWeeks * 7);

    // Generate simple milestones
    const milestones = [];
    for (let i = 1; i <= durationWeeks; i++) {
      const weekDate = new Date(startDate);
      weekDate.setDate(weekDate.getDate() + i * 7);
      const milestoneValue = currentValue + ((targetValue - currentValue) * i) / durationWeeks;
      milestones.push({
        week: i,
        date: weekDate.toISOString().split('T')[0],
        targetValue: Math.round(milestoneValue * 100) / 100,
      });
    }

    // If setting as primary, unset other primary goals
    if (params.isPrimary) {
      await query(
        'UPDATE user_goals SET is_primary = false WHERE user_id = $1 AND is_primary = true',
        [userId]
      );
    }

    const result = await query<{ id: string }>(
      `INSERT INTO user_goals (
        user_id, category, pillar, is_primary, title, description,
        target_value, target_unit, current_value, start_value,
        start_date, target_date, duration_weeks, milestones,
        motivation, confidence_level, ai_suggested
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id`,
      [
        userId,
        category,
        pillar,
        params.isPrimary || existingGoalsCount === 0,
        params.title.trim(),
        description,
        targetValue,
        targetUnit,
        currentValue,
        currentValue,
        startDate.toISOString().split('T')[0],
        targetDate.toISOString().split('T')[0],
        durationWeeks,
        JSON.stringify(milestones),
        motivation,
        7, // Default confidence
        true, // AI suggested
      ]
    );

    const goalId = result.rows[0].id;

    // Enqueue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_goal',
      sourceId: goalId,
      operation: 'create',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Goal created successfully',
      data: { id: goalId, title: params.title },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating goal', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create goal',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update goal
 */
async function updateGoal(userId: string, params: z.infer<typeof UpdateGoalSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_goals WHERE id = $1 AND user_id = $2`,
      [params.goalId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Goal not found or access denied' });
    }

    const fieldMapping: Record<string, string> = {
      title: 'title',
      description: 'description',
      targetValue: 'target_value',
      currentValue: 'current_value',
      motivation: 'motivation',
      status: 'status',
      isPrimary: 'is_primary',
    };

    const setClauses: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      if (key === 'goalId') continue;
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value as string | number | boolean | null);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    // If setting as primary, unset other primary goals
    if (params.isPrimary) {
      await query(
        'UPDATE user_goals SET is_primary = false WHERE user_id = $1 AND id != $2 AND is_primary = true',
        [userId, params.goalId]
      );
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE user_goals SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.goalId, userId]
    );

    // Enqueue embedding update
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_goal',
      sourceId: params.goalId,
      operation: 'update',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Goal updated successfully',
      data: { id: params.goalId },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating goal', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update goal',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete goal
 */
async function deleteGoal(userId: string, params: z.infer<typeof DeleteGoalSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_goals WHERE id = $1 AND user_id = $2`,
      [params.goalId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Goal not found or access denied' });
    }

    // Enqueue embedding deletion BEFORE actual deletion
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_goal',
      sourceId: params.goalId,
      operation: 'delete',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding deletion', { error: err });
    });

    await query(
      `DELETE FROM user_goals WHERE id = $1 AND user_id = $2`,
      [params.goalId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Goal deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting goal', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete goal',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// USER INTEGRATIONS CRUD
// ============================================

/**
 * Get user integrations
 */
async function getUserIntegrations(userId: string, params?: z.infer<typeof GetUserIntegrationsSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT id, provider, status, connected_at, disconnected_at, last_sync_at, last_sync_status, is_enabled, is_primary_for_data_types FROM user_integrations WHERE user_id = $1`;
    const queryParams: string[] = [userId];
    let paramIndex = 2;

    if (params?.provider) {
      sqlQuery += ` AND provider = $${paramIndex}`;
      queryParams.push(params.provider);
      paramIndex++;
    }

    if (params?.status) {
      sqlQuery += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY connected_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No integrations found', integrations: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      connectedAt: row.connected_at,
      disconnectedAt: row.disconnected_at,
      lastSyncAt: row.last_sync_at,
      lastSyncStatus: row.last_sync_status,
      isEnabled: row.is_enabled,
      isPrimaryForDataTypes: row.is_primary_for_data_types || [],
    }));

    return JSON.stringify({ integrations: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting integrations', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve integrations' });
  }
}

/**
 * Get integration by ID
 */
async function getUserIntegrationById(userId: string, params: z.infer<typeof GetUserIntegrationByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT id, provider, status, connected_at, disconnected_at, last_sync_at, last_sync_status, is_enabled, is_primary_for_data_types, device_info FROM user_integrations WHERE id = $1 AND user_id = $2`,
      [params.integrationId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Integration not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      provider: row.provider,
      status: row.status,
      connectedAt: row.connected_at,
      disconnectedAt: row.disconnected_at,
      lastSyncAt: row.last_sync_at,
      lastSyncStatus: row.last_sync_status,
      isEnabled: row.is_enabled,
      isPrimaryForDataTypes: row.is_primary_for_data_types || [],
      deviceInfo: row.device_info,
    };

    return JSON.stringify({ success: true, integration: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting integration by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve integration' });
  }
}

/**
 * Get integration by provider
 */
async function getUserIntegrationByProvider(userId: string, params: z.infer<typeof GetUserIntegrationByProviderSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT id, provider, status, connected_at, last_sync_at, is_enabled FROM user_integrations WHERE provider = $1 AND user_id = $2`,
      [params.provider, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'Integration not found', integration: null });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      provider: row.provider,
      status: row.status,
      connectedAt: row.connected_at,
      lastSyncAt: row.last_sync_at,
      isEnabled: row.is_enabled,
    };

    return JSON.stringify({ integration: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting integration by provider', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve integration' });
  }
}

/**
 * Create user integration
 */
async function createUserIntegration(userId: string, params: z.infer<typeof CreateUserIntegrationSchema>): Promise<string> {
  try {
    // Check if integration already exists for this provider
    const existing = await query(
      `SELECT id FROM user_integrations WHERE user_id = $1 AND provider = $2`,
      [userId, params.provider]
    );

    if (existing.rows.length > 0) {
      return JSON.stringify({ 
        success: false, 
        error: `Integration for ${params.provider} already exists. Use updateUserIntegration to modify it.`,
        integrationId: existing.rows[0].id 
      });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO user_integrations (
        user_id, provider, access_token, refresh_token, token_expiry, scopes, is_enabled, device_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        userId,
        params.provider,
        params.accessToken,
        params.refreshToken || null,
        params.tokenExpiry ? new Date(params.tokenExpiry) : null,
        params.scopes || [],
        params.isEnabled ?? true,
        params.deviceInfo ? JSON.stringify(params.deviceInfo) : null,
      ]
    );

    return JSON.stringify({
      success: true,
      message: 'Integration created successfully',
      data: { id: result.rows[0].id, provider: params.provider },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating integration', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create integration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update user integration
 */
async function updateUserIntegration(userId: string, params: z.infer<typeof UpdateUserIntegrationSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_integrations WHERE id = $1 AND user_id = $2`,
      [params.integrationId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Integration not found or access denied' });
    }

    const setClauses: string[] = [];
    const values: (string | boolean | null | object | string[])[] = [];
    let paramIndex = 1;

    if (params.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }

    if (params.isEnabled !== undefined) {
      setClauses.push(`is_enabled = $${paramIndex}`);
      values.push(params.isEnabled);
      paramIndex++;
    }

    if (params.isPrimaryForDataTypes !== undefined) {
      setClauses.push(`is_primary_for_data_types = $${paramIndex}`);
      values.push(params.isPrimaryForDataTypes);
      paramIndex++;
    }

    if (params.deviceInfo !== undefined) {
      setClauses.push(`device_info = $${paramIndex}`);
      values.push(JSON.stringify(params.deviceInfo));
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE user_integrations SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.integrationId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Integration updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating integration', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update integration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete user integration
 */
async function deleteUserIntegration(userId: string, params: z.infer<typeof DeleteUserIntegrationSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_integrations WHERE id = $1 AND user_id = $2`,
      [params.integrationId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Integration not found or access denied' });
    }

    await query(
      `UPDATE user_integrations SET status = 'disconnected', disconnected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
      [params.integrationId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Integration disconnected successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting integration', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete integration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete integration by provider
 */
async function deleteUserIntegrationByProvider(userId: string, params: z.infer<typeof DeleteUserIntegrationByProviderSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_integrations WHERE provider = $1 AND user_id = $2`,
      [params.provider, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Integration not found or access denied' });
    }

    await query(
      `UPDATE user_integrations SET status = 'disconnected', disconnected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE provider = $1 AND user_id = $2`,
      [params.provider, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Integration disconnected successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting integration by provider', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete integration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all integrations
 */
async function deleteAllUserIntegrations(userId: string, params: z.infer<typeof DeleteAllUserIntegrationsSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to disconnect all integrations.' 
      });
    }

    let sqlQuery = `UPDATE user_integrations SET status = 'disconnected', disconnected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`;
    const queryParams: string[] = [userId];
    let paramIndex = 2;

    if (params.status) {
      sqlQuery += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Disconnected ${result.rowCount || 0} integration(s)`,
      disconnectedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all integrations', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to disconnect integrations',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// HEALTH DATA RECORDS CRUD
// ============================================

/**
 * Get health data records
 */
async function getHealthDataRecords(userId: string, params?: z.infer<typeof GetHealthDataRecordsSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT hdr.*, ui.provider as integration_provider 
                    FROM health_data_records hdr
                    JOIN user_integrations ui ON hdr.integration_id = ui.id
                    WHERE hdr.user_id = $1`;
    const queryParams: (string | number | Date)[] = [userId];
    let paramIndex = 2;

    if (params?.dataType) {
      sqlQuery += ` AND hdr.data_type = $${paramIndex}`;
      queryParams.push(params.dataType);
      paramIndex++;
    }

    if (params?.provider) {
      sqlQuery += ` AND hdr.provider = $${paramIndex}`;
      queryParams.push(params.provider);
      paramIndex++;
    }

    if (params?.startDate) {
      sqlQuery += ` AND hdr.recorded_at >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params?.endDate) {
      sqlQuery += ` AND hdr.recorded_at <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY hdr.recorded_at DESC`;
    
    if (params?.limit) {
      sqlQuery += ` LIMIT $${paramIndex}`;
      queryParams.push(params.limit);
    } else {
      sqlQuery += ` LIMIT 50`;
    }

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No health data records found', records: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      dataType: row.data_type,
      recordedAt: row.recorded_at,
      value: row.value,
      unit: row.unit,
      sourcePriority: row.source_priority,
      isGoldenSource: row.is_golden_source,
    }));

    return JSON.stringify({ records: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting health data records', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve health data records' });
  }
}

/**
 * Get health data record by ID
 */
async function getHealthDataRecordById(userId: string, params: z.infer<typeof GetHealthDataRecordByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT hdr.*, ui.provider as integration_provider 
       FROM health_data_records hdr
       JOIN user_integrations ui ON hdr.integration_id = ui.id
       WHERE hdr.id = $1 AND hdr.user_id = $2`,
      [params.recordId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Health data record not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      integrationId: row.integration_id,
      provider: row.provider,
      dataType: row.data_type,
      recordedAt: row.recorded_at,
      receivedAt: row.received_at,
      value: row.value,
      unit: row.unit,
      sourcePriority: row.source_priority,
      isGoldenSource: row.is_golden_source,
      rawDataId: row.raw_data_id,
    };

    return JSON.stringify({ success: true, record: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting health data record by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve health data record' });
  }
}

/**
 * Create health data record
 */
async function createHealthDataRecord(userId: string, params: z.infer<typeof CreateHealthDataRecordSchema>): Promise<string> {
  try {
    // Verify integration belongs to user
    const integrationCheck = await query(
      `SELECT id FROM user_integrations WHERE id = $1 AND user_id = $2`,
      [params.integrationId, userId]
    );

    if (integrationCheck.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Integration not found or access denied' });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO health_data_records (
        user_id, integration_id, provider, data_type, recorded_at, value, unit,
        source_priority, is_golden_source, raw_data_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        userId,
        params.integrationId,
        params.provider,
        params.dataType,
        new Date(params.recordedAt),
        JSON.stringify(params.value),
        params.unit,
        params.sourcePriority || 0,
        params.isGoldenSource || false,
        params.rawDataId || null,
      ]
    );

    return JSON.stringify({
      success: true,
      message: 'Health data record created successfully',
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating health data record', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create health data record',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update health data record
 */
async function updateHealthDataRecord(userId: string, params: z.infer<typeof UpdateHealthDataRecordSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM health_data_records WHERE id = $1 AND user_id = $2`,
      [params.recordId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Health data record not found or access denied' });
    }

    const setClauses: string[] = [];
    const values: (string | number | boolean | object)[] = [];
    let paramIndex = 1;

    if (params.value !== undefined) {
      setClauses.push(`value = $${paramIndex}`);
      values.push(JSON.stringify(params.value));
      paramIndex++;
    }

    if (params.unit !== undefined) {
      setClauses.push(`unit = $${paramIndex}`);
      values.push(params.unit);
      paramIndex++;
    }

    if (params.sourcePriority !== undefined) {
      setClauses.push(`source_priority = $${paramIndex}`);
      values.push(params.sourcePriority);
      paramIndex++;
    }

    if (params.isGoldenSource !== undefined) {
      setClauses.push(`is_golden_source = $${paramIndex}`);
      values.push(params.isGoldenSource);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE health_data_records SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.recordId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Health data record updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating health data record', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update health data record',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete health data record
 */
async function deleteHealthDataRecord(userId: string, params: z.infer<typeof DeleteHealthDataRecordSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM health_data_records WHERE id = $1 AND user_id = $2`,
      [params.recordId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Health data record not found or access denied' });
    }

    await query(
      `DELETE FROM health_data_records WHERE id = $1 AND user_id = $2`,
      [params.recordId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Health data record deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting health data record', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete health data record',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all health data records
 */
async function deleteAllHealthDataRecords(userId: string, params: z.infer<typeof DeleteAllHealthDataRecordsSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all health data records.' 
      });
    }

    let sqlQuery = `DELETE FROM health_data_records WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params.dataType) {
      sqlQuery += ` AND data_type = $${paramIndex}`;
      queryParams.push(params.dataType);
      paramIndex++;
    }

    if (params.provider) {
      sqlQuery += ` AND provider = $${paramIndex}`;
      queryParams.push(params.provider);
      paramIndex++;
    }

    if (params.startDate) {
      sqlQuery += ` AND recorded_at >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params.endDate) {
      sqlQuery += ` AND recorded_at <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} health data record(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all health data records', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete health data records',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// USER PLANS CRUD
// ============================================

/**
 * Get user plans
 */
async function getUserPlans(userId: string, params?: z.infer<typeof GetUserPlansSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM user_plans WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params?.status) {
      sqlQuery += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    if (params?.goalCategory) {
      sqlQuery += ` AND goal_category = $${paramIndex}`;
      queryParams.push(params.goalCategory);
      paramIndex++;
    }

    if (params?.startDate) {
      sqlQuery += ` AND start_date >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params?.endDate) {
      sqlQuery += ` AND end_date <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No plans found', plans: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      goalId: row.goal_id,
      name: row.name,
      description: row.description,
      pillar: row.pillar,
      goalCategory: row.goal_category,
      startDate: row.start_date,
      endDate: row.end_date,
      durationWeeks: row.duration_weeks,
      currentWeek: row.current_week,
      status: row.status,
      overallProgress: row.overall_progress,
      activities: row.activities,
    }));

    return JSON.stringify({ plans: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting user plans', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve plans' });
  }
}

/**
 * Get user plan by ID
 */
async function getUserPlanById(userId: string, params: z.infer<typeof GetUserPlanByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM user_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Plan not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      goalId: row.goal_id,
      name: row.name,
      description: row.description,
      pillar: row.pillar,
      goalCategory: row.goal_category,
      startDate: row.start_date,
      endDate: row.end_date,
      durationWeeks: row.duration_weeks,
      currentWeek: row.current_week,
      status: row.status,
      overallProgress: row.overall_progress,
      activities: row.activities,
      weeklyFocuses: row.weekly_focuses,
    };

    return JSON.stringify({ success: true, plan: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting plan by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve plan' });
  }
}

/**
 * Get user plan by name
 */
async function getUserPlanByName(userId: string, params: z.infer<typeof GetUserPlanByNameSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM user_plans WHERE user_id = $1`;
    const queryParams: string[] = [userId];

    if (params.exactMatch) {
      sqlQuery += ` AND LOWER(name) = LOWER($2)`;
      queryParams.push(params.name);
    } else {
      sqlQuery += ` AND LOWER(name) LIKE LOWER($2)`;
      queryParams.push(`%${params.name}%`);
    }

    sqlQuery += ` ORDER BY created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No plans found', plans: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      goalCategory: row.goal_category,
      currentWeek: row.current_week,
      overallProgress: row.overall_progress,
    }));

    return JSON.stringify({ plans: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting plan by name', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve plans' });
  }
}

/**
 * Create user plan
 */
async function createUserPlan(userId: string, params: z.infer<typeof CreateUserPlanSchema>): Promise<string> {
  try {
    // Verify goal belongs to user
    const goalCheck = await query(
      `SELECT id FROM user_goals WHERE id = $1 AND user_id = $2`,
      [params.goalId, userId]
    );

    if (goalCheck.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Goal not found or access denied' });
    }

    const startDate = params.startDate || new Date().toISOString().split('T')[0];
    const durationWeeks = params.durationWeeks || 4;
    const endDate = params.endDate || new Date(Date.now() + durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await query<{ id: string }>(
      `INSERT INTO user_plans (
        user_id, goal_id, name, description, pillar, goal_category,
        start_date, end_date, duration_weeks, current_week, status,
        activities, weekly_focuses
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        userId,
        params.goalId,
        params.name,
        params.description || '',
        params.pillar || 'fitness',
        params.goalCategory || 'overall_optimization',
        startDate,
        endDate,
        durationWeeks,
        1,
        'draft',
        params.activities ? JSON.stringify(params.activities) : '[]',
        params.weeklyFocuses ? JSON.stringify(params.weeklyFocuses) : '[]',
      ]
    );

    // Enqueue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_plan',
      sourceId: result.rows[0].id,
      operation: 'create',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Plan created successfully',
      data: { id: result.rows[0].id, name: params.name },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating plan', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update user plan
 */
async function updateUserPlan(userId: string, params: z.infer<typeof UpdateUserPlanSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Plan not found or access denied' });
    }

    const fieldMapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      status: 'status',
      currentWeek: 'current_week',
      overallProgress: 'overall_progress',
    };

    const setClauses: string[] = [];
    const values: (string | number | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      if (key === 'planId') continue;
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        if (key === 'activities' || key === 'weeklyFocuses') {
          setClauses.push(`${key === 'activities' ? 'activities' : 'weekly_focuses'} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          setClauses.push(`${dbField} = $${paramIndex}`);
          values.push(value as string | number);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE user_plans SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.planId, userId]
    );

    // Enqueue embedding update
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_plan',
      sourceId: params.planId,
      operation: 'update',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Plan updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating plan', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete user plan
 */
async function deleteUserPlan(userId: string, params: z.infer<typeof DeleteUserPlanSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Plan not found or access denied' });
    }

    // Enqueue embedding deletion
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_plan',
      sourceId: params.planId,
      operation: 'delete',
      priority: JobPriorities.CRITICAL,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding deletion', { error: err });
    });

    await query(
      `DELETE FROM user_plans WHERE id = $1 AND user_id = $2`,
      [params.planId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting plan', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete plan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all user plans
 */
async function deleteAllUserPlans(userId: string, params: z.infer<typeof DeleteAllUserPlansSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all plans.' 
      });
    }

    let sqlQuery = `DELETE FROM user_plans WHERE user_id = $1`;
    const queryParams: string[] = [userId];
    let paramIndex = 2;

    if (params.status) {
      sqlQuery += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} plan(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all plans', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete plans',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update all user plans
 */
async function updateAllUserPlans(userId: string, params: z.infer<typeof UpdateAllUserPlansSchema>): Promise<string> {
  try {
    let sqlQuery = `UPDATE user_plans SET `;
    const setClauses: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (params.updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(params.updates.status);
      paramIndex++;
    }

    if (params.updates.currentWeek !== undefined) {
      setClauses.push(`current_week = $${paramIndex}`);
      values.push(params.updates.currentWeek);
      paramIndex++;
    }

    if (params.updates.overallProgress !== undefined) {
      setClauses.push(`overall_progress = $${paramIndex}`);
      values.push(params.updates.overallProgress);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    sqlQuery += setClauses.join(', ');

    sqlQuery += ` WHERE user_id = $${paramIndex}`;
    values.push(userId);
    paramIndex++;

    if (params.filter) {
      if (params.filter.status) {
        sqlQuery += ` AND status = $${paramIndex}`;
        values.push(params.filter.status);
        paramIndex++;
      }
      if (params.filter.goalCategory) {
        sqlQuery += ` AND goal_category = $${paramIndex}`;
        values.push(params.filter.goalCategory);
        paramIndex++;
      }
    }

    const result = await query(sqlQuery, values);

    return JSON.stringify({
      success: true,
      message: `Updated ${result.rowCount || 0} plan(s)`,
      updatedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating all plans', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update plans',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// NOTIFICATIONS CRUD
// ============================================

/**
 * Get notifications
 */
async function getNotifications(userId: string, params?: z.infer<typeof GetNotificationsSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM notifications WHERE user_id = $1`;
    const queryParams: (string | boolean | number | Date)[] = [userId];
    let paramIndex = 2;

    if (params?.type) {
      sqlQuery += ` AND type = $${paramIndex}`;
      queryParams.push(params.type);
      paramIndex++;
    }

    if (params?.isRead !== undefined) {
      sqlQuery += ` AND is_read = $${paramIndex}`;
      queryParams.push(params.isRead);
      paramIndex++;
    }

    if (params?.priority) {
      sqlQuery += ` AND priority = $${paramIndex}`;
      queryParams.push(params.priority);
      paramIndex++;
    }

    if (params?.startDate) {
      sqlQuery += ` AND created_at >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params?.endDate) {
      sqlQuery += ` AND created_at <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY created_at DESC`;
    
    if (params?.limit) {
      sqlQuery += ` LIMIT $${paramIndex}`;
      queryParams.push(params.limit);
    } else {
      sqlQuery += ` LIMIT 50`;
    }

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No notifications found', notifications: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      icon: row.icon,
      imageUrl: row.image_url,
      actionUrl: row.action_url,
      actionLabel: row.action_label,
      priority: row.priority,
      isRead: row.is_read,
      isArchived: row.is_archived,
      createdAt: row.created_at,
    }));

    return JSON.stringify({ notifications: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting notifications', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve notifications' });
  }
}

/**
 * Get notification by ID
 */
async function getNotificationById(userId: string, params: z.infer<typeof GetNotificationByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE id = $1 AND user_id = $2`,
      [params.notificationId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Notification not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      icon: row.icon,
      imageUrl: row.image_url,
      actionUrl: row.action_url,
      actionLabel: row.action_label,
      priority: row.priority,
      isRead: row.is_read,
      isArchived: row.is_archived,
      metadata: row.metadata,
      createdAt: row.created_at,
    };

    return JSON.stringify({ success: true, notification: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting notification by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve notification' });
  }
}

/**
 * Create notification
 */
async function createNotification(userId: string, params: z.infer<typeof CreateNotificationSchema>): Promise<string> {
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO notifications (
        user_id, type, title, message, icon, image_url, action_url, action_label,
        category, priority, related_entity_type, related_entity_id, metadata, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id`,
      [
        userId,
        params.type,
        params.title,
        params.message,
        params.icon || null,
        params.imageUrl || null,
        params.actionUrl || null,
        params.actionLabel || null,
        params.category || null,
        params.priority || 'normal',
        params.relatedEntityType || null,
        params.relatedEntityId || null,
        params.metadata ? JSON.stringify(params.metadata) : '{}',
        params.expiresAt ? new Date(params.expiresAt) : null,
      ]
    );

    return JSON.stringify({
      success: true,
      message: 'Notification created successfully',
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating notification', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update notification
 */
async function updateNotification(userId: string, params: z.infer<typeof UpdateNotificationSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM notifications WHERE id = $1 AND user_id = $2`,
      [params.notificationId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Notification not found or access denied' });
    }

    const setClauses: string[] = [];
    const values: (string | boolean | Date)[] = [];
    let paramIndex = 1;

    if (params.isRead !== undefined) {
      setClauses.push(`is_read = $${paramIndex}`);
      values.push(params.isRead);
      if (params.isRead) {
        setClauses.push(`read_at = CURRENT_TIMESTAMP`);
      }
      paramIndex++;
    }

    if (params.isArchived !== undefined) {
      setClauses.push(`is_archived = $${paramIndex}`);
      values.push(params.isArchived);
      if (params.isArchived) {
        setClauses.push(`archived_at = CURRENT_TIMESTAMP`);
      }
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE notifications SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.notificationId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Notification updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating notification', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete notification
 */
async function deleteNotification(userId: string, params: z.infer<typeof DeleteNotificationSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM notifications WHERE id = $1 AND user_id = $2`,
      [params.notificationId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Notification not found or access denied' });
    }

    await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [params.notificationId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting notification', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all notifications
 */
async function deleteAllNotifications(userId: string, params: z.infer<typeof DeleteAllNotificationsSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all notifications.' 
      });
    }

    let sqlQuery = `DELETE FROM notifications WHERE user_id = $1`;
    const queryParams: (string | boolean)[] = [userId];
    let paramIndex = 2;

    if (params.isRead !== undefined) {
      sqlQuery += ` AND is_read = $${paramIndex}`;
      queryParams.push(params.isRead);
      paramIndex++;
    }

    if (params.type) {
      sqlQuery += ` AND type = $${paramIndex}`;
      queryParams.push(params.type);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} notification(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all notifications', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete notifications',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsRead(userId: string, params: z.infer<typeof MarkAllNotificationsReadSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to mark all notifications as read.' 
      });
    }

    const result = await query(
      `UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return JSON.stringify({
      success: true,
      message: `Marked ${result.rowCount || 0} notification(s) as read`,
      updatedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error marking all notifications as read', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to mark notifications as read',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// USER BODY IMAGES CRUD
// ============================================

/**
 * Get user body images
 */
async function getUserBodyImages(userId: string, params?: z.infer<typeof GetUserBodyImagesSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM user_body_images WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params?.imageType) {
      sqlQuery += ` AND image_type = $${paramIndex}`;
      queryParams.push(params.imageType);
      paramIndex++;
    }

    if (params?.captureContext) {
      sqlQuery += ` AND capture_context = $${paramIndex}`;
      queryParams.push(params.captureContext);
      paramIndex++;
    }

    if (params?.startDate) {
      sqlQuery += ` AND captured_at >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params?.endDate) {
      sqlQuery += ` AND captured_at <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY captured_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No body images found', images: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      imageType: row.image_type,
      imageKey: row.image_key,
      captureContext: row.capture_context,
      analysisStatus: row.analysis_status,
      capturedAt: row.captured_at,
      analyzedAt: row.analyzed_at,
    }));

    return JSON.stringify({ images: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting body images', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve body images' });
  }
}

/**
 * Get body image by ID
 */
async function getUserBodyImageById(userId: string, params: z.infer<typeof GetUserBodyImageByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM user_body_images WHERE id = $1 AND user_id = $2`,
      [params.imageId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Body image not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      imageType: row.image_type,
      imageKey: row.image_key,
      captureContext: row.capture_context,
      analysisStatus: row.analysis_status,
      analysisResult: row.analysis_result,
      capturedAt: row.captured_at,
      analyzedAt: row.analyzed_at,
    };

    return JSON.stringify({ success: true, image: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting body image by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve body image' });
  }
}

/**
 * Create body image record
 */
async function createUserBodyImage(userId: string, params: z.infer<typeof CreateUserBodyImageSchema>): Promise<string> {
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO user_body_images (
        user_id, image_type, image_key, capture_context, is_encrypted
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        userId,
        params.imageType,
        params.imageKey,
        params.captureContext,
        params.isEncrypted || false,
      ]
    );

    return JSON.stringify({
      success: true,
      message: 'Body image record created successfully',
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating body image', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create body image record',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete body image
 */
async function deleteUserBodyImage(userId: string, params: z.infer<typeof DeleteUserBodyImageSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM user_body_images WHERE id = $1 AND user_id = $2`,
      [params.imageId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Body image not found or access denied' });
    }

    // Note: In production, you might want to also delete the file from R2 storage
    await query(
      `DELETE FROM user_body_images WHERE id = $1 AND user_id = $2`,
      [params.imageId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Body image deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting body image', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete body image',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all body images
 */
async function deleteAllUserBodyImages(userId: string, params: z.infer<typeof DeleteAllUserBodyImagesSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all body images.' 
      });
    }

    let sqlQuery = `DELETE FROM user_body_images WHERE user_id = $1`;
    const queryParams: string[] = [userId];
    let paramIndex = 2;

    if (params.imageType) {
      sqlQuery += ` AND image_type = $${paramIndex}`;
      queryParams.push(params.imageType);
      paramIndex++;
    }

    if (params.captureContext) {
      sqlQuery += ` AND capture_context = $${paramIndex}`;
      queryParams.push(params.captureContext);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} body image(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all body images', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete body images',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// WORKOUT LOGS CRUD (ENHANCEMENTS)
// ============================================

/**
 * Get workout log by ID
 */
async function getWorkoutLogById(userId: string, params: z.infer<typeof GetWorkoutLogByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM workout_logs WHERE id = $1 AND user_id = $2`,
      [params.logId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Workout log not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      workoutPlanId: row.workout_plan_id,
      scheduledDate: row.scheduled_date,
      workoutName: row.workout_name,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMinutes: row.duration_minutes,
      status: row.status,
      exercisesCompleted: row.exercises_completed,
      difficultyRating: row.difficulty_rating,
      energyLevel: row.energy_level,
      moodAfter: row.mood_after,
      notes: row.notes,
    };

    return JSON.stringify({ success: true, log: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting workout log by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve workout log' });
  }
}

/**
 * Get workout log by date
 */
async function getWorkoutLogByDate(userId: string, params: z.infer<typeof GetWorkoutLogByDateSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM workout_logs WHERE user_id = $1 AND scheduled_date = $2 ORDER BY scheduled_date DESC`,
      [userId, params.date]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No workout logs found for this date', logs: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      workoutName: row.workout_name,
      scheduledDate: row.scheduled_date,
      status: row.status,
      durationMinutes: row.duration_minutes,
      difficultyRating: row.difficulty_rating,
      moodAfter: row.mood_after,
    }));

    return JSON.stringify({ logs: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting workout log by date', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve workout logs' });
  }
}

/**
 * Create workout log
 */
async function createWorkoutLog(userId: string, params: z.infer<typeof CreateWorkoutLogSchema>): Promise<string> {
  try {
    // Verify workout plan ownership if provided
    if (params.workoutPlanId) {
      const planCheck = await query(
        `SELECT id FROM workout_plans WHERE id = $1 AND user_id = $2`,
        [params.workoutPlanId, userId]
      );

      if (planCheck.rows.length === 0) {
        return JSON.stringify({ success: false, error: 'Workout plan not found or access denied' });
      }
    }

    const result = await query<{ id: string }>(
      `INSERT INTO workout_logs (
        user_id, workout_plan_id, scheduled_date, scheduled_day_of_week, workout_name,
        started_at, completed_at, duration_minutes, status, exercises_completed,
        difficulty_rating, energy_level, mood_after, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id`,
      [
        userId,
        params.workoutPlanId || null,
        params.scheduledDate,
        params.scheduledDayOfWeek || null,
        params.workoutName || null,
        params.startedAt ? new Date(params.startedAt) : null,
        params.completedAt ? new Date(params.completedAt) : null,
        params.durationMinutes || null,
        params.status || 'pending',
        params.exercisesCompleted ? JSON.stringify(params.exercisesCompleted) : '[]',
        params.difficultyRating || null,
        params.energyLevel || null,
        params.moodAfter || null,
        params.notes || null,
      ]
    );

    return JSON.stringify({
      success: true,
      message: 'Workout log created successfully',
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating workout log', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create workout log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update workout log
 */
async function updateWorkoutLog(userId: string, params: z.infer<typeof UpdateWorkoutLogSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM workout_logs WHERE id = $1 AND user_id = $2`,
      [params.logId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Workout log not found or access denied' });
    }

    const fieldMapping: Record<string, string> = {
      status: 'status',
      durationMinutes: 'duration_minutes',
      difficultyRating: 'difficulty_rating',
      energyLevel: 'energy_level',
      moodAfter: 'mood_after',
      notes: 'notes',
    };

    const setClauses: string[] = [];
    const values: (string | number | Date | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      if (key === 'logId') continue;
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        if (key === 'exercisesCompleted') {
          setClauses.push(`exercises_completed = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else if (key === 'startedAt' || key === 'completedAt') {
          setClauses.push(`${key === 'startedAt' ? 'started_at' : 'completed_at'} = $${paramIndex}`);
          values.push(new Date(value as string));
        } else {
          setClauses.push(`${dbField} = $${paramIndex}`);
          values.push(value as string | number);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE workout_logs SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.logId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Workout log updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating workout log', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update workout log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete workout log
 */
async function deleteWorkoutLog(userId: string, params: z.infer<typeof DeleteWorkoutLogSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM workout_logs WHERE id = $1 AND user_id = $2`,
      [params.logId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Workout log not found or access denied' });
    }

    await query(
      `DELETE FROM workout_logs WHERE id = $1 AND user_id = $2`,
      [params.logId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Workout log deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting workout log', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete workout log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all workout logs
 */
async function deleteAllWorkoutLogs(userId: string, params: z.infer<typeof DeleteAllWorkoutLogsSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all workout logs.' 
      });
    }

    let sqlQuery = `DELETE FROM workout_logs WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params.planId) {
      sqlQuery += ` AND workout_plan_id = $${paramIndex}`;
      queryParams.push(params.planId);
      paramIndex++;
    }

    if (params.startDate) {
      sqlQuery += ` AND scheduled_date >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params.endDate) {
      sqlQuery += ` AND scheduled_date <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} workout log(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all workout logs', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete workout logs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update all workout logs
 */
async function updateAllWorkoutLogs(userId: string, params: z.infer<typeof UpdateAllWorkoutLogsSchema>): Promise<string> {
  try {
    let sqlQuery = `UPDATE workout_logs SET `;
    const setClauses: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (params.updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(params.updates.status);
      paramIndex++;
    }

    if (params.updates.difficultyRating !== undefined) {
      setClauses.push(`difficulty_rating = $${paramIndex}`);
      values.push(params.updates.difficultyRating);
      paramIndex++;
    }

    if (params.updates.energyLevel !== undefined) {
      setClauses.push(`energy_level = $${paramIndex}`);
      values.push(params.updates.energyLevel);
      paramIndex++;
    }

    if (params.updates.moodAfter !== undefined) {
      setClauses.push(`mood_after = $${paramIndex}`);
      values.push(params.updates.moodAfter);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    sqlQuery += setClauses.join(', ');

    sqlQuery += ` WHERE user_id = $${paramIndex}`;
    values.push(userId);
    paramIndex++;

    if (params.filter) {
      if (params.filter.planId) {
        sqlQuery += ` AND workout_plan_id = $${paramIndex}`;
        values.push(params.filter.planId);
        paramIndex++;
      }
      if (params.filter.startDate) {
        sqlQuery += ` AND scheduled_date >= $${paramIndex}`;
        values.push(params.filter.startDate);
        paramIndex++;
      }
      if (params.filter.endDate) {
        sqlQuery += ` AND scheduled_date <= $${paramIndex}`;
        values.push(params.filter.endDate);
        paramIndex++;
      }
      if (params.filter.status) {
        sqlQuery += ` AND status = $${paramIndex}`;
        values.push(params.filter.status);
        paramIndex++;
      }
    }

    const result = await query(sqlQuery, values);

    return JSON.stringify({
      success: true,
      message: `Updated ${result.rowCount || 0} workout log(s)`,
      updatedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating all workout logs', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update workout logs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// PROGRESS RECORDS CRUD (ENHANCEMENTS)
// ============================================

/**
 * Get progress record by ID
 */
async function getProgressRecordById(userId: string, params: z.infer<typeof GetProgressRecordByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM progress_records WHERE id = $1 AND user_id = $2`,
      [params.recordId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Progress record not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      recordDate: row.record_date,
      recordType: row.record_type,
      value: row.value,
      photoKeys: row.photo_keys || [],
      source: row.source,
      sourceDevice: row.source_device,
      notes: row.notes,
    };

    return JSON.stringify({ success: true, record: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting progress record by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve progress record' });
  }
}

/**
 * Get progress record by date
 */
async function getProgressRecordByDate(userId: string, params: z.infer<typeof GetProgressRecordByDateSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM progress_records WHERE user_id = $1 AND record_date = $2`;
    const queryParams: (string | Date)[] = [userId, params.date];
    let paramIndex = 3;

    if (params.recordType) {
      sqlQuery += ` AND record_type = $${paramIndex}`;
      queryParams.push(params.recordType);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY record_date DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No progress records found for this date', records: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      recordType: row.record_type,
      recordDate: row.record_date,
      value: row.value,
      source: row.source,
    }));

    return JSON.stringify({ records: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting progress record by date', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve progress records' });
  }
}

/**
 * Create progress record
 */
async function createProgressRecord(userId: string, params: z.infer<typeof CreateProgressRecordSchema>): Promise<string> {
  try {
    // Check if record already exists for this date and type
    const existing = await query(
      `SELECT id FROM progress_records WHERE user_id = $1 AND record_date = $2 AND record_type = $3`,
      [userId, params.recordDate, params.recordType]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await query<{ id: string }>(
        `UPDATE progress_records SET value = $1, photo_keys = $2, source = $3, source_device = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id`,
        [
          JSON.stringify(params.value),
          params.photoKeys || [],
          params.source || 'manual',
          params.sourceDevice || null,
          params.notes || null,
          existing.rows[0].id,
        ]
      );
    } else {
      // Create new
      result = await query<{ id: string }>(
        `INSERT INTO progress_records (
          user_id, record_date, record_type, value, photo_keys, source, source_device, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          userId,
          params.recordDate,
          params.recordType,
          JSON.stringify(params.value),
          params.photoKeys || [],
          params.source || 'manual',
          params.sourceDevice || null,
          params.notes || null,
        ]
      );
    }

    // Enqueue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'progress_record',
      sourceId: result.rows[0].id,
      operation: existing.rows.length > 0 ? 'update' : 'create',
      priority: JobPriorities.MEDIUM,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: existing.rows.length > 0 ? 'Progress record updated successfully' : 'Progress record created successfully',
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating progress record', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create progress record',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update progress record
 */
async function updateProgressRecord(userId: string, params: z.infer<typeof UpdateProgressRecordSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM progress_records WHERE id = $1 AND user_id = $2`,
      [params.recordId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Progress record not found or access denied' });
    }

    const setClauses: string[] = [];
    const values: (string | object | string[])[] = [];
    let paramIndex = 1;

    if (params.value !== undefined) {
      setClauses.push(`value = $${paramIndex}`);
      values.push(JSON.stringify(params.value));
      paramIndex++;
    }

    if (params.photoKeys !== undefined) {
      setClauses.push(`photo_keys = $${paramIndex}`);
      values.push(params.photoKeys);
      paramIndex++;
    }

    if (params.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex}`);
      values.push(params.notes);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE progress_records SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.recordId, userId]
    );

    // Enqueue embedding update
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'progress_record',
      sourceId: params.recordId,
      operation: 'update',
      priority: JobPriorities.MEDIUM,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding', { error: err });
    });

    return JSON.stringify({
      success: true,
      message: 'Progress record updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating progress record', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update progress record',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete progress record
 */
async function deleteProgressRecord(userId: string, params: z.infer<typeof DeleteProgressRecordSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM progress_records WHERE id = $1 AND user_id = $2`,
      [params.recordId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Progress record not found or access denied' });
    }

    // Enqueue embedding deletion
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'progress_record',
      sourceId: params.recordId,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding deletion', { error: err });
    });

    await query(
      `DELETE FROM progress_records WHERE id = $1 AND user_id = $2`,
      [params.recordId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Progress record deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting progress record', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete progress record',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all progress records
 */
async function deleteAllProgressRecords(userId: string, params: z.infer<typeof DeleteAllProgressRecordsSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all progress records.' 
      });
    }

    let sqlQuery = `DELETE FROM progress_records WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params.recordType) {
      sqlQuery += ` AND record_type = $${paramIndex}`;
      queryParams.push(params.recordType);
      paramIndex++;
    }

    if (params.startDate) {
      sqlQuery += ` AND record_date >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params.endDate) {
      sqlQuery += ` AND record_date <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} progress record(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all progress records', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete progress records',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update all progress records
 */
async function updateAllProgressRecords(userId: string, params: z.infer<typeof UpdateAllProgressRecordsSchema>): Promise<string> {
  try {
    let sqlQuery = `UPDATE progress_records SET `;
    const setClauses: string[] = [];
    const values: string[] = [];
    let paramIndex = 1;

    if (params.updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex}`);
      values.push(params.updates.notes);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    sqlQuery += setClauses.join(', ');

    sqlQuery += ` WHERE user_id = $${paramIndex}`;
    values.push(userId);
    paramIndex++;

    if (params.filter) {
      if (params.filter.recordType) {
        sqlQuery += ` AND record_type = $${paramIndex}`;
        values.push(params.filter.recordType);
        paramIndex++;
      }
      if (params.filter.startDate) {
        sqlQuery += ` AND record_date >= $${paramIndex}`;
        values.push(params.filter.startDate);
        paramIndex++;
      }
      if (params.filter.endDate) {
        sqlQuery += ` AND record_date <= $${paramIndex}`;
        values.push(params.filter.endDate);
        paramIndex++;
      }
    }

    const result = await query(sqlQuery, values);

    return JSON.stringify({
      success: true,
      message: `Updated ${result.rowCount || 0} progress record(s)`,
      updatedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating all progress records', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update progress records',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// WATER INTAKE LOGS CRUD
// ============================================

/**
 * Get water intake logs
 */
async function getWaterIntakeLogs(userId: string, params?: z.infer<typeof GetWaterIntakeLogsSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM water_intake_logs WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params?.date) {
      sqlQuery += ` AND log_date = $${paramIndex}`;
      queryParams.push(params.date);
      paramIndex++;
    } else if (params?.startDate && params?.endDate) {
      sqlQuery += ` AND log_date >= $${paramIndex} AND log_date <= $${paramIndex + 1}`;
      queryParams.push(params.startDate, params.endDate);
      paramIndex += 2;
    } else if (!params?.date && !params?.startDate) {
      // Default to today
      sqlQuery += ` AND log_date = CURRENT_DATE`;
    }

    sqlQuery += ` ORDER BY log_date DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No water intake logs found', logs: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      logDate: row.log_date,
      glassesConsumed: row.glasses_consumed,
      mlConsumed: row.ml_consumed,
      targetGlasses: row.target_glasses,
      targetMl: row.target_ml,
      goalAchieved: row.goal_achieved,
      entries: row.entries || [],
    }));

    return JSON.stringify({ logs: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting water intake logs', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve water intake logs' });
  }
}

/**
 * Get water intake log by date
 */
async function getWaterIntakeLogByDate(userId: string, params: z.infer<typeof GetWaterIntakeLogByDateSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM water_intake_logs WHERE user_id = $1 AND log_date = $2`,
      [userId, params.date]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No water intake log found for this date', log: null });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      logDate: row.log_date,
      glassesConsumed: row.glasses_consumed,
      mlConsumed: row.ml_consumed,
      targetGlasses: row.target_glasses,
      targetMl: row.target_ml,
      goalAchieved: row.goal_achieved,
      entries: row.entries || [],
    };

    return JSON.stringify({ log: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting water intake log by date', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve water intake log' });
  }
}

/**
 * Create or update water intake log
 */
async function createWaterIntakeLog(userId: string, params: z.infer<typeof CreateWaterIntakeLogSchema>): Promise<string> {
  try {
    const logDate = params.logDate || new Date().toISOString().split('T')[0];

    // Check if log already exists
    const existing = await query(
      `SELECT id FROM water_intake_logs WHERE user_id = $1 AND log_date = $2`,
      [userId, logDate]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      const setClauses: string[] = [];
      const values: (number | object | string)[] = [];
      let paramIndex = 1;

      if (params.glassesConsumed !== undefined) {
        setClauses.push(`glasses_consumed = $${paramIndex}`);
        values.push(params.glassesConsumed);
        paramIndex++;
      }

      if (params.mlConsumed !== undefined) {
        setClauses.push(`ml_consumed = $${paramIndex}`);
        values.push(params.mlConsumed);
        paramIndex++;
      }

      if (params.targetGlasses !== undefined) {
        setClauses.push(`target_glasses = $${paramIndex}`);
        values.push(params.targetGlasses);
        paramIndex++;
      }

      if (params.targetMl !== undefined) {
        setClauses.push(`target_ml = $${paramIndex}`);
        values.push(params.targetMl);
        paramIndex++;
      }

      if (params.entries !== undefined) {
        setClauses.push(`entries = $${paramIndex}`);
        values.push(JSON.stringify(params.entries));
        paramIndex++;
      }

      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

      result = await query<{ id: string }>(
        `UPDATE water_intake_logs SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id`,
        [...values, existing.rows[0].id]
      );
    } else {
      // Create new
      result = await query<{ id: string }>(
        `INSERT INTO water_intake_logs (
          user_id, log_date, glasses_consumed, ml_consumed, target_glasses, target_ml, entries
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          userId,
          logDate,
          params.glassesConsumed || 0,
          params.mlConsumed || 0,
          params.targetGlasses || 8,
          params.targetMl || 2000,
          params.entries ? JSON.stringify(params.entries) : '[]',
        ]
      );
    }

    return JSON.stringify({
      success: true,
      message: existing.rows.length > 0 ? 'Water intake log updated successfully' : 'Water intake log created successfully',
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating water intake log', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create water intake log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update water intake log
 */
async function updateWaterIntakeLog(userId: string, params: z.infer<typeof UpdateWaterIntakeLogSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM water_intake_logs WHERE user_id = $1 AND log_date = $2`,
      [userId, params.logDate]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Water intake log not found' });
    }

    const setClauses: string[] = [];
    const values: (number | object | string)[] = [];
    let paramIndex = 1;

    if (params.glassesConsumed !== undefined) {
      setClauses.push(`glasses_consumed = $${paramIndex}`);
      values.push(params.glassesConsumed);
      paramIndex++;
    }

    if (params.mlConsumed !== undefined) {
      setClauses.push(`ml_consumed = $${paramIndex}`);
      values.push(params.mlConsumed);
      paramIndex++;
    }

    if (params.targetGlasses !== undefined) {
      setClauses.push(`target_glasses = $${paramIndex}`);
      values.push(params.targetGlasses);
      paramIndex++;
    }

    if (params.targetMl !== undefined) {
      setClauses.push(`target_ml = $${paramIndex}`);
      values.push(params.targetMl);
      paramIndex++;
    }

    if (params.entries !== undefined) {
      setClauses.push(`entries = $${paramIndex}`);
      values.push(JSON.stringify(params.entries) as string);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE water_intake_logs SET ${setClauses.join(', ')}
       WHERE user_id = $${paramIndex} AND log_date = $${paramIndex + 1}`,
      [...values, userId, params.logDate]
    );

    return JSON.stringify({
      success: true,
      message: 'Water intake log updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating water intake log', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update water intake log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Add water entry
 */
async function addWaterEntry(userId: string, params: z.infer<typeof AddWaterEntrySchema>): Promise<string> {
  try {
    const date = params.date || new Date().toISOString().split('T')[0];
    const amountMl = params.amountMl;
    const time = params.time || new Date().toTimeString().slice(0, 5);

    // Get or create log for the date
    let logResult = await query(
      `SELECT * FROM water_intake_logs WHERE user_id = $1 AND log_date = $2`,
      [userId, date]
    );

    if (logResult.rows.length === 0) {
      // Create new log
      await query(
        `INSERT INTO water_intake_logs (user_id, log_date, glasses_consumed, ml_consumed, entries)
         VALUES ($1, $2, 0, 0, '[]')`,
        [userId, date]
      );
      logResult = await query(
        `SELECT * FROM water_intake_logs WHERE user_id = $1 AND log_date = $2`,
        [userId, date]
      );
    }

    const log = logResult.rows[0];
    const entries = log.entries || [];
    const newEntry = {
      time,
      amountMl,
      type: params.type || 'water',
    };
    entries.push(newEntry);

    const newMlConsumed = (log.ml_consumed || 0) + amountMl;
    const newGlassesConsumed = Math.floor(newMlConsumed / 250);

    await query(
      `UPDATE water_intake_logs 
       SET ml_consumed = $1, glasses_consumed = $2, entries = $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4 AND log_date = $5`,
      [newMlConsumed, newGlassesConsumed, JSON.stringify(entries), userId, date]
    );

    return JSON.stringify({
      success: true,
      message: 'Water entry added successfully',
      data: { mlConsumed: newMlConsumed, glassesConsumed: newGlassesConsumed },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error adding water entry', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to add water entry',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete water intake log
 */
async function deleteWaterIntakeLog(userId: string, params: z.infer<typeof DeleteWaterIntakeLogSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM water_intake_logs WHERE user_id = $1 AND log_date = $2`,
      [userId, params.logDate]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Water intake log not found' });
    }

    await query(
      `DELETE FROM water_intake_logs WHERE user_id = $1 AND log_date = $2`,
      [userId, params.logDate]
    );

    return JSON.stringify({
      success: true,
      message: 'Water intake log deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting water intake log', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete water intake log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all water intake logs
 */
async function deleteAllWaterIntakeLogs(userId: string, params: z.infer<typeof DeleteAllWaterIntakeLogsSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all water intake logs.' 
      });
    }

    let sqlQuery = `DELETE FROM water_intake_logs WHERE user_id = $1`;
    const queryParams: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (params.startDate) {
      sqlQuery += ` AND log_date >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params.endDate) {
      sqlQuery += ` AND log_date <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} water intake log(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all water intake logs', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete water intake logs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// SHOPPING LIST ITEMS CRUD
// ============================================

/**
 * Get shopping list items
 */
async function getShoppingListItems(userId: string, params?: z.infer<typeof GetShoppingListItemsSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM shopping_list_items WHERE user_id = $1`;
    const queryParams: (string | boolean)[] = [userId];
    let paramIndex = 2;

    if (params?.category) {
      sqlQuery += ` AND category = $${paramIndex}`;
      queryParams.push(params.category);
      paramIndex++;
    }

    if (params?.isPurchased !== undefined) {
      sqlQuery += ` AND is_purchased = $${paramIndex}`;
      queryParams.push(params.isPurchased);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY priority DESC, created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No shopping list items found', items: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      category: row.category,
      notes: row.notes,
      calories: row.calories,
      source: row.source,
      isPurchased: row.is_purchased,
      purchasedAt: row.purchased_at,
      priority: row.priority,
    }));

    return JSON.stringify({ items: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting shopping list items', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve shopping list items' });
  }
}

/**
 * Get shopping list item by ID
 */
async function getShoppingListItemById(userId: string, params: z.infer<typeof GetShoppingListItemByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM shopping_list_items WHERE id = $1 AND user_id = $2`,
      [params.itemId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Shopping list item not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      category: row.category,
      notes: row.notes,
      calories: row.calories,
      source: row.source,
      isPurchased: row.is_purchased,
      purchasedAt: row.purchased_at,
      priority: row.priority,
    };

    return JSON.stringify({ success: true, item: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting shopping list item by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve shopping list item' });
  }
}

/**
 * Get shopping list item by name
 */
async function getShoppingListItemByName(userId: string, params: z.infer<typeof GetShoppingListItemByNameSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM shopping_list_items WHERE user_id = $1`;
    const queryParams: string[] = [userId];

    if (params.exactMatch) {
      sqlQuery += ` AND LOWER(name) = LOWER($2)`;
      queryParams.push(params.name);
    } else {
      sqlQuery += ` AND LOWER(name) LIKE LOWER($2)`;
      queryParams.push(`%${params.name}%`);
    }

    sqlQuery += ` ORDER BY priority DESC, created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No shopping list items found', items: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      category: row.category,
      isPurchased: row.is_purchased,
    }));

    return JSON.stringify({ items: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting shopping list item by name', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve shopping list items' });
  }
}

/**
 * Create shopping list item
 */
async function createShoppingListItem(userId: string, params: z.infer<typeof CreateShoppingListItemSchema>): Promise<string> {
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO shopping_list_items (
        user_id, name, quantity, category, notes, calories, source, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        userId,
        params.name,
        params.quantity || null,
        params.category || 'other',
        params.notes || null,
        params.calories !== undefined ? params.calories : null,
        params.source || 'manual',
        params.priority || 0,
      ]
    );

    return JSON.stringify({
      success: true,
      message: 'Shopping list item created successfully',
      data: { id: result.rows[0].id, name: params.name, calories: params.calories || null },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating shopping list item', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create shopping list item',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update shopping list item
 */
async function updateShoppingListItem(userId: string, params: z.infer<typeof UpdateShoppingListItemSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM shopping_list_items WHERE id = $1 AND user_id = $2`,
      [params.itemId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Shopping list item not found or access denied' });
    }

    const fieldMapping: Record<string, string> = {
      name: 'name',
      quantity: 'quantity',
      category: 'category',
      notes: 'notes',
      calories: 'calories',
      isPurchased: 'is_purchased',
      priority: 'priority',
    };

    const setClauses: string[] = [];
    const values: (string | number | boolean | Date)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      if (key === 'itemId') continue;
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value as string | number | boolean);
        if (key === 'isPurchased' && value === true) {
          setClauses.push(`purchased_at = CURRENT_TIMESTAMP`);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE shopping_list_items SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.itemId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Shopping list item updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating shopping list item', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update shopping list item',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete shopping list item
 */
async function deleteShoppingListItem(userId: string, params: z.infer<typeof DeleteShoppingListItemSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM shopping_list_items WHERE id = $1 AND user_id = $2`,
      [params.itemId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Shopping list item not found or access denied' });
    }

    await query(
      `DELETE FROM shopping_list_items WHERE id = $1 AND user_id = $2`,
      [params.itemId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Shopping list item deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting shopping list item', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete shopping list item',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete shopping list item by name
 */
async function deleteShoppingListItemByName(userId: string, params: z.infer<typeof DeleteShoppingListItemByNameSchema>): Promise<string> {
  try {
    let sqlQuery = `DELETE FROM shopping_list_items WHERE user_id = $1`;
    const queryParams: string[] = [userId];

    if (params.exactMatch) {
      sqlQuery += ` AND LOWER(name) = LOWER($2)`;
      queryParams.push(params.name);
    } else {
      sqlQuery += ` AND LOWER(name) LIKE LOWER($2)`;
      queryParams.push(`%${params.name}%`);
    }

    const result = await query(sqlQuery, queryParams);

    if (result.rowCount === 0) {
      return JSON.stringify({ success: false, error: 'Shopping list item not found' });
    }

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} shopping list item(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting shopping list item by name', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete shopping list item',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all shopping list items
 */
async function deleteAllShoppingListItems(userId: string, params: z.infer<typeof DeleteAllShoppingListItemsSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all shopping list items.' 
      });
    }

    let sqlQuery = `DELETE FROM shopping_list_items WHERE user_id = $1`;
    const queryParams: (string | boolean)[] = [userId];
    let paramIndex = 2;

    if (params.category) {
      sqlQuery += ` AND category = $${paramIndex}`;
      queryParams.push(params.category);
      paramIndex++;
    }

    if (params.isPurchased !== undefined) {
      sqlQuery += ` AND is_purchased = $${paramIndex}`;
      queryParams.push(params.isPurchased);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} shopping list item(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all shopping list items', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete shopping list items',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update all shopping list items
 */
async function updateAllShoppingListItems(userId: string, params: z.infer<typeof UpdateAllShoppingListItemsSchema>): Promise<string> {
  try {
    let sqlQuery = `UPDATE shopping_list_items SET `;
    const setClauses: string[] = [];
    const values: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (params.updates.isPurchased !== undefined) {
      setClauses.push(`is_purchased = $${paramIndex}`);
      values.push(params.updates.isPurchased);
      if (params.updates.isPurchased) {
        setClauses.push(`purchased_at = CURRENT_TIMESTAMP`);
      }
      paramIndex++;
    }

    if (params.updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex}`);
      values.push(params.updates.category);
      paramIndex++;
    }

    if (params.updates.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex}`);
      values.push(params.updates.priority);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    sqlQuery += setClauses.join(', ');

    sqlQuery += ` WHERE user_id = $${paramIndex}`;
    values.push(userId);
    paramIndex++;

    if (params.filter) {
      if (params.filter.category) {
        sqlQuery += ` AND category = $${paramIndex}`;
        values.push(params.filter.category);
        paramIndex++;
      }
      if (params.filter.isPurchased !== undefined) {
        sqlQuery += ` AND is_purchased = $${paramIndex}`;
        values.push(params.filter.isPurchased);
        paramIndex++;
      }
    }

    const result = await query(sqlQuery, values);

    return JSON.stringify({
      success: true,
      message: `Updated ${result.rowCount || 0} shopping list item(s)`,
      updatedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating all shopping list items', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update shopping list items',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// SCHEDULED REMINDERS CRUD
// ============================================

/**
 * Get scheduled reminders
 */
async function getScheduledReminders(userId: string, params?: z.infer<typeof GetScheduledRemindersSchema>): Promise<string> {
  try {
    let sqlQuery = `SELECT * FROM scheduled_reminders WHERE user_id = $1`;
    const queryParams: (string | boolean)[] = [userId];
    let paramIndex = 2;

    if (params?.reminderType) {
      sqlQuery += ` AND reminder_type = $${paramIndex}`;
      queryParams.push(params.reminderType);
      paramIndex++;
    }

    if (params?.isEnabled !== undefined) {
      sqlQuery += ` AND is_enabled = $${paramIndex}`;
      queryParams.push(params.isEnabled);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY reminder_time ASC, created_at DESC`;

    const result = await query(sqlQuery, queryParams);

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No reminders found', reminders: [] });
    }

    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      reminderType: row.reminder_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      title: row.title,
      message: row.message,
      reminderTime: row.reminder_time,
      daysOfWeek: row.days_of_week,
      isEnabled: row.is_enabled,
      nextTriggerAt: row.next_trigger_at,
    }));

    return JSON.stringify({ reminders: formatted, count: formatted.length }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting reminders', { userId, error });
    return JSON.stringify({ error: 'Failed to retrieve reminders' });
  }
}

/**
 * Get scheduled reminder by ID
 */
async function getScheduledReminderById(userId: string, params: z.infer<typeof GetScheduledReminderByIdSchema>): Promise<string> {
  try {
    const result = await query(
      `SELECT * FROM scheduled_reminders WHERE id = $1 AND user_id = $2`,
      [params.reminderId, userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Reminder not found or access denied' });
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      reminderType: row.reminder_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      title: row.title,
      message: row.message,
      reminderTime: row.reminder_time,
      daysOfWeek: row.days_of_week,
      timezone: row.timezone,
      notificationChannels: row.notification_channels,
      isEnabled: row.is_enabled,
      nextTriggerAt: row.next_trigger_at,
      metadata: row.metadata,
    };

    return JSON.stringify({ success: true, reminder: formatted }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting reminder by ID', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve reminder' });
  }
}

/**
 * Create scheduled reminder
 */
async function createScheduledReminder(userId: string, params: z.infer<typeof CreateScheduledReminderSchema>): Promise<string> {
  try {
    // Verify source ownership if sourceId provided
    if (params.sourceId && params.sourceType) {
      if (params.sourceType === 'diet_plan') {
        const check = await query(
          `SELECT id FROM diet_plans WHERE id = $1 AND user_id = $2`,
          [params.sourceId, userId]
        );
        if (check.rows.length === 0) {
          return JSON.stringify({ success: false, error: 'Diet plan not found or access denied' });
        }
      } else if (params.sourceType === 'workout_plan') {
        const check = await query(
          `SELECT id FROM workout_plans WHERE id = $1 AND user_id = $2`,
          [params.sourceId, userId]
        );
        if (check.rows.length === 0) {
          return JSON.stringify({ success: false, error: 'Workout plan not found or access denied' });
        }
      }
    }

    const result = await query<{ id: string }>(
      `INSERT INTO scheduled_reminders (
        user_id, reminder_type, source_type, source_id, title, message, icon,
        reminder_time, days_of_week, timezone, notification_channels,
        advance_minutes, repeat_if_missed, snooze_minutes, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        userId,
        params.reminderType,
        params.sourceType || null,
        params.sourceId || null,
        params.title,
        params.message || null,
        params.icon || null,
        params.reminderTime,
        params.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
        params.timezone || 'UTC',
        params.notificationChannels || ['push'],
        params.advanceMinutes || 0,
        params.repeatIfMissed || false,
        params.snoozeMinutes || 10,
        params.metadata ? JSON.stringify(params.metadata) : '{}',
      ]
    );

    return JSON.stringify({
      success: true,
      message: 'Reminder created successfully',
      data: { id: result.rows[0].id },
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error creating reminder', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to create reminder',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update scheduled reminder
 */
async function updateScheduledReminder(userId: string, params: z.infer<typeof UpdateScheduledReminderSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM scheduled_reminders WHERE id = $1 AND user_id = $2`,
      [params.reminderId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Reminder not found or access denied' });
    }

    const fieldMapping: Record<string, string> = {
      title: 'title',
      message: 'message',
      reminderTime: 'reminder_time',
      isEnabled: 'is_enabled',
      advanceMinutes: 'advance_minutes',
      snoozeMinutes: 'snooze_minutes',
    };

    const setClauses: string[] = [];
    const values: (string | number | boolean | number[] | string[])[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(params)) {
      if (key === 'reminderId') continue;
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        if (key === 'daysOfWeek') {
          setClauses.push(`days_of_week = $${paramIndex}`);
          values.push(value as number[]);
        } else if (key === 'notificationChannels') {
          setClauses.push(`notification_channels = $${paramIndex}`);
          values.push(value as string[]);
        } else {
          setClauses.push(`${dbField} = $${paramIndex}`);
          values.push(value as string | number | boolean);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return JSON.stringify({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    await query(
      `UPDATE scheduled_reminders SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      [...values, params.reminderId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Reminder updated successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating reminder', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to update reminder',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete scheduled reminder
 */
async function deleteScheduledReminder(userId: string, params: z.infer<typeof DeleteScheduledReminderSchema>): Promise<string> {
  try {
    // Verify ownership
    const existing = await query(
      `SELECT * FROM scheduled_reminders WHERE id = $1 AND user_id = $2`,
      [params.reminderId, userId]
    );

    if (existing.rows.length === 0) {
      return JSON.stringify({ success: false, error: 'Reminder not found or access denied' });
    }

    await query(
      `DELETE FROM scheduled_reminders WHERE id = $1 AND user_id = $2`,
      [params.reminderId, userId]
    );

    return JSON.stringify({
      success: true,
      message: 'Reminder deleted successfully',
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting reminder', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete reminder',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete all scheduled reminders
 */
async function deleteAllScheduledReminders(userId: string, params: z.infer<typeof DeleteAllScheduledRemindersSchema>): Promise<string> {
  try {
    if (!params.confirm) {
      return JSON.stringify({ 
        success: false, 
        error: 'Confirmation required. Set confirm to true to delete all reminders.' 
      });
    }

    let sqlQuery = `DELETE FROM scheduled_reminders WHERE user_id = $1`;
    const queryParams: (string | boolean)[] = [userId];
    let paramIndex = 2;

    if (params.reminderType) {
      sqlQuery += ` AND reminder_type = $${paramIndex}`;
      queryParams.push(params.reminderType);
      paramIndex++;
    }

    if (params.isEnabled !== undefined) {
      sqlQuery += ` AND is_enabled = $${paramIndex}`;
      queryParams.push(params.isEnabled);
      paramIndex++;
    }

    const result = await query(sqlQuery, queryParams);

    return JSON.stringify({
      success: true,
      message: `Deleted ${result.rowCount || 0} reminder(s)`,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting all reminders', { userId, error });
    return JSON.stringify({
      success: false,
      error: 'Failed to delete reminders',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// WORKOUT RESCHEDULE IMPLEMENTATIONS
// ============================================

/**
 * Check workout progress and detect missed tasks
 */
async function checkWorkoutProgress(userId: string, params?: z.infer<typeof CheckWorkoutProgressSchema>): Promise<string> {
  try {
    const { workoutAuditService } = await import('./workout-audit.service.js');
    const { workoutPlanService } = await import('./workout-plan.service.js');

    // Get active workout plans
    const plans = await workoutPlanService.getUserPlans(userId, 'active');
    
    if (plans.length === 0) {
      return JSON.stringify({ success: true, data: { missedTasks: [], message: 'No active workout plans found' } }, null, 2);
    }

    // If specific plan requested, filter
    let targetPlans = plans;
    if (params?.workoutPlanId) {
      targetPlans = plans.filter(p => p.id === params.workoutPlanId);
    }

    const allMissedTasks: Array<{ planId: string; planName: string; tasks: any[] }> = [];

    for (const plan of targetPlans) {
      const missedTasks = await workoutAuditService.getMissedTasks(userId, plan.id);
      if (missedTasks.length > 0) {
        allMissedTasks.push({
          planId: plan.id,
          planName: plan.name,
          tasks: missedTasks,
        });
      }
    }

    const totalMissed = allMissedTasks.reduce((sum, p) => sum + p.tasks.length, 0);

    return JSON.stringify({
      success: true,
      data: {
        missedTasks: allMissedTasks,
        totalMissed,
        message: totalMissed > 0 
          ? `Found ${totalMissed} missed workout(s). Would you like me to reschedule them?`
          : 'All workouts are on track!',
      },
    }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error checking workout progress', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to check workout progress' });
  }
}

/**
 * Reschedule missed workout tasks
 */
async function rescheduleWorkoutTasks(userId: string, params: z.infer<typeof RescheduleWorkoutTasksSchema>): Promise<string> {
  try {
    const { workoutRescheduleWorkflowService } = await import('./workout-reschedule-workflow.service.js');

    const result = await workoutRescheduleWorkflowService.executeRescheduleWorkflow(
      userId,
      params.workoutPlanId,
      params.policy || 'FILL_GAPS',
      'conversation'
    );

    if (result.success) {
      return JSON.stringify({
        success: true,
        data: {
          actions: result.actions,
          summary: result.summary,
          message: result.summary,
        },
      }, null, 2);
    } else {
      return JSON.stringify({
        success: false,
        error: result.summary,
        validationErrors: result.validationErrors,
      }, null, 2);
    }
  } catch (error) {
    logger.error('[LangGraphTools] Error rescheduling workout tasks', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to reschedule workout tasks' });
  }
}

// ============================================
// WELLBEING IMPLEMENTATIONS
// ============================================

/**
 * Get user mood logs
 */
async function getUserMoodLogs(userId: string, params?: z.infer<typeof GetUserMoodLogsSchema>): Promise<string> {
  try {
    const result = await moodService.getMoodLogs(userId, {
      startDate: params?.startDate,
      endDate: params?.endDate,
      page: params?.page,
      limit: params?.limit,
    });
    return JSON.stringify({ success: true, data: result }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting mood logs', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve mood logs' });
  }
}

/**
 * Create mood log
 */
async function createMoodLog(userId: string, params: z.infer<typeof CreateMoodLogSchema>): Promise<string> {
  try {
    const result = await moodService.createMoodLog(userId, {
      moodEmoji: params.moodEmoji as any,
      descriptor: params.descriptor,
      happinessRating: params.happinessRating,
      energyRating: params.energyRating,
      stressRating: params.stressRating,
      anxietyRating: params.anxietyRating,
      emotionTags: params.emotionTags as any,
      contextNote: params.contextNote,
      mode: params.mode,
      loggedAt: params.loggedAt,
    });
    
    // Queue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: result.id,
      operation: 'create',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, data: { moodLog: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error creating mood log', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to create mood log', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Update mood log
 */
async function updateMoodLog(userId: string, _params: z.infer<typeof UpdateMoodLogSchema>): Promise<string> {
  try {
    // Note: moodService doesn't have update method, so we'll need to add it or use direct query
    // For now, return error
    return JSON.stringify({ success: false, error: 'Update mood log not yet implemented' });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating mood log', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to update mood log' });
  }
}

/**
 * Delete mood log
 */
async function deleteMoodLog(userId: string, _params: z.infer<typeof DeleteMoodLogSchema>): Promise<string> {
  try {
    // Note: moodService doesn't have delete method, so we'll need to add it or use direct query
    // For now, return error
    return JSON.stringify({ success: false, error: 'Delete mood log not yet implemented' });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting mood log', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to delete mood log' });
  }
}

/**
 * Get mood timeline
 */
async function getMoodTimeline(userId: string, params: z.infer<typeof GetMoodTimelineSchema>): Promise<string> {
  try {
    const result = await moodService.getMoodTimeline(userId, params.startDate, params.endDate);
    return JSON.stringify({ success: true, data: { timeline: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting mood timeline', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve mood timeline' });
  }
}

/**
 * Get mood patterns
 */
async function getMoodPatterns(userId: string, params?: z.infer<typeof GetMoodPatternsSchema>): Promise<string> {
  try {
    const result = await moodService.getMoodPatterns(userId, params?.days);
    return JSON.stringify({ success: true, data: { patterns: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting mood patterns', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve mood patterns' });
  }
}

/**
 * Get user stress logs
 */
async function getUserStressLogs(userId: string, params?: z.infer<typeof GetUserStressLogsSchema>): Promise<string> {
  try {
    const result = await stressService.getStressLogs(userId, params?.startDate, params?.endDate);
    // Apply pagination manually if needed
    let logs = result;
    if (params?.page && params?.limit) {
      const start = (params.page - 1) * params.limit;
      const end = start + params.limit;
      logs = result.slice(start, end);
    }
    return JSON.stringify({ success: true, data: { logs, total: result.length, page: params?.page || 1, limit: params?.limit || 50 } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting stress logs', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve stress logs' });
  }
}

/**
 * Create stress log
 */
async function createStressLog(userId: string, params: z.infer<typeof CreateStressLogSchema>): Promise<string> {
  try {
    const result = await stressService.createStressLog(userId, {
      stressRating: params.stressRating,
      triggers: params.triggers as any,
      otherTrigger: params.otherTrigger,
      note: params.note,
      checkInType: params.checkInType,
      clientRequestId: params.clientRequestId,
      loggedAt: params.loggedAt,
    });
    
    // Queue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: result.id,
      operation: 'create',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, data: { stressLog: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error creating stress log', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to create stress log', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Update stress log
 */
async function updateStressLog(userId: string, _params: z.infer<typeof UpdateStressLogSchema>): Promise<string> {
  try {
    // Note: stressService doesn't have update method, so we'll need to add it or use direct query
    // For now, return error
    return JSON.stringify({ success: false, error: 'Update stress log not yet implemented' });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating stress log', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to update stress log' });
  }
}

/**
 * Delete stress log
 */
async function deleteStressLog(userId: string, _params: z.infer<typeof DeleteStressLogSchema>): Promise<string> {
  try {
    // Note: stressService doesn't have delete method, so we'll need to add it or use direct query
    // For now, return error
    return JSON.stringify({ success: false, error: 'Delete stress log not yet implemented' });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting stress log', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to delete stress log' });
  }
}

/**
 * Get stress trends
 */
async function getStressTrends(userId: string, params?: z.infer<typeof GetStressTrendsSchema>): Promise<string> {
  try {
    const days = params?.days || 30;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const result = await stressService.getMultiSignalStressPatterns(userId, startDateStr, endDate);
    return JSON.stringify({ success: true, data: result }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting stress trends', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve stress trends' });
  }
}

/**
 * Get user journal entries
 */
async function getUserJournalEntries(userId: string, params?: z.infer<typeof GetUserJournalEntriesSchema>): Promise<string> {
  try {
    const result = await journalService.getJournalEntries(userId, {
      startDate: params?.startDate,
      endDate: params?.endDate,
      page: params?.page,
      limit: params?.limit,
      category: params?.category as any,
    });
    return JSON.stringify({ success: true, data: result }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting journal entries', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve journal entries' });
  }
}

/**
 * Create journal entry
 */
async function createJournalEntry(userId: string, params: z.infer<typeof CreateJournalEntrySchema>): Promise<string> {
  try {
    const result = await journalService.createJournalEntry(userId, {
      prompt: params.prompt,
      promptCategory: params.promptCategory as any,
      promptId: params.promptId,
      entryText: params.entryText,
      mode: params.mode,
      voiceEntry: params.voiceEntry,
      durationSeconds: params.durationSeconds,
      loggedAt: params.loggedAt,
    });
    
    // Queue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: result.id,
      operation: 'create',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, data: { entry: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error creating journal entry', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to create journal entry', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Update journal entry
 */
async function updateJournalEntry(userId: string, params: z.infer<typeof UpdateJournalEntrySchema>): Promise<string> {
  try {
    const result = await journalService.updateJournalEntry(userId, params.entryId, {
      entryText: params.entryText,
      prompt: params.prompt,
      promptCategory: params.promptCategory as any,
    });
    
    // Queue embedding update
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: params.entryId,
      operation: 'update',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, data: { entry: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error updating journal entry', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to update journal entry' });
  }
}

/**
 * Delete journal entry
 */
async function deleteJournalEntry(userId: string, params: z.infer<typeof DeleteJournalEntrySchema>): Promise<string> {
  try {
    await journalService.deleteJournalEntry(userId, params.entryId);
    
    // Queue embedding deletion
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: params.entryId,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, message: 'Journal entry deleted successfully' }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting journal entry', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to delete journal entry' });
  }
}

/**
 * Get journal streak
 */
async function getJournalStreak(userId: string, _params?: z.infer<typeof GetJournalStreakSchema>): Promise<string> {
  try {
    const result = await journalService.getJournalStreak(userId);
    return JSON.stringify({ success: true, data: { streak: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting journal streak', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve journal streak' });
  }
}

/**
 * Create or update today's daily check-in
 */
async function createDailyCheckin(userId: string, params: z.infer<typeof CreateDailyCheckinSchema>): Promise<string> {
  try {
    const result = await dailyCheckinService.createOrUpdateCheckin(userId, {
      moodScore: params.moodScore,
      energyScore: params.energyScore,
      sleepQuality: params.sleepQuality,
      stressScore: params.stressScore,
      tags: params.tags as any,
      daySummary: params.daySummary,
    });
    return JSON.stringify({ success: true, data: { checkin: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error creating daily check-in', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to save daily check-in' });
  }
}

/**
 * Get today's daily check-in
 */
async function getTodayCheckin(userId: string, _params?: z.infer<typeof GetTodayCheckinSchema>): Promise<string> {
  try {
    const result = await dailyCheckinService.getTodayCheckin(userId);
    if (!result) {
      return JSON.stringify({ success: true, data: { checkin: null, message: 'No check-in yet today' } }, null, 2);
    }
    return JSON.stringify({ success: true, data: { checkin: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting today check-in', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to get today check-in' });
  }
}

/**
 * Get check-in history
 */
async function getCheckinHistory(userId: string, params?: z.infer<typeof GetCheckinHistorySchema>): Promise<string> {
  try {
    const result = await dailyCheckinService.getCheckinHistory(userId, {
      startDate: params?.startDate,
      endDate: params?.endDate,
      limit: params?.limit,
    });
    return JSON.stringify({ success: true, data: result }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting check-in history', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to get check-in history' });
  }
}

/**
 * Get check-in streak
 */
async function getCheckinStreak(userId: string, _params?: z.infer<typeof GetCheckinStreakSchema>): Promise<string> {
  try {
    const result = await dailyCheckinService.getCheckinStreak(userId);
    return JSON.stringify({ success: true, data: { streak: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting check-in streak', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to get check-in streak' });
  }
}

/**
 * Get journal insights — aggregated mood trends, entry frequency, top categories
 */
async function getJournalInsights(userId: string, params?: z.infer<typeof GetJournalInsightsSchema>): Promise<string> {
  try {
    const days = params?.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get entries for the period
    const entries = await journalService.getJournalEntries(userId, {
      startDate: startDateStr,
      limit: 200,
    });

    const entryList = entries.entries || [];
    const totalEntries = entryList.length;

    if (totalEntries === 0) {
      return JSON.stringify({
        success: true,
        data: {
          period: `Last ${days} days`,
          totalEntries: 0,
          message: 'No journal entries found for this period.',
        },
      }, null, 2);
    }

    // Sentiment distribution
    const sentiments = entryList
      .filter((e: any) => e.sentimentScore != null)
      .map((e: any) => e.sentimentScore as number);
    const avgSentiment = sentiments.length > 0
      ? Math.round((sentiments.reduce((a: number, b: number) => a + b, 0) / sentiments.length) * 100) / 100
      : null;

    // Word count stats
    const wordCounts = entryList.map((e: any) => e.wordCount || 0);
    const avgWordCount = Math.round(wordCounts.reduce((a: number, b: number) => a + b, 0) / totalEntries);

    // Top prompt categories
    const categoryCounts: Record<string, number> = {};
    for (const e of entryList) {
      const cat = (e as any).promptCategory || 'uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    // Entries per week
    const weekMap: Record<string, number> = {};
    for (const e of entryList) {
      const d = new Date((e as any).createdAt || (e as any).loggedAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weekMap[key] = (weekMap[key] || 0) + 1;
    }
    const entriesPerWeek = Object.entries(weekMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, count]) => ({ weekOf: week, count }));

    // Get streak info
    const streak = await journalService.getJournalStreak(userId);

    return JSON.stringify({
      success: true,
      data: {
        period: `Last ${days} days`,
        totalEntries,
        averageSentiment: avgSentiment,
        averageWordCount: avgWordCount,
        topCategories,
        entriesPerWeek,
        streak,
      },
    }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting journal insights', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to get journal insights' });
  }
}

/**
 * Get user energy logs
 */
async function getUserEnergyLogs(userId: string, params?: z.infer<typeof GetUserEnergyLogsSchema>): Promise<string> {
  try {
    const result = await energyService.getEnergyLogs(userId, {
      startDate: params?.startDate,
      endDate: params?.endDate,
      page: params?.page,
      limit: params?.limit,
    });
    return JSON.stringify({ success: true, data: result }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting energy logs', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve energy logs' });
  }
}

/**
 * Create energy log
 */
async function createEnergyLog(userId: string, params: z.infer<typeof CreateEnergyLogSchema>): Promise<string> {
  try {
    const result = await energyService.createEnergyLog(userId, {
      energyRating: params.energyRating,
      contextTag: params.contextTag as any,
      contextNote: params.contextNote,
      loggedAt: params.loggedAt,
    });
    
    // Queue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: result.id,
      operation: 'create',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, data: { energyLog: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error creating energy log', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to create energy log', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Update energy log
 */
async function updateEnergyLog(userId: string, params: z.infer<typeof UpdateEnergyLogSchema>): Promise<string> {
  try {
    const result = await energyService.updateEnergyLog(userId, params.logId, {
      energyRating: params.energyRating,
      contextTag: params.contextTag as any,
      contextNote: params.contextNote,
    });
    
    // Queue embedding update
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: params.logId,
      operation: 'update',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, data: { energyLog: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error updating energy log', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to update energy log' });
  }
}

/**
 * Delete energy log
 */
async function deleteEnergyLog(userId: string, params: z.infer<typeof DeleteEnergyLogSchema>): Promise<string> {
  try {
    await energyService.deleteEnergyLog(userId, params.logId);
    
    // Queue embedding deletion
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: params.logId,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, message: 'Energy log deleted successfully' }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting energy log', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to delete energy log' });
  }
}

/**
 * Get energy timeline
 */
async function getEnergyTimeline(userId: string, params: z.infer<typeof GetEnergyTimelineSchema>): Promise<string> {
  try {
    const result = await energyService.getEnergyTimeline(userId, params.startDate, params.endDate);
    return JSON.stringify({ success: true, data: { timeline: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting energy timeline', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve energy timeline' });
  }
}

/**
 * Get energy patterns
 */
async function getEnergyPatterns(userId: string, params?: z.infer<typeof GetEnergyPatternsSchema>): Promise<string> {
  try {
    const result = await energyService.getEnergyPatterns(userId, params?.days);
    return JSON.stringify({ success: true, data: { patterns: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting energy patterns', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve energy patterns' });
  }
}

/**
 * Get user habits
 */
async function getUserHabits(userId: string, params?: z.infer<typeof GetUserHabitsSchema>): Promise<string> {
  try {
    const result = await habitService.getHabits(userId, params?.includeArchived);
    return JSON.stringify({ success: true, data: { habits: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting habits', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve habits' });
  }
}

/**
 * Create habit
 */
async function createHabit(userId: string, params: z.infer<typeof CreateHabitSchema>): Promise<string> {
  try {
    const result = await habitService.createHabit(userId, {
      habitName: params.habitName,
      category: params.category,
      trackingType: params.trackingType as any,
      frequency: params.frequency,
      specificDays: params.specificDays as any,
      description: params.description,
      targetValue: params.targetValue,
      unit: params.unit,
      reminderEnabled: params.reminderEnabled,
      reminderTime: params.reminderTime,
    });
    
    // Queue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: result.id,
      operation: 'create',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, data: { habit: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error creating habit', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to create habit', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Update habit
 */
async function updateHabit(userId: string, params: z.infer<typeof UpdateHabitSchema>): Promise<string> {
  try {
    const result = await habitService.updateHabit(userId, params.habitId, {
      habitName: params.habitName,
      category: params.category,
      trackingType: params.trackingType as any,
      frequency: params.frequency,
      specificDays: params.specificDays as any,
      description: params.description,
      targetValue: params.targetValue,
      unit: params.unit,
      reminderEnabled: params.reminderEnabled,
      reminderTime: params.reminderTime,
      isActive: params.isActive,
      isArchived: params.isArchived,
    });
    
    // Queue embedding update
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: params.habitId,
      operation: 'update',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, data: { habit: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error updating habit', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to update habit' });
  }
}

/**
 * Delete habit
 */
async function deleteHabit(userId: string, params: z.infer<typeof DeleteHabitSchema>): Promise<string> {
  try {
    await habitService.deleteHabit(userId, params.habitId);
    
    // Queue embedding deletion
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: params.habitId,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, message: 'Habit deleted successfully' }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting habit', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to delete habit' });
  }
}

/**
 * Log habit completion
 */
async function logHabitCompletion(userId: string, params: z.infer<typeof LogHabitCompletionSchema>): Promise<string> {
  try {
    const result = await habitService.logHabitCompletion(userId, params.habitId, {
      completed: params.completed,
      value: params.value,
      note: params.note,
      logDate: params.logDate,
    });
    
    return JSON.stringify({ success: true, data: { habitLog: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error logging habit completion', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to log habit completion' });
  }
}

/**
 * Get habit analytics
 */
async function getHabitAnalytics(userId: string, params: z.infer<typeof GetHabitAnalyticsSchema>): Promise<string> {
  try {
    const result = await habitService.getHabitAnalytics(userId, params.habitId, params.days);
    return JSON.stringify({ success: true, data: result }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting habit analytics', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve habit analytics' });
  }
}

/**
 * Get user schedules
 */
async function getUserSchedules(userId: string, params?: z.infer<typeof GetUserSchedulesSchema>): Promise<string> {
  try {
    // Note: scheduleService doesn't have a method to get all schedules, so we'll use direct query
    let queryText = `SELECT * FROM daily_schedules WHERE user_id = $1`;
    const queryParams: string[] = [userId];
    let paramIndex = 2;
    
    if (params?.startDate) {
      queryText += ` AND schedule_date >= $${paramIndex}`;
      queryParams.push(params.startDate);
      paramIndex++;
    }
    
    if (params?.endDate) {
      queryText += ` AND schedule_date <= $${paramIndex}`;
      queryParams.push(params.endDate);
      paramIndex++;
    }
    
    queryText += ` ORDER BY schedule_date DESC`;
    
    const result = await query(queryText, queryParams);
    
    return JSON.stringify({ success: true, data: { schedules: result.rows } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error getting schedules', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to retrieve schedules' });
  }
}

/**
 * Create a daily schedule
 */
async function createDailySchedule(userId: string, params: z.infer<typeof CreateDailyScheduleSchema>): Promise<string> {
  try {
    // Use today's date if not provided
    let scheduleDate = params.scheduleDate;
    if (!scheduleDate) {
      scheduleDate = new Date().toISOString().split('T')[0];
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) {
      return JSON.stringify({ 
        success: false, 
        error: 'Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)' 
      });
    }
    
    // Preprocess items: convert strings to objects if needed
    let processedItems: Array<z.infer<typeof CreateScheduleItemInputSchemaForSchedule>> | undefined;
    if (params.items && params.items.length > 0) {
      const processed: Array<z.infer<typeof CreateScheduleItemInputSchemaForSchedule>> = [];
      for (let index = 0; index < params.items.length; index++) {
        const item = params.items[index];
        // If item is a string, try to parse it into an object
        if (typeof item === 'string') {
          // Try to extract time and title from string like "Breakfast at 7:00 a.m." or "Workout at 8:00 a.m."
          const timeMatch = item.match(/(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?|AM|PM)/i);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = timeMatch[2];
            const period = timeMatch[3].toUpperCase();
            let hour24 = hours;
            if (period.includes('P') && hours !== 12) hour24 += 12;
            if (period.includes('A') && hours === 12) hour24 = 0;
            const timeStr = `${hour24.toString().padStart(2, '0')}:${minutes}`;
            const title = item.replace(/\s*at\s*\d{1,2}:\d{2}\s*(a\.?m\.?|p\.?m\.?|AM|PM)/i, '').trim();
            processed.push({
              title: title || item,
              startTime: timeStr,
              position: index,
            });
          } else {
            // If no time found, log warning and skip this item
            logger.warn('[LangGraphTools] Could not parse schedule item string - no time pattern found', { item, index });
          }
        } else {
          // If already an object, ensure position is set
          processed.push({
            ...item,
            position: item.position ?? index,
          });
        }
      }
      processedItems = processed.length > 0 ? processed : undefined;
    }
    
    // Check if schedule already exists for this date
    const existingSchedule = await scheduleService.getScheduleByDate(userId, scheduleDate);
    let schedule: DailySchedule;
    let isUpdate = false;
    
    if (existingSchedule) {
      // Update existing schedule
      isUpdate = true;
      
      // Update schedule metadata if provided
      if (params.name !== undefined || params.notes !== undefined) {
        schedule = await scheduleService.updateSchedule(userId, existingSchedule.id, {
          name: params.name,
          notes: params.notes,
        });
      } else {
        schedule = existingSchedule;
      }
    } else {
      // Create new schedule
      schedule = await scheduleService.createSchedule(userId, {
        scheduleDate,
        templateId: params.templateId,
        name: params.name,
        notes: params.notes,
      });
    }
    
    const createdItems: Array<{ id: string; title: string; position: number }> = [];
    const itemErrors: Array<{ title: string; error: string }> = [];
    
    // Normalize time format helper
    const normalizeTime = (time: string): string => {
      // Convert "5:30 AM" or "5:30" to "05:30"
      if (!time) return time;
      
      // Remove AM/PM and whitespace
      let normalized = time.trim().toUpperCase();
      const isPM = normalized.includes('PM');
      const isAM = normalized.includes('AM');
      
      normalized = normalized.replace(/[AP]M/gi, '').trim();
      
      // Parse hours and minutes
      const parts = normalized.split(':');
      if (parts.length !== 2) return time; // Return original if format is unexpected
      
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].padStart(2, '0');
      
      // Handle 12-hour format
      if (isPM && hours !== 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    };
    
    // Create schedule items if provided
    if (processedItems && processedItems.length > 0) {
      for (let index = 0; index < processedItems.length; index++) {
        const itemInput = processedItems[index];
        try {
          // Normalize time formats
          const normalizedStartTime = normalizeTime(itemInput.startTime);
          const normalizedEndTime = itemInput.endTime ? normalizeTime(itemInput.endTime) : undefined;
          
          // Validate required fields
          if (!itemInput.title || !normalizedStartTime) {
            const errorMsg = !itemInput.title ? 'Missing title' : 'Missing or invalid startTime';
            itemErrors.push({ title: itemInput.title || 'Unknown', error: errorMsg });
            logger.warn('[LangGraphTools] Invalid schedule item', { 
              userId, 
              scheduleId: schedule.id, 
              itemInput,
              error: errorMsg
            });
            continue;
          }
          
          // Auto-generate position if not provided (use index as position)
          const position: number = itemInput.position ?? index;
          
          const item = await scheduleService.addScheduleItem(userId, schedule.id, {
            title: itemInput.title,
            description: itemInput.description,
            startTime: normalizedStartTime,
            endTime: normalizedEndTime,
            durationMinutes: itemInput.durationMinutes,
            color: itemInput.color,
            icon: itemInput.icon,
            category: itemInput.category,
            position: position,
            metadata: itemInput.metadata,
          });
          createdItems.push({ id: item.id, title: item.title, position: item.position });
          
          // Queue embedding for the schedule item
          await embeddingQueueService.enqueueEmbedding({
            userId,
            sourceType: 'schedule_item',
            sourceId: item.id,
            operation: 'create',
            priority: JobPriorities.MEDIUM,
          }).catch((err) => {
            logger.warn('[LangGraphTools] Failed to enqueue embedding for schedule item', { 
              itemId: item.id, 
              error: err 
            });
          });
        } catch (itemError) {
          const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
          itemErrors.push({ title: itemInput.title || 'Unknown', error: errorMessage });
          logger.error('[LangGraphTools] Error creating schedule item', { 
            userId, 
            scheduleId: schedule.id, 
            itemInput, 
            error: itemError instanceof Error ? itemError.message : 'Unknown error',
            stack: itemError instanceof Error ? itemError.stack : undefined
          });
          // Continue with other items
        }
      }
    }
    
    // Create schedule links if provided
    const createdLinks: Array<{ id: string; sourceItemId: string; targetItemId: string }> = [];
    const linkErrors: Array<{ sourceItemId: string; targetItemId: string; error: string }> = [];
    
    if (params.links && params.links.length > 0 && createdItems.length > 0) {
      // Get existing links to avoid duplicates
      const existingLinks = schedule.links || [];
      const existingLinkKeys = new Set(
        existingLinks.map(link => `${link.sourceItemId}-${link.targetItemId}`)
      );
      
      for (const linkInput of params.links) {
        try {
          // Validate indices
          if (
            linkInput.sourceItemIndex < 0 || 
            linkInput.sourceItemIndex >= createdItems.length ||
            linkInput.targetItemIndex < 0 || 
            linkInput.targetItemIndex >= createdItems.length
          ) {
            logger.warn('[LangGraphTools] Invalid link indices', { 
              userId, 
              sourceIndex: linkInput.sourceItemIndex, 
              targetIndex: linkInput.targetItemIndex,
              itemsCount: createdItems.length 
            });
            continue;
          }
          
          const sourceItem = createdItems[linkInput.sourceItemIndex];
          const targetItem = createdItems[linkInput.targetItemIndex];
          
          if (!sourceItem || !targetItem) {
            continue;
          }
          
          // Check if link already exists
          const linkKey = `${sourceItem.id}-${targetItem.id}`;
          if (existingLinkKeys.has(linkKey)) {
            logger.info('[LangGraphTools] Link already exists, skipping', {
              userId,
              scheduleId: schedule.id,
              sourceItemId: sourceItem.id,
              targetItemId: targetItem.id,
            });
            // Find and add the existing link to createdLinks
            const existingLink = existingLinks.find(
              l => l.sourceItemId === sourceItem.id && l.targetItemId === targetItem.id
            );
            if (existingLink) {
              createdLinks.push({
                id: existingLink.id,
                sourceItemId: existingLink.sourceItemId,
                targetItemId: existingLink.targetItemId,
              });
            }
            continue;
          }
          
          try {
            const link = await scheduleService.createScheduleLink(userId, schedule.id, {
              sourceItemId: sourceItem.id,
              targetItemId: targetItem.id,
              linkType: linkInput.linkType || 'sequential',
              delayMinutes: linkInput.delayMinutes || 0,
              conditions: linkInput.conditions || {},
            });
            createdLinks.push({ 
              id: link.id, 
              sourceItemId: link.sourceItemId, 
              targetItemId: link.targetItemId 
            });
            // Add to existing links set to avoid duplicates in same batch
            existingLinkKeys.add(linkKey);
          } catch (createError: any) {
            // Handle duplicate key error (unique constraint violation)
            if (createError?.code === '23505' || createError?.errorCode === '23505' || 
                (createError?.message && createError.message.includes('duplicate key'))) {
              logger.info('[LangGraphTools] Link already exists (duplicate key), skipping', {
                userId,
                scheduleId: schedule.id,
                sourceItemId: sourceItem.id,
                targetItemId: targetItem.id,
              });
              // Try to get the existing link
              try {
                const existingLinksResult = await scheduleService.getScheduleById(userId, schedule.id);
                const existingLink = existingLinksResult.links.find(
                  l => l.sourceItemId === sourceItem.id && l.targetItemId === targetItem.id
                );
                if (existingLink) {
                  createdLinks.push({
                    id: existingLink.id,
                    sourceItemId: existingLink.sourceItemId,
                    targetItemId: existingLink.targetItemId,
                  });
                  existingLinkKeys.add(linkKey);
                }
              } catch {
                // Ignore if we can't retrieve existing link
              }
            } else {
              throw createError; // Re-throw if it's a different error
            }
          }
        } catch (linkError) {
          const errorMessage = linkError instanceof Error ? linkError.message : 'Unknown error';
          linkErrors.push({
            sourceItemId: createdItems[linkInput.sourceItemIndex]?.id || 'unknown',
            targetItemId: createdItems[linkInput.targetItemIndex]?.id || 'unknown',
            error: errorMessage,
          });
          logger.warn('[LangGraphTools] Error creating schedule link', { 
            userId, 
            scheduleId: schedule.id, 
            linkInput, 
            error: linkError instanceof Error ? linkError.message : 'Unknown error',
            stack: linkError instanceof Error ? linkError.stack : undefined
          });
          // Continue with other links
        }
      }
    }
    
    // Queue embedding for the schedule
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'schedule',
      sourceId: schedule.id,
      operation: isUpdate ? 'update' : 'create',
      priority: JobPriorities.MEDIUM,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding for schedule', { 
        scheduleId: schedule.id, 
        error: err 
      });
    });
    
    // Get the complete schedule with items and links to verify database persistence
    const completeSchedule = await scheduleService.getScheduleById(userId, schedule.id);
    
    // Log successful database save
    logger.info('[LangGraphTools] Schedule saved to database', {
      userId,
      scheduleId: schedule.id,
      scheduleDate,
      action: isUpdate ? 'updated' : 'created',
      itemsCount: createdItems.length,
      linksCount: createdLinks.length,
      totalItemsInSchedule: completeSchedule.items.length,
      totalLinksInSchedule: completeSchedule.links.length,
    });
    
    // Build response message with explicit database confirmation
    const action = isUpdate ? 'updated' : 'created';
    let message = `Daily schedule ${action} and saved to database successfully for ${scheduleDate}`;
    if (createdItems.length > 0) {
      message += ` with ${createdItems.length} new item${createdItems.length > 1 ? 's' : ''}`;
    }
    if (createdLinks.length > 0) {
      message += ` and ${createdLinks.length} link${createdLinks.length > 1 ? 's' : ''} (including existing ones)`;
    }
    message += `. Schedule ID: ${schedule.id}. All data has been persisted to the database.`;
    
    if (itemErrors.length > 0) {
      message += ` Note: ${itemErrors.length} item${itemErrors.length > 1 ? 's' : ''} failed to create.`;
    }
    
    if (linkErrors.length > 0) {
      message += ` Note: ${linkErrors.length} link${linkErrors.length > 1 ? 's' : ''} failed to create.`;
    }
    
    // Verify database persistence by checking schedule exists
    const verificationSchedule = await scheduleService.getScheduleByDate(userId, scheduleDate);
    if (!verificationSchedule || verificationSchedule.id !== schedule.id) {
      logger.error('[LangGraphTools] Schedule verification failed - schedule not found in database', {
        userId,
        scheduleId: schedule.id,
        scheduleDate,
      });
      return JSON.stringify({
        success: false,
        error: 'Schedule was created but verification failed. Please check the database.',
        message: 'Schedule creation completed but verification failed.',
      });
    }
    
    return JSON.stringify({ 
      success: (itemErrors.length === 0 && linkErrors.length === 0) || createdItems.length > 0, // Success if at least some items were created
      message,
      data: {
        schedule: completeSchedule,
        scheduleId: schedule.id,
        scheduleDate,
        createdItems: createdItems.length,
        createdLinks: createdLinks.length,
        totalItems: completeSchedule.items.length,
        totalLinks: completeSchedule.links.length,
        failedItems: itemErrors.length > 0 ? itemErrors : undefined,
        failedLinks: linkErrors.length > 0 ? linkErrors : undefined,
        wasUpdated: isUpdate,
        databaseSaved: true, // Explicit confirmation that data is in database
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('[LangGraphTools] Error creating daily schedule', { 
      userId, 
      error: errorMessage,
      stack: errorStack,
      params: {
        scheduleDate: params.scheduleDate,
        itemsCount: params.items?.length || 0,
        linksCount: params.links?.length || 0,
      }
    });
    
    return JSON.stringify({ 
      success: false, 
      error: `Failed to create schedule in database: ${errorMessage}`,
      databaseSaved: false,
    });
  }
}

/**
 * Update a daily schedule
 */
async function updateDailySchedule(userId: string, params: z.infer<typeof UpdateDailyScheduleSchema>): Promise<string> {
  try {
    const schedule = await scheduleService.updateSchedule(userId, params.scheduleId, {
      name: params.name,
      notes: params.notes,
    });
    
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'schedule',
      sourceId: schedule.id,
      operation: 'update',
      priority: JobPriorities.MEDIUM,
    });
    
    return JSON.stringify({ success: true, message: 'Schedule updated successfully', data: schedule });
  } catch (error) {
    logger.error('[LangGraphTools] Error updating daily schedule', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to update schedule' });
  }
}

/**
 * Delete a daily schedule
 */
async function deleteDailySchedule(userId: string, params: z.infer<typeof DeleteDailyScheduleSchema>): Promise<string> {
  try {
    await scheduleService.deleteSchedule(userId, params.scheduleId);
    
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'schedule',
      sourceId: params.scheduleId,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    });
    
    return JSON.stringify({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting daily schedule', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to delete schedule' });
  }
}

/**
 * Get schedule by date
 */
async function getScheduleByDate(userId: string, params: z.infer<typeof GetScheduleByDateSchema>): Promise<string> {
  try {
    // Use today's date if not provided
    let date = params.date;
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return JSON.stringify({ 
        success: false, 
        error: 'Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)' 
      });
    }
    
    const result = await scheduleService.getScheduleByDate(userId, date);
    
    if (result) {
      logger.info('[LangGraphTools] Schedule retrieved from database', {
        userId,
        scheduleId: result.id,
        scheduleDate: date,
        itemsCount: result.items?.length || 0,
        linksCount: result.links?.length || 0,
      });
      
      return JSON.stringify({ 
        success: true, 
        data: result,
        message: result.items && result.items.length > 0 
          ? `Schedule found for ${date} with ${result.items.length} item${result.items.length > 1 ? 's' : ''}`
          : `Schedule found for ${date} (no items yet)`
      }, null, 2);
    } else {
      logger.info('[LangGraphTools] No schedule found for date', {
        userId,
        scheduleDate: date,
      });
      
      return JSON.stringify({ 
        success: true, 
        data: null,
        message: `No schedule found for ${date}`
      }, null, 2);
    }
  } catch (error) {
    logger.error('[LangGraphTools] Error getting schedule by date', { 
      userId, 
      scheduleDate: params.date,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return JSON.stringify({ success: false, error: 'Failed to retrieve schedule from database' });
  }
}

/**
 * Create schedule item
 */
async function createScheduleItem(userId: string, params: z.infer<typeof CreateScheduleItemSchema>): Promise<string> {
  try {
    let scheduleId = params.scheduleId;
    
    // Check if scheduleId is actually a date (YYYY-MM-DD format)
    // This can happen if the AI passes a date instead of a schedule ID
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (datePattern.test(scheduleId)) {
      // It's a date, look up the schedule by date
      const schedule = await scheduleService.getScheduleByDate(userId, scheduleId);
      
      if (!schedule) {
        // Schedule doesn't exist for this date, create it first
        const newSchedule = await scheduleService.createSchedule(userId, {
          scheduleDate: scheduleId,
        });
        scheduleId = newSchedule.id;
        
        // Queue embedding for the new schedule
        await embeddingQueueService.enqueueEmbedding({
          userId,
          sourceType: 'schedule',
          sourceId: newSchedule.id,
          operation: 'create',
          priority: JobPriorities.MEDIUM,
        }).catch(() => {});
      } else {
        scheduleId = schedule.id;
      }
    }
    
    const result = await scheduleService.addScheduleItem(userId, scheduleId, {
      title: params.title,
      description: params.description,
      startTime: params.startTime,
      endTime: params.endTime,
      durationMinutes: params.durationMinutes,
      color: params.color,
      icon: params.icon,
      category: params.category,
      position: params.position,
      metadata: params.metadata || {},
    });
    
    // Queue embedding
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: result.id,
      operation: 'create',
      priority: JobPriorities.MEDIUM,
    }).catch(() => {});
    
    return JSON.stringify({ success: true, data: { item: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error creating schedule item', { userId, error, params });
    return JSON.stringify({ success: false, error: 'Failed to create schedule item', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Update schedule item
 */
async function updateScheduleItem(userId: string, params: z.infer<typeof UpdateScheduleItemSchema>): Promise<string> {
  try {
    const result = await scheduleService.updateScheduleItem(userId, params.itemId, {
      title: params.title,
      description: params.description,
      startTime: params.startTime,
      endTime: params.endTime,
      durationMinutes: params.durationMinutes,
      color: params.color,
      icon: params.icon,
      category: params.category,
      position: params.position,
      metadata: params.metadata,
    });
    
    // Queue embedding update for schedule item
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'schedule_item',
      sourceId: params.itemId,
      operation: 'update',
      priority: JobPriorities.MEDIUM,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding update for schedule item', { 
        itemId: params.itemId, 
        error: err 
      });
    });
    
    return JSON.stringify({ success: true, data: { item: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error updating schedule item', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to update schedule item' });
  }
}

/**
 * Delete schedule item
 */
async function deleteScheduleItem(userId: string, params: z.infer<typeof DeleteScheduleItemSchema>): Promise<string> {
  try {
    await scheduleService.deleteScheduleItem(userId, params.itemId);
    
    // Queue embedding deletion for schedule item
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'schedule_item',
      sourceId: params.itemId,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    }).catch((err) => {
      logger.warn('[LangGraphTools] Failed to enqueue embedding deletion for schedule item', { 
        itemId: params.itemId, 
        error: err 
      });
    });
    
    return JSON.stringify({ success: true, message: 'Schedule item deleted successfully' }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting schedule item', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to delete schedule item' });
  }
}

/**
 * Create schedule link
 */
async function createScheduleLink(userId: string, params: z.infer<typeof CreateScheduleLinkSchema>): Promise<string> {
  try {
    const result = await scheduleService.createScheduleLink(userId, params.scheduleId, {
      sourceItemId: params.sourceItemId,
      targetItemId: params.targetItemId,
      linkType: params.linkType || 'sequential',
      delayMinutes: params.delayMinutes || 0,
      conditions: params.conditions || {},
    });
    
    return JSON.stringify({ success: true, data: { link: result } }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error creating schedule link', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to create schedule link' });
  }
}

/**
 * Delete schedule link
 */
async function deleteScheduleLink(userId: string, params: z.infer<typeof DeleteScheduleLinkSchema>): Promise<string> {
  try {
    await scheduleService.deleteScheduleLink(userId, params.linkId);
    return JSON.stringify({ success: true, message: 'Schedule link deleted successfully' }, null, 2);
  } catch (error) {
    logger.error('[LangGraphTools] Error deleting schedule link', { userId, error });
    return JSON.stringify({ success: false, error: 'Failed to delete schedule link' });
  }
}

// ============================================
// TOOL CREATION
// ============================================

/**
 * Create all tools for a user
 */
export function createTools(userId: string): DynamicStructuredTool[] {
  // OpenAI has a limit of 128 tools, we have 158. 
  // Limit to first 128 tools (prioritized order)
  const allTools: DynamicStructuredTool[] = [
    // GET tools (existing)
    new DynamicStructuredTool({
      name: 'getUserWorkoutPlans',
      description: 'Get the user\'s workout plans. Use when user asks about their workouts, exercise routines, or training plans. Returns plan details including name, status, difficulty, progress, and schedule.',
      schema: GetUserWorkoutPlansSchema,
      func: async (params: z.infer<typeof GetUserWorkoutPlansSchema>) => {
        return getUserWorkoutPlans(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserWorkoutLogs',
      description: 'Get the user\'s workout logs (completed workouts). Use when user asks about their workout history, what workouts they did, or exercise completion records. Returns logs with dates, exercises, duration, and ratings.',
      schema: GetUserWorkoutLogsSchema,
      func: async (params: z.infer<typeof GetUserWorkoutLogsSchema>) => {
        return getUserWorkoutLogs(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserDietPlans',
      description: 'Get the user\'s diet plans. Use when user asks about their nutrition plans, meal plans, or dietary goals. Returns plan details including calories, macros, meal structure, and adherence.',
      schema: GetUserDietPlansSchema,
      func: async (params: z.infer<typeof GetUserDietPlansSchema>) => {
        return getUserDietPlans(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserActivePlans',
      description: 'Get all of the user\'s currently active plans (workout, diet, and general plans). ALWAYS use this tool when user asks about their current plans, active routines, or what they\'re working on. This provides a complete picture of their active fitness and nutrition programs.',
      schema: GetUserActivePlansSchema,
      func: async () => {
        return getUserActivePlans(userId);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserActivityLogsWithMood',
      description: 'Get the user\'s activity logs with mood data. Use when user asks about their activity history, mood patterns, how they felt during activities, or to understand their emotional state related to fitness and wellness activities. Returns activity completion status along with mood scores (1-5 scale).',
      schema: GetUserActivityLogsWithMoodSchema,
      func: async (params: z.infer<typeof GetUserActivityLogsWithMoodSchema>) => {
        return getUserActivityLogsWithMood(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserMoodTrends',
      description: 'Get the user\'s mood trends over time. Use when user asks about their mood patterns, emotional trends, how their mood has changed, or to understand their overall emotional wellbeing related to their health and fitness journey. Returns trend analysis (improving, stable, or declining) and average mood.',
      schema: GetUserMoodTrendsSchema,
      func: async (params: z.infer<typeof GetUserMoodTrendsSchema>) => {
        return getUserMoodTrends(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserMealLogs',
      description: 'Get the user\'s meal logs (what they ate). Use when user asks about what they ate, their meals today, nutrition intake, or meal history. Returns meals with calories, macros, and food details.',
      schema: GetUserMealLogsSchema,
      func: async (params: z.infer<typeof GetUserMealLogsSchema>) => {
        return getUserMealLogs(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserRecipes',
      description: 'Get the user\'s recipes. Use when user asks about their recipes, saved recipes, favorite recipes, or recipe collection. Returns recipe details including ingredients, instructions, nutrition info, and cooking times.',
      schema: GetUserRecipesSchema,
      func: async (params: z.infer<typeof GetUserRecipesSchema>) => {
        return getUserRecipes(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserTasks',
      description: 'Get the user\'s tasks. Use when user asks about their tasks, to-dos, reminders, or scheduled activities. Returns tasks with status, priority, category, and schedule.',
      schema: GetUserTasksSchema,
      func: async (params: z.infer<typeof GetUserTasksSchema>) => {
        return getUserTasks(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserProgress',
      description: 'Get the user\'s progress records (weight, measurements, etc.). Use when user asks about their progress, weight history, body measurements, or health metrics over time.',
      schema: GetUserProgressSchema,
      func: async (params: z.infer<typeof GetUserProgressSchema>) => {
        return getUserProgress(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserGoals',
      description: 'Get the user\'s goals. Use when user asks about their goals, objectives, or what they\'re working towards. Returns goal details including category, target, current value, and deadline. Can filter by status and date range.',
      schema: z.object({
        status: z.string().optional().describe('Filter by status: active, completed, paused, archived'),
        startDate: z.string().optional().describe('Filter goals starting from this date (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('Filter goals ending by this date (YYYY-MM-DD)'),
      }),
      func: async (params: { status?: string; startDate?: string; endDate?: string }) => {
        return getUserGoals(userId, params);
      },
    }),
    // Schedule Tools - Daily Schedules (daily_schedules table) - PRIORITIZED for common use
    new DynamicStructuredTool({
      name: 'createDailySchedule',
      description: 'CRITICAL: ALWAYS call this tool when user requests schedule creation - NEVER just describe a schedule in text format. This tool saves schedules to the database. Use when user says "create schedule", "plan my day", "set up a schedule", "create a daily schedule", "schedule my day", "add in db", or when user describes daily activities with times. IMPORTANT: This is for daily schedules (daily_schedules table), NOT workout plans, diet plans, or user plans. No goal ID is required. scheduleDate is OPTIONAL - if not provided, it will default to today\'s date (YYYY-MM-DD format). If a schedule already exists for the same date, it will be automatically updated with new items and links. You can optionally include items (activities) and links (connections between activities) in the same call. When user describes activities with times, create items for them. Each item needs: title (required), startTime (required), and optionally endTime, description, icon, category. Position will be auto-generated based on item order if not provided. When user mentions activities happening in sequence or connected activities, create links between them. Items and links will be added to existing schedules, not replace them. ALWAYS call this tool immediately when creating schedules - do not ask for confirmation first. The schedule will be automatically saved to the database.',
      schema: CreateDailyScheduleSchema,
      func: async (params: z.infer<typeof CreateDailyScheduleSchema>) => {
        return createDailySchedule(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserSchedules',
      description: 'Get the user\'s daily schedules. Use when user asks about their schedules, daily plans, or schedule history.',
      schema: GetUserSchedulesSchema,
      func: async (params: z.infer<typeof GetUserSchedulesSchema>) => {
        return getUserSchedules(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getScheduleByDate',
      description: 'Get schedule for a specific date. Use when user asks about their schedule for a particular date or day. The date parameter is OPTIONAL - if not provided, it will default to today\'s date. You can call this tool without a date parameter when user asks "what\'s my schedule", "show my schedule", "my schedule today", etc.',
      schema: GetScheduleByDateSchema,
      func: async (params: z.infer<typeof GetScheduleByDateSchema>) => {
        return getScheduleByDate(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateDailySchedule',
      description: 'Update a daily schedule. Use when user asks to modify, change, or update their schedule.',
      schema: UpdateDailyScheduleSchema,
      func: async (params: z.infer<typeof UpdateDailyScheduleSchema>) => {
        return updateDailySchedule(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteDailySchedule',
      description: 'Delete a daily schedule. Use when user asks to remove or delete their schedule.',
      schema: DeleteDailyScheduleSchema,
      func: async (params: z.infer<typeof DeleteDailyScheduleSchema>) => {
        return deleteDailySchedule(userId, params);
      },
    }),
    // Schedule Item/Link Tools - PRIORITIZED for schedule management
    new DynamicStructuredTool({
      name: 'createScheduleItem',
      description: 'Create a schedule item. Use when user mentions an activity, appointment, or task with a time. Can suggest scheduling when user mentions time-based activities.',
      schema: CreateScheduleItemSchema,
      func: async (params: z.infer<typeof CreateScheduleItemSchema>) => {
        return createScheduleItem(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateScheduleItem',
      description: 'Update a schedule item. Use when user asks to modify, change, or update a scheduled activity.',
      schema: UpdateScheduleItemSchema,
      func: async (params: z.infer<typeof UpdateScheduleItemSchema>) => {
        return updateScheduleItem(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteScheduleItem',
      description: 'Delete a schedule item. Use when user asks to remove or cancel a scheduled activity.',
      schema: DeleteScheduleItemSchema,
      func: async (params: z.infer<typeof DeleteScheduleItemSchema>) => {
        return deleteScheduleItem(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createScheduleLink',
      description: 'Create a link between schedule items. Use when user wants to connect or link activities in their schedule.',
      schema: CreateScheduleLinkSchema,
      func: async (params: z.infer<typeof CreateScheduleLinkSchema>) => {
        return createScheduleLink(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteScheduleLink',
      description: 'Delete a schedule link. Use when user wants to remove a connection between schedule items.',
      schema: DeleteScheduleLinkSchema,
      func: async (params: z.infer<typeof DeleteScheduleLinkSchema>) => {
        return deleteScheduleLink(userId, params);
      },
    }),
    // Wellbeing Tools - PRIORITIZED for core functionality
    // Mood Tools
    new DynamicStructuredTool({
      name: 'getUserMoodLogs',
      description: 'Get the user\'s mood logs. Use when user asks about their mood history, emotional state, or mood check-ins. Returns mood logs with ratings, emojis, and emotion tags.',
      schema: GetUserMoodLogsSchema,
      func: async (params: z.infer<typeof GetUserMoodLogsSchema>) => {
        return getUserMoodLogs(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createMoodLog',
      description: 'Create a mood log entry. Use when user mentions their mood, feelings, or emotional state. Automatically creates mood entries from natural language.',
      schema: CreateMoodLogSchema,
      func: async (params: z.infer<typeof CreateMoodLogSchema>) => {
        return createMoodLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateMoodLog',
      description: 'Update a mood log entry. Use when user asks to modify or correct a mood log.',
      schema: UpdateMoodLogSchema,
      func: async (params: z.infer<typeof UpdateMoodLogSchema>) => {
        return updateMoodLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteMoodLog',
      description: 'Delete a mood log entry. Use when user asks to remove a mood log.',
      schema: DeleteMoodLogSchema,
      func: async (params: z.infer<typeof DeleteMoodLogSchema>) => {
        return deleteMoodLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getMoodTimeline',
      description: 'Get mood timeline data for visualization. Use when user asks about mood trends over time or wants to see mood patterns.',
      schema: GetMoodTimelineSchema,
      func: async (params: z.infer<typeof GetMoodTimelineSchema>) => {
        return getMoodTimeline(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getMoodPatterns',
      description: 'Get mood patterns and insights. Use when user asks about mood patterns, time-of-day patterns, or dominant emotions.',
      schema: GetMoodPatternsSchema,
      func: async (params: z.infer<typeof GetMoodPatternsSchema>) => {
        return getMoodPatterns(userId, params);
      },
    }),
    // Stress Tools
    new DynamicStructuredTool({
      name: 'getUserStressLogs',
      description: 'Get the user\'s stress logs. Use when user asks about their stress history, stress levels, or stress check-ins.',
      schema: GetUserStressLogsSchema,
      func: async (params: z.infer<typeof GetUserStressLogsSchema>) => {
        return getUserStressLogs(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createStressLog',
      description: 'Create a stress log entry. Use when user mentions feeling stressed, overwhelmed, or anxious. Automatically creates stress entries from natural language.',
      schema: CreateStressLogSchema,
      func: async (params: z.infer<typeof CreateStressLogSchema>) => {
        return createStressLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateStressLog',
      description: 'Update a stress log entry. Use when user asks to modify or correct a stress log.',
      schema: UpdateStressLogSchema,
      func: async (params: z.infer<typeof UpdateStressLogSchema>) => {
        return updateStressLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteStressLog',
      description: 'Delete a stress log entry. Use when user asks to remove a stress log.',
      schema: DeleteStressLogSchema,
      func: async (params: z.infer<typeof DeleteStressLogSchema>) => {
        return deleteStressLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getStressTrends',
      description: 'Get stress trends and analysis. Use when user asks about stress patterns or trends over time.',
      schema: GetStressTrendsSchema,
      func: async (params: z.infer<typeof GetStressTrendsSchema>) => {
        return getStressTrends(userId, params);
      },
    }),
    // Journal Tools
    new DynamicStructuredTool({
      name: 'getUserJournalEntries',
      description: 'Get the user\'s journal entries. Use when user asks about their journal, reflections, or journaling history.',
      schema: GetUserJournalEntriesSchema,
      func: async (params: z.infer<typeof GetUserJournalEntriesSchema>) => {
        return getUserJournalEntries(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createJournalEntry',
      description: 'Create a journal entry. Use when user reflects, shares thoughts, or wants to journal. Can suggest journaling when user mentions reflection or deep thoughts.',
      schema: CreateJournalEntrySchema,
      func: async (params: z.infer<typeof CreateJournalEntrySchema>) => {
        return createJournalEntry(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateJournalEntry',
      description: 'Update a journal entry. Use when user asks to modify or edit a journal entry.',
      schema: UpdateJournalEntrySchema,
      func: async (params: z.infer<typeof UpdateJournalEntrySchema>) => {
        return updateJournalEntry(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteJournalEntry',
      description: 'Delete a journal entry. Use when user asks to remove a journal entry.',
      schema: DeleteJournalEntrySchema,
      func: async (params: z.infer<typeof DeleteJournalEntrySchema>) => {
        return deleteJournalEntry(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getJournalStreak',
      description: 'Get journal streak information. Use when user asks about their journaling streak or consistency.',
      schema: GetJournalStreakSchema,
      func: async (params: z.infer<typeof GetJournalStreakSchema>) => {
        return getJournalStreak(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getJournalInsights',
      description: 'Get journal insights and analytics including mood trends, entry frequency, top categories, and averages. Use when user asks about their journaling patterns, mood over time, or wants a summary of their reflections.',
      schema: GetJournalInsightsSchema,
      func: async (params: z.infer<typeof GetJournalInsightsSchema>) => {
        return getJournalInsights(userId, params);
      },
    }),
    // Daily Check-in Tools
    new DynamicStructuredTool({
      name: 'createDailyCheckin',
      description: 'Create or update today\'s daily check-in. Use when user wants to do their daily check-in, log how they\'re feeling today, or report their mood/energy/sleep/stress. Guides a conversational check-in experience.',
      schema: CreateDailyCheckinSchema,
      func: async (params: z.infer<typeof CreateDailyCheckinSchema>) => {
        return createDailyCheckin(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getTodayCheckin',
      description: 'Get today\'s daily check-in status. Use to check if user has already done their check-in today.',
      schema: GetTodayCheckinSchema,
      func: async (params: z.infer<typeof GetTodayCheckinSchema>) => {
        return getTodayCheckin(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getCheckinHistory',
      description: 'Get check-in history over time. Use when user asks about their past check-ins, daily trends, or how they\'ve been feeling recently.',
      schema: GetCheckinHistorySchema,
      func: async (params: z.infer<typeof GetCheckinHistorySchema>) => {
        return getCheckinHistory(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getCheckinStreak',
      description: 'Get daily check-in streak information. Use when user asks about their check-in consistency or streak.',
      schema: GetCheckinStreakSchema,
      func: async (params: z.infer<typeof GetCheckinStreakSchema>) => {
        return getCheckinStreak(userId, params);
      },
    }),
    // Energy Tools
    new DynamicStructuredTool({
      name: 'getUserEnergyLogs',
      description: 'Get the user\'s energy logs. Use when user asks about their energy levels, energy history, or energy check-ins.',
      schema: GetUserEnergyLogsSchema,
      func: async (params: z.infer<typeof GetUserEnergyLogsSchema>) => {
        return getUserEnergyLogs(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createEnergyLog',
      description: 'Create an energy log entry. Use when user mentions feeling tired, energetic, or their energy level. Automatically creates energy entries from natural language.',
      schema: CreateEnergyLogSchema,
      func: async (params: z.infer<typeof CreateEnergyLogSchema>) => {
        return createEnergyLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateEnergyLog',
      description: 'Update an energy log entry. Use when user asks to modify or correct an energy log.',
      schema: UpdateEnergyLogSchema,
      func: async (params: z.infer<typeof UpdateEnergyLogSchema>) => {
        return updateEnergyLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteEnergyLog',
      description: 'Delete an energy log entry. Use when user asks to remove an energy log.',
      schema: DeleteEnergyLogSchema,
      func: async (params: z.infer<typeof DeleteEnergyLogSchema>) => {
        return deleteEnergyLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getEnergyTimeline',
      description: 'Get energy timeline data for visualization. Use when user asks about energy trends over time.',
      schema: GetEnergyTimelineSchema,
      func: async (params: z.infer<typeof GetEnergyTimelineSchema>) => {
        return getEnergyTimeline(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getEnergyPatterns',
      description: 'Get energy patterns and insights. Use when user asks about energy patterns or time-of-day energy levels.',
      schema: GetEnergyPatternsSchema,
      func: async (params: z.infer<typeof GetEnergyPatternsSchema>) => {
        return getEnergyPatterns(userId, params);
      },
    }),
    // Habits Tools
    new DynamicStructuredTool({
      name: 'getUserHabits',
      description: 'Get the user\'s habits. Use when user asks about their habits, habit tracking, or habit list.',
      schema: GetUserHabitsSchema,
      func: async (params: z.infer<typeof GetUserHabitsSchema>) => {
        return getUserHabits(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createHabit',
      description: 'Create a new habit. Use when user wants to start tracking a new habit or mentions wanting to build a habit.',
      schema: CreateHabitSchema,
      func: async (params: z.infer<typeof CreateHabitSchema>) => {
        return createHabit(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateHabit',
      description: 'Update a habit. Use when user asks to modify habit settings, change frequency, or update habit details.',
      schema: UpdateHabitSchema,
      func: async (params: z.infer<typeof UpdateHabitSchema>) => {
        return updateHabit(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteHabit',
      description: 'Delete a habit. Use when user asks to remove or stop tracking a habit.',
      schema: DeleteHabitSchema,
      func: async (params: z.infer<typeof DeleteHabitSchema>) => {
        return deleteHabit(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'logHabitCompletion',
      description: 'Log habit completion. Use when user mentions completing a habit, doing a habit, or wants to mark a habit as done. Can suggest logging when user mentions habit activities.',
      schema: LogHabitCompletionSchema,
      func: async (params: z.infer<typeof LogHabitCompletionSchema>) => {
        return logHabitCompletion(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getHabitAnalytics',
      description: 'Get habit analytics and insights. Use when user asks about habit performance, completion rate, streaks, or habit statistics.',
      schema: GetHabitAnalyticsSchema,
      func: async (params: z.infer<typeof GetHabitAnalyticsSchema>) => {
        return getHabitAnalytics(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getGoalById',
      description: 'Get a specific goal by its ID. Use when user asks about a particular goal or references a goal ID.',
      schema: GetGoalByIdSchema,
      func: async (params: z.infer<typeof GetGoalByIdSchema>) => {
        return getGoalById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getGoalByName',
      description: 'Get goals by searching for the goal title/name. Use when user asks about a goal by its name or title. Supports exact and partial matching.',
      schema: GetGoalByNameSchema,
      func: async (params: z.infer<typeof GetGoalByNameSchema>) => {
        return getGoalByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getGoalByDate',
      description: 'Get goals filtered by date range or target date. Use when user asks about goals for a specific time period, goals due by a certain date, or goals starting/ending in a date range.',
      schema: GetGoalByDateSchema,
      func: async (params: z.infer<typeof GetGoalByDateSchema>) => {
        return getGoalByDate(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserPreferences',
      description: 'Get the user\'s preferences and settings. Use when user asks about their preferences, coaching style, or settings. Returns preferences including coaching style, intensity, check-in frequency, and focus areas.',
      schema: z.object({}),
      func: async () => {
        return getUserPreferences(userId);
      },
    }),
    // CRUD tools - User Preferences
    new DynamicStructuredTool({
      name: 'createUserPreferences',
      description: 'Create user preferences. Use when user wants to set up their preferences for the first time. Note: If preferences already exist, use updateUserPreferences instead.',
      schema: CreateUserPreferencesSchema,
      func: async (params: z.infer<typeof CreateUserPreferencesSchema>) => {
        return createUserPreferences(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateUserPreferences',
      description: 'Update user preferences. Use when user asks to change, modify, or update their preferences, coaching style, notification settings, or display preferences.',
      schema: UpdateUserPreferencesSchema,
      func: async (params: z.infer<typeof UpdateUserPreferencesSchema>) => {
        return updateUserPreferences(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteUserPreferences',
      description: 'Delete user preferences. Use when user asks to remove or reset their preferences. This will delete all preference settings.',
      schema: z.object({}),
      func: async () => {
        return deleteUserPreferences(userId);
      },
    }),
    // CRUD tools - Workout Plans
    new DynamicStructuredTool({
      name: 'createWorkoutPlan',
      description: 'Create a new workout plan for the user. Use when user asks to create, add, or make a new workout plan. Exercises will be automatically generated if not provided in weeklySchedule. Always include exercises in the plan - they are essential for a complete workout plan.',
      schema: CreateWorkoutPlanSchema,
      func: async (params: z.infer<typeof CreateWorkoutPlanSchema>) => {
        return createWorkoutPlan(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateWorkoutPlan',
      description: 'Update an existing workout plan. Use when user asks to modify, change, or update a workout plan. Requires the plan ID and fields to update.',
      schema: UpdateWorkoutPlanSchema,
      func: async (params: z.infer<typeof UpdateWorkoutPlanSchema>) => {
        return updateWorkoutPlan(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteWorkoutPlan',
      description: 'Delete a workout plan. Use when user asks to remove, delete, or cancel a workout plan. Requires the plan ID.',
      schema: DeleteWorkoutPlanSchema,
      func: async (params: z.infer<typeof DeleteWorkoutPlanSchema>) => {
        return deleteWorkoutPlan(userId, params);
      },
    }),
    // CRUD tools - Workout Alarms
    new DynamicStructuredTool({
      name: 'createWorkoutAlarm',
      description: 'Create a workout alarm/reminder. Use when user asks to set, create, or add a workout reminder or alarm. Requires alarm time.',
      schema: CreateWorkoutAlarmSchema,
      func: async (params: z.infer<typeof CreateWorkoutAlarmSchema>) => {
        return createWorkoutAlarm(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateWorkoutAlarm',
      description: 'Update a workout alarm. Use when user asks to modify, change, or update a workout alarm/reminder. Requires the alarm ID.',
      schema: UpdateWorkoutAlarmSchema,
      func: async (params: z.infer<typeof UpdateWorkoutAlarmSchema>) => {
        return updateWorkoutAlarm(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteWorkoutAlarm',
      description: 'Delete a workout alarm. Use when user asks to remove, delete, or cancel a workout alarm/reminder. Requires the alarm ID.',
      schema: DeleteWorkoutAlarmSchema,
      func: async (params: z.infer<typeof DeleteWorkoutAlarmSchema>) => {
        return deleteWorkoutAlarm(userId, params);
      },
    }),
    // CRUD tools - Recipes
    new DynamicStructuredTool({
      name: 'createRecipe',
      description: 'Create a new recipe. Use when user asks to create, add, or save a recipe. Requires recipe name.',
      schema: CreateRecipeSchema,
      func: async (params: z.infer<typeof CreateRecipeSchema>) => {
        return createRecipe(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateRecipe',
      description: 'Update an existing recipe. Use when user asks to modify, change, or update a recipe. Requires the recipe ID.',
      schema: UpdateRecipeSchema,
      func: async (params: z.infer<typeof UpdateRecipeSchema>) => {
        return updateRecipe(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteRecipe',
      description: 'Delete a recipe. Use when user asks to remove, delete, or remove a recipe. Requires the recipe ID.',
      schema: DeleteRecipeSchema,
      func: async (params: z.infer<typeof DeleteRecipeSchema>) => {
        return deleteRecipe(userId, params);
      },
    }),
    // CRUD tools - Meal Logs
    new DynamicStructuredTool({
      name: 'createMealLog',
      description: 'Log a meal. Use when user asks to log, record, or add a meal they ate. Requires meal type (breakfast, lunch, dinner, snack).',
      schema: CreateMealLogSchema,
      func: async (params: z.infer<typeof CreateMealLogSchema>) => {
        return createMealLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateMealLog',
      description: 'Update a meal log. Use when user asks to modify, change, or update a logged meal. Requires the meal log ID.',
      schema: UpdateMealLogSchema,
      func: async (params: z.infer<typeof UpdateMealLogSchema>) => {
        return updateMealLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteMealLog',
      description: 'Delete a meal log. Use when user asks to remove, delete, or remove a logged meal. Requires the meal log ID.',
      schema: DeleteMealLogSchema,
      func: async (params: z.infer<typeof DeleteMealLogSchema>) => {
        return deleteMealLog(userId, params);
      },
    }),
    // CRUD tools - Diet Plans
    new DynamicStructuredTool({
      name: 'createDietPlan',
      description: 'Create a new diet plan or meal plan. Use when user asks to create, add, make, or generate a new diet plan, meal plan, nutrition plan, eating plan, or food plan. This tool creates a complete meal plan with meals and snacks. Always call this tool when user requests meal plans, diet plans, or nutrition plans. Requires plan name. You can optionally include weeklyMeals with meal descriptions for each day.',
      schema: CreateDietPlanSchema,
      func: async (params: z.infer<typeof CreateDietPlanSchema>) => {
        return createDietPlan(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateDietPlan',
      description: 'Update an existing diet plan. Use when user asks to modify, change, or update a diet plan. Requires the plan ID.',
      schema: UpdateDietPlanSchema,
      func: async (params: z.infer<typeof UpdateDietPlanSchema>) => {
        return updateDietPlan(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteDietPlan',
      description: 'Delete a diet plan. Use when user asks to remove, delete, or cancel a diet plan. Requires the plan ID.',
      schema: DeleteDietPlanSchema,
      func: async (params: z.infer<typeof DeleteDietPlanSchema>) => {
        return deleteDietPlan(userId, params);
      },
    }),
    // CRUD tools - Goals
    new DynamicStructuredTool({
      name: 'createGoal',
      description: 'Create a new goal. Use when user asks to create, add, or set a new health or fitness goal. Requires goal title. Maximum 3 active goals allowed.',
      schema: CreateGoalSchema,
      func: async (params: z.infer<typeof CreateGoalSchema>) => {
        return createGoal(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateGoal',
      description: 'Update an existing goal. Use when user asks to modify, change, or update a goal. Requires the goal ID.',
      schema: UpdateGoalSchema,
      func: async (params: z.infer<typeof UpdateGoalSchema>) => {
        return updateGoal(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteGoal',
      description: 'Delete a goal. Use when user asks to remove, delete, or cancel a goal. Requires the goal ID.',
      schema: DeleteGoalSchema,
      func: async (params: z.infer<typeof DeleteGoalSchema>) => {
        return deleteGoal(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllGoals',
      description: 'Delete all goals (with optional filters). Use when user asks to remove, delete, or clear all goals. Requires confirmation. Can filter by status or category.',
      schema: DeleteAllGoalsSchema,
      func: async (params: z.infer<typeof DeleteAllGoalsSchema>) => {
        return deleteAllGoals(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateAllGoals',
      description: 'Update multiple goals at once. Use when user asks to update all goals, bulk update goals, or modify multiple goals. Can filter by status, category, or pillar.',
      schema: UpdateAllGoalsSchema,
      func: async (params: z.infer<typeof UpdateAllGoalsSchema>) => {
        return updateAllGoals(userId, params);
      },
    }),
    // CRUD tools - User Integrations
    new DynamicStructuredTool({
      name: 'getUserIntegrations',
      description: 'Get the user\'s health app integrations (Google Fit, Apple Health, Fitbit, etc.). Use when user asks about their connected apps, integrations, or synced devices.',
      schema: GetUserIntegrationsSchema,
      func: async (params: z.infer<typeof GetUserIntegrationsSchema>) => {
        return getUserIntegrations(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserIntegrationById',
      description: 'Get a specific integration by its ID. Use when user asks about a particular integration or references an integration ID.',
      schema: GetUserIntegrationByIdSchema,
      func: async (params: z.infer<typeof GetUserIntegrationByIdSchema>) => {
        return getUserIntegrationById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserIntegrationByProvider',
      description: 'Get integration by provider name. Use when user asks about a specific provider like Google Fit, Apple Health, Fitbit, etc.',
      schema: GetUserIntegrationByProviderSchema,
      func: async (params: z.infer<typeof GetUserIntegrationByProviderSchema>) => {
        return getUserIntegrationByProvider(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createUserIntegration',
      description: 'Create a new health app integration. Use when user wants to connect a new health app or device. Requires provider and access token.',
      schema: CreateUserIntegrationSchema,
      func: async (params: z.infer<typeof CreateUserIntegrationSchema>) => {
        return createUserIntegration(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateUserIntegration',
      description: 'Update an existing integration. Use when user asks to modify integration settings, enable/disable sync, or change integration preferences.',
      schema: UpdateUserIntegrationSchema,
      func: async (params: z.infer<typeof UpdateUserIntegrationSchema>) => {
        return updateUserIntegration(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteUserIntegration',
      description: 'Disconnect an integration by ID. Use when user asks to disconnect, remove, or delete a health app integration.',
      schema: DeleteUserIntegrationSchema,
      func: async (params: z.infer<typeof DeleteUserIntegrationSchema>) => {
        return deleteUserIntegration(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteUserIntegrationByProvider',
      description: 'Disconnect an integration by provider name. Use when user asks to disconnect a specific provider like Google Fit or Fitbit.',
      schema: DeleteUserIntegrationByProviderSchema,
      func: async (params: z.infer<typeof DeleteUserIntegrationByProviderSchema>) => {
        return deleteUserIntegrationByProvider(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllUserIntegrations',
      description: 'Disconnect all integrations. Use when user asks to disconnect, remove, or delete all health app integrations. Requires confirmation.',
      schema: DeleteAllUserIntegrationsSchema,
      func: async (params: z.infer<typeof DeleteAllUserIntegrationsSchema>) => {
        return deleteAllUserIntegrations(userId, params);
      },
    }),
    // CRUD tools - Health Data Records
    new DynamicStructuredTool({
      name: 'getHealthDataRecords',
      description: 'Get health data records synced from integrations. Use when user asks about their synced health data, steps, heart rate, sleep, weight, etc.',
      schema: GetHealthDataRecordsSchema,
      func: async (params: z.infer<typeof GetHealthDataRecordsSchema>) => {
        return getHealthDataRecords(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getHealthDataRecordById',
      description: 'Get a specific health data record by ID. Use when user asks about a particular health data record.',
      schema: GetHealthDataRecordByIdSchema,
      func: async (params: z.infer<typeof GetHealthDataRecordByIdSchema>) => {
        return getHealthDataRecordById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createHealthDataRecord',
      description: 'Create a health data record manually. Use when user wants to manually log health data like steps, weight, etc.',
      schema: CreateHealthDataRecordSchema,
      func: async (params: z.infer<typeof CreateHealthDataRecordSchema>) => {
        return createHealthDataRecord(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateHealthDataRecord',
      description: 'Update a health data record. Use when user asks to modify or correct health data.',
      schema: UpdateHealthDataRecordSchema,
      func: async (params: z.infer<typeof UpdateHealthDataRecordSchema>) => {
        return updateHealthDataRecord(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteHealthDataRecord',
      description: 'Delete a health data record. Use when user asks to remove or delete health data.',
      schema: DeleteHealthDataRecordSchema,
      func: async (params: z.infer<typeof DeleteHealthDataRecordSchema>) => {
        return deleteHealthDataRecord(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllHealthDataRecords',
      description: 'Delete all health data records (with optional filters). Use when user asks to clear all health data. Requires confirmation.',
      schema: DeleteAllHealthDataRecordsSchema,
      func: async (params: z.infer<typeof DeleteAllHealthDataRecordsSchema>) => {
        return deleteAllHealthDataRecords(userId, params);
      },
    }),
    // CRUD tools - User Plans
    new DynamicStructuredTool({
      name: 'getUserPlans',
      description: 'Get user plans. Use when user asks about their plans, active plans, or plan progress.',
      schema: GetUserPlansSchema,
      func: async (params: z.infer<typeof GetUserPlansSchema>) => {
        return getUserPlans(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserPlanById',
      description: 'Get a specific plan by ID. Use when user asks about a particular plan.',
      schema: GetUserPlanByIdSchema,
      func: async (params: z.infer<typeof GetUserPlanByIdSchema>) => {
        return getUserPlanById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserPlanByName',
      description: 'Get plans by searching for the plan name. Use when user asks about a plan by its name.',
      schema: GetUserPlanByNameSchema,
      func: async (params: z.infer<typeof GetUserPlanByNameSchema>) => {
        return getUserPlanByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createUserPlan',
      description: 'Create a new user plan. Use when user asks to create, add, or make a new plan.',
      schema: CreateUserPlanSchema,
      func: async (params: z.infer<typeof CreateUserPlanSchema>) => {
        return createUserPlan(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateUserPlan',
      description: 'Update an existing user plan. Use when user asks to modify, change, or update a plan.',
      schema: UpdateUserPlanSchema,
      func: async (params: z.infer<typeof UpdateUserPlanSchema>) => {
        return updateUserPlan(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteUserPlan',
      description: 'Delete a user plan. Use when user asks to remove, delete, or cancel a plan.',
      schema: DeleteUserPlanSchema,
      func: async (params: z.infer<typeof DeleteUserPlanSchema>) => {
        return deleteUserPlan(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllUserPlans',
      description: 'Delete all user plans (with optional filters). Use when user asks to remove all plans. Requires confirmation.',
      schema: DeleteAllUserPlansSchema,
      func: async (params: z.infer<typeof DeleteAllUserPlansSchema>) => {
        return deleteAllUserPlans(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateAllUserPlans',
      description: 'Update multiple plans at once. Use when user asks to bulk update plans.',
      schema: UpdateAllUserPlansSchema,
      func: async (params: z.infer<typeof UpdateAllUserPlansSchema>) => {
        return updateAllUserPlans(userId, params);
      },
    }),
    // CRUD tools - Notifications
    new DynamicStructuredTool({
      name: 'getNotifications',
      description: 'Get user notifications. Use when user asks about their notifications, alerts, or messages.',
      schema: GetNotificationsSchema,
      func: async (params: z.infer<typeof GetNotificationsSchema>) => {
        return getNotifications(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getNotificationById',
      description: 'Get a specific notification by ID. Use when user asks about a particular notification.',
      schema: GetNotificationByIdSchema,
      func: async (params: z.infer<typeof GetNotificationByIdSchema>) => {
        return getNotificationById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createNotification',
      description: 'Create a notification. Use when user wants to create a custom notification or reminder.',
      schema: CreateNotificationSchema,
      func: async (params: z.infer<typeof CreateNotificationSchema>) => {
        return createNotification(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateNotification',
      description: 'Update a notification. Use when user asks to mark notification as read, archive, or modify it.',
      schema: UpdateNotificationSchema,
      func: async (params: z.infer<typeof UpdateNotificationSchema>) => {
        return updateNotification(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteNotification',
      description: 'Delete a notification. Use when user asks to remove or delete a notification.',
      schema: DeleteNotificationSchema,
      func: async (params: z.infer<typeof DeleteNotificationSchema>) => {
        return deleteNotification(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllNotifications',
      description: 'Delete all notifications (with optional filters). Use when user asks to clear all notifications. Requires confirmation.',
      schema: DeleteAllNotificationsSchema,
      func: async (params: z.infer<typeof DeleteAllNotificationsSchema>) => {
        return deleteAllNotifications(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'markAllNotificationsRead',
      description: 'Mark all notifications as read. Use when user asks to mark all notifications as read.',
      schema: MarkAllNotificationsReadSchema,
      func: async (params: z.infer<typeof MarkAllNotificationsReadSchema>) => {
        return markAllNotificationsRead(userId, params);
      },
    }),
    // CRUD tools - User Body Images
    new DynamicStructuredTool({
      name: 'getUserBodyImages',
      description: 'Get user body images. Use when user asks about their progress photos or body images.',
      schema: GetUserBodyImagesSchema,
      func: async (params: z.infer<typeof GetUserBodyImagesSchema>) => {
        return getUserBodyImages(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getUserBodyImageById',
      description: 'Get a specific body image by ID. Use when user asks about a particular body image.',
      schema: GetUserBodyImageByIdSchema,
      func: async (params: z.infer<typeof GetUserBodyImageByIdSchema>) => {
        return getUserBodyImageById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createUserBodyImage',
      description: 'Create a body image record. Use when user uploads a progress photo. Note: Image file must be uploaded separately.',
      schema: CreateUserBodyImageSchema,
      func: async (params: z.infer<typeof CreateUserBodyImageSchema>) => {
        return createUserBodyImage(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteUserBodyImage',
      description: 'Delete a body image. Use when user asks to remove or delete a progress photo.',
      schema: DeleteUserBodyImageSchema,
      func: async (params: z.infer<typeof DeleteUserBodyImageSchema>) => {
        return deleteUserBodyImage(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllUserBodyImages',
      description: 'Delete all body images (with optional filters). Use when user asks to remove all progress photos. Requires confirmation.',
      schema: DeleteAllUserBodyImagesSchema,
      func: async (params: z.infer<typeof DeleteAllUserBodyImagesSchema>) => {
        return deleteAllUserBodyImages(userId, params);
      },
    }),
    // CRUD tools - Workout Logs (Enhancements)
    new DynamicStructuredTool({
      name: 'getWorkoutLogById',
      description: 'Get a specific workout log by ID. Use when user asks about a particular workout session.',
      schema: GetWorkoutLogByIdSchema,
      func: async (params: z.infer<typeof GetWorkoutLogByIdSchema>) => {
        return getWorkoutLogById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getWorkoutLogByDate',
      description: 'Get workout logs for a specific date. Use when user asks about workouts on a particular day.',
      schema: GetWorkoutLogByDateSchema,
      func: async (params: z.infer<typeof GetWorkoutLogByDateSchema>) => {
        return getWorkoutLogByDate(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createWorkoutLog',
      description: 'Create a workout log. Use when user wants to log a workout session manually.',
      schema: CreateWorkoutLogSchema,
      func: async (params: z.infer<typeof CreateWorkoutLogSchema>) => {
        return createWorkoutLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateWorkoutLog',
      description: 'Update a workout log. Use when user asks to modify, change, or update workout log details.',
      schema: UpdateWorkoutLogSchema,
      func: async (params: z.infer<typeof UpdateWorkoutLogSchema>) => {
        return updateWorkoutLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteWorkoutLog',
      description: 'Delete a workout log. Use when user asks to remove or delete a workout session.',
      schema: DeleteWorkoutLogSchema,
      func: async (params: z.infer<typeof DeleteWorkoutLogSchema>) => {
        return deleteWorkoutLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllWorkoutLogs',
      description: 'Delete all workout logs (with optional filters). Use when user asks to clear all workout logs. Requires confirmation.',
      schema: DeleteAllWorkoutLogsSchema,
      func: async (params: z.infer<typeof DeleteAllWorkoutLogsSchema>) => {
        return deleteAllWorkoutLogs(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateAllWorkoutLogs',
      description: 'Update multiple workout logs at once. Use when user asks to bulk update workout logs.',
      schema: UpdateAllWorkoutLogsSchema,
      func: async (params: z.infer<typeof UpdateAllWorkoutLogsSchema>) => {
        return updateAllWorkoutLogs(userId, params);
      },
    }),
    // CRUD tools - Progress Records (Enhancements)
    new DynamicStructuredTool({
      name: 'getProgressRecordById',
      description: 'Get a specific progress record by ID. Use when user asks about a particular progress entry.',
      schema: GetProgressRecordByIdSchema,
      func: async (params: z.infer<typeof GetProgressRecordByIdSchema>) => {
        return getProgressRecordById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getProgressRecordByDate',
      description: 'Get progress records for a specific date. Use when user asks about progress on a particular day.',
      schema: GetProgressRecordByDateSchema,
      func: async (params: z.infer<typeof GetProgressRecordByDateSchema>) => {
        return getProgressRecordByDate(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createProgressRecord',
      description: 'Create a progress record. Use when user wants to log weight, measurements, or other progress data.',
      schema: CreateProgressRecordSchema,
      func: async (params: z.infer<typeof CreateProgressRecordSchema>) => {
        return createProgressRecord(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateProgressRecord',
      description: 'Update a progress record. Use when user asks to modify or correct progress data.',
      schema: UpdateProgressRecordSchema,
      func: async (params: z.infer<typeof UpdateProgressRecordSchema>) => {
        return updateProgressRecord(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteProgressRecord',
      description: 'Delete a progress record. Use when user asks to remove or delete progress data.',
      schema: DeleteProgressRecordSchema,
      func: async (params: z.infer<typeof DeleteProgressRecordSchema>) => {
        return deleteProgressRecord(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllProgressRecords',
      description: 'Delete all progress records (with optional filters). Use when user asks to clear all progress data. Requires confirmation.',
      schema: DeleteAllProgressRecordsSchema,
      func: async (params: z.infer<typeof DeleteAllProgressRecordsSchema>) => {
        return deleteAllProgressRecords(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateAllProgressRecords',
      description: 'Update multiple progress records at once. Use when user asks to bulk update progress records.',
      schema: UpdateAllProgressRecordsSchema,
      func: async (params: z.infer<typeof UpdateAllProgressRecordsSchema>) => {
        return updateAllProgressRecords(userId, params);
      },
    }),
    // CRUD tools - Water Intake Logs
    new DynamicStructuredTool({
      name: 'getWaterIntakeLogs',
      description: 'Get water intake logs. Use when user asks about their water consumption, hydration, or water intake.',
      schema: GetWaterIntakeLogsSchema,
      func: async (params: z.infer<typeof GetWaterIntakeLogsSchema>) => {
        return getWaterIntakeLogs(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getWaterIntakeLogByDate',
      description: 'Get water intake log for a specific date. Use when user asks about water intake on a particular day.',
      schema: GetWaterIntakeLogByDateSchema,
      func: async (params: z.infer<typeof GetWaterIntakeLogByDateSchema>) => {
        return getWaterIntakeLogByDate(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createWaterIntakeLog',
      description: 'Create or update a water intake log. Use when user wants to log water consumption.',
      schema: CreateWaterIntakeLogSchema,
      func: async (params: z.infer<typeof CreateWaterIntakeLogSchema>) => {
        return createWaterIntakeLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateWaterIntakeLog',
      description: 'Update a water intake log. Use when user asks to modify water intake data.',
      schema: UpdateWaterIntakeLogSchema,
      func: async (params: z.infer<typeof UpdateWaterIntakeLogSchema>) => {
        return updateWaterIntakeLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'addWaterEntry',
      description: 'Add a water entry to today\'s log. Use when user drinks water and wants to log it.',
      schema: AddWaterEntrySchema,
      func: async (params: z.infer<typeof AddWaterEntrySchema>) => {
        return addWaterEntry(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteWaterIntakeLog',
      description: 'Delete a water intake log. Use when user asks to remove water intake data for a specific date.',
      schema: DeleteWaterIntakeLogSchema,
      func: async (params: z.infer<typeof DeleteWaterIntakeLogSchema>) => {
        return deleteWaterIntakeLog(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllWaterIntakeLogs',
      description: 'Delete all water intake logs (with optional filters). Use when user asks to clear all water intake data. Requires confirmation.',
      schema: DeleteAllWaterIntakeLogsSchema,
      func: async (params: z.infer<typeof DeleteAllWaterIntakeLogsSchema>) => {
        return deleteAllWaterIntakeLogs(userId, params);
      },
    }),
    // CRUD tools - Shopping List Items
    new DynamicStructuredTool({
      name: 'getShoppingListItems',
      description: 'Get shopping list items. Use when user asks about their shopping list, grocery list, or items to buy.',
      schema: GetShoppingListItemsSchema,
      func: async (params: z.infer<typeof GetShoppingListItemsSchema>) => {
        return getShoppingListItems(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getShoppingListItemById',
      description: 'Get a specific shopping list item by ID. Use when user asks about a particular item.',
      schema: GetShoppingListItemByIdSchema,
      func: async (params: z.infer<typeof GetShoppingListItemByIdSchema>) => {
        return getShoppingListItemById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getShoppingListItemByName',
      description: 'Get shopping list items by searching for the item name. Use when user asks about an item by its name.',
      schema: GetShoppingListItemByNameSchema,
      func: async (params: z.infer<typeof GetShoppingListItemByNameSchema>) => {
        return getShoppingListItemByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createShoppingListItem',
      description: 'Create a shopping list item. Use when user asks to add an item to their shopping list. IMPORTANT: Always include calories (estimated calories per item/portion) when creating food items for nutrition tracking. For example: salmon fillets (1 lb) ~800 calories, eggs (1 dozen) ~840 calories, quinoa (500g) ~555 calories, spinach (1 bunch) ~20 calories, broccoli (500g) ~165 calories. Estimate based on standard nutritional values if exact calories are unknown.',
      schema: CreateShoppingListItemSchema,
      func: async (params: z.infer<typeof CreateShoppingListItemSchema>) => {
        return createShoppingListItem(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateShoppingListItem',
      description: 'Update a shopping list item. Use when user asks to modify an item, mark it as purchased, or change its details.',
      schema: UpdateShoppingListItemSchema,
      func: async (params: z.infer<typeof UpdateShoppingListItemSchema>) => {
        return updateShoppingListItem(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteShoppingListItem',
      description: 'Delete a shopping list item. Use when user asks to remove an item from their shopping list.',
      schema: DeleteShoppingListItemSchema,
      func: async (params: z.infer<typeof DeleteShoppingListItemSchema>) => {
        return deleteShoppingListItem(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteShoppingListItemByName',
      description: 'Delete shopping list items by name. Use when user asks to remove items by their name.',
      schema: DeleteShoppingListItemByNameSchema,
      func: async (params: z.infer<typeof DeleteShoppingListItemByNameSchema>) => {
        return deleteShoppingListItemByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllShoppingListItems',
      description: 'Delete all shopping list items (with optional filters). Use when user asks to clear their shopping list. Requires confirmation.',
      schema: DeleteAllShoppingListItemsSchema,
      func: async (params: z.infer<typeof DeleteAllShoppingListItemsSchema>) => {
        return deleteAllShoppingListItems(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateAllShoppingListItems',
      description: 'Update multiple shopping list items at once. Use when user asks to bulk update items, mark all as purchased, etc.',
      schema: UpdateAllShoppingListItemsSchema,
      func: async (params: z.infer<typeof UpdateAllShoppingListItemsSchema>) => {
        return updateAllShoppingListItems(userId, params);
      },
    }),
    // CRUD tools - Scheduled Reminders
    new DynamicStructuredTool({
      name: 'getScheduledReminders',
      description: 'Get scheduled reminders. Use when user asks about their reminders, notifications, or scheduled alerts.',
      schema: GetScheduledRemindersSchema,
      func: async (params: z.infer<typeof GetScheduledRemindersSchema>) => {
        return getScheduledReminders(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'getScheduledReminderById',
      description: 'Get a specific reminder by ID. Use when user asks about a particular reminder.',
      schema: GetScheduledReminderByIdSchema,
      func: async (params: z.infer<typeof GetScheduledReminderByIdSchema>) => {
        return getScheduledReminderById(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'createScheduledReminder',
      description: 'Create a scheduled reminder. Use when user asks to set up a reminder, schedule an alert, or create a notification.',
      schema: CreateScheduledReminderSchema,
      func: async (params: z.infer<typeof CreateScheduledReminderSchema>) => {
        return createScheduledReminder(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateScheduledReminder',
      description: 'Update a scheduled reminder. Use when user asks to modify, enable, disable, or change reminder settings.',
      schema: UpdateScheduledReminderSchema,
      func: async (params: z.infer<typeof UpdateScheduledReminderSchema>) => {
        return updateScheduledReminder(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteScheduledReminder',
      description: 'Delete a scheduled reminder. Use when user asks to remove, cancel, or delete a reminder.',
      schema: DeleteScheduledReminderSchema,
      func: async (params: z.infer<typeof DeleteScheduledReminderSchema>) => {
        return deleteScheduledReminder(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteAllScheduledReminders',
      description: 'Delete all scheduled reminders (with optional filters). Use when user asks to clear all reminders. Requires confirmation.',
      schema: DeleteAllScheduledRemindersSchema,
      func: async (params: z.infer<typeof DeleteAllScheduledRemindersSchema>) => {
        return deleteAllScheduledReminders(userId, params);
      },
    }),
    // Operations by Name - Meals
    new DynamicStructuredTool({
      name: 'getMealByName',
      description: 'Get a meal log by its name. Use when user asks to find, get, or retrieve a specific meal by name. Supports exact or partial name matching.',
      schema: GetMealByNameSchema,
      func: async (params: z.infer<typeof GetMealByNameSchema>) => {
        return getMealByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateMealByName',
      description: 'Update a meal log by its name. Use when user asks to modify, change, or update a specific meal by name. Supports exact or partial name matching.',
      schema: UpdateMealByNameSchema,
      func: async (params: z.infer<typeof UpdateMealByNameSchema>) => {
        return updateMealByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteMealByName',
      description: 'Delete a meal log by its name. Use when user asks to remove, delete, or remove a specific meal by name. Supports exact or partial name matching.',
      schema: DeleteMealByNameSchema,
      func: async (params: z.infer<typeof DeleteMealByNameSchema>) => {
        return deleteMealByName(userId, params);
      },
    }),
    // Operations by Name - Diet Plans
    new DynamicStructuredTool({
      name: 'getDietPlanByName',
      description: 'Get a diet plan by its name. Use when user asks to find, get, or retrieve a specific diet plan by name. Supports exact or partial name matching.',
      schema: GetDietPlanByNameSchema,
      func: async (params: z.infer<typeof GetDietPlanByNameSchema>) => {
        return getDietPlanByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateDietPlanByName',
      description: 'Update a diet plan by its name. Use when user asks to modify, change, or update a specific diet plan by name. Supports exact or partial name matching.',
      schema: UpdateDietPlanByNameSchema,
      func: async (params: z.infer<typeof UpdateDietPlanByNameSchema>) => {
        return updateDietPlanByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteDietPlanByName',
      description: 'Delete a diet plan by its name. Use when user asks to remove, delete, or cancel a specific diet plan by name. Supports exact or partial name matching.',
      schema: DeleteDietPlanByNameSchema,
      func: async (params: z.infer<typeof DeleteDietPlanByNameSchema>) => {
        return deleteDietPlanByName(userId, params);
      },
    }),
    // Operations by Name - Recipes
    new DynamicStructuredTool({
      name: 'getRecipeByName',
      description: 'Get a recipe by its name. Use when user asks to find, get, or retrieve a specific recipe by name. Supports exact or partial name matching.',
      schema: GetRecipeByNameSchema,
      func: async (params: z.infer<typeof GetRecipeByNameSchema>) => {
        return getRecipeByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateRecipeByName',
      description: 'Update a recipe by its name. Use when user asks to modify, change, or update a specific recipe by name. Supports exact or partial name matching.',
      schema: UpdateRecipeByNameSchema,
      func: async (params: z.infer<typeof UpdateRecipeByNameSchema>) => {
        return updateRecipeByName(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'deleteRecipeByName',
      description: 'Delete a recipe by its name. Use when user asks to remove, delete, or remove a specific recipe by name. Supports exact or partial name matching.',
      schema: DeleteRecipeByNameSchema,
      func: async (params: z.infer<typeof DeleteRecipeByNameSchema>) => {
        return deleteRecipeByName(userId, params);
      },
    }),
    // Bulk Operations - Meals
    new DynamicStructuredTool({
      name: 'deleteAllMeals',
      description: 'Delete all meal logs. Use when user asks to delete all meals, remove all meal logs, or clear all meal history. Requires confirmation. Can filter by date range or meal type.',
      schema: DeleteAllMealsSchema,
      func: async (params: z.infer<typeof DeleteAllMealsSchema>) => {
        return deleteAllMeals(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateAllMeals',
      description: 'Update multiple meal logs at once. Use when user asks to update all meals, bulk update meals, or modify multiple meals. Can filter by date range or meal type.',
      schema: UpdateAllMealsSchema,
      func: async (params: z.infer<typeof UpdateAllMealsSchema>) => {
        return updateAllMeals(userId, params);
      },
    }),
    // Bulk Operations - Diet Plans
    new DynamicStructuredTool({
      name: 'deleteAllDietPlans',
      description: 'Delete all diet plans. Use when user asks to delete all diet plans, remove all plans, or clear all diet plans. Requires confirmation. Can filter by status.',
      schema: DeleteAllDietPlansSchema,
      func: async (params: z.infer<typeof DeleteAllDietPlansSchema>) => {
        return deleteAllDietPlans(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateAllDietPlans',
      description: 'Update multiple diet plans at once. Use when user asks to update all diet plans, bulk update plans, or modify multiple plans. Can filter by status or goal category.',
      schema: UpdateAllDietPlansSchema,
      func: async (params: z.infer<typeof UpdateAllDietPlansSchema>) => {
        return updateAllDietPlans(userId, params);
      },
    }),
    // Bulk Operations - Recipes
    new DynamicStructuredTool({
      name: 'deleteAllRecipes',
      description: 'Delete all recipes. Use when user asks to delete all recipes, remove all recipes, or clear all recipes. Requires confirmation. Can filter by category or favorite status.',
      schema: DeleteAllRecipesSchema,
      func: async (params: z.infer<typeof DeleteAllRecipesSchema>) => {
        return deleteAllRecipes(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'updateAllRecipes',
      description: 'Update multiple recipes at once. Use when user asks to update all recipes, bulk update recipes, or modify multiple recipes. Can filter by category or favorite status.',
      schema: UpdateAllRecipesSchema,
      func: async (params: z.infer<typeof UpdateAllRecipesSchema>) => {
        return updateAllRecipes(userId, params);
      },
    }),
    // ============================================
    // WORKOUT RESCHEDULE TOOLS
    // ============================================
    new DynamicStructuredTool({
      name: 'checkWorkoutProgress',
      description: 'Check workout progress and detect missed tasks. Use when user asks about missed workouts, workout completion, or to see if any workouts need rescheduling. Returns missed tasks and suggests rescheduling if needed.',
      schema: CheckWorkoutProgressSchema,
      func: async (params: z.infer<typeof CheckWorkoutProgressSchema>) => {
        return checkWorkoutProgress(userId, params);
      },
    }),
    new DynamicStructuredTool({
      name: 'rescheduleWorkoutTasks',
      description: 'Reschedule missed workout tasks. Use when user asks to reschedule missed workouts, move workouts to different days, or adjust their workout schedule. Automatically finds best slots based on constraints.',
      schema: RescheduleWorkoutTasksSchema,
      func: async (params: z.infer<typeof RescheduleWorkoutTasksSchema>) => {
        return rescheduleWorkoutTasks(userId, params);
      },
    }),
    // ============================================
    // WELLBEING TOOLS
    // ============================================

    // ============================================
    // STATUS AWARENESS TOOLS
    // ============================================
    new DynamicStructuredTool({
      name: 'getStatusHistory',
      description: 'Get the user\'s activity status history. Use when user asks about past statuses like "when was I last sick", "how often do I travel", "my status history". Returns dates, statuses, durations, and notes.',
      schema: z.object({
        statusFilter: z.string().optional().describe('Filter by status: sick, injury, rest, vacation, travel, stress'),
        daysBack: z.number().optional().default(90).describe('How many days back to search (default 90)'),
      }),
      func: async (params) => {
        try {
          const { query: dbQuery } = await import('../database/pg.js');
          const conditions = [`user_id = $1`, `status_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL`];
          const values: (string | number)[] = [userId, params.daysBack ?? 90];

          if (params.statusFilter) {
            conditions.push(`activity_status = $3`);
            values.push(params.statusFilter);
          }

          const result = await dbQuery<{
            status_date: string;
            activity_status: string;
            mood: number | null;
            notes: string | null;
            expected_end_date: string | null;
            detected_from: string | null;
          }>(
            `SELECT status_date::text, activity_status, mood, notes, expected_end_date::text, detected_from
             FROM activity_status_history
             WHERE ${conditions.join(' AND ')}
             ORDER BY status_date DESC
             LIMIT 20`,
            values
          );

          if (result.rows.length === 0) {
            return JSON.stringify({ message: 'No status history found for the given criteria.' });
          }

          return JSON.stringify({
            count: result.rows.length,
            history: result.rows.map(r => ({
              date: r.status_date,
              status: r.activity_status,
              mood: r.mood,
              notes: r.notes,
              expectedEnd: r.expected_end_date,
              source: r.detected_from,
            })),
          });
        } catch (error) {
          return JSON.stringify({ error: 'Failed to retrieve status history' });
        }
      },
    }),
  ];

  // OpenAI has a limit of 128 tools
  // Exclude rarely-used batch operations and redundant variants to stay under limit
  // These tools are low priority: batch operations are dangerous, and *ByName/*ByProvider
  // variants can be handled by the base tools with ID parameters
  const TOOLS_TO_EXCLUDE = new Set([
    // Batch delete operations - dangerous and rarely needed
    'deleteAllGoals',
    'deleteAllUserIntegrations',
    'deleteAllHealthDataRecords',
    'deleteAllUserPlans',
    'deleteAllNotifications',
    'deleteAllUserBodyImages',
    'deleteAllWorkoutLogs',
    'deleteAllProgressRecords',
    'deleteAllWaterIntakeLogs',
    'deleteAllShoppingListItems',
    'deleteAllScheduledReminders',
    'deleteAllMeals',
    'deleteAllDietPlans',
    'deleteAllRecipes',
    // Batch update operations - rarely needed
    'updateAllGoals',
    'updateAllUserPlans',
    'updateAllWorkoutLogs',
    'updateAllProgressRecords',
    'updateAllShoppingListItems',
    'updateAllMeals',
    'updateAllDietPlans',
    'updateAllRecipes',
    // ByName/ByProvider variants - redundant, can use ID-based tools
    'getMealByName',
    'updateMealByName',
    'deleteMealByName',
    'getDietPlanByName',
    'updateDietPlanByName',
    'deleteDietPlanByName',
    'getRecipeByName',
    'updateRecipeByName',
    'deleteRecipeByName',
    'getShoppingListItemByName',
    'deleteShoppingListItemByName',
    'getUserIntegrationByProvider',
    'deleteUserIntegrationByProvider',
  ]);

  const filteredTools = allTools.filter(tool => !TOOLS_TO_EXCLUDE.has(tool.name));

  if (filteredTools.length > 128) {
    logger.warn('[LangGraphTools] Too many tools after filtering, limiting to 128', {
      total: allTools.length,
      afterFilter: filteredTools.length,
      userId,
      excludedByPriority: Array.from(TOOLS_TO_EXCLUDE),
      includedTools: filteredTools.slice(0, 128).map(t => t.name),
      excludedTools: filteredTools.slice(128).map(t => t.name),
    });
    return filteredTools.slice(0, 128);
  }

  logger.debug('[LangGraphTools] Tools created', {
    total: allTools.length,
    afterFilter: filteredTools.length,
    excluded: Array.from(TOOLS_TO_EXCLUDE),
    userId,
  });

  return filteredTools;
}

export const langgraphToolsService = {
  createTools,
};

