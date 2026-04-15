/**
 * @file Session Orchestration Service
 * @description Determines appropriate session type based on context
 */

import { logger } from './logger.service.js';
import { query } from '../database/pg.js';
import { crisisDetectionService } from './crisis-detection.service.js';

// ============================================
// TYPES
// ============================================

export type SessionType =
  | 'quick_checkin'
  | 'coaching_session'
  | 'emergency_support'
  | 'goal_review'
  | 'health_coach'
  | 'nutrition'
  | 'fitness'
  | 'wellness';

export interface SessionContext {
  userId: string;
  userRequest?: string;
  availableTime?: number; // minutes
  hasScheduledCoaching?: boolean;
  goalDeadlineApproaching?: boolean;
  consistentGoalFailure?: boolean;
  recentCoachingDate?: Date;
  isDeepMode?: boolean;
  detectedEmotion?: string;
  crisisDetected?: boolean;
  callPurpose?: string; // Purpose category from call initiation
}

export interface SessionSuggestion {
  sessionType: SessionType;
  confidence: number; // 0-100
  reasoning: string;
  estimatedDuration: number; // minutes
}

// ============================================
// SERVICE CLASS
// ============================================

class SessionOrchestrationService {
  /**
   * Determine appropriate session type based on context
   */
  async determineSessionType(context: SessionContext): Promise<SessionType> {
    try {
      // Priority 1: Emergency support (highest priority)
      if (context.crisisDetected || context.callPurpose === 'emergency') {
        logger.info('[SessionOrchestration] Emergency session triggered', {
          userId: context.userId,
          reason: context.callPurpose === 'emergency' ? 'call_purpose' : 'crisis_detected',
        });
        return 'emergency_support';
      }

      // Priority 1.5: Use call_purpose to determine session type if provided
      if (context.callPurpose) {
        const purposeToSessionType: Record<string, SessionType> = {
          workout: 'fitness',
          fitness: 'fitness',
          nutrition: 'nutrition',
          meal: 'nutrition',
          emotion: 'coaching_session',
          sleep: 'wellness',
          stress: 'wellness',
          wellness: 'wellness',
          recovery: 'wellness',
          goal_review: 'goal_review',
          general_health: 'health_coach',
        };

        const mappedSessionType = purposeToSessionType[context.callPurpose];
        if (mappedSessionType) {
          logger.info('[SessionOrchestration] Session type determined from call purpose', {
            userId: context.userId,
            callPurpose: context.callPurpose,
            sessionType: mappedSessionType,
          });
          return mappedSessionType;
        }
      }

      // Check for crisis keywords in user request
      if (context.userRequest) {
        const crisisDetection = await crisisDetectionService.detectCrisisKeywords(
          context.userRequest
        );
        if (crisisDetection.isCrisis && crisisDetection.severity !== 'low') {
          logger.warn('[SessionOrchestration] Crisis detected in request, triggering emergency', {
            userId: context.userId,
            severity: crisisDetection.severity,
          });
          return 'emergency_support';
        }
      }

      // Priority 2: Quick check-in if user has <10 minutes
      if (context.availableTime !== undefined && context.availableTime < 10) {
        logger.info('[SessionOrchestration] Quick check-in selected due to limited time', {
          userId: context.userId,
          availableTime: context.availableTime,
        });
        return 'quick_checkin';
      }

      // Priority 3: Scheduled coaching session
      if (context.hasScheduledCoaching) {
        logger.info('[SessionOrchestration] Coaching session selected (scheduled)', {
          userId: context.userId,
        });
        return 'coaching_session';
      }

      // Priority 4: Goal review if deadline approaching or consistent failure
      if (context.goalDeadlineApproaching || context.consistentGoalFailure) {
        logger.info('[SessionOrchestration] Goal review session selected', {
          userId: context.userId,
          reason: context.goalDeadlineApproaching
            ? 'deadline_approaching'
            : 'consistent_failure',
        });
        return 'goal_review';
      }

      // Priority 5: Offer coaching session in deep mode if no recent coaching
      if (
        context.isDeepMode &&
        (!context.recentCoachingDate ||
          this.isMoreThanWeekAgo(context.recentCoachingDate))
      ) {
        logger.info('[SessionOrchestration] Coaching session suggested (deep mode, no recent coaching)', {
          userId: context.userId,
          lastCoachingDate: context.recentCoachingDate,
        });
        return 'coaching_session';
      }

      // Default: Quick check-in
      logger.info('[SessionOrchestration] Defaulting to quick check-in', {
        userId: context.userId,
      });
      return 'quick_checkin';
    } catch (error) {
      logger.error('[SessionOrchestration] Error determining session type', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId,
      });
      // Safe default: quick check-in
      return 'quick_checkin';
    }
  }

  /**
   * Suggest session type with explanation
   */
  async suggestSessionType(
    userId: string,
    userRequest?: string
  ): Promise<SessionSuggestion> {
    try {
      // Build context
      const context = await this.buildContext(userId, userRequest);

      // Determine session type
      const sessionType = await this.determineSessionType(context);

      // Get session details
      const sessionDetails = this.getSessionDetails(sessionType);

      // Calculate confidence based on context match
      let confidence = 70; // Base confidence
      if (context.crisisDetected || context.userRequest?.toLowerCase().includes('emergency')) {
        confidence = 100;
      } else if (context.hasScheduledCoaching) {
        confidence = 95;
      } else if (context.goalDeadlineApproaching || context.consistentGoalFailure) {
        confidence = 85;
      } else if (context.availableTime !== undefined && context.availableTime < 10) {
        confidence = 90;
      } else if (context.isDeepMode && !context.recentCoachingDate) {
        confidence = 75;
      }

      // Build reasoning
      let reasoning = '';
      if (sessionType === 'emergency_support') {
        reasoning = 'Emergency support session triggered due to crisis indicators detected.';
      } else if (sessionType === 'quick_checkin') {
        reasoning = context.availableTime !== undefined && context.availableTime < 10
          ? `Quick check-in recommended based on your available time (${context.availableTime} minutes).`
          : 'Quick check-in is the default session type.';
      } else if (sessionType === 'coaching_session') {
        reasoning = context.hasScheduledCoaching
          ? 'Coaching session recommended based on your scheduled appointment.'
          : 'Deep coaching session recommended for comprehensive support.';
      } else if (sessionType === 'goal_review') {
        reasoning = context.goalDeadlineApproaching
          ? 'Goal review session recommended - you have goals with approaching deadlines.'
          : 'Goal review session recommended - some goals need adjustment.';
      }

      return {
        sessionType,
        confidence,
        reasoning,
        estimatedDuration: sessionDetails.estimatedDuration,
      };
    } catch (error) {
      logger.error('[SessionOrchestration] Error suggesting session type', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      // Default suggestion
      return {
        sessionType: 'quick_checkin',
        confidence: 50,
        reasoning: 'Default quick check-in session.',
        estimatedDuration: 5,
      };
    }
  }

  /**
   * Build context from user data
   */
  private async buildContext(
    userId: string,
    userRequest?: string
  ): Promise<SessionContext> {
    const context: SessionContext = {
      userId,
      userRequest,
    };

    try {
      // Check for scheduled coaching
      // TODO: Implement when scheduling system is available
      context.hasScheduledCoaching = false;

      // Check for goals with approaching deadlines
      const goalResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count 
         FROM user_goals 
         WHERE user_id = $1 
           AND status = 'active'
           AND target_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`,
        [userId]
      );

      context.goalDeadlineApproaching =
        goalResult.rows.length > 0 && parseInt(goalResult.rows[0].count as unknown as string) > 0;

      // Check for consistent goal failure
      const failureResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count 
         FROM user_goals 
         WHERE user_id = $1 
           AND status = 'active'
           AND progress < 30 
           AND target_date > CURRENT_DATE
           AND (target_date - CURRENT_DATE) < (target_date - start_date) * 0.7`,
        [userId]
      );

      context.consistentGoalFailure =
        failureResult.rows.length > 0 && parseInt(failureResult.rows[0].count as unknown as string) > 0;

      // Get recent coaching session date
      const coachingResult = await query<{ created_at: Date }>(
        `SELECT created_at 
         FROM rag_conversations 
         WHERE user_id = $1 
           AND session_type IN ('coaching_session', 'health_coach')
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (coachingResult.rows.length > 0) {
        context.recentCoachingDate = coachingResult.rows[0].created_at;
      }

      // Check if user is in deep mode (check preferences)
      const preferencesResult = await query<{ coaching_intensity: string }>(
        `SELECT coaching_intensity 
         FROM user_preferences 
         WHERE user_id = $1`,
        [userId]
      );

      context.isDeepMode =
        preferencesResult.rows.length > 0 &&
        preferencesResult.rows[0].coaching_intensity === 'intensive';

      // Check for crisis in user request
      if (userRequest) {
        const crisisDetection = await crisisDetectionService.detectCrisisKeywords(userRequest);
        context.crisisDetected = crisisDetection.isCrisis && crisisDetection.severity !== 'low';
      }

      return context;
    } catch (error) {
      logger.error('[SessionOrchestration] Error building context', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return context; // Return partial context
    }
  }

  /**
   * Check if date is more than a week ago
   */
  private isMoreThanWeekAgo(date: Date): boolean {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date < weekAgo;
  }

  /**
   * Get session details
   */
  private getSessionDetails(sessionType: SessionType): {
    estimatedDuration: number; // minutes
    phases: string[];
  } {
    const sessionDetails: Record<SessionType, { estimatedDuration: number; phases: string[] }> = {
      quick_checkin: {
        estimatedDuration: 5,
        phases: ['opening', 'metric_review', 'recommendation', 'closing'],
      },
      coaching_session: {
        estimatedDuration: 25,
        phases: [
          'opening_reflection',
          'data_review',
          'insight_discussion',
          'goal_adjustment',
          'action_planning',
          'closing',
        ],
      },
      emergency_support: {
        estimatedDuration: 12,
        phases: [
          'immediate_acknowledgment',
          'active_listening',
          'emotional_validation',
          'immediate_coping',
          'resource_provision',
          'follow_up',
        ],
      },
      goal_review: {
        estimatedDuration: 15,
        phases: ['goal_selection', 'progress_analysis', 'barrier_exploration', 'goal_adjustment', 'commitment'],
      },
      health_coach: {
        estimatedDuration: 20,
        phases: ['opening', 'assessment', 'discussion', 'recommendations', 'closing'],
      },
      nutrition: {
        estimatedDuration: 20,
        phases: ['opening', 'assessment', 'discussion', 'recommendations', 'closing'],
      },
      fitness: {
        estimatedDuration: 20,
        phases: ['opening', 'assessment', 'discussion', 'recommendations', 'closing'],
      },
      wellness: {
        estimatedDuration: 20,
        phases: ['opening', 'assessment', 'discussion', 'recommendations', 'closing'],
      },
    };

    return sessionDetails[sessionType] || sessionDetails.quick_checkin;
  }

  /**
   * Check if session type should be suggested
   */
  async shouldSuggestSessionType(userId: string): Promise<boolean> {
    try {
      // Suggest if user hasn't had a session recently or if they're in deep mode
      const recentSessionResult = await query<{ created_at: Date }>(
        `SELECT created_at 
         FROM rag_conversations 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (recentSessionResult.rows.length === 0) {
        return true; // No sessions yet, suggest
      }

      const lastSessionDate = recentSessionResult.rows[0].created_at;
      const daysSinceLastSession =
        (Date.now() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60 * 24);

      // Suggest if more than 3 days since last session
      return daysSinceLastSession > 3;
    } catch (error) {
      logger.error('[SessionOrchestration] Error checking if should suggest session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return false; // Don't suggest on error
    }
  }
}

export const sessionOrchestrationService = new SessionOrchestrationService();

