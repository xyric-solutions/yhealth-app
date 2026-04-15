/**
 * @file Accountability Trigger Service
 * @description Evaluates trigger conditions and fires social accountability messages.
 * Supports inactivity detection, metric thresholds, login gaps, streak breaks,
 * and SOS emergency alerts. Respects consent at every step.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { accountabilityConsentService } from './accountability-consent.service.js';
import { chatService } from './chat.service.js';
import { messageService } from './message.service.js';
import { socketService } from './socket.service.js';
import { proactiveMessagingService } from './proactive-messaging.service.js';

// ============================================
// TYPES
// ============================================

export interface AccountabilityTrigger {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  condition_type: string;
  condition_metric: string | null;
  condition_operator: string | null;
  condition_value: number | null;
  condition_window_days: number;
  target_type: string;
  target_contact_id: string | null;
  target_group_id: string | null;
  message_type: string;
  message_template: string | null;
  cooldown_hours: number;
  is_active: boolean;
  ai_intervene_first: boolean;
  last_triggered_at: Date | null;
  trigger_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTriggerParams {
  name: string;
  description?: string;
  condition_type: string;
  condition_metric?: string;
  condition_operator?: string;
  condition_value?: number;
  condition_window_days?: number;
  target_type: string;
  target_contact_id?: string;
  target_group_id?: string;
  message_type?: string;
  message_template?: string;
  cooldown_hours?: number;
  ai_intervene_first?: boolean;
}

export interface UpdateTriggerParams {
  name?: string;
  description?: string;
  condition_type?: string;
  condition_metric?: string;
  condition_operator?: string;
  condition_value?: number;
  condition_window_days?: number;
  target_type?: string;
  target_contact_id?: string;
  target_group_id?: string;
  message_type?: string;
  message_template?: string;
  cooldown_hours?: number;
  ai_intervene_first?: boolean;
  is_active?: boolean;
}

export interface ConditionResult {
  met: boolean;
  snapshot: Record<string, unknown>;
}

interface TemplateContext {
  name?: string;
  days?: number;
  metric?: string;
  value?: number | string;
}

// Default message templates per type
const DEFAULT_TEMPLATES: Record<string, string> = {
  motivation:
    "Hey, just checking in! I've been a bit off track lately. Your encouragement means a lot.",
  failure:
    'I missed my {metric} goal for {days} days. Help me stay accountable!',
  sos: '', // Uses the sos_message from consent settings
};

// ============================================
// SERVICE
// ============================================

class AccountabilityTriggerService {

  // ------------------------------------------
  // Trigger CRUD
  // ------------------------------------------

  /**
   * Create a new accountability trigger. Validates that consent is enabled first.
   */
  async createTrigger(
    userId: string,
    trigger: CreateTriggerParams
  ): Promise<AccountabilityTrigger> {
    try {
      // Validate consent is enabled
      const consent = await accountabilityConsentService.getConsent(userId);
      if (!consent.enabled) {
        throw new Error(
          'Accountability consent must be enabled before creating triggers'
        );
      }

      // M2: Enforce max triggers per user (50)
      const countResult = await query<{ cnt: string }>(
        `SELECT COUNT(*)::text as cnt FROM accountability_triggers WHERE user_id = $1 AND is_active = true`,
        [userId]
      );
      if (parseInt(countResult.rows[0]?.cnt || '0', 10) >= 50) {
        throw new Error('Maximum of 50 active triggers allowed per user');
      }

      // H3: Validate target ownership
      if (trigger.target_contact_id) {
        const own = await query<{ id: string }>(
          `SELECT id FROM accountability_contacts WHERE id = $1 AND user_id = $2 AND is_active = true`,
          [trigger.target_contact_id, userId]
        );
        if (own.rows.length === 0) throw new Error('Target contact not found or not owned by user');
      }
      if (trigger.target_group_id) {
        const own = await query<{ id: string }>(
          `SELECT id FROM accountability_groups WHERE id = $1 AND user_id = $2 AND is_active = true`,
          [trigger.target_group_id, userId]
        );
        if (own.rows.length === 0) throw new Error('Target group not found or not owned by user');
      }

      const result = await query(
        `INSERT INTO accountability_triggers (
           user_id, name, description,
           condition_type, condition_metric, condition_operator,
           condition_value, condition_window_days,
           target_type, target_contact_id, target_group_id,
           message_type, message_template,
           cooldown_hours, ai_intervene_first
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          userId,
          trigger.name,
          trigger.description || null,
          trigger.condition_type,
          trigger.condition_metric || null,
          trigger.condition_operator || null,
          trigger.condition_value ?? null,
          trigger.condition_window_days ?? 3,
          trigger.target_type,
          trigger.target_contact_id || null,
          trigger.target_group_id || null,
          trigger.message_type || 'motivation',
          trigger.message_template || null,
          trigger.cooldown_hours ?? 48,
          trigger.ai_intervene_first ?? true,
        ]
      );

      await accountabilityConsentService.logAudit(userId, 'trigger_created', {
        trigger_id: result.rows[0].id,
        name: trigger.name,
        condition_type: trigger.condition_type,
      });

      logger.info(`Created accountability trigger "${trigger.name}" for user ${userId}`);
      return result.rows[0] as AccountabilityTrigger;
    } catch (error) {
      logger.error('Failed to create accountability trigger', { userId, error });
      throw error;
    }
  }

  /**
   * Get all active triggers for a user.
   */
  async getTriggers(userId: string): Promise<AccountabilityTrigger[]> {
    try {
      const result = await query(
        `SELECT * FROM accountability_triggers
         WHERE user_id = $1 AND is_active = true
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows as AccountabilityTrigger[];
    } catch (error) {
      logger.error('Failed to get accountability triggers', { userId, error });
      throw error;
    }
  }

  /**
   * Update a trigger's fields.
   */
  async updateTrigger(
    userId: string,
    triggerId: string,
    updates: UpdateTriggerParams
  ): Promise<AccountabilityTrigger> {
    try {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const allowedFields: Array<keyof UpdateTriggerParams> = [
        'name',
        'description',
        'condition_type',
        'condition_metric',
        'condition_operator',
        'condition_value',
        'condition_window_days',
        'target_type',
        'target_contact_id',
        'target_group_id',
        'message_type',
        'message_template',
        'cooldown_hours',
        'ai_intervene_first',
        'is_active',
      ];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          setClauses.push(`${field} = $${paramIndex}`);
          values.push(updates[field]);
          paramIndex++;
        }
      }

      if (setClauses.length === 0) {
        const existing = await query(
          `SELECT * FROM accountability_triggers WHERE id = $1 AND user_id = $2`,
          [triggerId, userId]
        );
        return existing.rows[0] as AccountabilityTrigger;
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(triggerId, userId);

      const result = await query(
        `UPDATE accountability_triggers
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
         RETURNING *`,
        values as (string | number | boolean | null)[]
      );

      logger.info(`Updated accountability trigger ${triggerId} for user ${userId}`);
      return result.rows[0] as AccountabilityTrigger;
    } catch (error) {
      logger.error('Failed to update accountability trigger', { userId, triggerId, error });
      throw error;
    }
  }

  /**
   * Soft-delete a trigger.
   */
  async deleteTrigger(userId: string, triggerId: string): Promise<void> {
    try {
      await query(
        `UPDATE accountability_triggers
         SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [triggerId, userId]
      );

      logger.info(`Deleted accountability trigger ${triggerId} for user ${userId}`);
    } catch (error) {
      logger.error('Failed to delete accountability trigger', { userId, triggerId, error });
      throw error;
    }
  }

  // ------------------------------------------
  // Trigger Evaluation (CORE)
  // ------------------------------------------

  /**
   * Main evaluation method — called by the background job.
   * Checks all active triggers for a user and fires those whose conditions are met.
   */
  async evaluateTriggersForUser(userId: string): Promise<void> {
    try {
      // Check master consent
      const consent = await accountabilityConsentService.getConsent(userId);
      if (!consent.enabled) {
        return;
      }

      const triggers = await this.getTriggers(userId);
      if (triggers.length === 0) return;

      for (const trigger of triggers) {
        try {
          const conditionResult = await this.evaluateCondition(userId, trigger);

          if (!conditionResult.met) {
            continue;
          }

          // Check cooldown
          if (!this.checkCooldown(trigger)) {
            await this.logTriggerExecution(
              trigger.id,
              userId,
              conditionResult.snapshot,
              'blocked_cooldown'
            );
            continue;
          }

          // Optionally attempt AI intervention first
          if (trigger.ai_intervene_first) {
            const aiSent = await this.attemptAIIntervention(userId, trigger);
            if (aiSent) {
              await this.logTriggerExecution(
                trigger.id,
                userId,
                conditionResult.snapshot,
                'ai_intervened',
                false,
                undefined,
                undefined,
                undefined,
                true
              );
              continue;
            }
          }

          // Fire the trigger
          await this.fireTrigger(userId, trigger, conditionResult.snapshot);
        } catch (triggerError) {
          logger.error(`Failed to evaluate trigger ${trigger.id}`, {
            userId,
            triggerId: trigger.id,
            error: triggerError,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to evaluate triggers for user', { userId, error });
    }
  }

  /**
   * Evaluate whether a trigger's condition is currently met.
   */
  async evaluateCondition(
    userId: string,
    trigger: AccountabilityTrigger
  ): Promise<ConditionResult> {
    try {
      switch (trigger.condition_type) {
        case 'inactivity':
          return this.evaluateInactivity(userId, trigger);
        case 'metric_threshold':
          return this.evaluateMetricThreshold(userId, trigger);
        case 'login_gap':
          return this.evaluateLoginGap(userId, trigger);
        case 'streak_break':
          return this.evaluateStreakBreak(userId, trigger);
        default:
          logger.warn(`Unknown condition type: ${trigger.condition_type}`, {
            triggerId: trigger.id,
          });
          return { met: false, snapshot: { error: 'unknown_condition_type' } };
      }
    } catch (error) {
      logger.error('Failed to evaluate condition', {
        userId,
        triggerId: trigger.id,
        error,
      });
      return { met: false, snapshot: { error: 'evaluation_failed' } };
    }
  }

  /**
   * Check inactivity — no activity events of a given type within the window.
   */
  private async evaluateInactivity(
    userId: string,
    trigger: AccountabilityTrigger
  ): Promise<ConditionResult> {
    const metric = trigger.condition_metric || 'any';
    const windowDays = trigger.condition_window_days;
    const threshold = trigger.condition_value ?? 0;

    let result;
    if (metric === 'any') {
      result = await query(
        `SELECT COUNT(*)::int AS count FROM activity_events
         WHERE user_id = $1
         AND timestamp >= NOW() - ($2 || ' days')::INTERVAL`,
        [userId, windowDays]
      );
    } else {
      result = await query(
        `SELECT COUNT(*)::int AS count FROM activity_events
         WHERE user_id = $1 AND type = $2
         AND timestamp >= NOW() - ($3 || ' days')::INTERVAL`,
        [userId, metric, windowDays]
      );
    }

    const count = result.rows[0]?.count ?? 0;
    const met = count <= threshold;

    return {
      met,
      snapshot: {
        condition_type: 'inactivity',
        metric,
        window_days: windowDays,
        activity_count: count,
        threshold,
      },
    };
  }

  /**
   * Check metric threshold — compare daily averages against a target.
   */
  private async evaluateMetricThreshold(
    userId: string,
    trigger: AccountabilityTrigger
  ): Promise<ConditionResult> {
    const metric = trigger.condition_metric;
    const operator = trigger.condition_operator || 'lt';
    const targetValue = trigger.condition_value ?? 0;
    const windowDays = trigger.condition_window_days;

    let currentValue: number | null = null;

    switch (metric) {
      case 'calories': {
        const result = await query(
          `SELECT AVG(calories)::numeric AS avg_value FROM meal_logs
           WHERE user_id = $1
           AND eaten_at >= NOW() - ($2 || ' days')::INTERVAL`,
          [userId, windowDays]
        );
        currentValue = result.rows[0]?.avg_value
          ? parseFloat(result.rows[0].avg_value)
          : null;
        break;
      }

      case 'sleep_hours': {
        const result = await query(
          `SELECT AVG(sleep_hours)::numeric AS avg_value FROM health_data_records
           WHERE user_id = $1
           AND recorded_at >= NOW() - ($2 || ' days')::INTERVAL
           AND sleep_hours IS NOT NULL`,
          [userId, windowDays]
        );
        currentValue = result.rows[0]?.avg_value
          ? parseFloat(result.rows[0].avg_value)
          : null;
        break;
      }

      case 'steps': {
        const result = await query(
          `SELECT AVG(steps)::numeric AS avg_value FROM daily_health_metrics
           WHERE user_id = $1
           AND date >= (CURRENT_DATE - ($2 || ' days')::INTERVAL)
           AND steps IS NOT NULL`,
          [userId, windowDays]
        );
        currentValue = result.rows[0]?.avg_value
          ? parseFloat(result.rows[0].avg_value)
          : null;
        break;
      }

      case 'water_intake': {
        const result = await query(
          `SELECT SUM(glasses_consumed)::numeric AS total_value FROM water_intake_logs
           WHERE user_id = $1
           AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
          [userId, windowDays]
        );
        currentValue = result.rows[0]?.total_value
          ? parseFloat(result.rows[0].total_value)
          : null;
        break;
      }

      default:
        logger.warn(`Unknown metric for threshold check: ${metric}`, {
          triggerId: trigger.id,
        });
        return {
          met: false,
          snapshot: { error: `unknown_metric: ${metric}` },
        };
    }

    // If no data, condition is not met (avoid false positives for new users)
    if (currentValue === null) {
      return {
        met: false,
        snapshot: {
          condition_type: 'metric_threshold',
          metric,
          current_value: null,
          target_value: targetValue,
          operator,
          no_data: true,
        },
      };
    }

    const met = this.compareValues(currentValue, operator, targetValue);

    return {
      met,
      snapshot: {
        condition_type: 'metric_threshold',
        metric,
        current_value: currentValue,
        target_value: targetValue,
        operator,
        window_days: windowDays,
      },
    };
  }

  /**
   * Check login gap — whether the user hasn't logged in within the window.
   */
  private async evaluateLoginGap(
    userId: string,
    trigger: AccountabilityTrigger
  ): Promise<ConditionResult> {
    const windowDays = trigger.condition_window_days;

    const result = await query(
      `SELECT last_login FROM users WHERE id = $1`,
      [userId]
    );

    const lastLogin = result.rows[0]?.last_login;
    if (!lastLogin) {
      return {
        met: true,
        snapshot: {
          condition_type: 'login_gap',
          last_login: null,
          window_days: windowDays,
        },
      };
    }

    const lastLoginTime = new Date(lastLogin).getTime();
    const thresholdTime = Date.now() - windowDays * 24 * 3600 * 1000;
    const met = lastLoginTime < thresholdTime;

    return {
      met,
      snapshot: {
        condition_type: 'login_gap',
        last_login: lastLogin,
        window_days: windowDays,
        days_since_login: Math.floor(
          (Date.now() - lastLoginTime) / (24 * 3600 * 1000)
        ),
      },
    };
  }

  /**
   * Check streak break — whether the user's current streak is broken or below a threshold.
   */
  private async evaluateStreakBreak(
    userId: string,
    trigger: AccountabilityTrigger
  ): Promise<ConditionResult> {
    const threshold = trigger.condition_value ?? 1;

    const result = await query(
      `SELECT current_streak FROM user_streaks WHERE user_id = $1`,
      [userId]
    );

    const currentStreak = result.rows[0]?.current_streak ?? 0;
    const met = currentStreak < threshold;

    return {
      met,
      snapshot: {
        condition_type: 'streak_break',
        current_streak: currentStreak,
        threshold,
      },
    };
  }

  /**
   * Compare two numeric values using the specified operator.
   */
  private compareValues(
    current: number,
    operator: string,
    target: number
  ): boolean {
    switch (operator) {
      case 'lt':
        return current < target;
      case 'lte':
        return current <= target;
      case 'gt':
        return current > target;
      case 'gte':
        return current >= target;
      case 'eq':
        return current === target;
      case 'missed':
        return current === 0;
      default:
        return false;
    }
  }

  /**
   * Check if enough time has passed since the trigger last fired.
   */
  checkCooldown(trigger: AccountabilityTrigger): boolean {
    if (!trigger.last_triggered_at) return true;

    const elapsed =
      Date.now() - new Date(trigger.last_triggered_at).getTime();
    const cooldownMs = trigger.cooldown_hours * 3600000;

    return elapsed > cooldownMs;
  }

  // ------------------------------------------
  // Trigger Firing
  // ------------------------------------------

  /**
   * Fire a trigger — resolve targets, check consent, send messages, log execution.
   */
  async fireTrigger(
    userId: string,
    trigger: AccountabilityTrigger,
    snapshot: Record<string, unknown>
  ): Promise<void> {
    try {
      // Resolve target contact user IDs
      const targetContacts = await this.resolveTargetContacts(
        userId,
        trigger
      );

      if (targetContacts.length === 0) {
        await this.logTriggerExecution(
          trigger.id,
          userId,
          snapshot,
          'blocked_consent',
          false
        );
        return;
      }

      const notifiedUserIds: string[] = [];
      let lastMessageId: string | undefined;
      let lastChatId: string | undefined;

      // Get user name for template
      const userResult = await query(
        `SELECT first_name, last_name FROM users WHERE id = $1`,
        [userId]
      );
      const userName = userResult.rows[0]?.first_name || 'Your friend';

      for (const contact of targetContacts) {
        try {
          // Check per-contact consent for this message type
          const consented =
            await accountabilityConsentService.isConsentedForMessageType(
              userId,
              contact.contactId,
              trigger.message_type
            );

          if (!consented) {
            logger.debug(
              `Skipping contact ${contact.contactId} — no consent for ${trigger.message_type}`
            );
            continue;
          }

          // Get or create chat between user and contact
          const chat = await chatService.createOrGetChat({
            userId,
            otherUserId: contact.contactUserId,
            isGroupChat: false,
          });

          // Build the message from template
          const messageContent = this.processTemplate(
            trigger.message_template || DEFAULT_TEMPLATES[trigger.message_type] || DEFAULT_TEMPLATES.motivation,
            {
              name: userName,
              days: trigger.condition_window_days,
              metric: trigger.condition_metric || 'health goal',
              value: snapshot.current_value as string | undefined,
            }
          );

          // Send the message (from the user — they authorized this)
          const sentMessage = await messageService.sendMessage({
            chatId: chat.id,
            senderId: userId,
            content: messageContent,
            contentType: 'text',
          });

          lastMessageId = sentMessage.id;
          lastChatId = chat.id;
          notifiedUserIds.push(contact.contactUserId);

          // Emit socket event for real-time delivery
          socketService.emitToUser(contact.contactUserId, 'new_message', {
            message: sentMessage,
            chatId: chat.id,
            isAccountabilityMessage: true,
            triggerType: trigger.condition_type,
          });
        } catch (contactError) {
          logger.error(
            `Failed to send accountability message to contact ${contact.contactId}`,
            { userId, error: contactError }
          );
        }
      }

      // Log execution
      await this.logTriggerExecution(
        trigger.id,
        userId,
        snapshot,
        notifiedUserIds.length > 0 ? 'fired' : 'blocked_consent',
        notifiedUserIds.length > 0,
        lastMessageId,
        lastChatId,
        notifiedUserIds
      );

      // Update trigger metadata
      if (notifiedUserIds.length > 0) {
        await query(
          `UPDATE accountability_triggers
           SET last_triggered_at = NOW(),
               trigger_count = trigger_count + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [trigger.id]
        );
      }

      logger.info(
        `Fired accountability trigger "${trigger.name}" for user ${userId}, notified ${notifiedUserIds.length} contacts`
      );
    } catch (error) {
      logger.error('Failed to fire accountability trigger', {
        userId,
        triggerId: trigger.id,
        error,
      });
    }
  }

  /**
   * Resolve the target contacts for a trigger based on target_type.
   * Returns an array of { contactId, contactUserId }.
   */
  private async resolveTargetContacts(
    userId: string,
    trigger: AccountabilityTrigger
  ): Promise<Array<{ contactId: string; contactUserId: string }>> {
    switch (trigger.target_type) {
      case 'contact': {
        if (!trigger.target_contact_id) return [];
        const result = await query<{ id: string; contact_user_id: string }>(
          `SELECT id, contact_user_id FROM accountability_contacts
           WHERE id = $1 AND user_id = $2 AND is_active = true`,
          [trigger.target_contact_id, userId]
        );
        return result.rows.map((r) => ({
          contactId: r.id,
          contactUserId: r.contact_user_id,
        }));
      }

      case 'group': {
        if (!trigger.target_group_id) return [];
        const result = await query<{ contact_id: string; contact_user_id: string }>(
          `SELECT ac.id AS contact_id, ac.contact_user_id
           FROM accountability_group_members agm
           JOIN accountability_contacts ac ON ac.id = agm.contact_id
           WHERE agm.group_id = $1 AND ac.is_active = true`,
          [trigger.target_group_id]
        );
        return result.rows.map((r) => ({
          contactId: r.contact_id,
          contactUserId: r.contact_user_id,
        }));
      }

      case 'emergency': {
        const contacts =
          await accountabilityConsentService.getEmergencyContacts(userId);
        return contacts.map((c) => ({
          contactId: c.id,
          contactUserId: c.contact_user_id,
        }));
      }

      default:
        logger.warn(`Unknown target type: ${trigger.target_type}`);
        return [];
    }
  }

  /**
   * Attempt an AI coach intervention before sending a social message.
   * Returns true if an AI message was successfully sent.
   */
  async attemptAIIntervention(
    userId: string,
    trigger: AccountabilityTrigger
  ): Promise<boolean> {
    try {
      const metricLabel = trigger.condition_metric || 'health goals';
      const message = `I noticed you've been less active with your ${metricLabel} recently. ` +
        `Before reaching out to your accountability contacts, I wanted to check in personally. ` +
        `Is everything okay? Sometimes a small step can get momentum going again.`;

      await proactiveMessagingService.sendProactiveMessage(
        userId,
        message,
        'accountability_ai_nudge'
      );

      logger.info(
        `AI intervention sent for user ${userId}, trigger "${trigger.name}"`
      );
      return true;
    } catch (error) {
      logger.warn('AI intervention failed, will proceed with social trigger', {
        userId,
        triggerId: trigger.id,
        error,
      });
      return false;
    }
  }

  // ------------------------------------------
  // SOS System
  // ------------------------------------------

  /**
   * Evaluate and fire SOS emergency alerts for a user.
   * Called by the background job on a longer interval.
   */
  async evaluateSOS(userId: string): Promise<void> {
    try {
      const consent = await accountabilityConsentService.getConsent(userId);

      if (!consent.enabled || !consent.allow_sos_alerts) {
        return;
      }

      const inactivityDays = consent.sos_inactivity_days;

      // Check for any recent activity (login or activity events)
      const activityResult = await query(
        `SELECT
           GREATEST(
             COALESCE((SELECT last_login FROM users WHERE id = $1), '1970-01-01'),
             COALESCE(
               (SELECT MAX(timestamp) FROM activity_events WHERE user_id = $1),
               '1970-01-01'
             )
           ) AS last_activity`,
        [userId]
      );

      const lastActivity = activityResult.rows[0]?.last_activity;
      if (!lastActivity) return;

      const lastActivityTime = new Date(lastActivity).getTime();
      const thresholdTime =
        Date.now() - inactivityDays * 24 * 3600 * 1000;

      if (lastActivityTime >= thresholdTime) {
        return; // User has been active within the SOS window
      }

      // Check cooldown — use global_cooldown_hours for SOS
      const lastSosLog = await query(
        `SELECT created_at FROM accountability_trigger_logs
         WHERE user_id = $1
         AND condition_snapshot->>'condition_type' = 'sos'
         AND result = 'fired'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (lastSosLog.rows.length > 0) {
        const lastSosTime = new Date(lastSosLog.rows[0].created_at).getTime();
        const sosCooldownMs = consent.global_cooldown_hours * 3600000;
        if (Date.now() - lastSosTime < sosCooldownMs) {
          return;
        }
      }

      // Get emergency contacts
      const emergencyContacts =
        await accountabilityConsentService.getEmergencyContacts(userId);

      if (emergencyContacts.length === 0) {
        logger.debug(`No emergency contacts for SOS: user ${userId}`);
        return;
      }

      // Get user info for the message
      const userResult = await query(
        `SELECT first_name, last_name FROM users WHERE id = $1`,
        [userId]
      );
      const userName = userResult.rows[0]?.first_name || 'A yHealth user';

      // Use the user's configured SOS message or a default
      const sosMessage =
        consent.sos_message ||
        `This is an automated check-in. ${userName} hasn't been active for ${inactivityDays} days. Please reach out.`;

      const notifiedUserIds: string[] = [];

      for (const contact of emergencyContacts) {
        try {
          // Get or create chat
          const chat = await chatService.createOrGetChat({
            userId,
            otherUserId: contact.contact_user_id,
            isGroupChat: false,
          });

          // Send the SOS message
          const sentMessage = await messageService.sendMessage({
            chatId: chat.id,
            senderId: userId,
            content: sosMessage,
            contentType: 'text',
          });

          notifiedUserIds.push(contact.contact_user_id);

          // Emit socket event
          socketService.emitToUser(contact.contact_user_id, 'new_message', {
            message: sentMessage,
            chatId: chat.id,
            isAccountabilityMessage: true,
            triggerType: 'sos',
          });
        } catch (contactError) {
          logger.error(
            `Failed to send SOS to emergency contact ${contact.id}`,
            { userId, error: contactError }
          );
        }
      }

      // Log the SOS execution (NULL trigger_id for system SOS)
      if (notifiedUserIds.length > 0) {
        await query(
          `INSERT INTO accountability_trigger_logs (
             trigger_id, user_id, condition_snapshot, result,
             message_sent, target_user_ids
           ) VALUES (
             NULL, $1, $2, 'fired', true, $3
           )`,
          [
            userId,
            JSON.stringify({
              condition_type: 'sos',
              inactivity_days: inactivityDays,
              last_activity: lastActivity,
              days_since_activity: Math.floor(
                (Date.now() - lastActivityTime) / (24 * 3600 * 1000)
              ),
            }),
            notifiedUserIds,
          ]
        );
      }

      await accountabilityConsentService.logAudit(userId, 'sos_fired', {
        emergency_contacts_notified: notifiedUserIds.length,
        inactivity_days: inactivityDays,
      });

      logger.info(
        `SOS alert fired for user ${userId}, notified ${notifiedUserIds.length} emergency contacts`
      );
    } catch (error) {
      logger.error('Failed to evaluate SOS for user', { userId, error });
    }
  }

  // ------------------------------------------
  // Message Template Processing
  // ------------------------------------------

  /**
   * Replace placeholders in a message template with context values.
   */
  processTemplate(template: string, context: TemplateContext): string {
    let result = template;

    if (context.name !== undefined) {
      result = result.replace(/\{name\}/g, context.name);
    }
    if (context.days !== undefined) {
      result = result.replace(/\{days\}/g, String(context.days));
    }
    if (context.metric !== undefined) {
      result = result.replace(/\{metric\}/g, context.metric);
    }
    if (context.value !== undefined) {
      result = result.replace(/\{value\}/g, String(context.value));
    }

    return result;
  }

  // ------------------------------------------
  // Trigger Execution Logging
  // ------------------------------------------

  /**
   * Log a trigger execution to the accountability_trigger_logs table.
   */
  private async logTriggerExecution(
    triggerId: string,
    userId: string,
    snapshot: Record<string, unknown>,
    result: string,
    messageSent: boolean = false,
    messageId?: string,
    chatId?: string,
    targetUserIds?: string[],
    aiInterventionAttempted: boolean = false,
    aiInterventionMessage?: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO accountability_trigger_logs (
           trigger_id, user_id, condition_snapshot, result,
           message_sent, message_id, chat_id, target_user_ids,
           ai_intervention_attempted, ai_intervention_message
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          triggerId,
          userId,
          JSON.stringify(snapshot),
          result,
          messageSent,
          messageId || null,
          chatId || null,
          targetUserIds || null,
          aiInterventionAttempted,
          aiInterventionMessage || null,
        ]
      );
    } catch (error) {
      logger.error('Failed to log trigger execution', {
        triggerId,
        userId,
        error,
      });
    }
  }
}

export const accountabilityTriggerService =
  new AccountabilityTriggerService();
export default accountabilityTriggerService;
