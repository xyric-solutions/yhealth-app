/**
 * @file Intervention Engine Job
 * @description Scheduled job that runs the intelligent intervention framework for all
 * active users. Evaluates cross-pillar contradictions and applies decision trees to
 * auto-adjust training, nutrition, and recovery plans.
 *
 * Runs every 4 hours to balance responsiveness with resource usage.
 * Depends on: daily-analysis.job (generates reports), cross-pillar-intelligence
 * (detects contradictions), user-classification (provides tier).
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { comprehensiveUserContextService } from '../services/comprehensive-user-context.service.js';
import { crossPillarIntelligenceService } from '../services/cross-pillar-intelligence.service.js';
import { userClassificationService } from '../services/user-classification.service.js';
import { intelligentInterventionService } from '../services/intelligent-intervention.service.js';
import { dailyAnalysisService } from '../services/daily-analysis.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 4 * 60 * 60 * 1000; // Run every 4 hours
const BATCH_SIZE = 5;
const INTER_BATCH_DELAY_MS = 2000;
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

async function processInterventionEngine(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    // Find active users with recent daily reports (eligible for interventions)
    const result = await query<{ id: string }>(
      `SELECT DISTINCT u.id
       FROM users u
       INNER JOIN daily_analysis_reports dar ON dar.user_id = u.id
       WHERE u.is_active = true
         AND dar.report_date >= CURRENT_DATE - INTERVAL '1 day'
       ORDER BY u.id
       LIMIT 100`,
    );

    if (result.rows.length === 0) {
      logger.debug('[InterventionEngine] No eligible users');
      return;
    }

    let processed = 0;
    let interventionsCreated = 0;
    let errors = 0;

    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (user) => {
          try {
            // Gather all context needed for intervention evaluation
            const [context, report] = await Promise.all([
              comprehensiveUserContextService.getComprehensiveContext(user.id),
              dailyAnalysisService.getLatestReport(user.id),
            ]);

            if (!context || !report) {
              return; // Skip users without sufficient data
            }

            // Run cross-pillar analysis
            const contradictions = await crossPillarIntelligenceService.analyzeUser(
              user.id,
              report.snapshot,
              context
            );

            // Classify user
            const classification = await userClassificationService.classifyUser(user.id, context);

            // Run intervention decision trees
            const interventions = await intelligentInterventionService.evaluateAndIntervene(
              user.id,
              report.snapshot,
              context,
              classification,
              contradictions
            );

            processed++;
            interventionsCreated += interventions.length;

            if (interventions.length > 0) {
              logger.debug('[InterventionEngine] Interventions created', {
                userId: user.id,
                count: interventions.length,
                types: interventions.map(i => i.type),
              });
            }
          } catch (error) {
            errors++;
            logger.error('[InterventionEngine] Failed to process user', {
              userId: user.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );

      if (i + BATCH_SIZE < result.rows.length) {
        await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }

    if (processed > 0 || errors > 0) {
      logger.info('[InterventionEngine] Processing complete', {
        processed,
        interventionsCreated,
        errors,
        totalEligible: result.rows.length,
      });
    }
  } catch (error) {
    logger.error('[InterventionEngine] Fatal error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB LIFECYCLE
// ============================================

export function startInterventionEngine(): void {
  if (intervalId) {
    logger.warn('[InterventionEngine] Already running');
    return;
  }

  logger.info('[InterventionEngine] Starting intervention engine', {
    intervalMs: JOB_INTERVAL_MS,
    batchSize: BATCH_SIZE,
  });

  // Delay first run by 30 minutes to let daily analysis complete first
  setTimeout(() => {
    processInterventionEngine();
    intervalId = setInterval(processInterventionEngine, JOB_INTERVAL_MS);
  }, 30 * 60 * 1000);
}

export function stopInterventionEngine(): void {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  logger.info('[InterventionEngine] Stopped');
}

export function isInterventionEngineRunning(): boolean {
  return intervalId !== null;
}

export const interventionEngineJob = {
  start: startInterventionEngine,
  stop: stopInterventionEngine,
  isRunning: isInterventionEngineRunning,
  processNow: processInterventionEngine,
};

export default interventionEngineJob;
