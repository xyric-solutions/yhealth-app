/**
 * @file Wellbeing Context Service
 * @description Retrieves relevant wellbeing history using vector search for AI context
 */

import { logger } from './logger.service.js';
import { wellbeingEmbeddingService } from './wellbeing-embedding.service.js';
import { moodService } from './wellbeing/mood.service.js';
import { stressService } from './stress.service.js';
import { journalService } from './wellbeing/journal.service.js';
import { energyService } from './wellbeing/energy.service.js';
import { habitService } from './wellbeing/habit.service.js';
import { breathingService } from './wellbeing/breathing.service.js';

// ============================================
// TYPES
// ============================================

export interface WellbeingContext {
  recentMood?: {
    averageRating?: number;
    lastLogged?: string;
    trend?: 'improving' | 'stable' | 'declining';
    missingToday?: boolean;
    hoursSinceLastLog?: number;
  };
  recentStress?: {
    averageRating?: number;
    lastLogged?: string;
    trend?: 'improving' | 'stable' | 'declining';
    missingToday?: boolean;
    hoursSinceLastLog?: number;
  };
  recentEnergy?: {
    averageRating?: number;
    lastLogged?: string;
    missingToday?: boolean;
    hoursSinceLastLog?: number;
  };
  journalStreak?: {
    currentStreak: number;
    longestStreak: number;
    missingToday?: boolean;
  };
  activeHabits?: number;
  recentBreathing?: {
    totalTests?: number;
    averageBreathHoldSeconds?: number;
    bestBreathHoldSeconds?: number;
    lastTestDate?: string;
    mostUsedTestType?: string;
    improvementPercentage?: number;
    missingToday?: boolean;
  };
  relevantHistory?: Array<{
    type: string;
    content: string;
    date: string;
    similarity: number;
  }>;
  missingToday?: {
    mood: boolean;
    stress: boolean;
    energy: boolean;
    journal: boolean;
    breathing?: boolean;
  };
}

// ============================================
// SERVICE CLASS
// ============================================

class WellbeingContextService {
  /** In-memory cache for wellbeing context (5-min TTL, only for non-queryText calls) */
  private contextCache: Map<string, { data: WellbeingContext; expiresAt: number }> = new Map();
  private static readonly CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get comprehensive wellbeing context for AI assistant
   */
  async getWellbeingContext(userId: string, queryText?: string): Promise<WellbeingContext> {
    try {
      // Use cache for non-queryText calls (e.g., from getComprehensiveContext)
      if (!queryText) {
        const cached = this.contextCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
          logger.debug('[WellbeingContext] Cache hit', { userId });
          return cached.data;
        }
      }

      const context: WellbeingContext = {};
      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);

      // Get recent mood data
      const moodLogs = await moodService.getMoodLogs(userId, {
        startDate: this.getDateDaysAgo(7),
        limit: 10,
      });

      if (moodLogs.logs.length > 0) {
        const ratings = moodLogs.logs
          .map((log) => log.happinessRating || (log.moodEmoji === '😊' ? 9 : log.moodEmoji === '😐' ? 6 : 4))
          .filter((r) => r !== undefined) as number[];

        if (ratings.length > 0) {
          const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          const lastLogged = new Date(moodLogs.logs[0].loggedAt);
          const hoursSinceLastLog = (Date.now() - lastLogged.getTime()) / (1000 * 60 * 60);
          const missingToday = lastLogged < todayStart;
          
          context.recentMood = {
            averageRating: avgRating,
            lastLogged: moodLogs.logs[0].loggedAt,
            missingToday,
            hoursSinceLastLog: Math.round(hoursSinceLastLog),
          };

          // Calculate trend
          if (ratings.length >= 3) {
            const recent = ratings.slice(0, 3);
            const older = ratings.slice(3, 6);
            if (older.length >= 2) {
              const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
              const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
              
              if (avgRecent > avgOlder + 1) context.recentMood.trend = 'improving';
              else if (avgRecent < avgOlder - 1) context.recentMood.trend = 'declining';
              else context.recentMood.trend = 'stable';
            }
          }
        }
      } else {
        // No mood logs at all
        context.recentMood = {
          missingToday: true,
        };
      }

      // Get recent stress data
      const stressLogs = await stressService.getStressLogs(
        userId,
        this.getDateDaysAgo(7),
        new Date().toISOString().split('T')[0]
      );

      if (stressLogs.length > 0) {
        const avgRating = stressLogs.reduce((sum, log) => sum + log.stressRating, 0) / stressLogs.length;
        const lastLogged = new Date(stressLogs[0].loggedAt);
        const hoursSinceLastLog = (Date.now() - lastLogged.getTime()) / (1000 * 60 * 60);
        const missingToday = lastLogged < todayStart;
        
        context.recentStress = {
          averageRating: avgRating,
          lastLogged: stressLogs[0].loggedAt,
          missingToday,
          hoursSinceLastLog: Math.round(hoursSinceLastLog),
        };

        // Calculate trend
        if (stressLogs.length >= 3) {
          const recent = stressLogs.slice(0, 3).map((log) => log.stressRating);
          const older = stressLogs.slice(3, 6).map((log) => log.stressRating);
          if (older.length >= 2) {
            const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
            const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
            
            if (avgRecent < avgOlder - 1) context.recentStress.trend = 'improving';
            else if (avgRecent > avgOlder + 1) context.recentStress.trend = 'declining';
            else context.recentStress.trend = 'stable';
          }
        }
      } else {
        // No stress logs at all
        context.recentStress = {
          missingToday: true,
        };
      }

      // Get recent energy data
      const energyLogs = await energyService.getEnergyLogs(userId, {
        startDate: this.getDateDaysAgo(7),
        limit: 10,
      });

      if (energyLogs.logs.length > 0) {
        const avgRating = energyLogs.logs.reduce((sum, log) => sum + log.energyRating, 0) / energyLogs.logs.length;
        const lastLogged = new Date(energyLogs.logs[0].loggedAt);
        const hoursSinceLastLog = (Date.now() - lastLogged.getTime()) / (1000 * 60 * 60);
        const missingToday = lastLogged < todayStart;
        
        context.recentEnergy = {
          averageRating: avgRating,
          lastLogged: energyLogs.logs[0].loggedAt,
          missingToday,
          hoursSinceLastLog: Math.round(hoursSinceLastLog),
        };
      } else {
        // No energy logs at all
        context.recentEnergy = {
          missingToday: true,
        };
      }

      // Get journal streak
      try {
        const streak = await journalService.getJournalStreak(userId);
        // Check if journal entry exists today
        const todayJournal = await journalService.getJournalEntries(userId, {
          startDate: today,
          endDate: today,
          limit: 1,
        });
        context.journalStreak = {
          ...streak,
          missingToday: todayJournal.entries.length === 0,
        };
      } catch (error) {
        // Ignore
      }

      // Get breathing stats
      try {
        const breathingStats = await breathingService.getBreathingStats(userId, 7);
        const breathingTests = await breathingService.getBreathingTests(userId, {
          limit: 1,
        });
        
        const lastTestDate = breathingTests.tests.length > 0
          ? new Date(breathingTests.tests[0].completedAt)
          : null;
        const missingToday = lastTestDate
          ? lastTestDate < todayStart
          : true;

        if (breathingStats.totalTests > 0) {
          context.recentBreathing = {
            totalTests: breathingStats.totalTests,
            averageBreathHoldSeconds: breathingStats.averageBreathHoldSeconds,
            bestBreathHoldSeconds: breathingStats.bestBreathHoldSeconds,
            lastTestDate: lastTestDate?.toISOString(),
            mostUsedTestType: breathingStats.mostUsedTestType,
            improvementPercentage: breathingStats.improvementPercentage,
            missingToday,
          };
        } else {
          context.recentBreathing = {
            missingToday: true,
          };
        }
      } catch (error) {
        logger.warn('[WellbeingContext] Failed to get breathing stats', { userId, error });
      }
      
      // Build missingToday summary
      context.missingToday = {
        mood: context.recentMood?.missingToday ?? true,
        stress: context.recentStress?.missingToday ?? true,
        energy: context.recentEnergy?.missingToday ?? true,
        journal: context.journalStreak?.missingToday ?? true,
        breathing: context.recentBreathing?.missingToday ?? true,
      };

      // Get active habits count
      try {
        const habits = await habitService.getHabits(userId, false);
        context.activeHabits = habits.length;
      } catch (error) {
        // Ignore
      }

      // Get relevant history using vector search if query provided
      if (queryText) {
        try {
          const history = await wellbeingEmbeddingService.searchWellbeingHistory(userId, queryText, undefined, 5);
          context.relevantHistory = history.map((h) => ({
            type: h.wellbeingType,
            content: h.content.substring(0, 200), // Truncate for context
            date: h.metadata?.date as string || 'unknown',
            similarity: h.similarity,
          }));
        } catch (error) {
          logger.warn('[WellbeingContext] Failed to get relevant history', { userId, error });
        }
      }

      // Cache the result for non-queryText calls
      if (!queryText) {
        this.contextCache.set(userId, {
          data: context,
          expiresAt: Date.now() + WellbeingContextService.CONTEXT_CACHE_TTL,
        });
      }

      return context;
    } catch (error) {
      logger.error('[WellbeingContext] Failed to get wellbeing context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Format context as string for AI prompt
   */
  formatContextForPrompt(context: WellbeingContext): string {
    const parts: string[] = [];

    if (context.recentMood) {
      if (context.recentMood.averageRating !== undefined) {
        parts.push(`Recent mood: Average ${context.recentMood.averageRating.toFixed(1)}/10`);
      }
      if (context.recentMood.trend) {
        parts.push(`Mood trend: ${context.recentMood.trend}`);
      }
      if (context.recentMood.lastLogged) {
        parts.push(`Last mood log: ${new Date(context.recentMood.lastLogged).toLocaleDateString()}`);
      }
      if (context.recentMood.missingToday) {
        parts.push(`⚠️ User hasn't logged mood today - consider asking naturally about how they're feeling`);
      }
    }

    if (context.recentStress) {
      if (context.recentStress.averageRating !== undefined) {
        parts.push(`Recent stress: Average ${context.recentStress.averageRating.toFixed(1)}/10`);
      }
      if (context.recentStress.trend) {
        parts.push(`Stress trend: ${context.recentStress.trend}`);
      }
      if (context.recentStress.lastLogged) {
        parts.push(`Last stress log: ${new Date(context.recentStress.lastLogged).toLocaleDateString()}`);
      }
      if (context.recentStress.missingToday) {
        parts.push(`⚠️ User hasn't logged stress today - consider asking naturally about their stress level`);
      }
    }

    if (context.recentEnergy) {
      if (context.recentEnergy.averageRating !== undefined) {
        parts.push(`Recent energy: Average ${context.recentEnergy.averageRating.toFixed(1)}/10`);
      }
      if (context.recentEnergy.lastLogged) {
        parts.push(`Last energy log: ${new Date(context.recentEnergy.lastLogged).toLocaleDateString()}`);
      }
      if (context.recentEnergy.missingToday) {
        parts.push(`⚠️ User hasn't logged energy today - consider asking naturally about their energy level`);
      }
    }

    if (context.journalStreak) {
      parts.push(`Journal streak: ${context.journalStreak.currentStreak} days (longest: ${context.journalStreak.longestStreak})`);
      if (context.journalStreak.missingToday) {
        parts.push(`⚠️ User hasn't journaled today - consider suggesting journaling if they share deep thoughts`);
      }
    }

    if (context.activeHabits !== undefined) {
      parts.push(`Active habits: ${context.activeHabits}`);
    }

    if (context.recentBreathing) {
      if (context.recentBreathing.totalTests !== undefined && context.recentBreathing.totalTests > 0) {
        if (context.recentBreathing.averageBreathHoldSeconds !== undefined && context.recentBreathing.averageBreathHoldSeconds > 0) {
          parts.push(`Breathing: Average breath hold ${context.recentBreathing.averageBreathHoldSeconds.toFixed(1)}s (best: ${context.recentBreathing.bestBreathHoldSeconds?.toFixed(1)}s)`);
        }
        if (context.recentBreathing.mostUsedTestType) {
          parts.push(`Most used breathing technique: ${context.recentBreathing.mostUsedTestType}`);
        }
        if (context.recentBreathing.improvementPercentage !== undefined && context.recentBreathing.improvementPercentage !== 0) {
          const direction = context.recentBreathing.improvementPercentage > 0 ? 'improved' : 'declined';
          parts.push(`Breathing ${direction}: ${Math.abs(context.recentBreathing.improvementPercentage).toFixed(1)}% from baseline`);
        }
        if (context.recentBreathing.lastTestDate) {
          parts.push(`Last breathing test: ${new Date(context.recentBreathing.lastTestDate).toLocaleDateString()}`);
        }
      }
      if (context.recentBreathing.missingToday) {
        parts.push(`⚠️ User hasn't done a breathing exercise today - consider suggesting breathing exercises for stress relief or recovery`);
      }
    }
    
    if (context.missingToday) {
      const missing = Object.entries(context.missingToday)
        .filter(([_, missing]) => missing)
        .map(([type, _]) => type);
      if (missing.length > 0) {
        parts.push(`\nMissing today: ${missing.join(', ')} - Ask about these naturally when conversation allows`);
      }
    }

    if (context.relevantHistory && context.relevantHistory.length > 0) {
      parts.push('\nRelevant history:');
      context.relevantHistory.forEach((h) => {
        parts.push(`- [${h.type}] ${h.content} (${h.date})`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Get date string N days ago
   */
  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}

export const wellbeingContextService = new WellbeingContextService();
export default wellbeingContextService;

