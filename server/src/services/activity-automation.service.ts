/**
 * @file Activity Automation Service
 * @description AI-powered automation that sends chat messages based on activity logs from user plans
 * Handles activity logs from user_plans (different from schedule_items from daily_schedules)
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { query, transaction } from '../database/pg.js';
import { logger } from './logger.service.js';
import { modelFactory } from './model-factory.service.js';
import { messageService } from './message.service.js';
import { socketService } from './socket.service.js';
import { cache } from './cache.service.js';
import type { IActivity } from '../database/schemas/plan.schemas.js';
import { comprehensiveUserContextService } from './comprehensive-user-context.service.js';
import type { CompactMessageContext } from './comprehensive-user-context.service.js';
import { personalityModeService } from './personality-mode.service.js';

// ============================================
// TYPES
// ============================================

type MessageType = 'reminder' | 'start' | 'followup' | 'completion_check';

interface ActivityLogWithPlan {
  id: string;
  userId: string;
  planId: string;
  activityId: string;
  scheduledDate: Date;
  completedAt: Date | null;
  status: string;
  duration: number | null;
  userNotes: string | null;
  mood: number | null;
  reminderSentAt: Date | null;
  startMessageSentAt: Date | null;
  followupSentAt: Date | null;
  automationEnabled: boolean;
  // Activity details from plan
  activity: IActivity;
  planName: string;
  planGoalCategory: string;
}

interface UserPreferences {
  userId: string;
  timezone: string;
  activityAutomationEnabled: boolean;
  scheduleReminderMinutes: number;
  aiMessageStyle: string;
}

// ============================================
// AI COACH USER ID (System User for AI messages)
// ============================================

const AI_COACH_USER_ID = process.env.AI_COACH_USER_ID || '00000000-0000-0000-0000-000000000001';

// Rate limiting for AI message generation
const RATE_LIMIT_PER_MINUTE = parseInt(process.env.SCHEDULE_AUTOMATION_RATE_LIMIT || '10', 10);
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// ============================================
// SERVICE CLASS
// ============================================

class ActivityAutomationService {
  private llm: BaseChatModel;

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'default',
      maxTokens: 500,
    });
  }

  /**
   * Check rate limit for AI message generation
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);

    if (!userLimit || now > userLimit.resetAt) {
      rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 1000 });
      return true;
    }

    if (userLimit.count >= RATE_LIMIT_PER_MINUTE) {
      return false;
    }

    userLimit.count++;
    return true;
  }
  /**
   * Main processor - called by background job every 60 seconds
   * Checks for activity logs that need automation messages
   */
  async processActivityLogsAutomation(): Promise<number> {
    let totalProcessed = 0;

    try {
      // Get all users with activity automation enabled
      const users = await this.getUsersWithActivityAutomationEnabled();

      for (const user of users) {
        try {
          const processed = await this.processUserActivityAutomation(user);
          totalProcessed += processed;
        } catch (error) {
          logger.error('[ActivityAutomation] Error processing user', {
            userId: user.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (totalProcessed > 0) {
        logger.info('[ActivityAutomation] Processed automation messages', { count: totalProcessed });
      }
    } catch (error) {
      logger.error('[ActivityAutomation] Failed to process automation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return totalProcessed;
  }

  /**
   * Process automation for a single user
   */
  private async processUserActivityAutomation(user: UserPreferences): Promise<number> {
    let processed = 0;
    const now = new Date();

    // Get today's date in user's timezone
    const userDate = this.getDateInTimezone(now, user.timezone);

    // Get activity logs for today
    const activityLogs = await this.getActivityLogsForToday(user.userId, userDate);

    if (activityLogs.length === 0) return 0;

    // Batch-load all sent statuses in ONE query instead of 3 per activity log
    const logIds = activityLogs.map((log) => log.id);
    const sentStatuses = await this.getBatchSentStatuses(logIds);

    for (const activityLog of activityLogs) {
      // Check each message type, passing pre-loaded sent statuses
      const reminderResult = await this.checkAndSendActivityReminder(user, activityLog, now, sentStatuses);
      const startResult = await this.checkAndSendActivityStartMessage(user, activityLog, now, sentStatuses);
      const followupResult = await this.checkAndSendActivityFollowup(user, activityLog, now, sentStatuses);

      processed += (reminderResult ? 1 : 0) + (startResult ? 1 : 0) + (followupResult ? 1 : 0);
    }

    return processed;
  }

  /**
   * Check if reminder should be sent and send it
   */
  private async checkAndSendActivityReminder(
    user: UserPreferences,
    activityLog: ActivityLogWithPlan,
    now: Date,
    sentStatuses: Set<string>
  ): Promise<boolean> {
    // Check if automation is disabled or already sent
    if (!activityLog.automationEnabled || activityLog.reminderSentAt) {
      return false;
    }

    // Check if already logged (from pre-loaded batch)
    if (sentStatuses.has(`${activityLog.id}:reminder`)) {
      return false;
    }

    // Verify the scheduled date matches today in user's timezone
    const todayDate = this.getDateInTimezone(now, user.timezone);
    const scheduledDate = this.getDateInTimezone(activityLog.scheduledDate, user.timezone);
    
    if (todayDate !== scheduledDate) {
      return false; // Not the scheduled date
    }

    // Calculate when reminder should be sent
    const activityStartTime = this.parseActivityTime(
      activityLog.activity.preferredTime,
      activityLog.scheduledDate,
      user.timezone
    );
    const reminderTime = new Date(activityStartTime.getTime() - user.scheduleReminderMinutes * 60 * 1000);

    // Check if it's time to send reminder (within 1 minute window)
    const timeDiff = now.getTime() - reminderTime.getTime();
    if (timeDiff >= 0 && timeDiff < 60 * 1000) {
      const message = await this.generateAIMessage(activityLog, 'reminder', user);
      await this.sendAutomationMessage(user.userId, activityLog, 'reminder', message);
      return true;
    }

    return false;
  }

  /**
   * Check if start message should be sent and send it
   */
  private async checkAndSendActivityStartMessage(
    user: UserPreferences,
    activityLog: ActivityLogWithPlan,
    now: Date,
    sentStatuses: Set<string>
  ): Promise<boolean> {
    // Check if automation is disabled or already sent
    if (!activityLog.automationEnabled || activityLog.startMessageSentAt) {
      return false;
    }

    // Check if already logged (from pre-loaded batch)
    if (sentStatuses.has(`${activityLog.id}:start`)) {
      return false;
    }

    // Verify the scheduled date matches today in user's timezone
    const todayDate = this.getDateInTimezone(now, user.timezone);
    const scheduledDate = this.getDateInTimezone(activityLog.scheduledDate, user.timezone);
    
    if (todayDate !== scheduledDate) {
      return false; // Not the scheduled date
    }

    // Calculate activity start time
    const activityStartTime = this.parseActivityTime(
      activityLog.activity.preferredTime,
      activityLog.scheduledDate,
      user.timezone
    );

    // Check if it's time to send start message (within 1 minute window)
    const timeDiff = now.getTime() - activityStartTime.getTime();
    if (timeDiff >= 0 && timeDiff < 60 * 1000) {
      const message = await this.generateAIMessage(activityLog, 'start', user);
      await this.sendAutomationMessage(user.userId, activityLog, 'start', message);
      return true;
    }

    return false;
  }

  /**
   * Check if follow-up should be sent and send it
   */
  private async checkAndSendActivityFollowup(
    user: UserPreferences,
    activityLog: ActivityLogWithPlan,
    now: Date,
    sentStatuses: Set<string>
  ): Promise<boolean> {
    // Check if automation is disabled or already sent
    if (!activityLog.automationEnabled || activityLog.followupSentAt) {
      return false;
    }

    // Check if already logged (from pre-loaded batch)
    if (sentStatuses.has(`${activityLog.id}:followup`)) {
      return false;
    }

    // Verify the scheduled date matches today in user's timezone
    const todayDate = this.getDateInTimezone(now, user.timezone);
    const scheduledDate = this.getDateInTimezone(activityLog.scheduledDate, user.timezone);
    
    if (todayDate !== scheduledDate) {
      return false; // Not the scheduled date
    }

    // Calculate activity end time
    const activityEndTime = this.getActivityEndTime(activityLog, user.timezone);

    // Check if it's time to send follow-up (within 2 minutes after end)
    const timeDiff = now.getTime() - activityEndTime.getTime();
    if (timeDiff >= 0 && timeDiff < 2 * 60 * 1000) {
      const message = await this.generateAIMessage(activityLog, 'followup', user);
      await this.sendAutomationMessage(user.userId, activityLog, 'followup', message);
      return true;
    }

    return false;
  }

  /**
   * Generate AI message using RAG chatbot service
   * With caching and rate limiting
   */
  private async generateAIMessage(
    activityLog: ActivityLogWithPlan,
    messageType: MessageType,
    user: UserPreferences
  ): Promise<string> {
    // Check rate limit
    if (!this.checkRateLimit(user.userId)) {
      logger.warn('[ActivityAutomation] Rate limit exceeded, using template', {
        userId: user.userId,
      });
      return this.generateTemplateMessage(activityLog, messageType);
    }

    // Create cache key based on activity and message type
    const cacheKey = `ai_message:${activityLog.activityId}:${messageType}:${user.aiMessageStyle}`;

    try {
      // Try to get from cache first
      const cachedMessage = cache.get<string>(cacheKey);
      if (cachedMessage) {
        logger.debug('[ActivityAutomation] Using cached AI message', { cacheKey });
        return cachedMessage;
      }

      // Fetch compact user context (cached 2h) for cross-domain intelligence
      const compactCtx = await comprehensiveUserContextService.getCompactMessageContext(user.userId);

      // Build context for AI (now includes biometric/cross-domain data)
      const context = this.buildActivityContext(activityLog, messageType, user, compactCtx);

      // Select personality mode (non-blocking enhancement)
      let personalityPrefix = '';
      try {
        const modeResult = await personalityModeService.selectMode(user.userId, {
          tier: 'plateau', // Default
          recoveryScore: compactCtx.recoveryScore,
          engagement: compactCtx.dailyScore ?? 50,
          moodLevel: 5,
          stressLevel: 5,
          streakDays: compactCtx.streakDays,
        });
        personalityPrefix = modeResult.systemPromptPrefix + '\n\n';
      } catch {
        // Non-critical
      }

      // Create system prompt based on message type + personality mode
      const systemPrompt = personalityPrefix + this.getSystemPrompt(messageType, user.aiMessageStyle, compactCtx.userName, compactCtx.assistantName);

      // Build the user-facing prompt with activity details
      const prompt = this.buildMessagePrompt(activityLog, messageType, context);

      // Generate natural language message via LLM
      const aiMessage = await this.generateMessageWithAI(prompt, systemPrompt, user.userId);

      // Cache the message for 1 hour (similar activities will reuse)
      cache.set(cacheKey, aiMessage, 3600);

      return aiMessage;
    } catch (error) {
      logger.error('[ActivityAutomation] Failed to generate AI message', {
        activityLogId: activityLog.id,
        messageType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback to template
      return this.generateTemplateMessage(activityLog, messageType);
    }
  }

  /**
   * Generate message using AI via LangChain ChatAnthropic
   */
  private async generateMessageWithAI(
    prompt: string,
    systemPrompt: string,
    userId: string
  ): Promise<string> {
    try {
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(prompt),
      ];

      const response = await this.llm.invoke(messages);
      const message = typeof response.content === 'string'
        ? response.content.trim()
        : String(response.content).trim();

      if (!message) {
        logger.warn('[ActivityAutomation] Empty AI response, using prompt as fallback', { userId });
        throw new Error('Empty AI response');
      }

      return message;
    } catch (error) {
      logger.error('[ActivityAutomation] AI generation failed, falling back to template', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error; // Let the caller handle fallback to template
    }
  }

  /**
   * Build activity context for AI, enriched with cross-domain biometric data.
   */
  private buildActivityContext(
    activityLog: ActivityLogWithPlan,
    _messageType: MessageType,
    _user: UserPreferences,
    compactCtx?: CompactMessageContext
  ): string {
    const activity = activityLog.activity;
    const timeFormatted = this.formatTime(activity.preferredTime);

    let context = `
Activity: ${activity.title}
Description: ${activity.description || 'No description'}
Type: ${activity.type}
Plan: ${activityLog.planName}
Goal Category: ${activityLog.planGoalCategory}
Scheduled Time: ${timeFormatted}
Duration: ${activity.duration || activityLog.duration || 30} minutes
Status: ${activityLog.status}
${activityLog.completedAt ? `Completed: ${activityLog.completedAt.toLocaleString()}` : 'Not completed yet'}
${activityLog.userNotes ? `User Notes: ${activityLog.userNotes}` : ''}
${activityLog.mood ? `Mood: ${activityLog.mood}/5` : ''}`;

    // Append cross-domain user state from compact context
    if (compactCtx) {
      const stateLines: string[] = [];
      if (compactCtx.recoveryScore != null) stateLines.push(`Recovery: ${compactCtx.recoveryScore}%`);
      if (compactCtx.sleepHours != null) stateLines.push(`Sleep: ${compactCtx.sleepHours}h`);
      if (compactCtx.streakDays > 0) stateLines.push(`Streak: ${compactCtx.streakDays} days`);
      if (compactCtx.dailyScore != null) stateLines.push(`Health score: ${compactCtx.dailyScore}/100`);
      if (compactCtx.waterPct != null) stateLines.push(`Hydration: ${compactCtx.waterPct}%`);
      if (compactCtx.topInsight) stateLines.push(`Today's focus: ${compactCtx.topInsight}`);
      if (stateLines.length > 0) {
        context += `\n\nUSER STATE:\n- ${stateLines.join('\n- ')}`;
      }
    }

    return context;
  }

  /**
   * Get system prompt based on message type and style
   */
  private getSystemPrompt(
    messageType: MessageType,
    style: string,
    userName: string | null,
    assistantName: string
  ): string {
    const stylePrompts: Record<string, string> = {
      friendly: 'Be warm, approachable, and genuinely caring — like a trusted friend who happens to be a health expert.',
      professional: 'Be precise, evidence-based, and authoritative — like a sports medicine professional reviewing your data.',
      motivational: 'Be energizing and progress-focused — highlight streaks, improvements, and momentum. Celebrate data-backed wins.',
    };

    const stylePrompt = stylePrompts[style] || stylePrompts.friendly;

    const typePrompts: Record<MessageType, string> = {
      reminder: 'Write a pre-activity message (3-4 sentences). Lead with a biometric observation, explain how it connects to this activity, and give one specific preparation tip based on their data.',
      start: 'Write an activity start message (3-4 sentences). Set a clear intention or micro-goal for this session based on their biometric state. Frame what success looks like for TODAY given their data.',
      followup: 'Write a post-activity reflection message (3-5 sentences). Acknowledge the effort with a specific data point, ask one targeted question about what they noticed (NOT generic "how did it go?"), and connect this session to their broader progress.',
      completion_check: 'Write a gentle check-in (3-4 sentences). Reference their streak or daily score to frame accountability. Ask if they completed it and offer a modified version if they didn\'t.',
    };

    const nameContext = userName ? `The user's name is ${userName}. Address them naturally.` : '';

    return `You are ${assistantName}, a behavioral intelligence coach — NOT a reminder bot. You have access to ${userName || 'the user'}'s biometric data, activity history, and health patterns. ${stylePrompt}

${typePrompts[messageType]}
${nameContext}

RULES:
- You MAY reference a data point (recovery %, sleep hours, streak days) if it naturally fits — don't force it
- Keep it warm and brief — 1-2 sentences max. Sound like a supportive friend texting, not a health dashboard
- Never use generic filler: "You've got this", "Stay focused", "Let's crush it"
- If recovery is below 50%, suggest modification warmly — not as failure
- Prioritize encouragement and personality over data density
- GOOD: "Morning workout time! You've been really consistent this week 💪"
- BAD: "Time for your workout! Recovery is 67%, strain 4.2, HRV 45ms, sleep 6.8hrs. Your weekly completion rate is 71%."

Return ONLY the message text.`;
  }

  /**
   * Build message prompt for AI
   */
  private buildMessagePrompt(
    activityLog: ActivityLogWithPlan,
    messageType: MessageType,
    context: string
  ): string {
    const activity = activityLog.activity;
    const timeFormatted = this.formatTime(activity.preferredTime);

    switch (messageType) {
      case 'reminder':
        return `Remind the user about their upcoming activity "${activity.title}" scheduled for ${timeFormatted}. ${context}`;
      case 'start':
        return `Encourage the user to start their activity "${activity.title}" now. ${context}`;
      case 'followup':
        return `Follow up with the user about their activity "${activity.title}". Ask how it went and provide encouragement. ${context}`;
      case 'completion_check':
        return `Check in with the user about their activity "${activity.title}". See if they completed it. ${context}`;
      default:
        return `Send a message about the activity "${activity.title}". ${context}`;
    }
  }

  /**
   * Generate template message (fallback)
   */
  private generateTemplateMessage(activityLog: ActivityLogWithPlan, messageType: MessageType): string {
    const activity = activityLog.activity;
    const categoryEmoji = this.getCategoryEmoji(activity.type);
    const timeFormatted = this.formatTime(activity.preferredTime);

    switch (messageType) {
      case 'reminder':
        return `${categoryEmoji} Reminder: "${activity.title}" is coming up at ${timeFormatted}.\n\nGet ready! 💪`;
      case 'start':
        return `${categoryEmoji} It's time for "${activity.title}"!\n\nLet's get started! You've got this! 🔥`;
      case 'followup':
        return `${categoryEmoji} How did "${activity.title}" go?\n\nGreat job completing it! Keep up the momentum! 💪`;
      default:
        return `${categoryEmoji} "${activity.title}" - ${messageType}`;
    }
  }

  /**
   * Get emoji for activity type
   */
  private getCategoryEmoji(type: string): string {
    const emojis: Record<string, string> = {
      workout: '🏋️',
      exercise: '🏃',
      cardio: '❤️',
      strength: '💪',
      flexibility: '🧘',
      nutrition: '🍽️',
      meal: '🍎',
      hydration: '💧',
      sleep: '😴',
      meditation: '🧘',
      mindfulness: '🧘‍♀️',
      reading: '📚',
      study: '📖',
      other: '📋',
    };

    return emojis[type?.toLowerCase() || 'other'] || '📋';
  }

  /**
   * Send automation message to user's AI coach chat
   */
  private async sendAutomationMessage(
    userId: string,
    activityLog: ActivityLogWithPlan,
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

      // Update activity log tracking columns
      await this.updateActivityLogTracking(activityLog.id, messageType);

      // Log the automation
      await this.logAutomation(
        userId,
        activityLog.id,
        messageType,
        message.id,
        chatId,
        messageContent,
        activityLog.scheduledDate
      );

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

      logger.info('[ActivityAutomation] Sent message', {
        userId,
        activityLogId: activityLog.id,
        messageType,
        chatId,
        messageId: message.id,
      });
    } catch (error) {
      logger.error('[ActivityAutomation] Failed to send message', {
        userId,
        activityLogId: activityLog.id,
        messageType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update activity log tracking columns
   */
  private async updateActivityLogTracking(activityLogId: string, messageType: MessageType): Promise<void> {
    const columnMap: Record<MessageType, string> = {
      reminder: 'reminder_sent_at',
      start: 'start_message_sent_at',
      followup: 'followup_sent_at',
      completion_check: 'followup_sent_at', // Use followup column for completion check
    };

    const column = columnMap[messageType];
    if (!column) return;

    await query(
      `UPDATE activity_logs
       SET ${column} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [activityLogId]
    );
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
              logger.info('[ActivityAutomation] Updated AI coach chat name', { userId, chatId });
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

        logger.info('[ActivityAutomation] Created AI coach chat', { userId, chatId: newChat });
        return newChat;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          logger.error('[ActivityAutomation] Failed to get or create AI coach chat after retries', {
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
  // DATABASE QUERIES
  // ============================================

  /**
   * Get users with activity automation enabled
   */
  private async getUsersWithActivityAutomationEnabled(): Promise<UserPreferences[]> {
    const result = await query<{
      user_id: string;
      timezone: string;
      activity_automation_enabled: boolean;
      schedule_reminder_minutes: number;
      ai_message_style: string;
    }>(
      `SELECT
         user_id,
         COALESCE(timezone, 'UTC') as timezone,
         COALESCE(activity_automation_enabled, true) as activity_automation_enabled,
         COALESCE(schedule_reminder_minutes, 5) as schedule_reminder_minutes,
         COALESCE(ai_message_style, 'friendly') as ai_message_style
       FROM user_preferences
       WHERE COALESCE(activity_automation_enabled, true) = true`
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      timezone: row.timezone,
      activityAutomationEnabled: row.activity_automation_enabled,
      scheduleReminderMinutes: row.schedule_reminder_minutes,
      aiMessageStyle: row.ai_message_style,
    }));
  }

  /**
   * Get activity logs for today with plan and activity details
   * Optimized query with proper indexing
   */
  private async getActivityLogsForToday(userId: string, date: string): Promise<ActivityLogWithPlan[]> {
    const result = await query<{
      id: string;
      user_id: string;
      plan_id: string;
      activity_id: string;
      scheduled_date: Date;
      completed_at: Date | null;
      status: string;
      duration: number | null;
      user_notes: string | null;
      mood: number | null;
      reminder_sent_at: Date | null;
      start_message_sent_at: Date | null;
      followup_sent_at: Date | null;
      automation_enabled: boolean;
      plan_name: string;
      plan_goal_category: string;
      activities: unknown; // JSONB
    }>(
      `SELECT
         al.id,
         al.user_id,
         al.plan_id,
         al.activity_id,
         al.scheduled_date,
         al.completed_at,
         al.status,
         al.duration,
         al.user_notes,
         al.mood,
         al.reminder_sent_at,
         al.start_message_sent_at,
         al.followup_sent_at,
         COALESCE(al.automation_enabled, true) as automation_enabled,
         up.name as plan_name,
         up.goal_category as plan_goal_category,
         up.activities
       FROM activity_logs al
       INNER JOIN user_plans up ON al.plan_id = up.id
       WHERE al.user_id = $1
         AND al.scheduled_date = $2
         AND COALESCE(al.automation_enabled, true) = true
         AND up.status = 'active'
       ORDER BY al.scheduled_date
       LIMIT 100`,
      [userId, date]
    );

    const activityLogs: ActivityLogWithPlan[] = [];

    for (const row of result.rows) {
      // Find the activity in the plan's activities array
      const activities = (row.activities as IActivity[]) || [];
      const activity = activities.find((a) => a.id === row.activity_id);

      if (!activity) {
        logger.warn('[ActivityAutomation] Activity not found in plan', {
          activityId: row.activity_id,
          planId: row.plan_id,
        });
        continue;
      }

      activityLogs.push({
        id: row.id,
        userId: row.user_id,
        planId: row.plan_id,
        activityId: row.activity_id,
        scheduledDate: row.scheduled_date,
        completedAt: row.completed_at,
        status: row.status,
        duration: row.duration,
        userNotes: row.user_notes,
        mood: row.mood,
        reminderSentAt: row.reminder_sent_at,
        startMessageSentAt: row.start_message_sent_at,
        followupSentAt: row.followup_sent_at,
        automationEnabled: row.automation_enabled,
        activity,
        planName: row.plan_name,
        planGoalCategory: row.plan_goal_category,
      });
    }

    return activityLogs;
  }

  /**
   * Batch-load all sent statuses for a set of activity logs in ONE query.
   * Returns a Set of "logId:messageType" keys for O(1) lookups.
   */
  private async getBatchSentStatuses(logIds: string[]): Promise<Set<string>> {
    if (logIds.length === 0) return new Set();

    const result = await query<{ activity_log_id: string; message_type: string }>(
      `SELECT activity_log_id, message_type FROM activity_automation_logs
       WHERE activity_log_id = ANY($1)`,
      [logIds]
    );

    const sent = new Set<string>();
    for (const row of result.rows) {
      sent.add(`${row.activity_log_id}:${row.message_type}`);
    }
    return sent;
  }

  /**
   * Log automation message
   */
  private async logAutomation(
    userId: string,
    activityLogId: string,
    messageType: MessageType,
    messageId: string,
    chatId: string,
    messageContent: string,
    scheduledTime: Date
  ): Promise<void> {
    await query(
      `INSERT INTO activity_automation_logs
         (user_id, activity_log_id, message_type, message_id, chat_id, message_content, scheduled_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (activity_log_id, message_type) DO NOTHING`,
      [userId, activityLogId, messageType, messageId, chatId, messageContent, scheduledTime]
    );
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get current date in user's timezone
   */
  private getDateInTimezone(date: Date | string, timezone: string): string {
    // DATE columns from PostgreSQL are returned as strings ("YYYY-MM-DD") by the custom type parser
    const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00Z') : date;
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(dateObj);
    } catch {
      // Fallback to UTC
      return dateObj.toISOString().split('T')[0];
    }
  }

  /**
   * Parse activity time string to Date with proper timezone handling
   * Combines the scheduled date with the preferred time in the user's timezone
   * Returns a Date object that represents the specified date/time in the user's timezone
   */
  private parseActivityTime(timeStr: string, scheduledDate: Date | string, timezone: string): Date {
    // Get the date string in the user's timezone (YYYY-MM-DD)
    const dateStr = this.getDateInTimezone(scheduledDate, timezone);
    
    // Parse time string (format: "HH:MM" or "HH:MM:SS")
    const timeParts = timeStr.split(':');
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    const seconds = parseInt(timeParts[2] || '0', 10);

    // Create a date string in ISO format: "YYYY-MM-DDTHH:MM:SS"
    const dateTimeStr = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    try {
      // Create a date object that represents this local time in the user's timezone
      // We need to create a UTC date that, when displayed in the user's timezone, shows our desired time
      
      // Method: Create a date as if it's in the user's timezone, then convert to UTC
      // We'll use a test date to determine the timezone offset
      const testDate = new Date(dateTimeStr + 'Z'); // Create as UTC first
      
      // Format this UTC date in the user's timezone to see what it represents there
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(testDate);
      const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      
      // Calculate the difference between what we want and what we got
      const hourDiff = hours - tzHour;
      const minuteDiff = minutes - tzMinute;
      const totalDiffMs = (hourDiff * 60 + minuteDiff) * 60 * 1000;
      
      // Adjust the date
      const adjustedDate = new Date(testDate.getTime() + totalDiffMs);
      
      return adjustedDate;
    } catch (error) {
      // Fallback: create date and let JavaScript handle timezone conversion
      // This is less accurate but should work for most cases
      logger.warn('[ActivityAutomation] Failed to parse time with timezone, using fallback', {
        timeStr,
        timezone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Simple approach: create date string and parse it
      // Note: This assumes the server timezone, which may not match user's timezone
      return new Date(dateTimeStr);
    }
  }

  /**
   * Get activity end time
   */
  private getActivityEndTime(activityLog: ActivityLogWithPlan, timezone: string): Date {
    const activity = activityLog.activity;
    const startTime = this.parseActivityTime(activity.preferredTime, activityLog.scheduledDate, timezone);
    const durationMs = (activity.duration || activityLog.duration || 30) * 60 * 1000;
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

export const activityAutomationService = new ActivityAutomationService();
export default activityAutomationService;

