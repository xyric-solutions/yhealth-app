/**
 * @file Schedule Automation Service
 * @description AI-powered automation that sends chat messages based on user's daily schedule
 * Similar to n8n workflow automation - triggers messages before, at, and after scheduled activities
 */

import { query, transaction } from '../database/pg.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { modelFactory } from './model-factory.service.js';
import { logger } from './logger.service.js';
import { messageService } from './message.service.js';
import { socketService } from './socket.service.js';
import { activityAutomationService } from './activity-automation.service.js';
import { scheduleService } from './schedule.service.js';
import { comprehensiveUserContextService } from './comprehensive-user-context.service.js';
import type { CompactMessageContext } from './comprehensive-user-context.service.js';
import { cache } from './cache.service.js';
import { userCoachingProfileService } from './user-coaching-profile.service.js';
import { personalityModeService } from './personality-mode.service.js';

// ============================================
// TYPES
// ============================================

type MessageType = 'reminder' | 'start' | 'followup';

interface ScheduleItemWithUser {
  id: string;
  scheduleId: string;
  userId: string;
  title: string;
  description: string | null;
  startTime: string; // HH:mm:ss format
  endTime: string | null;
  durationMinutes: number | null;
  color: string | null;
  icon: string | null;
  category: string | null;
  scheduleDate: string; // YYYY-MM-DD
  timezone: string;
  reminderMinutes: number;
  automationEnabled: boolean;
}

interface UserPreferences {
  userId: string;
  timezone: string;
  scheduleAutomationEnabled: boolean;
  scheduleReminderMinutes: number;
}

// ============================================
// AI COACH USER ID (System User for AI messages)
// ============================================

const AI_COACH_USER_ID = process.env.AI_COACH_USER_ID || '00000000-0000-0000-0000-000000000001';

// ============================================
// SERVICE CLASS
// ============================================

class ScheduleAutomationService {
  // AI message generation (multi-provider via modelFactory)
  private llm = modelFactory.getModel({ tier: 'default', temperature: 0.7, maxTokens: 500 });
  private rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  private static RATE_LIMIT = parseInt(process.env.SCHEDULE_AI_RATE_LIMIT || '5', 10);
  private static AI_MESSAGE_CACHE_TTL = 3600; // 1 hour

  /**
   * Main processor - called by background job every 60 seconds
   * Checks for schedule items that need automation messages
   * Also processes activity logs from user plans
   */
  async processScheduleAutomation(): Promise<number> {
    let totalProcessed = 0;

    try {
      // Process schedule items (from daily_schedules)
      const scheduleItemsProcessed = await this.processScheduleItemsAutomation();
      totalProcessed += scheduleItemsProcessed;

      // Process activity logs (from user_plans)
      const activityLogsProcessed = await activityAutomationService.processActivityLogsAutomation();
      totalProcessed += activityLogsProcessed;

      if (totalProcessed > 0) {
        logger.info('[ScheduleAutomation] Processed automation messages', {
          scheduleItems: scheduleItemsProcessed,
          activityLogs: activityLogsProcessed,
          total: totalProcessed,
        });
      }
    } catch (error) {
      logger.error('[ScheduleAutomation] Failed to process automation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return totalProcessed;
  }

  /**
   * Process schedule items automation (from daily_schedules)
   */
  private async processScheduleItemsAutomation(): Promise<number> {
    let totalProcessed = 0;

    try {
      // Get all users with automation enabled
      const users = await this.getUsersWithAutomationEnabled();

      for (const user of users) {
        try {
          const processed = await this.processUserScheduleAutomation(user);
          totalProcessed += processed;
        } catch (error) {
          logger.error('[ScheduleAutomation] Error processing user', {
            userId: user.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      logger.error('[ScheduleAutomation] Failed to process schedule items', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return totalProcessed;
  }

  /**
   * Process automation for a single user
   */
  private async processUserScheduleAutomation(user: UserPreferences): Promise<number> {
    let processed = 0;
    const now = new Date();

    // Get today's date in user's timezone
    const userDate = this.getDateInTimezone(now, user.timezone);

    // Get schedule items for today
    const items = await this.getScheduleItemsForDate(user.userId, userDate);

    if (items.length === 0) return 0;

    // Batch-load all sent statuses in ONE query instead of 3 per item
    const itemIds = items.map((item) => item.id);
    const sentStatuses = await this.getBatchSentStatuses(itemIds);

    for (const item of items) {
      // Check each message type, passing pre-loaded sent statuses
      const reminderResult = await this.checkAndSendReminder(user, item, now, sentStatuses);
      const startResult = await this.checkAndSendStartMessage(user, item, now, sentStatuses);
      const followupResult = await this.checkAndSendFollowup(user, item, now, sentStatuses);

      processed += (reminderResult ? 1 : 0) + (startResult ? 1 : 0) + (followupResult ? 1 : 0);
    }

    return processed;
  }

  /**
   * Check if reminder should be sent and send it
   */
  private async checkAndSendReminder(
    user: UserPreferences,
    item: ScheduleItemWithUser,
    now: Date,
    sentStatuses: Set<string>
  ): Promise<boolean> {
    // Check if already sent (from pre-loaded batch)
    if (sentStatuses.has(`${item.id}:reminder`)) {
      return false;
    }

    // Calculate when reminder should be sent
    const itemStartTime = this.parseScheduleTime(item.startTime, item.scheduleDate, user.timezone);
    const reminderTime = new Date(itemStartTime.getTime() - user.scheduleReminderMinutes * 60 * 1000);

    // Check if it's time to send reminder (within 1 minute window)
    const timeDiff = now.getTime() - reminderTime.getTime();
    if (timeDiff >= 0 && timeDiff < 60 * 1000) {
      const message = await this.generateContextualMessage(user.userId, item, 'reminder', user.scheduleReminderMinutes);
      await this.sendAutomationMessage(user.userId, item, 'reminder', message);
      return true;
    }

    return false;
  }

  /**
   * Check if start message should be sent and send it
   */
  private async checkAndSendStartMessage(
    user: UserPreferences,
    item: ScheduleItemWithUser,
    now: Date,
    sentStatuses: Set<string>
  ): Promise<boolean> {
    // Check if already sent (from pre-loaded batch)
    if (sentStatuses.has(`${item.id}:start`)) {
      return false;
    }

    // Calculate item start time
    const itemStartTime = this.parseScheduleTime(item.startTime, item.scheduleDate, user.timezone);

    // Check if it's time to send start message (within 1 minute window)
    const timeDiff = now.getTime() - itemStartTime.getTime();
    if (timeDiff >= 0 && timeDiff < 60 * 1000) {
      const message = await this.generateContextualMessage(user.userId, item, 'start');
      await this.sendAutomationMessage(user.userId, item, 'start', message);
      return true;
    }

    return false;
  }

  /**
   * Check if follow-up should be sent and send it
   */
  private async checkAndSendFollowup(
    user: UserPreferences,
    item: ScheduleItemWithUser,
    now: Date,
    sentStatuses: Set<string>
  ): Promise<boolean> {
    // Check if already sent (from pre-loaded batch)
    if (sentStatuses.has(`${item.id}:followup`)) {
      return false;
    }

    // Calculate item end time
    const itemEndTime = this.getItemEndTime(item, user.timezone);

    // Check if it's time to send follow-up (within 2 minutes after end)
    const timeDiff = now.getTime() - itemEndTime.getTime();
    if (timeDiff >= 0 && timeDiff < 2 * 60 * 1000) {
      const message = await this.generateContextualMessage(user.userId, item, 'followup');
      await this.sendAutomationMessage(user.userId, item, 'followup', message);
      return true;
    }

    return false;
  }

  /**
   * Send automation message to user's AI coach chat
   */
  private async sendAutomationMessage(
    userId: string,
    item: ScheduleItemWithUser,
    messageType: MessageType,
    messageContent: string
  ): Promise<void> {
    try {
      // Get or create AI coach chat
      const chatId = await this.getOrCreateAICoachChat(userId);

      // Send message from AI coach
      const message = await messageService.sendMessage({
        chatId,
        senderId: AI_COACH_USER_ID,
        content: messageContent,
        contentType: 'text',
      });

      // Log the automation
      await this.logAutomation(userId, item.id, messageType, message.id, chatId, messageContent, item.scheduleDate);

      // Emit socket event for real-time delivery
      socketService.emitToChat(chatId, 'newMessage', {
        message: {
          id: message.id,
          chatId,
          senderId: AI_COACH_USER_ID,
          content: messageContent,
          contentType: 'text',
          createdAt: new Date().toISOString(),
          sender: {
            id: AI_COACH_USER_ID,
            firstName: 'AI',
            lastName: 'Coach',
            avatar: null,
          },
        },
      });

      logger.info('[ScheduleAutomation] Sent message', {
        userId,
        itemId: item.id,
        messageType,
        chatId,
        messageId: message.id,
      });
    } catch (error) {
      logger.error('[ScheduleAutomation] Failed to send message', {
        userId,
        itemId: item.id,
        messageType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get or create AI coach chat for user
   * Enhanced with retry logic and race condition handling
   */
  private async getOrCreateAICoachChat(userId: string): Promise<string> {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // Check if AI coach chat exists (with proper locking to avoid race conditions)
        const existingChat = await query<{ id: string }>(
          `SELECT c.id FROM chats c
           INNER JOIN chat_participants cp1 ON c.id = cp1.chat_id
           INNER JOIN chat_participants cp2 ON c.id = cp2.chat_id
           WHERE c.is_group_chat = false
             AND cp1.user_id = $1
             AND cp2.user_id = $2
             AND cp1.left_at IS NULL
             AND cp2.left_at IS NULL
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [userId, AI_COACH_USER_ID]
        );

        if (existingChat.rows.length > 0) {
          // Verify chat still exists and has both participants
          const verifyChat = await query<{ id: string; participant_count: number; chat_name: string }>(
            `SELECT c.id, c.chat_name, COUNT(cp.user_id) as participant_count
             FROM chats c
             INNER JOIN chat_participants cp ON c.id = cp.chat_id
             WHERE c.id = $1 AND cp.left_at IS NULL
             GROUP BY c.id, c.chat_name
             HAVING COUNT(cp.user_id) = 2`,
            [existingChat.rows[0].id]
          );

          if (verifyChat.rows.length > 0) {
            const chatId = verifyChat.rows[0].id;
            // Update chat name to "AI Coach" if it's different
            if (verifyChat.rows[0].chat_name !== 'AI Coach') {
              await query(
                `UPDATE chats SET chat_name = 'AI Coach' WHERE id = $1`,
                [chatId]
              );
              logger.info('[ScheduleAutomation] Updated AI coach chat name', { userId, chatId });
            }
            return chatId;
          }
        }

        // Create new AI coach chat with retry logic for race conditions
        const newChat = await transaction(async (client) => {
          // Double-check if chat was created by another process
          const doubleCheck = await client.query<{ id: string; chat_name: string }>(
            `SELECT c.id, c.chat_name FROM chats c
             INNER JOIN chat_participants cp1 ON c.id = cp1.chat_id
             INNER JOIN chat_participants cp2 ON c.id = cp2.chat_id
             WHERE c.is_group_chat = false
               AND cp1.user_id = $1
               AND cp2.user_id = $2
               AND cp1.left_at IS NULL
               AND cp2.left_at IS NULL
             LIMIT 1
             FOR UPDATE`,
            [userId, AI_COACH_USER_ID]
          );

          if (doubleCheck.rows.length > 0) {
            const chatId = doubleCheck.rows[0].id;
            // Update chat name to "AI Coach" if it's different
            if (doubleCheck.rows[0].chat_name !== 'AI Coach') {
              await client.query(
                `UPDATE chats SET chat_name = 'AI Coach' WHERE id = $1`,
                [chatId]
              );
            }
            return chatId;
          }

          const chatResult = await client.query<{ id: string }>(
            `INSERT INTO chats (chat_name, is_group_chat, is_community, avatar, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            ['AI Coach', false, false, null, AI_COACH_USER_ID]
          );

          const chatId = chatResult.rows[0].id;

          // Add both participants
          await client.query(
            `INSERT INTO chat_participants (chat_id, user_id)
             VALUES ($1, $2), ($1, $3)
             ON CONFLICT (chat_id, user_id) DO NOTHING`,
            [chatId, userId, AI_COACH_USER_ID]
          );

          // Verify both participants were added
          const verifyParticipants = await client.query<{ count: string }>(
            `SELECT COUNT(*) as count
             FROM chat_participants
             WHERE chat_id = $1 AND left_at IS NULL`,
            [chatId]
          );

          if (parseInt(verifyParticipants.rows[0].count) !== 2) {
            throw new Error('Failed to add both participants to chat');
          }

          return chatId;
        });

        logger.info('[ScheduleAutomation] Created AI coach chat', { userId, chatId: newChat });
        return newChat;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          logger.error('[ScheduleAutomation] Failed to get or create AI coach chat after retries', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, retries - 1)));
      }
    }

    throw new Error('Failed to get or create AI coach chat');
  }

  // ============================================
  // AI-POWERED MESSAGE GENERATION
  // ============================================

  /**
   * Generate a context-aware AI message for a schedule item.
   * Uses CompactMessageContext (cached 2h) + LLM (gpt-4o-mini, 250 tokens).
   * Falls back to hardcoded templates on rate-limit, timeout, or LLM failure.
   */
  private async generateContextualMessage(
    userId: string,
    item: ScheduleItemWithUser,
    messageType: MessageType,
    minutesBefore?: number
  ): Promise<string> {
    // Check AI message cache first
    const today = new Date().toISOString().slice(0, 10);
    const aiCacheKey = `sched_ai:${item.id}:${messageType}:${today}`;
    const cached = cache.get<string>(aiCacheKey);
    if (cached) return cached;

    // Check rate limit
    if (!this.checkRateLimit(userId)) {
      return this.fallbackMessage(item, messageType, minutesBefore);
    }

    try {
      const ctx = await comprehensiveUserContextService.getCompactMessageContext(userId);
      const timeFormatted = this.formatTime(item.startTime);
      const categoryEmoji = this.getCategoryEmoji(item.category);

      // Select personality mode based on user state
      let personalityPrefix = '';
      try {
        const modeResult = await personalityModeService.selectMode(userId, {
          tier: 'plateau', // Default — will be overridden if classification exists
          recoveryScore: ctx.recoveryScore,
          engagement: ctx.dailyScore ?? 50,
          moodLevel: 5, // Default neutral
          stressLevel: 5,
          streakDays: ctx.streakDays,
        });
        personalityPrefix = modeResult.systemPromptPrefix + '\n\n';
      } catch {
        // Non-critical: personality mode is additive
      }

      const prompt = this.buildSchedulePrompt(ctx, item, messageType, timeFormatted, minutesBefore);

      const systemPrompt = `${personalityPrefix}You are ${ctx.assistantName}, a behavioral intelligence coach for ${ctx.userName}. You are NOT a reminder bot — you are a second mind that connects biometric data, habits, and cross-domain patterns into actionable coaching.

VOICE & TONE:
- Tone: ${ctx.coachingTone}
- Sound like a knowledgeable friend who has access to the user's health data, not a generic notification
- Never use filler phrases like "Take a moment to prepare yourself", "You've got this", "Stay focused and present", or "Let's crush it"

STRUCTURE (3-5 sentences):
1. ${categoryEmoji} Lead with a data-driven observation (reference a specific metric: recovery %, sleep hours, streak, hydration, or daily score)
2. Connect this activity to the user's current biometric state or health pattern
3. Give one specific, actionable micro-recommendation tied to their data
${messageType === 'followup' ? '4. End with one specific reflective question about what they noticed during the activity (not generic "how did it go?")\n' : ''}${messageType === 'reminder' ? '4. Create anticipation — frame WHY this activity matters for them right now based on their data\n' : ''}${messageType === 'start' ? '4. Set a clear intention or micro-goal for this session based on their state\n' : ''}
${ctx.recoveryScore != null && ctx.recoveryScore < 50 ? 'CRITICAL: Recovery is below 50% — strongly suggest modified intensity, active recovery, or gentler approach. Frame rest as strategic, not lazy.\n' : ''}${ctx.recoveryScore != null && ctx.recoveryScore >= 80 ? 'Recovery is high — user is primed for peak performance. Encourage pushing boundaries today.\n' : ''}
Return ONLY the message text.`;

      const response = await Promise.race([
        this.llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(prompt),
        ]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 8000)),
      ]);

      const aiMessage = typeof response.content === 'string'
        ? response.content.trim()
        : String(response.content).trim();

      if (aiMessage.length > 10) {
        cache.set(aiCacheKey, aiMessage, ScheduleAutomationService.AI_MESSAGE_CACHE_TTL);
        return aiMessage;
      }

      // AI returned something too short — fall back
      return this.fallbackMessage(item, messageType, minutesBefore);
    } catch (error) {
      logger.warn('[ScheduleAutomation] AI generation failed, using template', {
        userId,
        itemId: item.id,
        messageType,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.fallbackMessage(item, messageType, minutesBefore);
    }
  }

  /**
   * Build the LLM prompt with user context for schedule messages.
   */
  private buildSchedulePrompt(
    ctx: CompactMessageContext,
    item: ScheduleItemWithUser,
    messageType: MessageType,
    timeFormatted: string,
    minutesBefore?: number
  ): string {
    const typeLabel = messageType === 'reminder'
      ? `reminder (${minutesBefore} min before)`
      : messageType === 'start' ? 'start notification' : 'follow-up check-in';

    const stateLines: string[] = [];
    if (ctx.recoveryScore != null) stateLines.push(`Recovery: ${ctx.recoveryScore}%`);
    if (ctx.sleepHours != null) stateLines.push(`Sleep last night: ${ctx.sleepHours}h`);
    if (ctx.streakDays > 0) stateLines.push(`Active streak: ${ctx.streakDays} consecutive days`);
    if (ctx.dailyScore != null) stateLines.push(`Health score: ${ctx.dailyScore}/100`);
    if (ctx.waterPct != null) stateLines.push(`Hydration progress: ${ctx.waterPct}% of daily target`);
    if (ctx.nutritionAdherence != null) stateLines.push(`Nutrition adherence: ${ctx.nutritionAdherence}% this week`);
    if (ctx.topInsight) stateLines.push(`Key insight: ${ctx.topInsight}`);
    if (ctx.primaryFocusArea) stateLines.push(`Today's coaching focus: ${ctx.primaryFocusArea}`);

    let prompt = `Generate a ${typeLabel} for "${item.title}" (${item.category || 'general'}) at ${timeFormatted}.`;
    if (item.description) prompt += `\nActivity context: ${item.description}`;

    if (stateLines.length > 0) {
      prompt += `\n\nUSER BIOMETRIC STATE:\n- ${stateLines.join('\n- ')}`;
    }

    prompt += `\n\nYou MUST weave at least one specific data point into the message naturally. Don't just list numbers — interpret what they mean for THIS specific activity.`;

    return prompt;
  }

  /**
   * Per-user rate limiter for AI calls.
   * Returns true if under limit, false if exceeded.
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimitMap.get(userId);

    if (!entry || now >= entry.resetAt) {
      this.rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
      return true;
    }

    if (entry.count >= ScheduleAutomationService.RATE_LIMIT) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Fall back to the existing hardcoded templates.
   */
  private fallbackMessage(item: ScheduleItemWithUser, messageType: MessageType, minutesBefore?: number): string {
    switch (messageType) {
      case 'reminder':
        return this.generateReminderMessage(item, minutesBefore || 5);
      case 'start':
        return this.generateStartMessage(item);
      case 'followup':
        return this.generateFollowupMessage(item);
    }
  }

  // ============================================
  // TEMPLATE FALLBACK (original hardcoded messages)
  // ============================================

  /**
   * Generate reminder message
   */
  private generateReminderMessage(item: ScheduleItemWithUser, minutesBefore: number): string {
    const categoryEmoji = this.getCategoryEmoji(item.category);
    const timeFormatted = this.formatTime(item.startTime);

    const messages: Record<string, string> = {
      workout: `${categoryEmoji} Heads up! Your workout "${item.title}" starts in ${minutesBefore} minutes at ${timeFormatted}.\n\nGet your workout gear ready and let's crush it! 💪`,
      prayer: `${categoryEmoji} Reminder: "${item.title}" is in ${minutesBefore} minutes at ${timeFormatted}.\n\nTake a moment to prepare yourself.`,
      meal: `${categoryEmoji} "${item.title}" is coming up in ${minutesBefore} minutes at ${timeFormatted}.\n\nTime to think about what you'll have! 🍽️`,
      meditation: `${categoryEmoji} Your meditation session "${item.title}" starts in ${minutesBefore} minutes at ${timeFormatted}.\n\nFind a quiet space to center yourself. 🧘`,
      sleep: `${categoryEmoji} Time to wind down! "${item.title}" is in ${minutesBefore} minutes.\n\nStart your bedtime routine for better sleep. 🌙`,
      default: `${categoryEmoji} Reminder: "${item.title}" is starting in ${minutesBefore} minutes at ${timeFormatted}.\n\nGet ready!`,
    };

    return messages[item.category?.toLowerCase() || 'default'] || messages.default;
  }

  /**
   * Generate start message
   */
  private generateStartMessage(item: ScheduleItemWithUser): string {
    const categoryEmoji = this.getCategoryEmoji(item.category);

    const messages: Record<string, string> = {
      workout: `${categoryEmoji} It's time for "${item.title}"!\n\nLet's get moving! Remember, every workout counts toward your goals. You've got this! 🔥`,
      prayer: `${categoryEmoji} "${item.title}" is starting now.\n\nTake this time to find peace and focus.`,
      meal: `${categoryEmoji} Time for "${item.title}"!\n\nEnjoy your meal mindfully. Remember to eat slowly and savor each bite. 🥗`,
      meditation: `${categoryEmoji} "${item.title}" is starting now.\n\nClose your eyes, take a deep breath, and let go of any tension. 🧘‍♀️`,
      sleep: `${categoryEmoji} "${item.title}" - Time for bed!\n\nPut away screens and relax. A good night's sleep is essential for recovery. 💤`,
      default: `${categoryEmoji} "${item.title}" is starting now!\n\nTime to begin. Stay focused and present.`,
    };

    return messages[item.category?.toLowerCase() || 'default'] || messages.default;
  }

  /**
   * Generate follow-up message
   */
  private generateFollowupMessage(item: ScheduleItemWithUser): string {
    const categoryEmoji = this.getCategoryEmoji(item.category);

    const messages: Record<string, string> = {
      workout: `${categoryEmoji} Great job completing "${item.title}"!\n\nHow did your workout feel? Did you push yourself today? 💪\n\nRemember to hydrate and fuel your body!`,
      prayer: `${categoryEmoji} "${item.title}" time has passed.\n\nHow are you feeling? Take a moment to carry that peace with you.`,
      meal: `${categoryEmoji} Finished with "${item.title}"?\n\nHow was your meal? Did you enjoy it? Remember to log what you ate for better tracking! 📝`,
      meditation: `${categoryEmoji} Your meditation "${item.title}" should be complete.\n\nHow do you feel? Did you find some calm and clarity? 🧘`,
      sleep: `${categoryEmoji} Good morning! How did you sleep after "${item.title}"?\n\nA good night's rest helps recovery and energy levels. ☀️`,
      default: `${categoryEmoji} "${item.title}" should be complete!\n\nHow did it go? Let me know if you have any questions or need support.`,
    };

    return messages[item.category?.toLowerCase() || 'default'] || messages.default;
  }

  /**
   * Get emoji for category
   */
  private getCategoryEmoji(category: string | null): string {
    const emojis: Record<string, string> = {
      workout: '🏋️',
      exercise: '🏃',
      prayer: '🕌',
      meal: '🍽️',
      breakfast: '🌅',
      lunch: '☀️',
      dinner: '🌙',
      snack: '🍎',
      meditation: '🧘',
      mindfulness: '🧘‍♀️',
      sleep: '😴',
      rest: '💤',
      work: '💼',
      meeting: '👥',
      study: '📚',
      reading: '📖',
      other: '📋',
    };

    return emojis[category?.toLowerCase() || 'other'] || '📋';
  }

  // ============================================
  // DATABASE QUERIES
  // ============================================

  /**
   * Get users with automation enabled
   */
  private async getUsersWithAutomationEnabled(): Promise<UserPreferences[]> {
    const result = await query<{
      user_id: string;
      timezone: string;
      schedule_automation_enabled: boolean;
      schedule_reminder_minutes: number;
    }>(
      `SELECT
         user_id,
         COALESCE(timezone, 'UTC') as timezone,
         COALESCE(schedule_automation_enabled, true) as schedule_automation_enabled,
         COALESCE(schedule_reminder_minutes, 5) as schedule_reminder_minutes
       FROM user_preferences
       WHERE COALESCE(schedule_automation_enabled, true) = true`
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      timezone: row.timezone,
      scheduleAutomationEnabled: row.schedule_automation_enabled,
      scheduleReminderMinutes: row.schedule_reminder_minutes,
    }));
  }

  /**
   * Get schedule items for a specific date
   */
  private async getScheduleItemsForDate(userId: string, date: string): Promise<ScheduleItemWithUser[]> {
    const result = await query<{
      id: string;
      schedule_id: string;
      user_id: string;
      title: string;
      description: string | null;
      start_time: string;
      end_time: string | null;
      duration_minutes: number | null;
      color: string | null;
      icon: string | null;
      category: string | null;
      schedule_date: string;
    }>(
      `SELECT
         si.id,
         si.schedule_id,
         ds.user_id,
         si.title,
         si.description,
         si.start_time,
         si.end_time,
         si.duration_minutes,
         si.color,
         si.icon,
         si.category,
         ds.schedule_date::text as schedule_date
       FROM schedule_items si
       INNER JOIN daily_schedules ds ON si.schedule_id = ds.id
       WHERE ds.user_id = $1
         AND ds.schedule_date = $2
         AND ds.is_template = false
       ORDER BY si.start_time`,
      [userId, date]
    );

    return result.rows.map((row) => ({
      id: row.id,
      scheduleId: row.schedule_id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      durationMinutes: row.duration_minutes,
      color: row.color,
      icon: row.icon,
      category: row.category,
      scheduleDate: row.schedule_date,
      timezone: 'UTC', // Will be set by caller
      reminderMinutes: 5, // Will be set by caller
      automationEnabled: true, // Will be set by caller
    }));
  }

  /**
   * Batch-load all sent statuses for a set of schedule items in ONE query.
   * Returns a Set of "itemId:messageType" keys for O(1) lookups.
   */
  private async getBatchSentStatuses(itemIds: string[]): Promise<Set<string>> {
    if (itemIds.length === 0) return new Set();

    const result = await query<{ schedule_item_id: string; message_type: string }>(
      `SELECT schedule_item_id, message_type FROM schedule_automation_logs
       WHERE schedule_item_id = ANY($1)`,
      [itemIds]
    );

    const sent = new Set<string>();
    for (const row of result.rows) {
      sent.add(`${row.schedule_item_id}:${row.message_type}`);
    }
    return sent;
  }

  /**
   * Log automation message
   */
  private async logAutomation(
    userId: string,
    scheduleItemId: string,
    messageType: MessageType,
    messageId: string,
    chatId: string,
    messageContent: string,
    scheduledTime: string
  ): Promise<void> {
    await query(
      `INSERT INTO schedule_automation_logs
         (user_id, schedule_item_id, message_type, message_id, chat_id, message_content, scheduled_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (schedule_item_id, message_type) DO NOTHING`,
      [userId, scheduleItemId, messageType, messageId, chatId, messageContent, scheduledTime]
    );
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Automatically create today's schedule and send a personalized message.
   * For users WITH a coaching profile: AI-generates a personalized schedule.
   * For new users (no profile): uses the default Islamic daily schedule.
   */
  async autoCreateTodaySchedule(userId: string): Promise<{ created: boolean; scheduleId?: string; messageId?: string }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Check if schedule already exists for today
      const existingSchedule = await scheduleService.getScheduleByDate(userId, today);
      if (existingSchedule) {
        logger.debug('[ScheduleAutomation] Schedule already exists for today', { userId, scheduleId: existingSchedule.id });
        return { created: false };
      }

      // Fetch user data in parallel
      const [compactCtx, profile, plansResult] = await Promise.all([
        comprehensiveUserContextService.getCompactMessageContext(userId),
        userCoachingProfileService.getProfile(userId).catch(() => null),
        query<{ goal_category: string }>('SELECT goal_category FROM user_plans WHERE user_id = $1 AND status = \'active\' LIMIT 1', [userId]),
      ]);

      const goalCategory = plansResult.rows[0]?.goal_category || null;

      // Try AI-personalized schedule for users with a coaching profile
      let scheduleItems = await this.generatePersonalizedSchedule(profile, goalCategory, compactCtx);
      if (!scheduleItems) {
        // Fallback: default Islamic daily schedule
        scheduleItems = [
          { title: 'Fajr Prayer', startTime: '05:30', endTime: '06:00', category: 'prayer', description: 'Morning prayer' },
          { title: 'Workout', startTime: '06:00', endTime: '07:00', category: 'fitness', description: 'Morning exercise routine' },
          { title: 'Breakfast', startTime: '07:00', endTime: '07:30', category: 'meal', description: 'Start your day with a healthy breakfast' },
          { title: 'Office Work', startTime: '09:00', endTime: '17:00', category: 'work', description: 'Work hours' },
          { title: 'Dhuhr Prayer', startTime: '12:30', endTime: '13:00', category: 'prayer', description: 'Midday prayer' },
          { title: 'Lunch', startTime: '13:00', endTime: '13:30', category: 'meal', description: 'Lunch break' },
          { title: 'Asr Prayer', startTime: '16:00', endTime: '16:30', category: 'prayer', description: 'Afternoon prayer' },
          { title: 'Maghrib Prayer', startTime: '18:30', endTime: '19:00', category: 'prayer', description: 'Sunset prayer' },
          { title: 'Dinner', startTime: '19:30', endTime: '20:00', category: 'meal', description: 'Evening meal' },
          { title: 'Isha Prayer', startTime: '20:30', endTime: '21:00', category: 'prayer', description: 'Night prayer' },
        ];
      }

      // Create the schedule
      const schedule = await scheduleService.createSchedule(userId, {
        scheduleDate: today,
        name: `Daily Schedule - ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
        notes: profile ? 'Personalized schedule based on your profile' : 'Automatically created schedule for today',
      });

      // Add all items
      for (let i = 0; i < scheduleItems.length; i++) {
        const item = scheduleItems[i];
        await scheduleService.addScheduleItem(userId, schedule.id, {
          title: item.title,
          description: item.description,
          startTime: item.startTime,
          endTime: item.endTime,
          category: item.category,
          position: i,
        });
      }

      // Generate personalized announcement
      const chatId = await this.getOrCreateAICoachChat(userId);
      const messageContent = await this.generateScheduleAnnouncement(
        compactCtx, scheduleItems, goalCategory, !!profile
      );

      // Send message from AI coach
      const message = await messageService.sendMessage({
        chatId,
        senderId: AI_COACH_USER_ID,
        content: messageContent,
        contentType: 'text',
      });

      // Emit socket event for real-time delivery
      socketService.emitToChat(chatId, 'newMessage', {
        message: {
          id: message.id,
          chatId,
          senderId: AI_COACH_USER_ID,
          content: messageContent,
          contentType: 'text',
          createdAt: new Date().toISOString(),
          sender: {
            id: AI_COACH_USER_ID,
            firstName: 'AI',
            lastName: 'Coach',
            avatar: null,
          },
        },
      });

      logger.info('[ScheduleAutomation] Auto-created today\'s schedule and sent message', {
        userId,
        scheduleId: schedule.id,
        messageId: message.id,
        chatId,
        itemsCount: scheduleItems.length,
        personalized: !!profile,
      });

      return { created: true, scheduleId: schedule.id, messageId: message.id };
    } catch (error) {
      logger.error('[ScheduleAutomation] Failed to auto-create today\'s schedule', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * AI-generate a personalized daily schedule using the user's coaching profile.
   * Returns null if profile is missing or AI fails (caller falls back to default).
   */
  private async generatePersonalizedSchedule(
    profile: Awaited<ReturnType<typeof userCoachingProfileService.getProfile>>,
    goalCategory: string | null,
    ctx: CompactMessageContext
  ): Promise<Array<{ title: string; startTime: string; endTime: string; category: string; description: string }> | null> {
    if (!profile?.stableTraits) return null;

    try {
      const traits = profile.stableTraits;
      const prompt = `Generate a personalized daily schedule for a health-focused user.
Goal: ${goalCategory || 'general wellness'}
Preferred workouts: ${traits.preferredWorkoutTypes?.join(', ') || 'general'}
Personality: ${traits.personalityType || 'balanced'}
${traits.coachingStrategy?.bestTimeForMessages ? `Best time for messages: ${traits.coachingStrategy.bestTimeForMessages}` : ''}
${ctx.recoveryScore != null ? `Today's recovery: ${ctx.recoveryScore}%` : ''}
${ctx.sleepHours != null ? `Sleep last night: ${ctx.sleepHours}h` : ''}

Requirements:
- Include 5 prayer times (Fajr 05:30, Dhuhr 12:30, Asr 16:00, Maghrib 18:30, Isha 20:30)
- Include 3 meals (breakfast, lunch, dinner)
- Include 1 workout session (adjust intensity/type based on recovery and preferences)
- Include at least 1 other activity (meditation, reading, etc.) based on personality
- Times in HH:MM format, 24-hour
- Each item needs: title, startTime, endTime, category (prayer|meal|fitness|work|meditation|other), description

Output ONLY a JSON array, no markdown fences, no explanation:
[{"title":"...","startTime":"HH:MM","endTime":"HH:MM","category":"...","description":"..."}]`;

      const response = await Promise.race([
        this.llm.invoke([
          new SystemMessage('You are a schedule planner. Output only valid JSON arrays. No markdown fences.'),
          new HumanMessage(prompt),
        ]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Schedule AI timeout')), 8000)),
      ]);

      const text = (typeof response.content === 'string' ? response.content : String(response.content)).trim();
      // Strip markdown fences if AI added them anyway
      const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      const items = JSON.parse(jsonStr) as Array<{ title: string; startTime: string; endTime: string; category: string; description: string }>;

      // Basic validation
      if (!Array.isArray(items) || items.length < 5) return null;
      for (const item of items) {
        if (!item.title || !item.startTime || !item.endTime || !item.category) return null;
      }

      // Sort by startTime
      items.sort((a, b) => a.startTime.localeCompare(b.startTime));
      return items;
    } catch (error) {
      logger.warn('[ScheduleAutomation] Personalized schedule generation failed, using default', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }

  /**
   * Generate an AI-powered announcement message for the newly created schedule.
   */
  private async generateScheduleAnnouncement(
    ctx: CompactMessageContext,
    items: Array<{ title: string; startTime: string; endTime: string; category: string; description: string }>,
    goalCategory: string | null,
    isPersonalized: boolean
  ): Promise<string> {
    try {
      const itemsList = items.map(i => `- ${i.title} (${i.startTime}-${i.endTime})`).join('\n');

      let stateContext = '';
      if (ctx.recoveryScore != null) stateContext += `Recovery: ${ctx.recoveryScore}%. `;
      if (ctx.sleepHours != null) stateContext += `Sleep: ${ctx.sleepHours}h. `;
      if (ctx.streakDays > 0) stateContext += `Streak: ${ctx.streakDays} days. `;

      const prompt = `Write a morning briefing for ${ctx.userName}.

TODAY'S SCHEDULE:
${itemsList}

${stateContext ? `BIOMETRIC STATE: ${stateContext}` : ''}
${goalCategory ? `PRIMARY GOAL: ${goalCategory}` : ''}
${ctx.topInsight ? `TODAY'S KEY INSIGHT: ${ctx.topInsight}` : ''}
${isPersonalized ? 'This schedule was personalized based on their coaching profile and biometric data.' : 'This is their daily schedule.'}

STRUCTURE:
1. Greet ${ctx.userName} by name with a data-backed opening (reference their recovery/sleep/streak)
2. One sentence framing today's theme based on their biometric state and goal
3. List the schedule items with bold titles and times
4. If recovery is low (<50%), add a note about adjusting intensity
5. End with: "Adjust anything in the Wellbeing section. What's your #1 priority today?"

RULES:
- Tone: ${ctx.coachingTone}
- Interpret the data — don't just list numbers
- Make the user feel like you KNOW them and their patterns
- Use markdown formatting (bold for item titles)`;

      const response = await Promise.race([
        this.llm.invoke([
          new SystemMessage(`You are ${ctx.assistantName}, a behavioral intelligence coach. You have deep insight into ${ctx.userName}'s health data, patterns, and goals. Write a morning briefing that demonstrates you understand their unique health journey — not a generic schedule notification.`),
          new HumanMessage(prompt),
        ]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Announcement AI timeout')), 8000)),
      ]);

      const text = (typeof response.content === 'string' ? response.content : String(response.content)).trim();
      if (text.length > 20) return text;
    } catch (error) {
      logger.warn('[ScheduleAutomation] AI announcement failed, using template', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Fallback: static template
    const activitiesList = items
      .map((item, idx) => `${idx + 1}. **${item.title}** - ${item.startTime} to ${item.endTime}`)
      .join('\n');

    return `Good morning, ${ctx.userName}! 🌅

Here's your schedule for today, ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}:

${activitiesList}

Adjust anything in the Wellbeing section. What's your #1 priority today?`;
  }

  /**
   * Get current date in user's timezone
   */
  private getDateInTimezone(date: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    } catch {
      // Fallback to UTC
      return date.toISOString().split('T')[0];
    }
  }

  /**
   * Parse schedule time string to Date
   * Note: For production, consider using date-fns-tz for proper timezone handling
   */
  private parseScheduleTime(timeStr: string, dateStr: string, timezone: string): Date {
    // Create date in user's timezone (simplified approach)
    const dateTime = new Date(`${dateStr}T${timeStr.padEnd(8, ':00')}`);

    // Validate timezone by attempting to use it
    try {
      // Use the timezone to format - this validates the timezone is valid
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());

      // Return as UTC timestamp (assumes local time matches user timezone for now)
      // TODO: For production, use proper timezone conversion with date-fns-tz
      return new Date(`${dateStr}T${timeStr.padEnd(8, ':00')}Z`);
    } catch {
      // Invalid timezone, return date as-is
      return dateTime;
    }
  }

  /**
   * Get item end time
   */
  private getItemEndTime(item: ScheduleItemWithUser, timezone: string): Date {
    if (item.endTime) {
      return this.parseScheduleTime(item.endTime, item.scheduleDate, timezone);
    }

    // Calculate from duration
    const startTime = this.parseScheduleTime(item.startTime, item.scheduleDate, timezone);
    const durationMs = (item.durationMinutes || 30) * 60 * 1000;
    return new Date(startTime.getTime() + durationMs);
  }

  /**
   * Format time for display
   */
  private formatTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
}

// ============================================
// EXPORTS
// ============================================

export const scheduleAutomationService = new ScheduleAutomationService();
export default scheduleAutomationService;
