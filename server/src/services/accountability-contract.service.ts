/**
 * @file Accountability Contract Service
 * @description Core CRUD, lifecycle management, condition evaluation,
 * and violation handling for self-imposed accountability contracts.
 *
 * Builds on existing accountability infrastructure (consent, contacts, triggers).
 * Reuses evaluation patterns from accountability-trigger.service.ts.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { gamificationService } from './gamification.service.js';
import { notificationService } from './notification.service.js';
import { socketService } from './socket.service.js';
import { accountabilityConsentService } from './accountability-consent.service.js';
import type { CreateContractInput, UpdateContractInput } from '../validators/accountability-contract.validator.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface Contract {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  conditionType: string;
  conditionMetric: string | null;
  conditionOperator: string | null;
  conditionValue: number | null;
  conditionWindowDays: number;
  conditionDetails: Record<string, unknown>;
  penaltyType: string;
  penaltyAmount: number | null;
  penaltyCurrency: string;
  penaltyDetails: Record<string, unknown>;
  status: string;
  signedAt: string | null;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  pauseCount: number;
  verificationMethod: string;
  gracePeriodHours: number;
  confidenceThreshold: number;
  aiSuggested: boolean;
  aiSuggestionReason: string | null;
  socialEnforcerIds: string[];
  violationCount: number;
  successCount: number;
  totalChecks: number;
  lastCheckedAt: string | null;
  lastViolationAt: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface ContractViolation {
  id: string;
  contractId: string;
  userId: string;
  violationType: string;
  confidenceScore: number;
  evidence: Record<string, unknown>;
  penaltyStatus: string;
  penaltyExecutedAt: string | null;
  penaltyExecutionDetails: Record<string, unknown>;
  graceExpiresAt: string | null;
  graceUsed: boolean;
  aiIntervened: boolean;
  aiInterventionMessage: string | null;
  userNotified: boolean;
  enforcersNotified: boolean;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface EvaluationResult {
  passed: boolean;
  confidence: number;
  evidence: Record<string, unknown>;
}

export interface ContractStats {
  activeCount: number;
  completedCount: number;
  totalViolations: number;
  totalSuccessChecks: number;
  overallSuccessRate: number;
  currentActiveStreak: number;
  penaltiesExecuted: number;
  penaltiesPending: number;
}

// ─── Row mapping ─────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Contract {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    description: row.description as string | null,
    conditionType: row.condition_type as string,
    conditionMetric: row.condition_metric as string | null,
    conditionOperator: row.condition_operator as string | null,
    conditionValue: row.condition_value != null ? Number(row.condition_value) : null,
    conditionWindowDays: Number(row.condition_window_days),
    conditionDetails: (row.condition_details as Record<string, unknown>) || {},
    penaltyType: row.penalty_type as string,
    penaltyAmount: row.penalty_amount != null ? Number(row.penalty_amount) : null,
    penaltyCurrency: row.penalty_currency as string,
    penaltyDetails: (row.penalty_details as Record<string, unknown>) || {},
    status: row.status as string,
    signedAt: row.signed_at as string | null,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    autoRenew: row.auto_renew as boolean,
    pauseCount: Number(row.pause_count || 0),
    verificationMethod: row.verification_method as string,
    gracePeriodHours: Number(row.grace_period_hours || 0),
    confidenceThreshold: Number(row.confidence_threshold || 0.8),
    aiSuggested: row.ai_suggested as boolean,
    aiSuggestionReason: row.ai_suggestion_reason as string | null,
    socialEnforcerIds: (row.social_enforcer_ids as string[]) || [],
    violationCount: Number(row.violation_count || 0),
    successCount: Number(row.success_count || 0),
    totalChecks: Number(row.total_checks || 0),
    lastCheckedAt: row.last_checked_at as string | null,
    lastViolationAt: row.last_violation_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    cancelledAt: row.cancelled_at as string | null,
    cancelReason: row.cancel_reason as string | null,
  };
}

function mapViolationRow(row: Record<string, unknown>): ContractViolation {
  return {
    id: row.id as string,
    contractId: row.contract_id as string,
    userId: row.user_id as string,
    violationType: row.violation_type as string,
    confidenceScore: Number(row.confidence_score),
    evidence: (row.evidence as Record<string, unknown>) || {},
    penaltyStatus: row.penalty_status as string,
    penaltyExecutedAt: row.penalty_executed_at as string | null,
    penaltyExecutionDetails: (row.penalty_execution_details as Record<string, unknown>) || {},
    graceExpiresAt: row.grace_expires_at as string | null,
    graceUsed: row.grace_used as boolean,
    aiIntervened: row.ai_intervened as boolean,
    aiInterventionMessage: row.ai_intervention_message as string | null,
    userNotified: row.user_notified as boolean,
    enforcersNotified: row.enforcers_notified as boolean,
    detectedAt: row.detected_at as string,
    resolvedAt: row.resolved_at as string | null,
  };
}

// ─── Table auto-creation ─────────────────────────────────────────────

let tablesEnsured = false;

async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS accountability_contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        condition_type VARCHAR(30) NOT NULL,
        condition_metric VARCHAR(50),
        condition_operator VARCHAR(10),
        condition_value NUMERIC,
        condition_window_days INTEGER DEFAULT 1,
        condition_details JSONB DEFAULT '{}',
        penalty_type VARCHAR(30) NOT NULL,
        penalty_amount NUMERIC,
        penalty_currency VARCHAR(10) DEFAULT 'PKR',
        penalty_details JSONB DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        signed_at TIMESTAMPTZ,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        auto_renew BOOLEAN DEFAULT false,
        pause_count INTEGER DEFAULT 0,
        paused_at TIMESTAMPTZ,
        verification_method VARCHAR(20) DEFAULT 'auto',
        grace_period_hours INTEGER DEFAULT 0,
        confidence_threshold NUMERIC(3,2) DEFAULT 0.80,
        ai_suggested BOOLEAN DEFAULT false,
        ai_suggestion_reason TEXT,
        social_enforcer_ids UUID[] DEFAULT '{}',
        violation_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        total_checks INTEGER DEFAULT 0,
        last_checked_at TIMESTAMPTZ,
        last_violation_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        cancelled_at TIMESTAMPTZ,
        cancel_reason TEXT
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_ac_user_status ON accountability_contracts(user_id, status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ac_active ON accountability_contracts(status, start_date, end_date) WHERE status IN ('active', 'at_risk')`);

    await query(`
      CREATE TABLE IF NOT EXISTS accountability_contract_violations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id UUID NOT NULL REFERENCES accountability_contracts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        violation_type VARCHAR(30) NOT NULL,
        confidence_score NUMERIC(3,2) NOT NULL,
        evidence JSONB NOT NULL DEFAULT '{}',
        penalty_status VARCHAR(20) DEFAULT 'pending',
        penalty_executed_at TIMESTAMPTZ,
        penalty_execution_details JSONB DEFAULT '{}',
        grace_expires_at TIMESTAMPTZ,
        grace_used BOOLEAN DEFAULT false,
        ai_intervened BOOLEAN DEFAULT false,
        ai_intervention_message TEXT,
        user_notified BOOLEAN DEFAULT false,
        enforcers_notified BOOLEAN DEFAULT false,
        detected_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_acv_contract ON accountability_contract_violations(contract_id, detected_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acv_user ON accountability_contract_violations(user_id, detected_at DESC)`);

    await query(`
      CREATE TABLE IF NOT EXISTS accountability_contract_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id UUID NOT NULL REFERENCES accountability_contracts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        checked_at TIMESTAMPTZ DEFAULT NOW(),
        result VARCHAR(10) NOT NULL,
        confidence_score NUMERIC(3,2),
        snapshot JSONB DEFAULT '{}'
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_contract ON accountability_contract_checks(contract_id, checked_at DESC)`);

    tablesEnsured = true;
    logger.info('[Contract] Tables ensured');
  } catch (error) {
    logger.error('[Contract] Error ensuring tables', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ─── Service ─────────────────────────────────────────────────────────

class AccountabilityContractService {

  // ══════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════

  async createContract(userId: string, data: CreateContractInput): Promise<Contract> {
    await ensureTables();
    const result = await query(
      `INSERT INTO accountability_contracts (
        user_id, title, description,
        condition_type, condition_metric, condition_operator, condition_value,
        condition_window_days, condition_details,
        penalty_type, penalty_amount, penalty_currency, penalty_details,
        start_date, end_date, auto_renew,
        verification_method, grace_period_hours, confidence_threshold,
        social_enforcer_ids
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        userId,
        data.title,
        data.description || null,
        data.condition_type,
        data.condition_metric || null,
        data.condition_operator || null,
        data.condition_value ?? null,
        data.condition_window_days,
        JSON.stringify(data.condition_details || {}),
        data.penalty_type,
        data.penalty_amount ?? null,
        data.penalty_currency,
        JSON.stringify(data.penalty_details || {}),
        data.start_date,
        data.end_date,
        data.auto_renew,
        data.verification_method,
        data.grace_period_hours,
        data.confidence_threshold,
        data.social_enforcer_ids,
      ]
    );

    const contract = mapRow(result.rows[0]);
    logger.info('[Contract] Created', { userId, contractId: contract.id, title: data.title });
    return contract;
  }

  async getContracts(
    userId: string,
    filters?: { status?: string; limit?: number; offset?: number }
  ): Promise<{ contracts: Contract[]; total: number }> {
    await ensureTables();
    const conditions = ['user_id = $1'];
    const params: (string | number | boolean | null)[] = [userId];
    let paramIdx = 2;

    if (filters?.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(filters.status);
    }

    const where = conditions.join(' AND ');
    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT * FROM accountability_contracts WHERE ${where}
         ORDER BY CASE status
           WHEN 'active' THEN 1 WHEN 'at_risk' THEN 2 WHEN 'draft' THEN 3
           WHEN 'paused' THEN 4 WHEN 'violated' THEN 5 WHEN 'completed' THEN 6
           ELSE 7 END, created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
      query(
        `SELECT COUNT(*)::int as total FROM accountability_contracts WHERE ${where}`,
        params
      ),
    ]);

    return {
      contracts: dataResult.rows.map(mapRow),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async getContractById(userId: string, contractId: string): Promise<Contract | null> {
    const result = await query(
      `SELECT * FROM accountability_contracts WHERE id = $1 AND user_id = $2`,
      [contractId, userId]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  async updateContract(userId: string, contractId: string, data: UpdateContractInput): Promise<Contract | null> {
    // Only allow updates on draft or paused contracts
    const existing = await this.getContractById(userId, contractId);
    if (!existing) return null;
    if (existing.status !== 'draft' && existing.status !== 'paused') {
      throw new Error('Can only update draft or paused contracts');
    }

    const fields: string[] = [];
    const values: (string | number | boolean | string[] | null)[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      title: 'title', description: 'description',
      condition_type: 'condition_type', condition_metric: 'condition_metric',
      condition_operator: 'condition_operator', condition_value: 'condition_value',
      condition_window_days: 'condition_window_days',
      penalty_type: 'penalty_type', penalty_amount: 'penalty_amount',
      penalty_currency: 'penalty_currency',
      start_date: 'start_date', end_date: 'end_date', auto_renew: 'auto_renew',
      verification_method: 'verification_method', grace_period_hours: 'grace_period_hours',
      confidence_threshold: 'confidence_threshold', social_enforcer_ids: 'social_enforcer_ids',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      const val = (data as Record<string, unknown>)[key];
      if (val !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push((key === 'condition_details' || key === 'penalty_details' ? JSON.stringify(val) : val) as string | number | boolean | null);
      }
    }

    // Handle JSONB fields
    if (data.condition_details !== undefined) {
      fields.push(`condition_details = $${idx++}`);
      values.push(JSON.stringify(data.condition_details));
    }
    if (data.penalty_details !== undefined) {
      fields.push(`penalty_details = $${idx++}`);
      values.push(JSON.stringify(data.penalty_details));
    }

    if (fields.length === 0) return existing;

    fields.push(`updated_at = NOW()`);
    values.push(contractId, userId);

    const result = await query(
      `UPDATE accountability_contracts SET ${fields.join(', ')}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      values
    );

    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  // ══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════

  async signContract(userId: string, contractId: string): Promise<Contract | null> {
    const result = await query(
      `UPDATE accountability_contracts
       SET status = 'active', signed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'draft'
       RETURNING *`,
      [contractId, userId]
    );

    if (result.rows.length === 0) return null;

    const contract = mapRow(result.rows[0]);
    logger.info('[Contract] Signed', { userId, contractId });

    // Notify user
    notificationService.create({
      userId,
      type: 'social',
      title: 'Contract Activated',
      message: `Your contract "${contract.title}" is now active. Stay committed!`,
      icon: '📜',
      priority: 'high',
      relatedEntityType: 'contract',
      relatedEntityId: contractId,
    }).catch(() => {});

    // Real-time update
    socketService.emitToUser(userId, 'contract:signed', {
      contractId,
      title: contract.title,
      status: 'active',
    });

    // Award XP for commitment
    gamificationService.awardXP(userId, 'bonus', 15, contractId, 'Contract signed').catch(() => {});

    return contract;
  }

  async pauseContract(userId: string, contractId: string): Promise<Contract | null> {
    const existing = await this.getContractById(userId, contractId);
    if (!existing || existing.status !== 'active') return null;
    if (existing.pauseCount >= 2) {
      throw new Error('Maximum 2 pauses allowed per contract');
    }

    const result = await query(
      `UPDATE accountability_contracts
       SET status = 'paused', pause_count = pause_count + 1, paused_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [contractId, userId]
    );

    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  async resumeContract(userId: string, contractId: string): Promise<Contract | null> {
    const result = await query(
      `UPDATE accountability_contracts
       SET status = 'active', paused_at = NULL, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'paused'
       RETURNING *`,
      [contractId, userId]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  async cancelContract(userId: string, contractId: string, reason?: string): Promise<Contract | null> {
    const result = await query(
      `UPDATE accountability_contracts
       SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $3, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('draft', 'active', 'paused', 'at_risk')
       RETURNING *`,
      [contractId, userId, reason || null]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  // ══════════════════════════════════════════════════════════════════
  // EVALUATION (called by background job)
  // ══════════════════════════════════════════════════════════════════

  async evaluateContract(contract: Contract): Promise<EvaluationResult> {
    try {
      switch (contract.conditionType) {
        case 'missed_activity':
          return this.evaluateMissedActivity(contract);
        case 'calorie_exceeded':
          return this.evaluateCalorieExceeded(contract);
        case 'streak_break':
          return this.evaluateStreakBreak(contract);
        case 'missed_goal':
          return this.evaluateMissedGoal(contract);
        case 'sleep_deficit':
          return this.evaluateSleepDeficit(contract);
        default:
          return { passed: true, confidence: 1.0, evidence: { reason: 'unknown_condition_type' } };
      }
    } catch (error) {
      logger.error('[Contract] Evaluation error', {
        contractId: contract.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return { passed: true, confidence: 0, evidence: { error: 'evaluation_failed' } };
    }
  }

  private async evaluateMissedActivity(contract: Contract): Promise<EvaluationResult> {
    const metric = contract.conditionMetric || 'any';
    const windowDays = contract.conditionWindowDays;

    let result;
    if (metric === 'any' || metric === 'gym_sessions') {
      result = await query(
        `SELECT COUNT(*)::int AS count FROM activity_events
         WHERE user_id = $1 AND timestamp >= NOW() - ($2 || ' days')::INTERVAL`,
        [contract.userId, windowDays]
      );
    } else {
      result = await query(
        `SELECT COUNT(*)::int AS count FROM activity_events
         WHERE user_id = $1 AND type = $2
         AND timestamp >= NOW() - ($3 || ' days')::INTERVAL`,
        [contract.userId, metric, windowDays]
      );
    }

    const count = Number(result.rows[0]?.count || 0);
    const threshold = contract.conditionValue ?? 1;
    const missed = count < threshold;

    return {
      passed: !missed,
      confidence: missed ? 0.95 : 1.0,
      evidence: { metric, windowDays, activityCount: count, threshold },
    };
  }

  private async evaluateCalorieExceeded(contract: Contract): Promise<EvaluationResult> {
    const windowDays = contract.conditionWindowDays;
    const limit = contract.conditionValue ?? 3000;

    const result = await query(
      `SELECT AVG(calories)::numeric AS avg_cal FROM meal_logs
       WHERE user_id = $1 AND eaten_at >= NOW() - ($2 || ' days')::INTERVAL`,
      [contract.userId, windowDays]
    );

    const avgCal = Number(result.rows[0]?.avg_cal || 0);
    const exceeded = avgCal > limit;

    return {
      passed: !exceeded,
      confidence: exceeded ? 0.9 : 1.0,
      evidence: { avgCalories: Math.round(avgCal), limit, windowDays },
    };
  }

  private async evaluateStreakBreak(contract: Contract): Promise<EvaluationResult> {
    const result = await query<{ current_streak: string }>(
      `SELECT current_streak FROM user_streaks WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [contract.userId]
    );

    const currentStreak = Number(result.rows[0]?.current_streak || 0);
    const minStreak = contract.conditionValue ?? 1;
    const broken = currentStreak < minStreak;

    return {
      passed: !broken,
      confidence: broken ? 0.95 : 1.0,
      evidence: { currentStreak, requiredStreak: minStreak },
    };
  }

  private async evaluateMissedGoal(contract: Contract): Promise<EvaluationResult> {
    const goalId = contract.conditionDetails?.goalId as string | undefined;
    if (!goalId) return { passed: true, confidence: 0.5, evidence: { reason: 'no_goal_linked' } };

    const result = await query<{ status: string; progress_percentage: string }>(
      `SELECT status, COALESCE(
        ROUND((current_value::numeric / NULLIF(target_value::numeric, 0)) * 100), 0
      ) as progress_percentage
      FROM user_goals WHERE id = $1 AND user_id = $2`,
      [goalId, contract.userId]
    );

    if (result.rows.length === 0) {
      return { passed: true, confidence: 0.5, evidence: { reason: 'goal_not_found' } };
    }

    const { status, progress_percentage } = result.rows[0];
    const failed = status === 'failed' || status === 'abandoned';

    return {
      passed: !failed,
      confidence: failed ? 0.95 : 1.0,
      evidence: { goalId, goalStatus: status, progressPercentage: Number(progress_percentage) },
    };
  }

  private async evaluateSleepDeficit(contract: Contract): Promise<EvaluationResult> {
    const windowDays = contract.conditionWindowDays;
    const minHours = contract.conditionValue ?? 7;

    const result = await query(
      `SELECT AVG(
        COALESCE((data->>'duration_hours')::numeric, (data->>'sleep_hours')::numeric, 0)
      ) as avg_sleep
      FROM health_data_records
      WHERE user_id = $1 AND data_type = 'sleep'
        AND recorded_at >= NOW() - ($2 || ' days')::INTERVAL`,
      [contract.userId, windowDays]
    );

    const avgSleep = Number(result.rows[0]?.avg_sleep || 0);
    const deficit = avgSleep < minHours;

    return {
      passed: !deficit,
      confidence: deficit ? 0.85 : 1.0,
      evidence: { avgSleepHours: Math.round(avgSleep * 10) / 10, requiredHours: minHours, windowDays },
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // VIOLATION HANDLING
  // ══════════════════════════════════════════════════════════════════

  async recordViolation(
    contract: Contract,
    evidence: Record<string, unknown>,
    confidence: number
  ): Promise<ContractViolation | null> {
    // Check confidence threshold
    if (confidence < contract.confidenceThreshold) {
      logger.info('[Contract] Violation below confidence threshold', {
        contractId: contract.id,
        confidence,
        threshold: contract.confidenceThreshold,
      });
      return null;
    }

    // Calculate grace expiry
    const graceExpiresAt = contract.gracePeriodHours > 0
      ? new Date(Date.now() + contract.gracePeriodHours * 60 * 60 * 1000).toISOString()
      : null;

    const result = await query(
      `INSERT INTO accountability_contract_violations (
        contract_id, user_id, violation_type, confidence_score, evidence,
        grace_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        contract.id,
        contract.userId,
        contract.conditionType,
        confidence,
        JSON.stringify(evidence),
        graceExpiresAt,
      ]
    );

    if (result.rows.length === 0) return null;

    const violation = mapViolationRow(result.rows[0]);

    // Update contract stats
    await query(
      `UPDATE accountability_contracts
       SET violation_count = violation_count + 1, last_violation_at = NOW(),
           status = 'violated', updated_at = NOW()
       WHERE id = $1`,
      [contract.id]
    );

    // Notify user
    await notificationService.create({
      userId: contract.userId,
      type: 'warning',
      title: 'Contract Violated',
      message: `Your contract "${contract.title}" has been violated. ${
        contract.penaltyType === 'donation'
          ? `Donation of ${contract.penaltyAmount} ${contract.penaltyCurrency} triggered.`
          : contract.penaltyType === 'xp_loss'
            ? `${contract.penaltyAmount} XP deducted.`
            : 'Penalty triggered.'
      }`,
      icon: '⚠️',
      priority: 'high',
      relatedEntityType: 'contract',
      relatedEntityId: contract.id,
    });

    await query(
      `UPDATE accountability_contract_violations SET user_notified = true WHERE id = $1`,
      [violation.id]
    );

    // Real-time update
    socketService.emitToUser(contract.userId, 'contract:violated', {
      contractId: contract.id,
      violationId: violation.id,
      title: contract.title,
      penaltyType: contract.penaltyType,
      penaltyAmount: contract.penaltyAmount,
    });

    // Execute penalty (if no grace period or grace is 0)
    if (!graceExpiresAt) {
      await this.executePenalty(contract, violation.id);
    }

    // Notify social enforcers (consent-gated)
    if (contract.socialEnforcerIds.length > 0) {
      this.notifyEnforcers(contract, violation.id).catch(() => {});
    }

    logger.info('[Contract] Violation recorded', {
      contractId: contract.id,
      violationId: violation.id,
      confidence,
    });

    return violation;
  }

  async recordCheck(
    contractId: string,
    userId: string,
    result: 'pass' | 'fail' | 'skip',
    confidence: number,
    snapshot: Record<string, unknown>
  ): Promise<void> {
    await query(
      `INSERT INTO accountability_contract_checks (contract_id, user_id, result, confidence_score, snapshot)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (contract_id, (checked_at::date)) DO UPDATE SET
         result = $3, confidence_score = $4, snapshot = $5, checked_at = NOW()`,
      [contractId, userId, result, confidence, JSON.stringify(snapshot)]
    );

    // Update contract counters
    const updateField = result === 'pass' ? 'success_count' : result === 'fail' ? 'violation_count' : null;
    await query(
      `UPDATE accountability_contracts
       SET total_checks = total_checks + 1,
           last_checked_at = NOW(),
           ${updateField ? `${updateField} = ${updateField} + 1,` : ''}
           updated_at = NOW()
       WHERE id = $1`,
      [contractId]
    );
  }

  private async executePenalty(contract: Contract, violationId: string): Promise<void> {
    try {
      const details: Record<string, unknown> = { executedAt: new Date().toISOString() };

      switch (contract.penaltyType) {
        case 'xp_loss': {
          const amount = contract.penaltyAmount || 50;
          const xpResult = await gamificationService.awardXP(
            contract.userId, 'bonus', -amount, violationId, `Contract violation: ${contract.title}`
          );
          details.xpDeducted = amount;
          details.newTotalXP = xpResult.newTotal;
          break;
        }
        case 'donation': {
          // No payment integration yet — mark as pending
          details.donationAmount = contract.penaltyAmount;
          details.donationCurrency = contract.penaltyCurrency;
          details.donationStatus = 'pending_manual';
          break;
        }
        case 'streak_freeze_loss': {
          // Deduct a streak freeze
          await query(
            `UPDATE user_streaks SET freeze_count = GREATEST(freeze_count - 1, 0)
             WHERE user_id = $1`,
            [contract.userId]
          );
          details.freezeDeducted = true;
          break;
        }
        case 'social_alert': {
          // Handled by notifyEnforcers
          details.socialAlertSent = true;
          break;
        }
        default:
          details.customPenalty = contract.penaltyDetails;
      }

      await query(
        `UPDATE accountability_contract_violations
         SET penalty_status = 'executed', penalty_executed_at = NOW(),
             penalty_execution_details = $2
         WHERE id = $1`,
        [violationId, JSON.stringify(details)]
      );

      logger.info('[Contract] Penalty executed', {
        contractId: contract.id,
        violationId,
        penaltyType: contract.penaltyType,
      });
    } catch (error) {
      logger.error('[Contract] Penalty execution failed', {
        contractId: contract.id,
        violationId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  private async notifyEnforcers(contract: Contract, violationId: string): Promise<void> {
    for (const enforcerId of contract.socialEnforcerIds) {
      try {
        // Check consent before notifying
        const consented = await accountabilityConsentService.isConsentedForMessageType(
          contract.userId, enforcerId, 'failure'
        );
        if (!consented) continue;

        await notificationService.create({
          userId: enforcerId,
          type: 'social',
          title: 'Accountability Alert',
          message: `Your friend violated their contract: "${contract.title}"`,
          icon: '🤝',
          priority: 'normal',
          relatedEntityType: 'contract_violation',
          relatedEntityId: violationId,
        });
      } catch {
        // Non-critical — skip silently
      }
    }

    await query(
      `UPDATE accountability_contract_violations SET enforcers_notified = true WHERE id = $1`,
      [violationId]
    );
  }

  async disputeViolation(userId: string, violationId: string, reason: string): Promise<ContractViolation | null> {
    const result = await query(
      `UPDATE accountability_contract_violations
       SET penalty_status = 'disputed',
           penalty_execution_details = penalty_execution_details || $3::jsonb
       WHERE id = $1 AND user_id = $2 AND penalty_status = 'pending'
       RETURNING *`,
      [violationId, userId, JSON.stringify({ disputeReason: reason, disputedAt: new Date().toISOString() })]
    );
    return result.rows.length > 0 ? mapViolationRow(result.rows[0]) : null;
  }

  // ══════════════════════════════════════════════════════════════════
  // QUERIES
  // ══════════════════════════════════════════════════════════════════

  async getViolations(userId: string, contractId?: string, limit = 20): Promise<ContractViolation[]> {
    const result = contractId
      ? await query(
          `SELECT * FROM accountability_contract_violations
           WHERE user_id = $1 AND contract_id = $2
           ORDER BY detected_at DESC LIMIT $3`,
          [userId, contractId, limit]
        )
      : await query(
          `SELECT * FROM accountability_contract_violations
           WHERE user_id = $1 ORDER BY detected_at DESC LIMIT $2`,
          [userId, limit]
        );
    return result.rows.map(mapViolationRow);
  }

  async getChecks(contractId: string, limit = 30): Promise<Record<string, unknown>[]> {
    const result = await query(
      `SELECT * FROM accountability_contract_checks
       WHERE contract_id = $1 ORDER BY checked_at DESC LIMIT $2`,
      [contractId, limit]
    );
    return result.rows;
  }

  async getActiveContracts(): Promise<Contract[]> {
    await ensureTables();
    const result = await query(
      `SELECT * FROM accountability_contracts
       WHERE status IN ('active', 'at_risk')
         AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
       ORDER BY created_at`
    );
    return result.rows.map(mapRow);
  }

  async getContractStats(userId: string): Promise<ContractStats> {
    await ensureTables();
    const result = await query<{
      active_count: string;
      completed_count: string;
      total_violations: string;
      total_success: string;
      total_checks: string;
      penalties_executed: string;
      penalties_pending: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE c.status IN ('active', 'at_risk')) as active_count,
        COUNT(*) FILTER (WHERE c.status = 'completed') as completed_count,
        COALESCE(SUM(c.violation_count), 0) as total_violations,
        COALESCE(SUM(c.success_count), 0) as total_success,
        COALESCE(SUM(c.total_checks), 0) as total_checks,
        (SELECT COUNT(*) FROM accountability_contract_violations v
         WHERE v.user_id = $1 AND v.penalty_status = 'executed') as penalties_executed,
        (SELECT COUNT(*) FROM accountability_contract_violations v
         WHERE v.user_id = $1 AND v.penalty_status = 'pending') as penalties_pending
      FROM accountability_contracts c
      WHERE c.user_id = $1`,
      [userId]
    );

    const r = result.rows[0];
    const totalChecks = Number(r?.total_checks || 0);
    const totalSuccess = Number(r?.total_success || 0);

    return {
      activeCount: Number(r?.active_count || 0),
      completedCount: Number(r?.completed_count || 0),
      totalViolations: Number(r?.total_violations || 0),
      totalSuccessChecks: totalSuccess,
      overallSuccessRate: totalChecks > 0 ? Math.round((totalSuccess / totalChecks) * 100) : 0,
      currentActiveStreak: 0, // calculated separately if needed
      penaltiesExecuted: Number(r?.penalties_executed || 0),
      penaltiesPending: Number(r?.penalties_pending || 0),
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // LIFECYCLE MANAGEMENT (called by job)
  // ══════════════════════════════════════════════════════════════════

  async checkExpiredContracts(): Promise<number> {
    // Complete contracts past end_date
    const completed = await query(
      `UPDATE accountability_contracts
       SET status = 'completed', updated_at = NOW()
       WHERE status IN ('active', 'at_risk') AND end_date < CURRENT_DATE
       RETURNING id, user_id, title, auto_renew`
    );

    for (const row of completed.rows) {
      // Award completion XP
      gamificationService.awardXP(
        row.user_id as string, 'achievement', 50,
        row.id as string, `Contract completed: ${row.title}`
      ).catch(() => {});

      notificationService.create({
        userId: row.user_id as string,
        type: 'celebration',
        title: 'Contract Completed!',
        message: `You fulfilled your contract "${row.title}". Well done!`,
        icon: '🎉',
        priority: 'high',
        relatedEntityType: 'contract',
        relatedEntityId: row.id as string,
      }).catch(() => {});

      socketService.emitToUser(row.user_id as string, 'contract:completed', {
        contractId: row.id,
        title: row.title,
      });

      // Auto-renew if enabled
      if (row.auto_renew) {
        const original = await this.getContractById(row.user_id as string, row.id as string);
        if (original) {
          const startDate = new Date();
          const durationDays = Math.round(
            (new Date(original.endDate).getTime() - new Date(original.startDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

          await this.createContract(row.user_id as string, {
            title: original.title,
            description: original.description || undefined,
            condition_type: original.conditionType as 'missed_activity',
            condition_metric: original.conditionMetric as 'gym_sessions' | undefined,
            condition_operator: original.conditionOperator as 'lt' | undefined,
            condition_value: original.conditionValue ?? undefined,
            condition_window_days: original.conditionWindowDays,
            penalty_type: original.penaltyType as 'donation',
            penalty_amount: original.penaltyAmount ?? undefined,
            penalty_currency: original.penaltyCurrency,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            auto_renew: true,
            verification_method: original.verificationMethod as 'auto',
            grace_period_hours: original.gracePeriodHours,
            confidence_threshold: original.confidenceThreshold,
            social_enforcer_ids: original.socialEnforcerIds,
          });
        }
      }
    }

    return completed.rows.length;
  }
}

export const accountabilityContractService = new AccountabilityContractService();
export default accountabilityContractService;
