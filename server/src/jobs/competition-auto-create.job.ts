/**
 * @file Competition Auto-Create Job
 * @description Automatically creates AI-generated competitions using dual-track logic:
 *   - Daily track: Always ensures a 1-day competition is running
 *   - Challenge track: Creates longer competitions (3, 7, or 15 days) independently
 * Runs hourly. Each track checks independently so a long challenge never blocks daily creation.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { competitionService } from '../services/competition.service.js';
import type { CompetitionRules } from '../services/competition.service.js';
import { smartCompetitionService } from '../services/smart-competition.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

const DAILY_DURATION = 1;
const CHALLENGE_DURATIONS = [3, 7, 15];

// ============================================
// COMPETITION TEMPLATES
// ============================================

interface CompetitionTemplate {
  name: string;
  description: string;
  rules: CompetitionRules;
  scoringWeights: { workout: number; nutrition: number; wellbeing: number; biometrics: number; engagement: number; consistency: number };
  badges: string[];
}

const TEMPLATES: CompetitionTemplate[] = [
  {
    name: 'Daily Workout Blitz',
    description: 'Push your limits! Log as many workouts as you can and rack up the highest total workout score.',
    rules: { metric: 'workout', aggregation: 'total', min_days: 1 },
    scoringWeights: { workout: 40, nutrition: 15, wellbeing: 10, biometrics: 15, engagement: 10, consistency: 10 },
    badges: ['Workout Blitz Champion'],
  },
  {
    name: 'Workout Streak Challenge',
    description: 'Consistency is king! Maintain a daily workout streak and outpace the competition.',
    rules: { metric: 'workout', aggregation: 'streak', min_days: 1 },
    scoringWeights: { workout: 30, nutrition: 10, wellbeing: 10, biometrics: 10, engagement: 15, consistency: 25 },
    badges: ['Streak Master'],
  },
  {
    name: 'Nutrition Mastery',
    description: 'Fuel your body right! Achieve the highest average nutrition score across the competition.',
    rules: { metric: 'nutrition', aggregation: 'average', min_days: 1 },
    scoringWeights: { workout: 10, nutrition: 40, wellbeing: 15, biometrics: 10, engagement: 10, consistency: 15 },
    badges: ['Nutrition Expert'],
  },
  {
    name: 'Clean Eating Sprint',
    description: 'Track every meal and hit your macros! The highest total nutrition score wins.',
    rules: { metric: 'nutrition', aggregation: 'total', min_days: 1 },
    scoringWeights: { workout: 10, nutrition: 40, wellbeing: 10, biometrics: 10, engagement: 15, consistency: 15 },
    badges: ['Clean Eating Pro'],
  },
  {
    name: 'Wellness Focus',
    description: 'Prioritize recovery, sleep, and mental wellbeing. The best average wellbeing score takes the crown.',
    rules: { metric: 'wellbeing', aggregation: 'average', min_days: 1 },
    scoringWeights: { workout: 10, nutrition: 15, wellbeing: 30, biometrics: 20, engagement: 10, consistency: 15 },
    badges: ['Wellness Champion'],
  },
  {
    name: 'Recovery Champion',
    description: 'Show off your best day! Hit the highest single-day biometrics score to win.',
    rules: { metric: 'biometrics', aggregation: 'max', min_days: 1 },
    scoringWeights: { workout: 10, nutrition: 10, wellbeing: 20, biometrics: 40, engagement: 10, consistency: 10 },
    badges: ['Recovery King'],
  },
  {
    name: 'Total Health Challenge',
    description: 'The ultimate test! Combine workout, nutrition, wellbeing, biometrics, and engagement for the highest overall score.',
    rules: { metric: 'total', aggregation: 'total', min_days: 1 },
    scoringWeights: { workout: 25, nutrition: 20, wellbeing: 15, biometrics: 15, engagement: 10, consistency: 15 },
    badges: ['Total Health Champion'],
  },
  {
    name: 'Engagement Marathon',
    description: 'Stay active every day! Complete tasks, habits, and routines consistently to build the longest engagement streak.',
    rules: { metric: 'engagement', aggregation: 'streak', min_days: 1 },
    scoringWeights: { workout: 10, nutrition: 10, wellbeing: 10, biometrics: 10, engagement: 35, consistency: 25 },
    badges: ['Engagement Legend'],
  },
];

// ============================================
// HELPERS
// ============================================

/**
 * Pick a template using smart goal-weighted selection.
 * Falls back to random if smart service fails.
 */
async function pickTemplate(avoidName?: string): Promise<CompetitionTemplate> {
  try {
    const recentNames = await smartCompetitionService.getRecentTemplateNames(5);
    const result = await smartCompetitionService.selectBestTemplateIndex('daily', recentNames);

    // Smart template (custom, not in TEMPLATES array)
    if (result.smartTemplate) {
      logger.info('[CompetitionAutoCreate] Smart template selected', { name: result.smartTemplate.name, reason: result.reason });
      return {
        name: result.smartTemplate.name,
        description: result.smartTemplate.description,
        rules: result.smartTemplate.rules,
        scoringWeights: result.smartTemplate.scoringWeights,
        badges: result.smartTemplate.badges,
      };
    }

    // Standard template by index
    if (result.index >= 0 && result.index < TEMPLATES.length) {
      const template = TEMPLATES[result.index];
      if (template.name !== avoidName) {
        logger.info('[CompetitionAutoCreate] Goal-weighted template selected', { name: template.name, reason: result.reason });
        return template;
      }
    }
  } catch (error) {
    logger.warn('[CompetitionAutoCreate] Smart selection failed, falling back to random', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Fallback: random selection
  const pool = avoidName ? TEMPLATES.filter((t) => t.name !== avoidName) : TEMPLATES;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Create a competition from a template with the given duration
 */
async function createCompetitionFromTemplate(
  template: CompetitionTemplate,
  durationDays: number,
  track: 'daily' | 'challenge'
): Promise<void> {
  const now = new Date();
  const startDate = now;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + durationDays);

  const competition = await competitionService.createCompetition({
    name: template.name,
    type: 'ai_generated',
    description: template.description,
    startDate,
    endDate,
    rules: template.rules,
    eligibility: {},
    scoringWeights: template.scoringWeights,
    antiCheatPolicy: {},
    prizeMetadata: {
      badges: template.badges,
      top_n: 10,
      track,
    },
    status: 'active',
    createdBy: null,
  });

  logger.info(`[CompetitionAutoCreate] Created ${track} competition`, {
    id: competition.id,
    name: competition.name,
    duration: `${durationDays} day(s)`,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    metric: template.rules.metric,
    aggregation: template.rules.aggregation,
  });
}

// ============================================
// DUAL-TRACK LOGIC
// ============================================

/**
 * Daily track: ensures a 1-day competition is always running.
 * Only looks at competitions with duration <= 1 day.
 */
async function ensureDailyCompetition(): Promise<void> {
  const latestResult = await query<{
    id: string;
    name: string;
    status: string;
    end_date: Date;
  }>(
    `SELECT id, name, status, end_date
     FROM competitions
     WHERE type = 'ai_generated'
       AND (end_date::date - start_date::date) <= 1
     ORDER BY end_date DESC
     LIMIT 1`
  );

  const latest = latestResult.rows[0] ?? null;
  const now = new Date();

  // If there's an active daily competition that hasn't expired, skip
  if (latest && new Date(latest.end_date) > now) {
    logger.debug('[CompetitionAutoCreate] Daily competition still running', {
      id: latest.id,
      name: latest.name,
      endsAt: latest.end_date,
    });
    return;
  }

  // Mark expired competition as 'ended' if still 'active'
  if (latest && latest.status === 'active') {
    await query(
      `UPDATE competitions SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [latest.id]
    );
    logger.info('[CompetitionAutoCreate] Marked expired daily competition as ended', {
      id: latest.id,
      name: latest.name,
    });
  }

  const template = await pickTemplate(latest?.name);
  await createCompetitionFromTemplate(template, DAILY_DURATION, 'daily');
}

/**
 * Challenge track: ensures a multi-day challenge (3, 7, or 15 days) is running.
 * Only looks at competitions with duration > 1 day.
 */
async function ensureChallengeCompetition(): Promise<void> {
  const latestResult = await query<{
    id: string;
    name: string;
    status: string;
    end_date: Date;
  }>(
    `SELECT id, name, status, end_date
     FROM competitions
     WHERE type = 'ai_generated'
       AND (end_date::date - start_date::date) > 1
     ORDER BY end_date DESC
     LIMIT 1`
  );

  const latest = latestResult.rows[0] ?? null;
  const now = new Date();

  // If there's an active challenge that hasn't expired, skip
  if (latest && new Date(latest.end_date) > now) {
    logger.debug('[CompetitionAutoCreate] Challenge competition still running', {
      id: latest.id,
      name: latest.name,
      endsAt: latest.end_date,
    });
    return;
  }

  // Mark expired competition as 'ended' if still 'active'
  if (latest && latest.status === 'active') {
    await query(
      `UPDATE competitions SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [latest.id]
    );
    logger.info('[CompetitionAutoCreate] Marked expired challenge competition as ended', {
      id: latest.id,
      name: latest.name,
    });
  }

  const template = await pickTemplate(latest?.name);
  const durationDays = CHALLENGE_DURATIONS[Math.floor(Math.random() * CHALLENGE_DURATIONS.length)];
  await createCompetitionFromTemplate(template, durationDays, 'challenge');
}

// ============================================
// JOB PROCESSOR
// ============================================

async function processAutoCreate(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    // Run both tracks independently
    await ensureDailyCompetition();
    await ensureChallengeCompetition();
  } catch (error) {
    logger.error('[CompetitionAutoCreate] Fatal error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB LIFECYCLE
// ============================================

export function startCompetitionAutoCreate(): void {
  if (intervalId) {
    logger.warn('[CompetitionAutoCreate] Already running');
    return;
  }

  logger.info('[CompetitionAutoCreate] Starting competition auto-create job (dual-track)', {
    intervalMs: JOB_INTERVAL_MS,
    templateCount: TEMPLATES.length,
    dailyDuration: DAILY_DURATION,
    challengeDurations: CHALLENGE_DURATIONS,
  });

  // Run immediately on start
  processAutoCreate();

  // Then run on interval
  intervalId = setInterval(processAutoCreate, JOB_INTERVAL_MS);
}

export function stopCompetitionAutoCreate(): void {
  if (!intervalId) {
    logger.warn('[CompetitionAutoCreate] Not running');
    return;
  }

  clearInterval(intervalId);
  intervalId = null;
  logger.info('[CompetitionAutoCreate] Stopped competition auto-create job');
}

export function isCompetitionAutoCreateRunning(): boolean {
  return intervalId !== null;
}

// ============================================
// EXPORTS
// ============================================

export const competitionAutoCreateJob = {
  start: startCompetitionAutoCreate,
  stop: stopCompetitionAutoCreate,
  isRunning: isCompetitionAutoCreateRunning,
  processNow: processAutoCreate,
};

export default competitionAutoCreateJob;
