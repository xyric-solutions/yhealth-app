/**
 * @file Voice Session Service
 * @description Manages voice coaching session lifecycle, phases, and upgrades
 */

import { logger } from './logger.service.js';
import { query } from '../database/pg.js';
import type { SessionType } from './session-orchestration.service.js';

// ============================================
// TYPES
// ============================================

export type SessionPhase =
  | 'opening'
  | 'metric_review'
  | 'recommendation'
  | 'closing'
  | 'opening_reflection'
  | 'data_review'
  | 'insight_discussion'
  | 'goal_adjustment'
  | 'action_planning'
  | 'immediate_acknowledgment'
  | 'active_listening'
  | 'emotional_validation'
  | 'immediate_coping'
  | 'resource_provision'
  | 'follow_up'
  | 'goal_selection'
  | 'progress_analysis'
  | 'barrier_exploration'
  | 'commitment'
  | 'assessment'
  | 'discussion';

export interface VoiceSession {
  id: string;
  userId: string;
  conversationId: string;
  callId?: string;
  sessionType: SessionType;
  sessionPhase: SessionPhase;
  targetDuration: number; // seconds
  sessionDuration: number; // seconds
  startedAt: Date;
  phaseStartedAt?: Date;
  upgradedFrom?: string;
  goalId?: string;
  emergencyTriggered: boolean;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: Date;
  updatedAt: Date;
}

export interface TimingStatus {
  isOnTrack: boolean;
  isOvertime: boolean;
  currentPhaseDuration: number; 
  totalDuration: number; // seconds
  targetDuration: number; // seconds
  remainingTime?: number; // seconds
  overTimeBy?: number; // seconds
}

export interface SessionContext {
  userId: string;
  sessionType?: SessionType;
  goalId?: string;
  upgradedFrom?: string;
  emergencyTriggered?: boolean;
  preCallContext?: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  session_type: string;
  session_phase: string | null;
  session_duration: number | null;
  target_duration: number | null;
  emergency_triggered: boolean;
  goal_id: string | null;
  upgraded_from: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

// Session type to target duration mapping (in seconds)
const SESSION_DURATIONS: Record<SessionType, number> = {
  quick_checkin: 5 * 60, // 5 minutes
  coaching_session: 25 * 60, // 25 minutes
  emergency_support: 12 * 60, // 12 minutes
  goal_review: 15 * 60, // 15 minutes
  health_coach: 20 * 60, // 20 minutes
  nutrition: 20 * 60,
  fitness: 20 * 60,
  wellness: 20 * 60,
};

// ============================================
// SERVICE CLASS
// ============================================

class VoiceSessionService {
  /**
   * Create a new voice session
   */
  async createSession(
    userId: string,
    type: SessionType,
    context?: SessionContext
  ): Promise<VoiceSession> {
    try {
      const targetDuration = SESSION_DURATIONS[type] || SESSION_DURATIONS.quick_checkin;
      const initialPhase = this.getInitialPhase(type);

      // Create conversation first
      const conversationResult = await query<{ id: string }>(
        `INSERT INTO rag_conversations (
          user_id, session_type, session_phase, target_duration,
          emergency_triggered, goal_id, upgraded_from, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
        RETURNING id`,
        [
          userId,
          type,
          initialPhase,
          targetDuration,
          context?.emergencyTriggered || false,
          context?.goalId || null,
          context?.upgradedFrom || null,
        ]
      );

      const conversationId = conversationResult.rows[0].id;

      const session: VoiceSession = {
        id: conversationId, // Use conversation ID as session ID
        userId,
        conversationId,
        callId: context?.goalId ? undefined : undefined,
        sessionType: type,
        sessionPhase: initialPhase,
        targetDuration,
        sessionDuration: 0,
        startedAt: new Date(),
        upgradedFrom: context?.upgradedFrom,
        goalId: context?.goalId,
        emergencyTriggered: context?.emergencyTriggered || false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.info('[VoiceSession] Session created', {
        userId,
        sessionId: session.id,
        sessionType: type,
        initialPhase,
        targetDuration,
      });

      return session;
    } catch (error) {
      logger.error('[VoiceSession] Error creating session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        type,
      });
      throw error;
    }
  }

  /**
   * Get initial phase for session type
   */
  private getInitialPhase(type: SessionType): SessionPhase {
    const phaseMap: Record<SessionType, SessionPhase> = {
      quick_checkin: 'opening',
      coaching_session: 'opening_reflection',
      emergency_support: 'immediate_acknowledgment',
      goal_review: 'goal_selection',
      health_coach: 'opening',
      nutrition: 'opening',
      fitness: 'opening',
      wellness: 'opening',
    };

    return phaseMap[type] || 'opening';
  }

  /**
   * Update session phase
   */
  async updateSessionPhase(sessionId: string, phase: SessionPhase): Promise<void> {
    try {
      await query(
        `UPDATE rag_conversations
         SET session_phase = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [phase, sessionId]
      );

      logger.info('[VoiceSession] Session phase updated', {
        sessionId,
        phase,
      });
    } catch (error) {
      logger.error('[VoiceSession] Error updating session phase', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        phase,
      });
      throw error;
    }
  }

  /**
   * Check session timing status
   */
  async checkSessionTiming(sessionId: string): Promise<TimingStatus> {
    try {
      const result = await query<{
        target_duration: number | null;
        session_duration: number | null;
        created_at: Date;
      }>(
        `SELECT target_duration, session_duration, created_at
         FROM rag_conversations
         WHERE id = $1`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        throw new Error('Session not found');
      }

      const session = result.rows[0];
      const targetDuration = session.target_duration || SESSION_DURATIONS.quick_checkin;
      const currentDuration =
        session.session_duration ||
        Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000);

      const isOnTrack = currentDuration <= targetDuration;
      const isOvertime = currentDuration > targetDuration;
      const overTimeBy = isOvertime ? currentDuration - targetDuration : undefined;
      const remainingTime = !isOvertime ? targetDuration - currentDuration : undefined;

      // Update session duration in database
      if (!session.session_duration) {
        await query(
          `UPDATE rag_conversations
           SET session_duration = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [currentDuration, sessionId]
        );
      }

      return {
        isOnTrack,
        isOvertime,
        currentPhaseDuration: 0, // Would need phase tracking for this
        totalDuration: currentDuration,
        targetDuration,
        remainingTime,
        overTimeBy,
      };
    } catch (error) {
      logger.error('[VoiceSession] Error checking session timing', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Upgrade session to a different type
   */
  async upgradeSession(sessionId: string, targetType: SessionType): Promise<VoiceSession> {
    try {
      // Get current session
      const currentResult = await query<SessionRow>(
        `SELECT * FROM rag_conversations WHERE id = $1`,
        [sessionId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Session not found');
      }

      const currentSession = currentResult.rows[0];
      const currentType = currentSession.session_type as SessionType;

      // Validate upgrade path
      if (!this.canUpgrade(currentType, targetType)) {
        throw new Error(
          `Cannot upgrade from ${currentType} to ${targetType}`
        );
      }

      const targetDuration = SESSION_DURATIONS[targetType];
      const newPhase = this.getInitialPhase(targetType);

      // Update current session to new type
      await query(
        `UPDATE rag_conversations
         SET session_type = $1,
             session_phase = $2,
             target_duration = $3,
             upgraded_from = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [targetType, newPhase, targetDuration, sessionId, sessionId]
      );

      // Get updated session
      const updatedResult = await query<SessionRow>(
        `SELECT * FROM rag_conversations WHERE id = $1`,
        [sessionId]
      );

      const updated = updatedResult.rows[0];

      const upgradedSession: VoiceSession = {
        id: updated.id,
        userId: updated.user_id,
        conversationId: updated.id,
        sessionType: targetType as SessionType,
        sessionPhase: (updated.session_phase as SessionPhase) || newPhase,
        targetDuration: updated.target_duration || targetDuration,
        sessionDuration: updated.session_duration || 0,
        startedAt: updated.created_at,
        upgradedFrom: updated.upgraded_from || undefined,
        goalId: updated.goal_id || undefined,
        emergencyTriggered: updated.emergency_triggered,
        status: updated.status as 'active' | 'completed' | 'abandoned',
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      };

      logger.info('[VoiceSession] Session upgraded', {
        sessionId,
        from: currentType,
        to: targetType,
      });

      return upgradedSession;
    } catch (error) {
      logger.error('[VoiceSession] Error upgrading session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        targetType,
      });
      throw error;
    }
  }

  /**
   * Check if session can be upgraded
   */
  private canUpgrade(from: SessionType, to: SessionType): boolean {
    // Can't upgrade to emergency (it's triggered automatically)
    if (to === 'emergency_support') {
      return false;
    }

    // Can upgrade from quick_checkin to coaching_session or goal_review
    if (from === 'quick_checkin') {
      return to === 'coaching_session' || to === 'goal_review';
    }

    // Can downgrade from coaching_session to quick_checkin
    if (from === 'coaching_session' && to === 'quick_checkin') {
      return true;
    }

    // Otherwise, upgrades need explicit validation
    return false;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<VoiceSession | null> {
    try {
      const result = await query<SessionRow>(
        `SELECT * FROM rag_conversations WHERE id = $1`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        conversationId: row.id,
        sessionType: row.session_type as SessionType,
        sessionPhase: (row.session_phase as SessionPhase) || 'opening',
        targetDuration: row.target_duration || SESSION_DURATIONS.quick_checkin,
        sessionDuration: row.session_duration || 0,
        startedAt: row.created_at,
        upgradedFrom: row.upgraded_from || undefined,
        goalId: row.goal_id || undefined,
        emergencyTriggered: row.emergency_triggered,
        status: row.status as 'active' | 'completed' | 'abandoned',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('[VoiceSession] Error getting session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Complete session
   */
  async completeSession(sessionId: string): Promise<void> {
    try {
      // Update session duration first
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const duration = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

      await query(
        `UPDATE rag_conversations
         SET status = 'completed',
             session_duration = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [duration, sessionId]
      );

      logger.info('[VoiceSession] Session completed', {
        sessionId,
        duration,
      });
    } catch (error) {
      logger.error('[VoiceSession] Error completing session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Abandon session
   */
  async abandonSession(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const duration = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

      await query(
        `UPDATE rag_conversations
         SET status = 'abandoned',
             session_duration = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [duration, sessionId]
      );

      logger.info('[VoiceSession] Session abandoned', {
        sessionId,
        duration,
      });
    } catch (error) {
      logger.error('[VoiceSession] Error abandoning session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      throw error;
    }
  }
}

export const voiceSessionService = new VoiceSessionService();

