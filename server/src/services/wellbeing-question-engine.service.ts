/**
 * @file Wellbeing Question Engine Service
 * @description Generates contextual wellbeing questions based on user history and patterns
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { modelFactory } from './model-factory.service.js';
import { logger } from './logger.service.js';
import { moodService } from './wellbeing/mood.service.js';
import { stressService } from './stress.service.js';
import { journalService } from './wellbeing/journal.service.js';
import { energyService } from './wellbeing/energy.service.js';
import { workoutPlanService } from './workout-plan.service.js';
import { query } from '../database/pg.js';
import { parseLlmJson } from '../helper/llm-json-parser.js';

// ============================================
// TYPES
// ============================================

export interface WellbeingQuestion {
  question: string;
  type: 'mood' | 'stress' | 'journal' | 'energy' | 'habits' | 'schedule' | 'nutrition' | 'workout' | 'meal' | 'calories' | 'whoop' | 'general';
  context?: string;
  priority: 'high' | 'medium' | 'low';
}

// ============================================
// SERVICE CLASS
// ============================================

class WellbeingQuestionEngineService {
  private llm: BaseChatModel;

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'light',
      temperature: 0.7,
      maxTokens: 2000,
    });
  }

  /**
   * Generate an opening question to start a conversation when user hasn't talked
   */
  async generateOpeningQuestion(userId: string): Promise<WellbeingQuestion | null> {
    try {
      // Check if user has sent a message recently (within last 24 hours)
      const lastMessageResult = await query<{ last_message_at: Date | null }>(
        `SELECT MAX(last_message_at) as last_message_at 
         FROM rag_conversations 
         WHERE user_id = $1 AND last_message_at > NOW() - INTERVAL '24 hours'`,
        [userId]
      );

      const lastMessageAt = lastMessageResult.rows[0]?.last_message_at;
      
      // If user has messaged recently, don't generate opening question
      if (lastMessageAt) {
        return null;
      }

      // Generate a contextual opening question
      const questions = await this.generateQuestions(userId, 1);
      return questions.length > 0 ? questions[0] : null;
    } catch (error) {
      logger.error('[WellbeingQuestionEngine] Failed to generate opening question', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Generate contextual questions based on user's wellbeing data
   */
  async generateQuestions(
    userId: string, 
    limit: number = 2,
    conversationContext?: {
      message?: string;
      topic?: string;
      recentMessages?: Array<{ role: string; content: string }>;
    }
  ): Promise<WellbeingQuestion[]> {
    try {
      // Get recent wellbeing data
      const recentData = await this.getRecentWellbeingData(userId);
      
      // Check what's missing today
      const missingToday = await this.checkMissingToday(userId);
      
      // Detect patterns
      const patterns = await this.detectPatterns(userId, recentData);
      
      // Generate questions using LLM with conversation context
      const questions = await this.generateQuestionsWithLLM(
        userId,
        recentData,
        missingToday,
        patterns,
        limit,
        conversationContext
      );
      
      return questions;
    } catch (error) {
      logger.error('[WellbeingQuestionEngine] Failed to generate questions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Return fallback questions
      return this.getFallbackQuestions(limit, userId);
    }
  }

  /**
   * Get recent wellbeing data for context
   */
  private async getRecentWellbeingData(userId: string): Promise<{
    lastMood?: string;
    lastStress?: string;
    lastJournal?: string;
    lastEnergy?: string;
    moodTrend?: 'improving' | 'stable' | 'declining';
    stressTrend?: 'improving' | 'stable' | 'declining';
    lastMeal?: string;
    lastWorkout?: string;
    todayCalories?: number;
    calorieTarget?: number;
    lastRecovery?: { score: number; date: string };
    lastStrain?: { score: number; date: string };
    activeGoals: Array<{ category: string; title: string }>;
    hasActiveWorkoutPlan: boolean;
    hasActiveDietPlan: boolean;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      // Get recent mood logs
      const moodLogs = await moodService.getMoodLogs(userId, {
        startDate: weekAgoStr,
        endDate: today,
        limit: 10,
      });

      // Get recent stress logs
      const stressLogs = await stressService.getStressLogs(userId, weekAgoStr, today);

      // Get recent journal entries
      const journalEntries = await journalService.getJournalEntries(userId, {
        startDate: weekAgoStr,
        endDate: today,
        limit: 5,
      });

      // Get recent energy logs
      const energyLogs = await energyService.getEnergyLogs(userId, {
        startDate: weekAgoStr,
        endDate: today,
        limit: 10,
      });

      const lastMood = moodLogs.logs[0]?.loggedAt;
      const lastStress = stressLogs[0]?.loggedAt;
      const lastJournal = journalEntries.entries[0]?.loggedAt;
      const lastEnergy = energyLogs.logs[0]?.loggedAt;

      // Calculate trends (simplified)
      let moodTrend: 'improving' | 'stable' | 'declining' | undefined;
      if (moodLogs.logs.length >= 3) {
        const recent = moodLogs.logs.slice(0, 3);
        const avgRecent = recent.reduce((sum, log) => {
          const rating = log.happinessRating || (log.moodEmoji === '😊' ? 9 : log.moodEmoji === '😐' ? 6 : 4);
          return sum + rating;
        }, 0) / recent.length;
        
        const older = moodLogs.logs.slice(3, 6);
        if (older.length >= 2) {
          const avgOlder = older.reduce((sum, log) => {
            const rating = log.happinessRating || (log.moodEmoji === '😊' ? 9 : log.moodEmoji === '😐' ? 6 : 4);
            return sum + rating;
          }, 0) / older.length;
          
          if (avgRecent > avgOlder + 1) moodTrend = 'improving';
          else if (avgRecent < avgOlder - 1) moodTrend = 'declining';
          else moodTrend = 'stable';
        }
      }

      let stressTrend: 'improving' | 'stable' | 'declining' | undefined;
      if (stressLogs.length >= 3) {
        const recent = stressLogs.slice(0, 3);
        const avgRecent = recent.reduce((sum, log) => sum + log.stressRating, 0) / recent.length;
        
        const older = stressLogs.slice(3, 6);
        if (older.length >= 2) {
          const avgOlder = older.reduce((sum, log) => sum + log.stressRating, 0) / older.length;
          
          if (avgRecent < avgOlder - 1) stressTrend = 'improving';
          else if (avgRecent > avgOlder + 1) stressTrend = 'declining';
          else stressTrend = 'stable';
        }
      }

      // Get additional data in parallel
      const [nutritionData, workoutData, whoopData, goalsAndPlans] = await Promise.all([
        this.getNutritionData(userId),
        this.getWorkoutData(userId),
        this.getWhoopData(userId),
        this.getUserGoalsAndPlans(userId),
      ]);

      return {
        lastMood,
        lastStress,
        lastJournal,
        lastEnergy,
        moodTrend,
        stressTrend,
        lastMeal: nutritionData.lastMeal,
        lastWorkout: workoutData.lastWorkout,
        todayCalories: nutritionData.todayCalories,
        calorieTarget: nutritionData.calorieTarget,
        lastRecovery: whoopData.lastRecovery,
        lastStrain: whoopData.lastStrain,
        activeGoals: goalsAndPlans.activeGoals,
        hasActiveWorkoutPlan: goalsAndPlans.hasActiveWorkoutPlan,
        hasActiveDietPlan: goalsAndPlans.hasActiveDietPlan,
      };
    } catch (error) {
      logger.error('[WellbeingQuestionEngine] Failed to get recent data', { userId, error });
      return {
        activeGoals: [],
        hasActiveWorkoutPlan: false,
        hasActiveDietPlan: false,
      };
    }
  }

  /**
   * Check what wellbeing data is missing today
   */
  private async checkMissingToday(userId: string): Promise<{
    missingMood: boolean;
    missingStress: boolean;
    missingJournal: boolean;
    missingEnergy: boolean;
    missingBreakfast: boolean;
    missingLunch: boolean;
    missingDinner: boolean;
    missingWorkout: boolean;
    missingCalorieLogging: boolean;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Check mood
      const moodLogs = await moodService.getMoodLogs(userId, {
        startDate: today,
        endDate: today,
        limit: 1,
      });
      const missingMood = moodLogs.logs.length === 0;

      // Check stress
      const stressLogs = await stressService.getStressLogs(userId, today, today);
      const missingStress = stressLogs.length === 0;

      // Check journal
      const journalEntries = await journalService.getJournalEntries(userId, {
        startDate: today,
        endDate: today,
        limit: 1,
      });
      const missingJournal = journalEntries.entries.length === 0;

      // Check energy
      const energyLogs = await energyService.getEnergyLogs(userId, {
        startDate: today,
        endDate: today,
        limit: 1,
      });
      const missingEnergy = energyLogs.logs.length === 0;

      // Check meals
      const mealLogsResult = await query<{ meal_type: string }>(
        `SELECT meal_type FROM meal_logs 
         WHERE user_id = $1 AND DATE(eaten_at) = $2`,
        [userId, today]
      );

      const mealTypes = new Set(mealLogsResult.rows.map((row) => row.meal_type.toLowerCase()));
      const missingBreakfast = !mealTypes.has('breakfast');
      const missingLunch = !mealTypes.has('lunch');
      const missingDinner = !mealTypes.has('dinner');

      // Check workout
      const todayWorkouts = await workoutPlanService.getWorkoutLogs(userId, {
        startDate: today,
        endDate: today,
        limit: 1,
      });
      const missingWorkout = todayWorkouts.logs.length === 0;

      // Check calorie logging (if no meals logged today)
      const missingCalorieLogging = mealLogsResult.rows.length === 0;

      return {
        missingMood,
        missingStress,
        missingJournal,
        missingEnergy,
        missingBreakfast,
        missingLunch,
        missingDinner,
        missingWorkout,
        missingCalorieLogging,
      };
    } catch (error) {
      logger.error('[WellbeingQuestionEngine] Failed to check missing data', { userId, error });
      return {
        missingMood: false,
        missingStress: false,
        missingJournal: false,
        missingEnergy: false,
        missingBreakfast: false,
        missingLunch: false,
        missingDinner: false,
        missingWorkout: false,
        missingCalorieLogging: false,
      };
    }
  }

  /**
   * Get nutrition data (meal logs, calories, diet plans)
   */
  private async getNutritionData(userId: string): Promise<{
    lastMeal?: string;
    todayCalories?: number;
    calorieTarget?: number;
    hasActiveDietPlan: boolean;
    mealCountToday: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      // Get recent meal logs
      const mealLogsResult = await query<{
        eaten_at: Date;
        calories: number | null;
      }>(
        `SELECT eaten_at, calories FROM meal_logs 
         WHERE user_id = $1 AND eaten_at >= $2 
         ORDER BY eaten_at DESC LIMIT 10`,
        [userId, weekAgoStr]
      );

      // Get today's meals and calories
      const todayMealsResult = await query<{
        calories: number | null;
      }>(
        `SELECT calories FROM meal_logs 
         WHERE user_id = $1 AND DATE(eaten_at) = $2`,
        [userId, today]
      );

      const todayCalories = todayMealsResult.rows.reduce(
        (sum, row) => sum + (row.calories || 0),
        0
      );

      // Get active diet plan
      const dietPlanResult = await query<{
        daily_calories: number | null;
      }>(
        `SELECT daily_calories FROM diet_plans 
         WHERE user_id = $1 AND status = 'active' 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      const lastMeal = mealLogsResult.rows[0]?.eaten_at?.toISOString();
      const calorieTarget = dietPlanResult.rows[0]?.daily_calories || undefined;
      const hasActiveDietPlan = dietPlanResult.rows.length > 0;

      return {
        lastMeal,
        todayCalories: todayCalories > 0 ? todayCalories : undefined,
        calorieTarget: calorieTarget ? Number(calorieTarget) : undefined,
        hasActiveDietPlan,
        mealCountToday: todayMealsResult.rows.length,
      };
    } catch (error) {
      logger.error('[WellbeingQuestionEngine] Failed to get nutrition data', { userId, error });
      return {
        hasActiveDietPlan: false,
        mealCountToday: 0,
      };
    }
  }

  /**
   * Get workout data (workout logs, plans, completion rate)
   */
  private async getWorkoutData(userId: string): Promise<{
    lastWorkout?: string;
    todayWorkout?: string;
    hasActivePlan: boolean;
    completionRate?: number;
    workoutCountThisWeek: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      // Get recent workout logs
      const workoutLogs = await workoutPlanService.getWorkoutLogs(userId, {
        startDate: weekAgoStr,
        endDate: today,
        limit: 10,
      });

      // Get today's workouts
      const todayWorkouts = await workoutPlanService.getWorkoutLogs(userId, {
        startDate: today,
        endDate: today,
        limit: 1,
      });

      // Get active workout plans
      const activePlans = await workoutPlanService.getUserPlans(userId, 'active');

      // Calculate completion rate for this week
      const completedWorkouts = workoutLogs.logs.filter(
        (log) => log.status === 'completed' || log.status === 'partial'
      ).length;
      const totalWorkouts = workoutLogs.logs.length;
      const completionRate =
        totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : undefined;

      const lastWorkout = workoutLogs.logs[0]?.scheduledDate;
      const todayWorkout = todayWorkouts.logs[0]?.scheduledDate;

      return {
        lastWorkout,
        todayWorkout,
        hasActivePlan: activePlans.length > 0,
        completionRate,
        workoutCountThisWeek: workoutLogs.logs.length,
      };
    } catch (error) {
      logger.error('[WellbeingQuestionEngine] Failed to get workout data', { userId, error });
      return {
        hasActivePlan: false,
        workoutCountThisWeek: 0,
      };
    }
  }

  /**
   * Get Whoop data (recovery, strain, sleep, HRV)
   */
  private async getWhoopData(userId: string): Promise<{
    isConnected: boolean;
    lastRecovery?: {
      score: number;
      date: string;
    };
    lastStrain?: {
      score: number;
      date: string;
    };
    lastSleep?: {
      score: number;
      date: string;
    };
    lastHRV?: {
      value: number;
      date: string;
    };
  }> {
    try {
      // Check if Whoop is connected
      const integrationResult = await query<{ id: string }>(
        `SELECT id FROM user_integrations 
         WHERE user_id = $1 AND provider = 'whoop' AND status = 'active' AND is_enabled = true`,
        [userId]
      );

      const isConnected = integrationResult.rows.length > 0;

      if (!isConnected) {
        return { isConnected: false };
      }

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Get latest recovery data
      const recoveryResult = await query<{
        recorded_at: Date;
        value: unknown;
      }>(
        `SELECT recorded_at, value FROM health_data_records 
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery' 
         AND recorded_at >= $2 
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, weekAgo]
      );

      // Get latest strain data
      const strainResult = await query<{
        recorded_at: Date;
        value: unknown;
      }>(
        `SELECT recorded_at, value FROM health_data_records 
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'strain' 
         AND recorded_at >= $2 
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, weekAgo]
      );

      // Get latest sleep data
      const sleepResult = await query<{
        recorded_at: Date;
        value: unknown;
      }>(
        `SELECT recorded_at, value FROM health_data_records 
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'sleep' 
         AND recorded_at >= $2 
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, weekAgo]
      );

      // Get latest HRV data
      const hrvResult = await query<{
        recorded_at: Date;
        value: unknown;
      }>(
        `SELECT recorded_at, value FROM health_data_records 
         WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'hrv' 
         AND recorded_at >= $2 
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, weekAgo]
      );

      const parseScore = (value: unknown): number | undefined => {
        if (typeof value === 'object' && value !== null) {
          const obj = value as Record<string, unknown>;
          if (typeof obj.score === 'number') return obj.score;
          if (typeof obj.value === 'number') return obj.value;
        }
        if (typeof value === 'number') return value;
        return undefined;
      };

      return {
        isConnected: true,
        lastRecovery: recoveryResult.rows[0]
          ? {
              score: parseScore(recoveryResult.rows[0].value) || 0,
              date: recoveryResult.rows[0].recorded_at.toISOString(),
            }
          : undefined,
        lastStrain: strainResult.rows[0]
          ? {
              score: parseScore(strainResult.rows[0].value) || 0,
              date: strainResult.rows[0].recorded_at.toISOString(),
            }
          : undefined,
        lastSleep: sleepResult.rows[0]
          ? {
              score: parseScore(sleepResult.rows[0].value) || 0,
              date: sleepResult.rows[0].recorded_at.toISOString(),
            }
          : undefined,
        lastHRV: hrvResult.rows[0]
          ? {
              value: parseScore(hrvResult.rows[0].value) || 0,
              date: hrvResult.rows[0].recorded_at.toISOString(),
            }
          : undefined,
      };
    } catch (error) {
      logger.error('[WellbeingQuestionEngine] Failed to get Whoop data', { userId, error });
      return { isConnected: false };
    }
  }

  /**
   * Get user goals and active plans
   */
  private async getUserGoalsAndPlans(userId: string): Promise<{
    activeGoals: Array<{ category: string; title: string }>;
    hasActiveWorkoutPlan: boolean;
    hasActiveDietPlan: boolean;
  }> {
    try {
      // Get active goals
      const goalsResult = await query<{ category: string; title: string }>(
        `SELECT category, title FROM user_goals 
         WHERE user_id = $1 AND status = 'active' 
         ORDER BY created_at DESC`,
        [userId]
      );

      // Check for active workout plan
      const workoutPlans = await workoutPlanService.getUserPlans(userId, 'active');

      // Check for active diet plan
      const dietPlanResult = await query<{ id: string }>(
        `SELECT id FROM diet_plans 
         WHERE user_id = $1 AND status = 'active' 
         LIMIT 1`,
        [userId]
      );

      return {
        activeGoals: goalsResult.rows,
        hasActiveWorkoutPlan: workoutPlans.length > 0,
        hasActiveDietPlan: dietPlanResult.rows.length > 0,
      };
    } catch (error) {
      logger.error('[WellbeingQuestionEngine] Failed to get goals and plans', { userId, error });
      return {
        activeGoals: [],
        hasActiveWorkoutPlan: false,
        hasActiveDietPlan: false,
      };
    }
  }

  /**
   * Detect patterns in wellbeing data
   */
  private async detectPatterns(
    userId: string,
    recentData: Awaited<ReturnType<typeof this.getRecentWellbeingData>>
  ): Promise<{
    highStress?: boolean;
    lowMood?: boolean;
    lowEnergy?: boolean;
    inconsistentJournaling?: boolean;
    lowWorkoutFrequency?: boolean;
    poorNutritionAdherence?: boolean;
    lowWhoopRecovery?: boolean;
    highStrainWithoutRecovery?: boolean;
  }> {
    const patterns: {
      highStress?: boolean;
      lowMood?: boolean;
      lowEnergy?: boolean;
      inconsistentJournaling?: boolean;
      lowWorkoutFrequency?: boolean;
      poorNutritionAdherence?: boolean;
      lowWhoopRecovery?: boolean;
      highStrainWithoutRecovery?: boolean;
    } = {};

    if (recentData.stressTrend === 'declining') {
      patterns.highStress = true;
    }

    if (recentData.moodTrend === 'declining') {
      patterns.lowMood = true;
    }

    // Check journal consistency
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const journalEntries = await journalService.getJournalEntries(userId, {
        startDate: weekAgo.toISOString().split('T')[0],
        limit: 10,
      });
      
      if (journalEntries.entries.length < 3) {
        patterns.inconsistentJournaling = true;
      }
    } catch (error) {
      // Ignore
    }

    // Check workout frequency
    try {
      const workoutData = await this.getWorkoutData(userId);
      if (workoutData.hasActivePlan && workoutData.workoutCountThisWeek < 2) {
        patterns.lowWorkoutFrequency = true;
      }
    } catch (error) {
      // Ignore
    }

    // Check nutrition adherence
    try {
      const nutritionData = await this.getNutritionData(userId);
      if (nutritionData.hasActiveDietPlan) {
        // Check if calories are significantly below target
        if (
          nutritionData.calorieTarget &&
          nutritionData.todayCalories &&
          nutritionData.todayCalories < nutritionData.calorieTarget * 0.7
        ) {
          patterns.poorNutritionAdherence = true;
        }
        // Check if very few meals logged today
        if (nutritionData.mealCountToday < 2) {
          patterns.poorNutritionAdherence = true;
        }
      }
    } catch (error) {
      // Ignore
    }

    // Check Whoop recovery patterns
    try {
      const whoopData = await this.getWhoopData(userId);
      if (whoopData.isConnected && whoopData.lastRecovery) {
        if (whoopData.lastRecovery.score < 50) {
          patterns.lowWhoopRecovery = true;
        }
        // Check for high strain without recovery
        if (
          whoopData.lastStrain &&
          whoopData.lastStrain.score > 15 &&
          whoopData.lastRecovery.score < 60
        ) {
          patterns.highStrainWithoutRecovery = true;
        }
      }
    } catch (error) {
      // Ignore
    }

    return patterns;
  }

  /**
   * Generate questions using LLM
   */
  private async generateQuestionsWithLLM(
    userId: string,
    recentData: Awaited<ReturnType<typeof this.getRecentWellbeingData>>,
    missingToday: Awaited<ReturnType<typeof this.checkMissingToday>>,
    patterns: Awaited<ReturnType<typeof this.detectPatterns>>,
    limit: number,
    conversationContext?: {
      message?: string;
      topic?: string;
      recentMessages?: Array<{ role: string; content: string }>;
    }
  ): Promise<WellbeingQuestion[]> {
    try {
      const timeOfDay = this.getTimeOfDay();
      
      // Build conversation context string
      let conversationContextStr = '';
      if (conversationContext) {
        if (conversationContext.message) {
          conversationContextStr += `Current user message: "${conversationContext.message}"\n`;
        }
        if (conversationContext.topic) {
          conversationContextStr += `Conversation topic: ${conversationContext.topic}\n`;
        }
        if (conversationContext.recentMessages && conversationContext.recentMessages.length > 0) {
          const recentUserMessages = conversationContext.recentMessages
            .filter(m => m.role === 'user')
            .slice(-3)
            .map(m => m.content)
            .join(' | ');
          if (recentUserMessages) {
            conversationContextStr += `Recent conversation: ${recentUserMessages}\n`;
          }
        }
      }

      // Add personalization based on user history, patterns, and trends
      let personalizationStr = '';
      
      // Mood personalization
      if (recentData.moodTrend === 'declining') {
        personalizationStr += `Note: User's mood has been declining recently. Reference this naturally if asking about mood: "I noticed you mentioned feeling stressed last week too. How are you managing it today?" or "Your mood seems lower this week. What's been different?"\n`;
      } else if (recentData.moodTrend === 'improving') {
        personalizationStr += `Note: User's mood has been improving. Acknowledge this positively: "I've noticed your mood has been better lately. How are you feeling today?"\n`;
      }
      
      // Stress personalization
      if (recentData.stressTrend === 'declining') {
        personalizationStr += `Note: User's stress has been increasing. Reference this naturally: "Your stress has been higher this week. What's been different?" or "I noticed you mentioned feeling stressed last week too. How are you managing it today?"\n`;
      } else if (recentData.stressTrend === 'improving') {
        personalizationStr += `Note: User's stress has been decreasing. Acknowledge this: "I've noticed your stress levels have been better. How are you feeling today?"\n`;
      }
      
      // Energy personalization
      if (recentData.lastEnergy) {
        const energyDate = new Date(recentData.lastEnergy);
        const daysSince = Math.floor((Date.now() - energyDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince > 3) {
          personalizationStr += `Note: User hasn't logged energy in ${daysSince} days. Consider asking about energy naturally.\n`;
        }
      }
      
      // Pattern-based personalization
      if (patterns.highStress) {
        personalizationStr += `Note: User shows high stress patterns. Ask about stress management: "I've noticed stress has been a theme. How are you handling it today?"\n`;
      }
      if (patterns.lowMood) {
        personalizationStr += `Note: User shows low mood patterns. Ask empathetically: "I've noticed you've been feeling down. How are you doing today?"\n`;
      }
      if (patterns.inconsistentJournaling) {
        personalizationStr += `Note: User hasn't been journaling consistently. If they share deep thoughts, suggest journaling: "That sounds like something worth reflecting on. Want to journal about it?"\n`;
      }
      
      // Goal-based personalization
      if (recentData.activeGoals.length > 0) {
        const goalCategories = recentData.activeGoals.map(g => g.category).join(', ');
        personalizationStr += `Note: User has active goals: ${goalCategories}. Reference these naturally in questions. For example, if weight_loss goal, ask about nutrition/workouts. If stress_wellness goal, ask about stress management.\n`;
      }
      
      // History-based personalization
      if (recentData.lastMood && recentData.moodTrend) {
        personalizationStr += `Note: User has mood history with ${recentData.moodTrend} trend. Reference past patterns naturally in questions.\n`;
      }

      const prompt = `You are a supportive health and wellness coach. Generate ${limit} natural, conversational questions to ask the user about their wellbeing, nutrition, workouts, and recovery.

IMPORTANT: These questions will be integrated naturally into a conversation response by an AI assistant. The questions should sound like a friend asking, NOT like a clinical assessment or survey. They should be warm, casual, and feel like part of a natural conversation.

${conversationContextStr ? `CONVERSATION CONTEXT:\n${conversationContextStr}\n` : ''}
${personalizationStr ? `PERSONALIZATION NOTES:\n${personalizationStr}\n` : ''}
Context:
- Time of day: ${timeOfDay}
- Last mood log: ${recentData.lastMood || 'none today'}
- Last stress log: ${recentData.lastStress || 'none today'}
- Last journal entry: ${recentData.lastJournal || 'none today'}
- Last energy log: ${recentData.lastEnergy || 'none today'}
- Last meal: ${recentData.lastMeal || 'none today'}
- Last workout: ${recentData.lastWorkout || 'none today'}
- Today's calories: ${recentData.todayCalories || 'not logged'} / ${recentData.calorieTarget || 'no target set'}
- Mood trend: ${recentData.moodTrend || 'unknown'}
- Stress trend: ${recentData.stressTrend || 'unknown'}
- Last recovery score: ${recentData.lastRecovery ? `${recentData.lastRecovery.score}%` : 'not available'}
- Last strain score: ${recentData.lastStrain ? `${recentData.lastStrain.score}` : 'not available'}

Active goals: ${recentData.activeGoals.length > 0 ? recentData.activeGoals.map(g => `${g.category}: ${g.title}`).join(', ') : 'none'}
- Has active workout plan: ${recentData.hasActiveWorkoutPlan}
- Has active diet plan: ${recentData.hasActiveDietPlan}

Missing today:
- Mood: ${missingToday.missingMood}
- Stress: ${missingToday.missingStress}
- Journal: ${missingToday.missingJournal}
- Energy: ${missingToday.missingEnergy}
- Breakfast: ${missingToday.missingBreakfast}
- Lunch: ${missingToday.missingLunch}
- Dinner: ${missingToday.missingDinner}
- Workout: ${missingToday.missingWorkout}
- Calorie logging: ${missingToday.missingCalorieLogging}

Patterns detected:
- High stress: ${patterns.highStress || false}
- Low mood: ${patterns.lowMood || false}
- Low energy: ${patterns.lowEnergy || false}
- Inconsistent journaling: ${patterns.inconsistentJournaling || false}
- Low workout frequency: ${patterns.lowWorkoutFrequency || false}
- Poor nutrition adherence: ${patterns.poorNutritionAdherence || false}
- Low Whoop recovery: ${patterns.lowWhoopRecovery || false}
- High strain without recovery: ${patterns.highStrainWithoutRecovery || false}

Generate ${limit} questions that are:
1. Natural and conversational (like talking to a friend - use casual language)
2. Contextually relevant based on the data above
3. Not overwhelming (1-2 questions at a time)
4. Varied and interesting
5. Supportive and empathetic
6. Sound like a friend asking, not a doctor or survey

Question Style Examples:
- GOOD: "How are you feeling today?" "What's your energy like?" "How's your stress level?"
- GOOD: "You doing okay?" "Feeling energized or a bit tired?" "Anything stressing you out?"
- BAD: "Please rate your mood on a scale of 1-10" "What is your current stress level?" "Have you logged your mood today?"

Prioritize questions based on:
- User's active goals (if weight loss goal → ask about nutrition/workouts)
- Active plans (if workout plan active → ask about workouts)
- Missing data (if no meal logged → ask about meals)
- Whoop data patterns (if recovery low → ask about recovery)
- Time of day (morning → breakfast/workout plans, evening → reflection/recovery)

Question types available: mood, stress, journal, energy, habits, schedule, nutrition, workout, meal, calories, whoop, general

Return JSON array:
[
  {
    "question": "string (natural, conversational question)",
    "type": "mood" | "stress" | "journal" | "energy" | "habits" | "schedule" | "nutrition" | "workout" | "meal" | "calories" | "whoop" | "general",
    "context": "optional context string",
    "priority": "high" | "medium" | "low"
  }
]`;

      const response = await this.llm.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      
      // Parse JSON (handles markdown fences, truncated output, etc.)
      const questions = parseLlmJson<WellbeingQuestion[]>(content);
      if (!questions || !Array.isArray(questions)) {
        logger.warn('[WellbeingQuestionEngine] Failed to parse LLM response', { content: content.substring(0, 200) });
        return this.getFallbackQuestions(limit, userId);
      }

      // Validate and limit
      return questions
        .filter((q) => q.question && q.type)
        .slice(0, limit)
        .map((q) => ({
          question: q.question,
          type: q.type,
          context: q.context,
          priority: q.priority || 'medium',
        }));
    } catch (error) {
      logger.error('[WellbeingQuestionEngine] Failed to generate questions with LLM', { userId, error });
      return this.getFallbackQuestions(limit, userId);
    }
  }

  /**
   * Get time of day category
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Get fallback questions when LLM fails
   */
  private async getFallbackQuestions(limit: number, userId?: string): Promise<WellbeingQuestion[]> {
    const timeOfDay = this.getTimeOfDay();
    const questions: WellbeingQuestion[] = [];

    // Try to get user context for better fallback questions
    let hasActiveWorkoutPlan = false;
    let hasActiveDietPlan = false;
    let whoopConnected = false;

    if (userId) {
      try {
        const goalsAndPlans = await this.getUserGoalsAndPlans(userId);
        hasActiveWorkoutPlan = goalsAndPlans.hasActiveWorkoutPlan;
        hasActiveDietPlan = goalsAndPlans.hasActiveDietPlan;

        const whoopData = await this.getWhoopData(userId);
        whoopConnected = whoopData.isConnected;
      } catch (error) {
        // Ignore errors, use defaults
      }
    }

    if (timeOfDay === 'morning') {
      questions.push({
        question: 'How are you feeling this morning?',
        type: 'mood',
        priority: 'high',
      });
      
      if (hasActiveDietPlan) {
        questions.push({
          question: 'What are you planning for breakfast?',
          type: 'meal',
          priority: 'medium',
        });
      } else {
        questions.push({
          question: 'What\'s your energy level like right now?',
          type: 'energy',
          priority: 'medium',
        });
      }

      if (hasActiveWorkoutPlan) {
        questions.push({
          question: 'Got a workout planned today?',
          type: 'workout',
          priority: 'medium',
        });
      }
    } else if (timeOfDay === 'afternoon') {
      questions.push({
        question: 'How\'s your day going?',
        type: 'general',
        priority: 'high',
      });

      if (hasActiveDietPlan) {
        questions.push({
          question: 'How\'s your nutrition been today?',
          type: 'nutrition',
          priority: 'medium',
        });
      }

      if (hasActiveWorkoutPlan) {
        questions.push({
          question: 'How did your workout go?',
          type: 'workout',
          priority: 'medium',
        });
      }
    } else if (timeOfDay === 'evening') {
      questions.push({
        question: 'How was your day?',
        type: 'general',
        priority: 'high',
      });

      if (whoopConnected) {
        questions.push({
          question: 'How was your recovery today?',
          type: 'whoop',
          priority: 'medium',
        });
      } else if (hasActiveDietPlan) {
        questions.push({
          question: 'Did you hit your calorie goals?',
          type: 'calories',
          priority: 'medium',
        });
      } else {
        questions.push({
          question: 'Would you like to reflect on your day?',
          type: 'journal',
          priority: 'medium',
        });
      }
    } else {
      questions.push({
        question: 'How are you doing?',
        type: 'general',
        priority: 'medium',
      });
    }

    return questions.slice(0, limit);
  }
}

export const wellbeingQuestionEngineService = new WellbeingQuestionEngineService();
export default wellbeingQuestionEngineService;

