/**
 * @file Inconsistency Detection Service
 * @description Detects inconsistencies between what users SAY in chat and what
 * their actual data shows. When user says "I ate clean today" but nutrition log
 * shows otherwise, the AI can confront this naturally.
 *
 * Integrates into the chat flow to provide context-aware responses.
 */

import { logger } from './logger.service.js';
import type { CompactMessageContext } from './comprehensive-user-context.service.js';

// ============================================
// TYPES
// ============================================

export interface DetectedInconsistency {
  type: string;
  userClaim: string;
  actualData: Record<string, unknown>;
  severity: 'minor' | 'moderate' | 'significant';
  suggestedResponse: string;
}

// ============================================
// INCONSISTENCY PATTERNS
// ============================================

interface InconsistencyPattern {
  id: string;
  keywords: string[];
  check(_userMessage: string, ctx: CompactMessageContext): DetectedInconsistency | null;
}

const PATTERNS: InconsistencyPattern[] = [
  {
    id: 'CLEAN_EATING_CLAIM',
    keywords: ['ate clean', 'eating clean', 'clean diet', 'ate healthy', 'eating healthy', 'been good with food'],
    check(_userMessage, ctx) {
      if (ctx.nutritionAdherence === null || ctx.nutritionAdherence >= 75) return null;
      return {
        type: 'CLEAN_EATING_CLAIM',
        userClaim: 'Claims clean eating',
        actualData: { nutritionAdherence: ctx.nutritionAdherence },
        severity: ctx.nutritionAdherence < 50 ? 'significant' : 'moderate',
        suggestedResponse: `I see your nutrition adherence is at ${ctx.nutritionAdherence}% this week. Let's look at what "eating clean" means for your goals — sometimes our perception and the data tell different stories. What does a typical clean eating day look like for you?`,
      };
    },
  },
  {
    id: 'GOOD_SLEEP_CLAIM',
    keywords: ['slept well', 'good sleep', 'slept great', 'great sleep', 'rested well'],
    check(_userMessage, ctx) {
      if (ctx.sleepHours === null || ctx.sleepHours >= 7) return null;
      return {
        type: 'GOOD_SLEEP_CLAIM',
        userClaim: 'Claims good sleep',
        actualData: { sleepHours: ctx.sleepHours },
        severity: ctx.sleepHours < 5.5 ? 'significant' : 'minor',
        suggestedResponse: `Your WHOOP data shows ${ctx.sleepHours.toFixed(1)}h of sleep. That might feel okay, but optimal recovery needs 7-9h. Your perception of "good sleep" might have shifted — let's recalibrate what truly restorative sleep looks like.`,
      };
    },
  },
  {
    id: 'HYDRATION_CLAIM',
    keywords: ['drinking enough', 'staying hydrated', 'good with water', 'drinking plenty'],
    check(_userMessage, ctx) {
      if (ctx.waterPct === null || ctx.waterPct >= 70) return null;
      return {
        type: 'HYDRATION_CLAIM',
        userClaim: 'Claims adequate hydration',
        actualData: { waterPercentage: ctx.waterPct },
        severity: ctx.waterPct < 40 ? 'significant' : 'moderate',
        suggestedResponse: `Your hydration log shows ${ctx.waterPct}% of your daily target. What does "enough water" feel like to you? Sometimes thirst signals decline when we're chronically under-hydrated.`,
      };
    },
  },
  {
    id: 'WORKOUT_INTENSITY_CLAIM',
    keywords: ['went hard', 'crushed it', 'intense workout', 'killed it', 'beast mode', 'pushed hard'],
    check(_userMessage, ctx) {
      if (ctx.recoveryScore === null || ctx.recoveryScore >= 40) return null;
      return {
        type: 'WORKOUT_INTENSITY_CLAIM',
        userClaim: 'Claims high-intensity workout',
        actualData: { recoveryScore: ctx.recoveryScore },
        severity: ctx.recoveryScore < 25 ? 'significant' : 'moderate',
        suggestedResponse: `I see the effort, but your recovery is at ${ctx.recoveryScore}% — going hard today could set you back. How do you feel physically right now, ignoring the mental drive? Your body's data suggests a different story than your motivation.`,
      };
    },
  },
  {
    id: 'CONSISTENCY_CLAIM',
    keywords: ['been consistent', 'not missing', 'on track', 'sticking to it', 'been good'],
    check(_userMessage, ctx) {
      if (ctx.dailyScore === null || ctx.dailyScore >= 60) return null;
      if (ctx.streakDays >= 5) return null; // They ARE consistent if streak is high
      return {
        type: 'CONSISTENCY_CLAIM',
        userClaim: 'Claims consistency',
        actualData: { dailyScore: ctx.dailyScore, streakDays: ctx.streakDays },
        severity: ctx.dailyScore < 40 ? 'significant' : 'minor',
        suggestedResponse: `Your health score is at ${ctx.dailyScore}/100 with a ${ctx.streakDays}-day streak. Consistency is about the compound effect — let's identify which specific area needs more attention to get that score moving up.`,
      };
    },
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class InconsistencyDetectionService {
  /**
   * Analyze a user's chat message against their actual data.
   * Returns detected inconsistencies (if any) to enrich the AI response.
   */
  async analyzeMessage(
    userMessage: string,
    ctx: CompactMessageContext
  ): Promise<DetectedInconsistency[]> {
    const detected: DetectedInconsistency[] = [];
    const messageLower = userMessage.toLowerCase();

    for (const pattern of PATTERNS) {
      const hasKeyword = pattern.keywords.some(kw => messageLower.includes(kw));
      if (!hasKeyword) continue;

      try {
        const inconsistency = pattern.check(userMessage, ctx);
        if (inconsistency) {
          detected.push(inconsistency);
        }
      } catch (error) {
        logger.warn('[InconsistencyDetection] Pattern check error', {
          patternId: pattern.id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    if (detected.length > 0) {
      logger.debug('[InconsistencyDetection] Inconsistencies detected', {
        count: detected.length,
        types: detected.map(d => d.type),
      });
    }

    return detected;
  }

  /**
   * Build a context addition for the AI system prompt when inconsistencies are detected.
   */
  buildPromptContext(inconsistencies: DetectedInconsistency[]): string {
    if (inconsistencies.length === 0) return '';

    const parts = inconsistencies.map(inc =>
      `DETECTED INCONSISTENCY: User claims "${inc.userClaim}" but data shows ${JSON.stringify(inc.actualData)}. ` +
      `Severity: ${inc.severity}. Address this naturally — don't accuse, but gently reference the data.`
    );

    return `\n\n--- DATA-CLAIM INCONSISTENCIES ---\n${parts.join('\n')}\n` +
      `IMPORTANT: Address inconsistencies with empathy and curiosity, not judgment. ` +
      `Use phrases like "I notice..." or "Your data shows..." rather than "You're wrong about..."`;
  }
}

export const inconsistencyDetectionService = new InconsistencyDetectionService();
export default inconsistencyDetectionService;
