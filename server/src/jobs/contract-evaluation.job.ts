/**
 * @file Contract Evaluation Job
 * @description Runs every 2 hours. Evaluates active accountability contracts,
 * records check results, detects violations, executes penalties, and manages
 * contract lifecycle (expiry, auto-renewal, at-risk detection).
 *
 * Timezone-aware: only evaluates during 7AM–10PM local time.
 * Batch processing with inter-batch delays to prevent DB saturation.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { accountabilityContractService } from '../services/accountability-contract.service.js';

const JOB_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const STARTUP_DELAY_MS = 840_000; // 14 minutes (after accountability-trigger at 780s)
const BATCH_SIZE = 5;
const INTER_BATCH_DELAY_MS = 2000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

async function processContracts(): Promise<void> {
  if (running) {
    logger.info('[ContractEvalJob] Previous run still in progress, skipping');
    return;
  }

  running = true;
  const startTime = Date.now();
  let evaluated = 0;
  let passed = 0;
  let violated = 0;
  let expired = 0;
  let errors = 0;

  try {
    logger.info('[ContractEvalJob] Starting evaluation run');

    // 1. Check expired contracts first
    expired = await accountabilityContractService.checkExpiredContracts();

    // 2. Get all active contracts
    const contracts = await accountabilityContractService.getActiveContracts();
    if (contracts.length === 0) {
      logger.debug('[ContractEvalJob] No active contracts to evaluate');
      return;
    }

    // 3. Process in batches
    for (let i = 0; i < contracts.length; i += BATCH_SIZE) {
      const batch = contracts.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (contract) => {
          try {
            // Timezone check: only evaluate during 7AM-10PM user local time
            if (!(await isWithinActiveHours(contract.userId))) {
              return;
            }

            // Evaluate condition
            const result = await accountabilityContractService.evaluateContract(contract);
            evaluated++;

            if (result.passed) {
              // Record successful check
              await accountabilityContractService.recordCheck(
                contract.id, contract.userId, 'pass', result.confidence, result.evidence
              );
              passed++;
            } else {
              // Record failed check
              await accountabilityContractService.recordCheck(
                contract.id, contract.userId, 'fail', result.confidence, result.evidence
              );

              // Record violation if confidence meets threshold
              if (result.confidence >= contract.confidenceThreshold) {
                await accountabilityContractService.recordViolation(
                  contract, result.evidence, result.confidence
                );
                violated++;
              }
            }
          } catch (error) {
            errors++;
            logger.error('[ContractEvalJob] Error evaluating contract', {
              contractId: contract.id,
              userId: contract.userId,
              error: error instanceof Error ? error.message : 'Unknown',
            });
          }
        })
      );

      // Inter-batch delay
      if (i + BATCH_SIZE < contracts.length) {
        await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }
  } catch (error) {
    logger.error('[ContractEvalJob] Fatal error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  } finally {
    running = false;
    const elapsedMs = Date.now() - startTime;
    if (evaluated > 0 || expired > 0) {
      logger.info('[ContractEvalJob] Run complete', {
        evaluated,
        passed,
        violated,
        expired,
        errors,
        elapsedMs,
      });
    }
  }
}

/**
 * Check if it's between 7AM and 10PM in the user's approximate timezone.
 * Falls back to UTC if timezone unavailable.
 */
/**
 * Check if it's between 7AM and 10PM in the user's timezone.
 * Reads timezone from user_streaks (set during onboarding) or defaults to Asia/Karachi.
 */
async function isWithinActiveHours(userId: string): Promise<boolean> {
  try {
    const tzResult = await query<{ timezone: string }>(
      `SELECT timezone FROM user_streaks WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const tz = tzResult.rows[0]?.timezone || 'Asia/Karachi';
    const localHour = parseInt(
      new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }),
      10
    );
    return localHour >= 7 && localHour <= 22;
  } catch {
    // Fallback: use UTC+5 estimation
    const hour = new Date().getUTCHours();
    return hour >= 2 && hour <= 17;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────

export function startContractEvaluationJob(): void {
  if (intervalId) {
    logger.warn('[ContractEvalJob] Already running');
    return;
  }

  logger.info('[ContractEvalJob] Scheduling contract evaluation job', {
    intervalMs: JOB_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
  });

  setTimeout(() => {
    processContracts();
    intervalId = setInterval(processContracts, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

export function stopContractEvaluationJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[ContractEvalJob] Job stopped');
  }
}

export const contractEvaluationJob = {
  start: startContractEvaluationJob,
  stop: stopContractEvaluationJob,
  processNow: processContracts,
};

export default contractEvaluationJob;
