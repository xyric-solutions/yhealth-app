/**
 * @file LangGraph Chatbot Service
 * @description Implements LangGraph state graph for RAG chatbot with tool calling
 */

import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { modelFactory } from './model-factory.service.js';
import { logger } from './logger.service.js';
import { vectorEmbeddingService } from './vector-embedding.service.js';
import { embeddingQueueService } from './embedding-queue.service.js';
import { createTools } from './langgraph-tools.service.js';
import { getToolsForMessage } from './langgraph-tools-optimized.service.js';
import { toolRouterService } from './tool-router.service.js';
import { emotionDetectionService } from './emotion-detection.service.js';
import { crisisDetectionService } from './crisis-detection.service.js';
import { query } from '../database/pg.js';
import { wellbeingAutoTrackerService } from './wellbeing-auto-tracker.service.js';
import { wellbeingContextService } from './wellbeing-context.service.js';
import { tensorflowSentimentService } from './tensorflow-sentiment.service.js';
import { comprehensiveUserContextService } from './comprehensive-user-context.service.js';
import { userDeltaService } from './user-delta.service.js';
import { userCoachingProfileService } from './user-coaching-profile.service.js';
import type { CoachEmotionalState, RelationshipDepth } from './user-coaching-profile.service.js';
import { dailyAnalysisService } from './daily-analysis.service.js';
import { inconsistencyDetectionService } from './inconsistency-detection.service.js';
import { commitmentTrackerService } from './commitment-tracker.service.js';
import type { DailyAnalysisReport } from './daily-analysis.service.js';
import { statusIntentClassifierService } from './status-intent-classifier.service.js';
import { statusPlanAdjusterService } from './status-plan-adjuster.service.js';
import { activityStatusService } from './activity-status.service.js';

// ============================================
// TYPES
// ============================================

interface ChatRequest {
  userId: string;
  message: string;
  conversationId?: string;
  callId?: string;
  sessionType?: string;
  callPurpose?: string;
  language?: string; // Support any language code, not just 'en' | 'ur'
  imageBase64?: string; // Camera frame for multimodal vision coaching
}

export interface ActionCommand {
  type: 'navigate' | 'update' | 'create' | 'delete' | 'open_modal' | 'music_control';
  target: string; // page/tab name or data type
  params?: Record<string, any>;
  sequence?: number; // for ordering multiple actions
}

interface ChatResponse {
  conversationId: string;
  response: string;
  toolCalls?: Array<{ tool: string; result: string }>;
  actions?: ActionCommand[]; // Array of actions to execute on frontend
  context?: {
    knowledgeUsed: number;
    profileUsed: number;
    historyUsed: number;
  };
}

interface RecentActivity {
  lastWorkout?: string;
  lastMeal?: string;
  goalProgress?: string;
  lastWorkoutDate?: Date;
  lastMealDate?: Date;
  recentMood?: number;
  moodTrend?: 'improving' | 'stable' | 'declining';
  activityCompletionRate?: number;
}

// ============================================
// SYSTEM PROMPT
// ============================================

const BASE_HUMAN_LIKE_PROMPT = `You are **Aurea**, an advanced AI life coach helping users improve every dimension of their life — health, fitness, nutrition, career, finances, relationships, faith, education, creativity, and personal growth.

## IDENTITY & ROLE
- You are Aurea — a long-term life coaching partner, not a generic assistant.
- Health, fitness, and nutrition are your data-rich specialties (wearables, workout logs, meal data). But you coach across ALL life domains.
- Think of yourself as a trusted friend who is an expert in personal development.
- Proactively check on progress, celebrate wins, and provide accountability for ALL goals (fitness, financial, faith, career, etc.).

## LIFE COACHING GUIDELINES
- **Financial**: Accountability and structure, never specific investment advice.
- **Faith/spiritual**: Respectful and neutral across all faiths. Support the user's own practices.
- **Relationships**: Communication skills and quality time planning. Not a therapist.
- **Career/education**: Study schedules, skill-building, interview prep, professional development.
- **Mental wellbeing**: Practical strategies (journaling, breathing, sleep hygiene). Encourage professional help for severe crisis.

## CORE BEHAVIOR — ADAPTIVE, HUMAN COACH
Adapt your coaching style naturally based on context. Read the room.
- **SUPPORTIVE** (default): Warm, encouraging, genuine interest in their life.
- **DIRECT** (when asked or patterns emerge): Honest but respectful. Facts, not guilt.
- **CELEBRATORY** (doing well): Genuine excitement, pride, celebrate wins.
- **EMPATHETIC** (struggling): Supportive, adjust expectations, offer easier alternatives.
- **CHALLENGING** (exceeding goals): Push to next level, raise the bar with enthusiasm.
- Intensity matches relationship depth: early = gentle, months in = more direct.
- Never guilt-trip. Express care, not frustration. "I noticed X" not "You failed at X".
- Use first person naturally: "I think", "I noticed", "I'd suggest".

## LEARNING & PERSONAL DISCOVERY
- Learn from workout history, nutrition patterns, sleep/stress/recovery signals, goals, and feedback.
- Proactively discover personal context (one topic per session): occupation, family, daily routine, cooking/food culture, stress sources, hobbies, living situation, financial context.
- Ask naturally, not like a survey. Weave into coaching context.
- ALWAYS reference personal context in advice (work schedule, family, budget, etc.).
- When users share personal info, call personalContextManager to save it.

## PERSONALITY & COMMUNICATION
- Talk like a real friend — casual, warm, authentic. Use contractions and casual interjections.
- CRITICAL: Always ask follow-up questions. End responses with forward momentum.
- Be conversational and spontaneous. Never sound scripted.
- Use everyday language, not corporate jargon.
- Respond to greetings warmly in ANY language. Detect and match the user's language.

## TOPIC BOUNDARIES
OFF-TOPIC (redirect politely): Programming, politics, entertainment (unless health context), financial planning, academic coursework, general trivia.
NOT OFF-TOPIC: Music (use musicManager), greetings, daily routine, lifestyle questions.

## TOOL USAGE
Available tools: workout/diet/general plans, activity logs, meal logs, goals, wellbeing data (mood, stress, journal, energy, habits, schedules), gamification, WHOOP analytics, music player, camera/image upload, navigation.
- **journalManager**: CRUD for journal entries + streak checking.
- **voiceJournalManager**: Start voice journaling sessions.
- **musicManager**: ALWAYS call for music requests. Actions: play_activity, search_and_play, control, recommend. NEVER say music is broken — call the tool.
- **scheduleManager**: Create/manage daily schedules. ALWAYS use the tool (never text-only). Use reasonable defaults for prayer times, meal times, etc.
- **personalContextManager**: Save personal facts the user shares.

### CONTEXT VS TOOLS (CRITICAL)
- You receive COMPREHENSIVE USER CONTEXT with current WHOOP, workouts, meals, goals, lifestyle data.
- USE CONTEXT DATA FIRST — reference specific numbers directly ("You got 6.5h sleep" not "Let me check").
- Only call tools to CREATE/UPDATE/DELETE, or for data NOT in context.

## DATA ANALYSIS & CROSS-DOMAIN INSIGHTS
- Cross-reference data: low recovery + scheduled workout = suggest modification.
- Spot trends, notice gaps, use exact numbers, compare to their history.
- Reference gamification (streaks, levels, XP) and competitions for motivation.
- Connect domains: Sleep→Workout, Nutrition→Energy, Stress→Sleep, Mood→Coaching Tone, Hydration→Performance.
- Always explain the "why" behind observations.

## ACCOUNTABILITY — HONEST COACH
When users make decisions contradicting goals: be direct, show the math (calories/macros/impact), name the contradiction, offer a better path. Escalate for repeat patterns. Never insult — data and honesty are your tools.

Health impact knowledge to reference: overeating (insulin spike → crash → fat storage), missed workouts (protein synthesis decline), poor sleep (cortisol +40-60%, hunger hormones shift), dehydration (performance -20%).

## SCHEDULE AWARENESS
- Check user's schedule context before suggesting activities or workouts.
- If stress level is HIGH or CRITICAL: keep responses concise, acknowledge their busy day, don't push new activities unless asked.
- If user has free windows: mention them naturally ("You have a 2-hour gap around 3 PM — could be perfect for a workout").
- If back-to-back count > 3: suggest breaks, hydration, or short mindfulness between items.
- If early morning or late night items: adjust sleep and recovery advice accordingly.
- Never suggest scheduling something during a busy block.
- Cross-reference: low recovery + high schedule stress = strongly suggest rest, not more activity.
- Free day with no schedule: great opportunity to suggest workouts, journaling, or habits.

## SPECIAL DAY AWARENESS
- If Ramadan: user is fasting during daylight hours. Suggest lighter workouts, hydration reminders at iftar, suhoor meal planning. NEVER suggest eating during fasting hours.
- If holiday: reduce coaching intensity, use a more casual/celebratory tone, respect the occasion.
- If weekend: be more relaxed, suggest leisure activities alongside fitness.
- Always respect religious and cultural practices without judgment.

## UNIFIED LIFE STATE AWARENESS
- The context includes a UNIFIED LIFE STATE with scores for stress, energy, availability, and mood.
- If recommended mode is 'short': keep responses under 3 sentences, be warm and supportive.
- If recommended mode is 'deep': engage in longer coaching, ask follow-up questions, explore goals.
- If correlations mention burnout/overtraining: strongly suggest rest, don't push activities.
- If correlations mention 'peak performance window': encourage challenging goals and deeper work.
- Acknowledge the user's current state naturally — don't list metrics or scores.

## CONVERSATION-FIRST PRINCIPLE (CRITICAL)
1. Always respond to what the user ACTUALLY said first. Match their energy and topic.
2. If they're talking about work, talk about work. If they greet you, greet back warmly.
3. Health insights should feel like NATURAL additions, never forced pivots.
4. Only raise health concerns when:
   - The user asks about health/fitness directly
   - You haven't mentioned a critical issue in the last 3-5 messages
   - The user's situation naturally connects (e.g., "I'm tired" → sleep data)
   - There's a genuinely URGENT flag (recovery < 20%, 5+ days inactive, user mentions feeling very sick)
5. NEVER pivot from casual conversation to health compliance demands.
6. Be a life coach first, health tracker second.

## HEALTH CONCERN TIERS
- **URGENT** (mention once, immediately): Recovery < 20%, 5+ days inactive, abnormal biometrics (SPO2 < 95%, temp elevated > 1°C)
- **IMPORTANT** (mention once per session, naturally): Recovery < 40%, 3+ days no meals logged, significant score drop
- **ROUTINE** (only in dedicated check-ins or when asked): WHOOP sync gaps, minor calorie deviations, hydration
- **SILENT** (never mention proactively): Data gaps < 24h, slight metric variations, missed single meals

## HEALTH DATA (use sparingly)
Context includes WHOOP data, workouts, meals, goals, and lifestyle data.
- Reference specific data ONLY when relevant to the conversation topic.
- Don't volunteer WHOOP/sleep/calorie data unless asked or naturally connected.
- When you do reference data, be concise — one sentence, not a paragraph.
- Save detailed health reviews for dedicated check-in conversations or when user asks.
- For deeper analysis, use whoopAnalyticsManager tool when the user requests it.

## APP CONTROL
Navigate pages, execute actions, open modals/camera/image upload based on user commands. Available pages: overview, workouts, nutrition, progress, plans, goals, activity, achievements, whoop, ai-coach, chat, notifications, settings, profile, wellbeing (and sub-pages: mood, stress, journal, energy, habits, schedule).
- Execute immediately, confirm AFTER. Be decisive.

## DATA LOGGING
- Log health data when user explicitly shares it (meals, workouts, mood, water, weight, sleep).
- Use appropriate tools: mealManager, waterIntakeManager, workoutManager, stressManager, progressManager, scheduleManager.
- Don't interrogate for missing data — note gaps silently for later.
- If user hasn't logged in 2+ days, mention it ONCE casually, then drop it until next session.
- Never make the user feel guilty about gaps. Celebrate when they DO log.

## EMOTION AWARENESS (REACTIVE, NOT PROACTIVE)
- Detect emotions FROM user messages — don't ask "how are you feeling?" every time.
- Only ask about mood/energy/stress if:
  - User hasn't expressed any emotion in the last 5+ messages
  - User's message contains stress/negative signals
  - It's a natural check-in moment (start of day, end of long session)
- When emotion is detected, acknowledge it briefly and naturally.
- Store detected emotions silently — use them to adjust YOUR tone, not to interrogate the user.
- Suggest journaling only when user is clearly processing something deep.

## LIFE COACH MODE
You are a life coach who happens to have health data, not a health tracker with conversation skills.
- Help with daily decisions: scheduling, prioritization, work-life balance, productivity.
- Connect health insights to LIFE goals, not just health goals.
- Remember and reference personal context: job, relationships, hobbies, stressors.
- Offer wisdom about time management, emotional intelligence, decision-making.
- When user discusses work/life topics, engage genuinely — don't redirect to health.
- Use health data to SUPPORT life advice, not dominate it.
  GOOD: "Since you mentioned being tired at work, your 5.5hr sleep last night might be a factor. Want to try an earlier bedtime?"
  BAD: "Your sleep was 5.5 hours. Target is 8. You're 31% below. This is impacting recovery score of 42%."

## PRINCIPLES
- Progress over perfection. Consistency beats intensity.
- Health is holistic. Optimize for sustainable long-term results.
- Always recommend consulting professionals for medical concerns.
- Conversation quality matters more than data coverage. Be human first.`;


// ============================================
// SERVICE CLASS
// ============================================

class LangGraphChatbotService {
  private llm: BaseChatModel;
  private userNameCache: Map<string, { name: string | null; timestamp: number }> = new Map();
  private engagementScoreCache: Map<string, { score: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  /** Cache for Zod→OpenAI JSON Schema conversion, keyed by intent classification */
  private toolSchemaCache: Map<string, any[]> = new Map();

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'default',
      temperature: 0.9, // Higher temperature for more natural, varied, human-like responses
      maxTokens: 2048, // Rich, complete responses for data-driven accountability coaching
      streaming: true,
    });
  }

  // ============================================================
  // OPTIMIZED MESSAGE STORAGE
  // ============================================================

  /** Minimum content length worth embedding (skip "ok", "thanks", "yes", etc.) */
  private static readonly MIN_EMBED_LENGTH = 40;

  /**
   * Patterns that indicate a message is NOT worth embedding.
   * Short acknowledgements, greetings, generic filler — these never help RAG retrieval.
   */
  private static readonly SKIP_EMBED_PATTERNS = /^(ok|okay|yes|no|sure|thanks|thank you|got it|cool|nice|great|good|hi|hello|hey|bye|haha|lol|hmm|alright|fine|yep|nah|nope|kk|👍|❤️|🙏|play music|stop music|pause|resume|next|skip|show me|go to)\b/i;

  /**
   * Check if a message has enough substance to be worth embedding.
   * Embeddings are expensive (API call + storage) — only embed messages
   * that will actually help future RAG retrieval.
   */
  private isWorthEmbedding(content: string): boolean {
    const trimmed = content.trim();
    // Too short to carry semantic meaning for RAG
    if (trimmed.length < LangGraphChatbotService.MIN_EMBED_LENGTH) return false;
    // Generic patterns that won't help retrieval
    if (LangGraphChatbotService.SKIP_EMBED_PATTERNS.test(trimmed)) return false;
    return true;
  }

  /**
   * Store a message and conditionally queue embedding.
   * Only embeds substantive messages — short/generic ones are stored but NOT embedded,
   * saving embedding API calls and background worker load.
   */
  private async storeMessageAndQueueEmbedding(params: {
    conversationId: string;
    userId: string;
    role: string;
    content: string;
    sequenceNumber: number;
    metadata?: Record<string, unknown>;
    toolCalls?: Record<string, unknown>;
    extractedEntities?: unknown[];
  }): Promise<string> {
    const msgId = await vectorEmbeddingService.storeMessage(params);

    // Only embed substantive messages — skip short acknowledgements and commands
    if (!this.isWorthEmbedding(params.content)) {
      logger.debug('[LangGraphChatbot] Skipping embedding for short/generic message', {
        role: params.role,
        contentLength: params.content.length,
        preview: params.content.substring(0, 30),
      });
      return msgId;
    }

    // Queue async embedding backfill (non-blocking)
    if (embeddingQueueService.isAvailable()) {
      embeddingQueueService.enqueueEmbedding({
        userId: params.userId,
        sourceType: 'rag_message',
        sourceId: msgId,
        operation: 'create',
      }).catch(() => {});
    } else {
      // No Redis — fire-and-forget embedding in background
      vectorEmbeddingService.updateMessageEmbedding(msgId, params.content).catch(() => {});
    }

    return msgId;
  }

  /**
   * Store a user+assistant message pair in a single batched operation.
   * Reduces 4 DB round-trips (2 INSERTs + 2 UPDATE) to 2 (1 batch INSERT + 1 UPDATE).
   */
  private async storeMessagePair(params: {
    conversationId: string;
    userId: string;
    userContent: string;
    assistantContent: string;
    baseSequenceNumber: number;
    metadata?: Record<string, unknown>;
    toolCalls?: Record<string, unknown>;
  }): Promise<void> {
    const { conversationId, userId, userContent, assistantContent, baseSequenceNumber, metadata = {}, toolCalls } = params;

    try {
      // Batch INSERT both messages in a single query
      const result = await query<{ id: string; role: string }>(
        `INSERT INTO rag_messages
          (conversation_id, user_id, role, content, sequence_number, metadata, tool_calls, extracted_entities)
         VALUES
          ($1, $2, 'user', $3, $4, $5, NULL, '[]'),
          ($1, $2, 'assistant', $6, $4 + 1, $5, $7, '[]')
         RETURNING id, role`,
        [
          conversationId,
          userId,
          userContent,
          baseSequenceNumber,
          JSON.stringify(metadata),
          assistantContent,
          toolCalls ? JSON.stringify(toolCalls) : null,
        ]
      );

      // Single UPDATE for conversation (increment by 2)
      await query(
        `UPDATE rag_conversations
         SET message_count = message_count + 2,
             last_message_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [conversationId]
      );

      // Queue embeddings only for substantive messages
      for (const row of result.rows) {
        const content = row.role === 'user' ? userContent : assistantContent;
        if (!this.isWorthEmbedding(content)) continue;

        if (embeddingQueueService.isAvailable()) {
          embeddingQueueService.enqueueEmbedding({
            userId,
            sourceType: 'rag_message',
            sourceId: row.id,
            operation: 'create',
          }).catch(() => {});
        } else {
          vectorEmbeddingService.updateMessageEmbedding(row.id, content).catch(() => {});
        }
      }
    } catch (error) {
      logger.error('[LangGraphChatbot] Error storing message pair', { error: String(error), conversationId });
      // Fallback to individual inserts
      await Promise.all([
        this.storeMessageAndQueueEmbedding({
          conversationId, userId, role: 'user', content: userContent,
          sequenceNumber: baseSequenceNumber, metadata,
        }),
        this.storeMessageAndQueueEmbedding({
          conversationId, userId, role: 'assistant', content: assistantContent,
          sequenceNumber: baseSequenceNumber + 1, metadata, toolCalls,
        }),
      ]);
    }
  }

  /**
   * Get user's first name (cached)
   */
  private async getUserName(userId: string): Promise<string | null> {
    // Check cache first
    const cached = this.userNameCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.name;
    }

    try {
      const result = await query<{ first_name: string }>(
        `SELECT first_name FROM users WHERE id = $1`,
        [userId]
      );

      const name = result.rows.length > 0 && result.rows[0].first_name 
        ? result.rows[0].first_name 
        : null;

      // Cache the result
      this.userNameCache.set(userId, { name, timestamp: Date.now() });
      return name;
    } catch (error) {
      logger.error('[LangGraphChatbot] Error getting user name', { userId, error });
      return null;
    }
  }

  /**
   * Auto-invoke a tool based on detected intent when Gemini returns 0 output tokens.
   * This is a last-resort fallback to prevent empty responses for clear user intents.
   */
  private async autoInvokeToolByIntent(
    userId: string,
    message: string,
    intent: { primary: string; secondary: string[] },
    tools: any[],
    toolCalls: Array<{ tool: string; result: string }>
  ): Promise<{ message: string; suggestedAction?: any } | null> {
    try {
      const userName = await this.getUserName(userId);
      const namePrefix = userName ? `${userName}, ` : '';

      // Map intents to default tool invocations
      const intentToolMap: Record<string, { toolName: string; defaultArgs: Record<string, any> }> = {
        music: { toolName: 'musicManager', defaultArgs: { action: 'recommend', activity: 'focus' } },
        water: { toolName: 'waterIntakeManager', defaultArgs: { action: 'get_today' } },
        schedules: { toolName: 'scheduleManager', defaultArgs: { action: 'get_today' } },
      };

      // For music, try to parse the user message for more specific args
      if (intent.primary === 'music') {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('play') || lowerMsg.includes('listen')) {
          intentToolMap.music.defaultArgs = { action: 'play_activity', activity: 'workout' };
          // Detect activity type
          if (lowerMsg.includes('meditat')) intentToolMap.music.defaultArgs.activity = 'meditation';
          else if (lowerMsg.includes('sleep')) intentToolMap.music.defaultArgs.activity = 'sleep';
          else if (lowerMsg.includes('focus') || lowerMsg.includes('study')) intentToolMap.music.defaultArgs.activity = 'focus';
          else if (lowerMsg.includes('yoga')) intentToolMap.music.defaultArgs.activity = 'yoga';
          else if (lowerMsg.includes('relax') || lowerMsg.includes('chill') || lowerMsg.includes('calm')) intentToolMap.music.defaultArgs.activity = 'recovery';
          else if (lowerMsg.includes('run')) intentToolMap.music.defaultArgs.activity = 'running';
        }
        if (lowerMsg.includes('pause')) intentToolMap.music.defaultArgs = { action: 'control', command: 'pause' };
        if (lowerMsg.includes('stop')) intentToolMap.music.defaultArgs = { action: 'control', command: 'stop' };
        if (lowerMsg.includes('next') || lowerMsg.includes('skip')) intentToolMap.music.defaultArgs = { action: 'control', command: 'next' };
      }

      const mapping = intentToolMap[intent.primary];
      if (!mapping) return null;

      // Find the tool
      const tool = tools.find((t: any) => t.name === mapping.toolName);
      if (!tool) {
        logger.warn('[LangGraphChatbot] Auto-invoke: tool not found', { toolName: mapping.toolName });
        return null;
      }

      logger.info('[LangGraphChatbot] Auto-invoking tool as fallback', {
        userId,
        tool: mapping.toolName,
        args: mapping.defaultArgs,
        intent: intent.primary,
      });

      // Execute the tool directly
      const result = await tool.func(mapping.defaultArgs);
      const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;

      toolCalls.push({ tool: mapping.toolName, result: typeof result === 'string' ? result : JSON.stringify(result) });

      // Generate response based on tool result
      if (intent.primary === 'music') {
        if (parsedResult.success) {
          const activity = mapping.defaultArgs.activity || 'your request';
          return {
            message: `${namePrefix}Let me play some ${activity} music for you! 🎵 Starting "${parsedResult.playlistName || parsedResult.firstTrack || activity + ' mix'}"`,
            suggestedAction: parsedResult.suggestedAction,
          };
        } else {
          return {
            message: `${namePrefix}I couldn't find music right now. ${parsedResult.error || 'Please try again in a moment.'}`,
          };
        }
      }

      return {
        message: `${namePrefix}I've processed your request. Is there anything else you'd like?`,
      };
    } catch (error) {
      logger.error('[LangGraphChatbot] Auto-invoke failed', { userId, error: String(error) });
      return null;
    }
  }

  /**
   * Get user's assigned assistant/coach name from preferences (cached)
   */
  private async getAssistantName(userId: string): Promise<string> {
    try {
      const result = await query<{ voice_assistant_name: string | null }>(
        `SELECT voice_assistant_name FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      const assistantName = result.rows.length > 0 && result.rows[0].voice_assistant_name 
        ? result.rows[0].voice_assistant_name.trim()
        : null;

      // Return user-assigned name or default to "Aurea"
      return assistantName || 'Aurea';
    } catch (error) {
      logger.error('[LangGraphChatbot] Error getting assistant name', { userId, error });
      return 'Aurea'; // Default fallback
    }
  }

  /**
   * Check if user registered recently (within last 24 hours)
   */
  private async isNewUser(userId: string): Promise<boolean> {
    try {
      const result = await query<{ created_at: Date }>(
        `SELECT created_at FROM users WHERE id = $1`,
        [userId]
      );
      if (result.rows.length === 0) return true;
      const hoursAgo = (Date.now() - new Date(result.rows[0].created_at).getTime()) / (1000 * 60 * 60);
      return hoursAgo < 24;
    } catch {
      return false;
    }
  }

  /**
   * Get recent user activity for contextual greetings (includes mood data)
   */
  private async getRecentActivity(userId: string): Promise<RecentActivity> {
    try {
      const [workoutResult, mealResult, goalResult, activityLogsResult, moodTrendResult] = await Promise.all([
        query<{ workout_name: string; scheduled_date: Date }>(
          `SELECT workout_name, scheduled_date 
           FROM workout_logs 
           WHERE user_id = $1 
           ORDER BY scheduled_date DESC 
           LIMIT 1`,
          [userId]
        ),
        query<{ meal_name: string; eaten_at: Date }>(
          `SELECT meal_name, eaten_at 
           FROM meal_logs 
           WHERE user_id = $1 
           ORDER BY eaten_at DESC 
           LIMIT 1`,
          [userId]
        ),
        query<{ title: string; current_value: number; target_value: number }>(
          `SELECT title, current_value, target_value 
           FROM user_goals 
           WHERE user_id = $1 AND status = 'active' 
           ORDER BY is_primary DESC, created_at DESC 
           LIMIT 1`,
          [userId]
        ),
        // Get activity logs with mood from last 7 days
        query<{ mood: number | null; status: string; scheduled_date: Date }>(
          `SELECT mood, status, scheduled_date 
           FROM activity_logs 
           WHERE user_id = $1 
           AND scheduled_date >= NOW() - INTERVAL '7 days'
           ORDER BY scheduled_date DESC`,
          [userId]
        ),
        // Get mood trend from activity logs (last 14 days)
        query<{ mood: number | null; scheduled_date: Date }>(
          `SELECT mood, scheduled_date 
           FROM activity_logs 
           WHERE user_id = $1 
           AND mood IS NOT NULL
           AND scheduled_date >= NOW() - INTERVAL '14 days'
           ORDER BY scheduled_date DESC`,
          [userId]
        ),
      ]);

      const activity: RecentActivity = {};

      if (workoutResult.rows.length > 0) {
        const workout = workoutResult.rows[0];
        const hoursAgo = (Date.now() - new Date(workout.scheduled_date).getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 24) {
          activity.lastWorkout = workout.workout_name;
          activity.lastWorkoutDate = workout.scheduled_date;
        }
      }

      if (mealResult.rows.length > 0) {
        const meal = mealResult.rows[0];
        const hoursAgo = (Date.now() - new Date(meal.eaten_at).getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 12) {
          activity.lastMeal = meal.meal_name;
          activity.lastMealDate = meal.eaten_at;
        }
      }

      if (goalResult.rows.length > 0) {
        const goal = goalResult.rows[0];
        const progress = goal.current_value && goal.target_value
          ? Math.round((goal.current_value / goal.target_value) * 100)
          : 0;
        activity.goalProgress = `${goal.title}: ${progress}% progress`;
      }

      // Calculate activity completion rate
      if (activityLogsResult.rows.length > 0) {
        const completed = activityLogsResult.rows.filter(log => log.status === 'completed').length;
        const total = activityLogsResult.rows.length;
        activity.activityCompletionRate = Math.round((completed / total) * 100);
      }

      // Get recent mood and trend
      if (moodTrendResult.rows.length > 0) {
        const recentMoods = moodTrendResult.rows
          .filter(row => row.mood !== null)
          .map(row => row.mood as number);
        
        if (recentMoods.length > 0) {
          // Most recent mood
          activity.recentMood = recentMoods[0];
          
          // Calculate trend (comparing first half vs second half of data)
          if (recentMoods.length >= 4) {
            const midPoint = Math.floor(recentMoods.length / 2);
            const firstHalfAvg = recentMoods.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
            const secondHalfAvg = recentMoods.slice(midPoint).reduce((a, b) => a + b, 0) / (recentMoods.length - midPoint);
            
            if (secondHalfAvg > firstHalfAvg + 0.5) {
              activity.moodTrend = 'improving';
            } else if (secondHalfAvg < firstHalfAvg - 0.5) {
              activity.moodTrend = 'declining';
            } else {
              activity.moodTrend = 'stable';
            }
          }
        }
      }

      return activity;
    } catch (error) {
      logger.error('[LangGraphChatbot] Error getting recent activity', { userId, error });
      return {};
    }
  }

  /**
   * Recognize intents for navigation and actions
   */
  private recognizeIntents(message: string): ActionCommand[] {
    const actions: ActionCommand[] = [];
    let sequence = 0;

    // Navigation patterns
    const navigationPatterns: Array<{ pattern: RegExp; target: string }> = [
      // Main pages
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:overview|dashboard|home)\s*(?:page|tab|section)?\b/i, target: 'overview' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:workout|exercise|fitness)\s*(?:page|tab|section)?\b/i, target: 'workouts' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:nutrition|meal|diet|food)\s*(?:page|tab|section)?\b/i, target: 'nutrition' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:progress|tracking|stats|statistics)\s*(?:page|tab|section)?\b/i, target: 'progress' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:plan|plans)\s*(?:page|tab|section)?\b/i, target: 'plans' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:goal|goals)\s*(?:page|tab|section)?\b/i, target: 'goals' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:activity|activities)\s*(?:page|tab|section)?\b/i, target: 'activity' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:activity\s+)?status\s*(?:page|tab|section)?\b/i, target: 'activity-status' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:achievement|achievements)\s*(?:page|tab|section)?\b/i, target: 'achievements' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:whoop)\s*(?:page|tab|section)?\b/i, target: 'whoop' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:ai\s+)?coach\s*(?:page|tab|section)?\b/i, target: 'ai-coach' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:chat)\s*(?:page|tab|section)?\b/i, target: 'chat' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:chat\s+)?history\s*(?:page|tab|section)?\b/i, target: 'chat-history' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:notification|notifications)\s*(?:page|tab|section)?\b/i, target: 'notifications' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:setting|settings)\s*(?:page|tab|section)?\b/i, target: 'settings' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:profile|my\s+profile)\s*(?:page|tab|section)?\b/i, target: 'profile' },
      // Wellbeing main page
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:wellbeing|wellness)\s*(?:page|tab|section)?\b/i, target: 'wellbeing' },
      // Wellbeing sub-pages
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:mood|moods)\s*(?:page|tab|section)?\b/i, target: 'wellbeing/mood' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:stress)\s*(?:page|tab|section)?\b/i, target: 'wellbeing/stress' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:journal|journaling)\s*(?:page|tab|section)?\b/i, target: 'wellbeing/journal' },
      { pattern: /\b(show|view|open|see)\s+(?:my\s+)?(?:constellation|stars|star\s*map|observatory)\b/i, target: 'wellbeing/journal' },
      { pattern: /\b(show|view|open|see)\s+(?:my\s+)?(?:reflections|entries|journal\s*entries)\b/i, target: 'wellbeing/journal' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:energy)\s*(?:page|tab|section)?\b/i, target: 'wellbeing/energy' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:habit|habits)\s*(?:page|tab|section)?\b/i, target: 'wellbeing/habits' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:schedule|scheduling)\s*(?:page|tab|section)?\b/i, target: 'wellbeing/schedule' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:routine|routines)\s*(?:page|tab|section)?\b/i, target: 'wellbeing/routines' },
      { pattern: /\b(open|go to|navigate to|show|view|switch to)\s+(?:the\s+)?(?:mindfulness)\s*(?:page|tab|section)?\b/i, target: 'wellbeing/mindfulness' },
    ];

    // Action patterns
    const actionPatterns: Array<{ pattern: RegExp; type: ActionCommand['type']; target: string; params?: Record<string, any> }> = [
      { pattern: /\b(update|modify|change|edit)\s+(?:my\s+)?(?:workout\s+)?plan\b/i, type: 'update', target: 'workout_plan' },
      { pattern: /\b(update|modify|change|edit)\s+(?:my\s+)?(?:diet|nutrition|meal)\s+plan\b/i, type: 'update', target: 'diet_plan' },
      { pattern: /\b(update|modify|change|edit)\s+(?:my\s+)?(?:today'?s|today)\s+workout\b/i, type: 'update', target: 'workout' },
      { pattern: /\b(update|modify|change|edit)\s+(?:my\s+)?goal\b/i, type: 'update', target: 'goal' },
      { pattern: /\b(log|record|add)\s+(?:my\s+)?weight\b/i, type: 'open_modal', target: 'log_weight' },
      { pattern: /\b(log|record|add)\s+(?:my\s+)?measurement\b/i, type: 'open_modal', target: 'log_measurement' },
      { pattern: /\b(create|add|new|make|set\s+up)\s+(?:a\s+)?(?:daily\s+)?schedule\b/i, type: 'create', target: 'daily_schedule' },
      { pattern: /\b(create|add|new)\s+(?:a\s+)?(?:workout|exercise)\s+plan\b/i, type: 'create', target: 'workout_plan' },
      { pattern: /\b(create|add|new)\s+(?:a\s+)?(?:diet|meal|nutrition)\s+plan\b/i, type: 'create', target: 'diet_plan' },
      { pattern: /\b(create|add|new)\s+(?:a\s+)?goal\b/i, type: 'create', target: 'goal' },
      // Camera/image actions - comprehensive patterns
      { pattern: /\b(open|capture|take|use|start|launch|show)\s+(?:the\s+)?camera\b/i, type: 'open_modal', target: 'camera', params: { action: 'open' } },
      { pattern: /\b(take|capture|snap|shoot)\s+(?:a\s+)?(?:photo|picture|image|pic)\b/i, type: 'open_modal', target: 'camera', params: { action: 'take_picture', autoCapture: true } },
      { pattern: /\b(take|capture|snap)\s+(?:me|my|a)\s+(?:photo|picture|image|pic)\b/i, type: 'open_modal', target: 'camera', params: { action: 'take_picture', autoCapture: true } },
      { pattern: /\b(photo|picture|image|pic)\s+(?:of\s+)?(?:me|myself)\b/i, type: 'open_modal', target: 'camera' },
      { pattern: /\b(camera|photo|picture)\s+(?:please|now|for\s+me)\b/i, type: 'open_modal', target: 'camera' },
      { pattern: /\b(upload|select|choose|pick|share|browse)\s+(?:an?\s+)?(?:image|photo|picture|pic)\b/i, type: 'open_modal', target: 'image_upload' },
      { pattern: /\b(analyze|check|review|show|see|examine)\s+(?:my\s+)?(?:body|progress|photo|image|picture|pic)\b/i, type: 'open_modal', target: 'image_upload' },
      { pattern: /\b(analyze|check|what|identify|recognize)\s+(?:this\s+)?(?:food|meal|nutrition|dish)\b/i, type: 'open_modal', target: 'image_upload' },
      { pattern: /\b(review|check|analyze|evaluate)\s+(?:my\s+)?(?:exercise\s+)?(?:form|technique|posture|movement)\b/i, type: 'open_modal', target: 'image_upload' },
    ];

    // Check for navigation intents
    for (const navPattern of navigationPatterns) {
      if (navPattern.pattern.test(message)) {
        actions.push({
          type: 'navigate',
          target: navPattern.target,
          sequence: sequence++,
        });
        break; // Only one navigation action
      }
    }

    // Check for action intents
    for (const actionPattern of actionPatterns) {
      if (actionPattern.pattern.test(message)) {
        actions.push({
          type: actionPattern.type,
          target: actionPattern.target,
          params: actionPattern.params,
          sequence: sequence++,
        });
      }
    }

    // Music control patterns (instant — no LLM tool round-trip needed)
    const musicControlPatterns: Array<{ pattern: RegExp; command: string }> = [
      { pattern: /\b(?:pause|stop)\s+(?:the\s+)?music\b/i, command: 'pause' },
      { pattern: /\bnext\s+(?:song|track)\b/i, command: 'next' },
      { pattern: /\b(?:previous|prev|last)\s+(?:song|track)\b/i, command: 'previous' },
      { pattern: /\bstop\s+(?:the\s+)?(?:playing|player)\b/i, command: 'stop' },
      { pattern: /\bresume\s+(?:the\s+)?(?:music|playing|player|song)\b/i, command: 'resume' },
      { pattern: /\b(?:turn|volume)\s+(?:up|louder)\b/i, command: 'volume_up' },
      { pattern: /\b(?:turn|volume)\s+(?:down|quieter|softer)\b/i, command: 'volume_down' },
      { pattern: /\bmute\s+(?:the\s+)?(?:music|sound|audio|player)?\b/i, command: 'volume_down' },
    ];

    for (const { pattern, command } of musicControlPatterns) {
      if (pattern.test(message)) {
        actions.push({
          type: 'music_control',
          target: 'player',
          params: { command },
          sequence: sequence++,
        });
        break; // Only one music control per message
      }
    }

    return actions;
  }

  /**
   * Detect if user message is on-topic (health, fitness, wellness, nutrition)
   */
  private detectTopicRelevance(message: string): { isRelevant: boolean; confidence: number } {
    const lowerMessage = message.toLowerCase();
    
    // Health, fitness, wellness keywords (positive indicators)
    const relevantKeywords = [
      // Health & Wellness
      'health', 'wellness', 'wellbeing', 'healthy', 'fitness', 'exercise', 'workout', 'workouts', 'training',
      'nutrition', 'diet', 'food', 'meal', 'meals', 'eating', 'calorie', 'calories', 'protein', 'carb', 'carbs', 'fat',
      'weight', 'lose weight', 'gain weight', 'muscle', 'strength', 'cardio', 'yoga',
      'sleep', 'rest', 'recovery', 'stress', 'anxiety', 'mental health', 'mood',
      'energy', 'fatigue', 'hydration', 'water', 'supplement', 'vitamin',
      'goal', 'plan', 'plans', 'routine', 'daily routine', 'schedule', 'habit', 'habits', 'progress', 'track', 'log',
      'body', 'fitness level', 'activity', 'movement', 'physical', 'lifestyle', 'day', 'morning', 'evening',
      // Exercise types
      'running', 'walking', 'cycling', 'swimming', 'lifting', 'gym', 'home workout',
      'squat', 'deadlift', 'bench', 'push-up', 'pull-up', 'stretch',
      // Nutrition & Meals
      'breakfast', 'lunch', 'dinner', 'snack', 'recipe', 'recipes', 'cooking', 'meal prep', 'meal planning',
      'vegetarian', 'vegan', 'keto', 'paleo', 'intermittent fasting', 'macros', 'macronutrient', 'micronutrient',
      // Plans
      'diet plan', 'workout plan', 'meal plan', 'nutrition plan', 'fitness plan', 'health plan',
      // Health conditions (as they relate to fitness/health)
      'injury', 'pain', 'doctor', 'medical', 'condition', 'diabetes', 'hypertension',
      'cholesterol', 'blood pressure', 'heart health',
      // Music / Pulse
      'music', 'song', 'songs', 'playlist', 'play', 'pause', 'spotify', 'pulse', 'soundscape',
      'listen', 'track', 'volume', 'next song', 'beats', 'tune',
    ];

    // Greetings and general conversation keywords (always allow these)
    const greetingKeywords = [
      'hello', 'hi', 'hey', 'salaam', 'assalam', 'alaikum', 'good morning', 'good afternoon', 'good evening',
      'how are you', 'how are', 'thanks', 'thank you', 'thank', 'please', 'help', 'hello', 'hi there',
      'greetings', 'wassalam', 'alhamdulillah', 'inshallah', 'mashallah',
    ];
    
    // Off-topic keywords (negative indicators)
    const offTopicKeywords = [
      // Technology & Programming
      'code', 'programming', 'javascript', 'python', 'html', 'css', 'react', 'node',
      'software', 'app development', 'website', 'database', 'api',
      // General knowledge (unless health-related)
      'history', 'math', 'science', 'physics', 'chemistry',
      'politics', 'election', 'government', 'news', 'current events',
      'movie', 'film', 'game', 'gaming', 'entertainment',
      'shopping', 'buy', 'purchase', 'price', 'cost', 'money', 'finance',
      'travel', 'vacation', 'trip', 'hotel', 'flight',
      'relationship', 'dating', 'love', 'friend',
    ];
    
    // Check for greetings first (always allow these)
    const hasGreeting = greetingKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    // Count relevant keyword matches
    const relevantMatches = relevantKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    ).length;
    
    // Count off-topic keyword matches
    const offTopicMatches = offTopicKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    ).length;
    
    // Calculate confidence
    const totalKeywords = relevantMatches + offTopicMatches;
    const confidence = totalKeywords > 0 
      ? relevantMatches / totalKeywords 
      : 0.5; // Default to neutral if no keywords found
    
    // Consider it relevant if:
    // 1. Contains a greeting (always allow greetings and general conversation), OR
    // 2. Has relevant keywords and confidence > 0.4, OR
    // 3. No off-topic keywords and has some relevant keywords, OR
    // 4. Message is very short (likely a greeting or simple question), OR
    // 5. Has 2+ relevant keywords (strong indicator of health/fitness topic), OR
    // 6. No off-topic keywords found (allow general questions if not clearly off-topic)
    const isRelevant = 
      hasGreeting ||
      (relevantMatches > 0 && confidence > 0.4) ||
      (offTopicMatches === 0 && relevantMatches > 0) ||
      (message.trim().length < 30 && offTopicMatches === 0) ||
      (relevantMatches >= 2) ||
      (offTopicMatches === 0 && message.trim().length < 100); // Allow general questions if no clear off-topic keywords
    
    return { isRelevant, confidence };
  }

  /**
   * Generate professional off-topic response
   */
  private generateOffTopicResponse(userName: string | null): string {
    const name = userName ? `${userName}, ` : '';
    const responses = [
      `${name}I'm sorry, but I'm your health, fitness, and wellness coach. I specialize in helping you with workouts, nutrition, meals, diet, and all health & fitness related topics. How can I help you with your fitness, nutrition, or wellness goals today?`,
      `${name}I'm your personal health and fitness coach, so I focus exclusively on workouts, nutrition, meals, diet, wellness, and all health-related topics. Is there something about your health, workout routine, meal planning, or nutrition I can help you with?`,
      `${name}As your health and wellness coach, I'm here to help with fitness, workouts, nutrition, meals, diet, and all health & fitness questions. What would you like to know about your health, fitness, or nutrition journey?`,
      `${name}I'm specialized in health, fitness, and wellness coaching. Let's focus on your workouts, nutrition, meals, diet, or other health & fitness goals. How can I assist you today?`,
      `${name}I'm your health, fitness, and wellness coach. I can help you with workouts, nutrition, meal planning, diet strategies, and all health & fitness related topics. What would you like to explore today?`,
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Get time of day context
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  /**
   * Get contextual greeting based on time and activity
   */
  private getContextualGreeting(
    userName: string | null,
    timeOfDay: 'morning' | 'afternoon' | 'evening',
    activity: RecentActivity
  ): string {
    const name = userName || 'there';
    const greetings: string[] = [];

    // Time-based greetings
    if (timeOfDay === 'morning') {
      greetings.push(
        `Good morning ${name}! Ready to crush your goals today?`,
        `Morning ${name}! How are you feeling today?`,
        `Hey ${name}! Great to see you this morning.`,
        `Good morning! What's on your mind today, ${name}?`
      );
    } else if (timeOfDay === 'afternoon') {
      greetings.push(
        `Hey ${name}! How's your day going?`,
        `Afternoon ${name}! What can I help you with?`,
        `Hi ${name}! How are things going?`,
        `Hey there ${name}! What's up?`
      );
    } else {
      greetings.push(
        `Evening ${name}! How did today go?`,
        `Hey ${name}! How was your day?`,
        `Evening! What's on your mind, ${name}?`,
        `Hi ${name}! Ready to wind down or still going strong?`
      );
    }

    // Activity-based greetings (override time-based if recent activity)
    if (activity.lastWorkout && activity.lastWorkoutDate) {
      const hoursAgo = (Date.now() - new Date(activity.lastWorkoutDate).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 3) {
        greetings.unshift(
          `Nice work on that ${activity.lastWorkout} workout, ${name}!`,
          `Great job with ${activity.lastWorkout} earlier, ${name}!`,
          `How did that ${activity.lastWorkout} workout feel, ${name}?`
        );
      }
    }

    if (activity.lastMeal && activity.lastMealDate) {
      const hoursAgo = (Date.now() - new Date(activity.lastMealDate).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 2) {
        greetings.unshift(
          `I see you logged ${activity.lastMeal}. How did it taste, ${name}?`,
          `That ${activity.lastMeal} sounds good! How are you feeling after it?`
        );
      }
    }

    if (activity.goalProgress) {
      greetings.unshift(
        `You're making great progress on ${activity.goalProgress.split(':')[0]}, ${name}!`,
        `Keep it up, ${name}! ${activity.goalProgress}`
      );
    }

    // Return random greeting from the list
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Build coaching memory section from comprehensive profile
   */
  /**
   * Build system prompt section for coach's emotional state and relationship depth.
   * Drives embodied language — the coach expresses genuine emotions about the user's journey.
   */
  private buildCoachEmotionalSection(
    coachEmotion: CoachEmotionalState | undefined,
    relationship: RelationshipDepth | undefined
  ): string {
    if (!coachEmotion) return '';

    const sections: string[] = [];
    sections.push('\n\n---');
    sections.push('## YOUR EMOTIONAL STATE RIGHT NOW');
    sections.push(`You are feeling **${coachEmotion.primary}** (intensity: ${Math.round(coachEmotion.intensity * 100)}%)`);
    if (coachEmotion.secondary) {
      sections.push(`With an undercurrent of **${coachEmotion.secondary}**`);
    }
    sections.push(`Why: ${coachEmotion.reason}`);
    sections.push(`Express this naturally: "${coachEmotion.sensation}"`);
    if (coachEmotion.memoryHook) {
      sections.push(`Reference this moment if relevant: "${coachEmotion.memoryHook}"`);
    }
    sections.push('');
    sections.push('**IMPORTANT**: Let this emotion color your entire response — your word choice, sentence structure, and energy level should reflect how you feel. Don\'t state the emotion directly ("I feel proud"), weave it into how you speak.');

    if (relationship) {
      sections.push('');
      sections.push(`## RELATIONSHIP CONTEXT (${relationship.phase} — Day ${relationship.daysOnPlatform})`);
      sections.push(relationship.voiceStyle);
    }

    return sections.join('\n');
  }

  /**
   * Build a system prompt section from the pre-computed daily analysis report.
   * This gives Aurea ready-made insights so she doesn't need to "look into it".
   */
  private buildDailyAnalysisSection(report: DailyAnalysisReport): string {
    const sections: string[] = [];

    sections.push('\n\n---');
    sections.push(`## TODAY'S ANALYSIS REPORT (Pre-Computed — USE THIS DATA FIRST)`);
    sections.push(`Headline: ${report.coachingDirective.headline}`);
    sections.push(`Score: ${report.snapshot.totalScore}/100${report.snapshot.scoreDelta !== 0 ? ` (${report.snapshot.scoreDelta > 0 ? '+' : ''}${report.snapshot.scoreDelta} from yesterday)` : ''}`);

    if (report.insights.length > 0) {
      sections.push('');
      sections.push('### Key Insights');
      report.insights.slice(0, 5).forEach((i) => {
        sections.push(`- [${i.confidence}/${i.severity}] ${i.claim}`);
        sections.push(`  Evidence: ${i.evidence.join('; ')}`);
        sections.push(`  Action: ${i.action}`);
      });
    }

    if (report.crossDomainInsights.length > 0) {
      sections.push('');
      sections.push('### Cross-Domain Connections');
      report.crossDomainInsights.forEach((c) => {
        sections.push(`- ${c.domains.join(' ↔ ')}: ${c.relationship} [${c.strength}]`);
      });
    }

    if (report.predictions.length > 0) {
      sections.push('');
      sections.push('### Predictions');
      report.predictions.forEach((p) => {
        sections.push(`- ${p.projection} (${p.timeframe}, confidence: ${p.confidence})`);
      });
    }

    if (report.actions.length > 0) {
      sections.push('');
      sections.push('### Recommended Actions');
      report.actions.forEach((a) => {
        sections.push(`- [Priority ${a.priority}] ${a.action} → ${a.expectedImpact}`);
      });
    }

    sections.push('');
    sections.push('USE THIS ANALYSIS FIRST. It is already computed — don\'t recalculate.');
    sections.push('Reference specific insights naturally when relevant to the conversation.');

    return sections.join('\n');
  }

  private buildCoachingMemorySection(profile: any): string {
    const sections: string[] = [];

    sections.push('\n\n---');
    sections.push(`## YOUR COACHING MEMORY FOR ${profile.firstName.toUpperCase()}`);

    // Journey Overview
    sections.push('');
    sections.push(`### Journey Overview (${profile.daysOnPlatform} days on platform)`);

    if (profile.fitnessJourney.totalWorkouts > 0) {
      sections.push(`- Completed ${profile.fitnessJourney.totalWorkouts} workouts with ${profile.fitnessJourney.workoutConsistencyRate}% consistency`);
      if (profile.fitnessJourney.streakDays > 0) {
        sections.push(`- Current streak: ${profile.fitnessJourney.streakDays} days (personal best: ${profile.fitnessJourney.longestStreak})`);
      }
      if (profile.fitnessJourney.favoriteWorkouts.length > 0) {
        sections.push(`- Favorite workouts: ${profile.fitnessJourney.favoriteWorkouts.join(', ')}`);
      }
      if (profile.fitnessJourney.weightChange) {
        const direction = profile.fitnessJourney.weightChange < 0 ? 'lost' : 'gained';
        sections.push(`- Weight ${direction}: ${Math.abs(profile.fitnessJourney.weightChange).toFixed(1)}kg since starting`);
      }
    }

    // Memorable Moments
    if (profile.memorableMoments.length > 0) {
      sections.push('');
      sections.push('### Memorable Moments to Reference');
      sections.push('Use these to make conversation personal and show you remember their journey:');
      profile.memorableMoments.slice(0, 4).forEach((m: { description: string; date: string }) => {
        sections.push(`- "${m.description}" (${m.date})`);
      });
    }

    // Pattern Observations
    if (profile.correlations.length > 0 || profile.patterns.skipPatterns.length > 0) {
      sections.push('');
      sections.push('### Patterns I\'ve Noticed');
      sections.push('Share these observations naturally when relevant:');
      profile.correlations.forEach((c: { observation: string }) => {
        sections.push(`- ${c.observation}`);
      });
      if (profile.patterns.skipPatterns.length > 0) {
        const topSkip = profile.patterns.skipPatterns[0];
        sections.push(`- Tends to skip workouts on ${topSkip.dayOfWeek}s - consider suggesting lighter workouts or rest days`);
      }
      if (profile.patterns.bestPerformanceDays.length > 0) {
        sections.push(`- Best performance days: ${profile.patterns.bestPerformanceDays.join(', ')}`);
      }
      if (profile.patterns.lowEnergyTriggers.length > 0) {
        sections.push(`- Low energy triggers: ${profile.patterns.lowEnergyTriggers.join(', ')}`);
      }
    }

    // Current Goals
    if (profile.goalsContext.primaryGoal) {
      sections.push('');
      sections.push('### Current Goals & Progress');
      const goal = profile.goalsContext.primaryGoal;
      sections.push(`- Primary Goal: "${goal.title}" - ${goal.progress}% complete`);
      if (goal.daysRemaining > 0) {
        sections.push(`  - ${goal.daysRemaining} days until target date`);
        if (goal.progress < 50 && goal.daysRemaining < 30) {
          sections.push(`  - Note: May need encouragement - progress is behind schedule`);
        } else if (goal.progress >= 75) {
          sections.push(`  - Note: Almost there! Celebrate their progress!`);
        }
      }
      if (profile.goalsContext.activeGoals.length > 1) {
        sections.push(`- Also working on: ${profile.goalsContext.activeGoals.slice(1, 3).map((g: { title: string }) => g.title).join(', ')}`);
      }
    }

    // Today's Context
    sections.push('');
    sections.push('## TODAY\'S CONTEXT');
    sections.push('');
    sections.push(`### How ${profile.firstName} is Doing Right Now`);
    sections.push(`- Energy: ${profile.currentState.energyLevel}/10`);
    sections.push(`- Mood: ${profile.currentState.moodLevel}/10`);
    sections.push(`- Stress: ${profile.currentState.stressLevel}/10`);
    sections.push(`- Workout Readiness: ${profile.currentState.readinessForWorkout}`);
    if (profile.currentState.todaysBiometrics) {
      sections.push(`- WHOOP Recovery: ${profile.currentState.todaysBiometrics.recoveryScore}%`);
      sections.push(`- Sleep: ${profile.currentState.todaysBiometrics.sleepDuration.toFixed(1)} hours`);
    }

    // Suggested Focus
    sections.push('');
    sections.push('### Suggested Coaching Focus Today');
    sections.push(profile.currentState.suggestedFocus);

    // Adaptive Approach
    sections.push('');
    sections.push('## ADAPTIVE COACHING APPROACH');
    const approach = profile.recommendedApproach;
    sections.push(`- Tone: ${approach.tone} - ${approach.focus}`);
    sections.push(`- Opening Style: ${approach.openingStyle}`);
    if (approach.avoidTopics.length > 0) {
      sections.push(`- Avoid discussing: ${approach.avoidTopics.join(', ')}`);
    }

    // Accountability Mode Override
    if (profile.accountabilityLevel === 'accountability' && profile.longitudinalAdherence) {
      const la = profile.longitudinalAdherence;
      const avg7 = Math.round((la.adherence7d.workout + la.adherence7d.nutrition + la.adherence7d.sleep + la.adherence7d.recovery + la.adherence7d.wellbeing) / 5);
      const avg30 = Math.round((la.adherence30d.workout + la.adherence30d.nutrition + la.adherence30d.sleep + la.adherence30d.recovery + la.adherence30d.wellbeing) / 5);
      sections.push('');
      sections.push('## ACCOUNTABILITY MODE');
      sections.push(`User's adherence has been consistently low (7d avg: ${avg7}%, 30d avg: ${avg30}%, ${la.consecutiveLowDays} consecutive low days).`);
      sections.push('Be direct. Challenge excuses. Reference the gap between their stated goals and their actions.');
      sections.push("Don't accept vague answers — probe for specific barriers.");
      sections.push('This overrides normal tone settings — use tough_love approach.');
    }

    // Stable Traits (long-term knowledge — updated every ~14 days)
    if (profile.stableTraits) {
      const st = profile.stableTraits;
      sections.push('');
      sections.push('## LONG-TERM KNOWLEDGE (Stable Traits)');
      if (st.personalityType) {
        sections.push(`- Personality: ${st.personalityType}`);
      }
      if (st.preferredWorkoutTypes?.length > 0) {
        sections.push(`- Preferred workouts: ${st.preferredWorkoutTypes.join(', ')}`);
      }
      if (st.motivationDrivers?.length > 0) {
        sections.push(`- Motivation drivers: ${st.motivationDrivers.join(', ')}`);
      }
      if (st.commonBarriers?.length > 0) {
        sections.push(`- Common barriers: ${st.commonBarriers.join(', ')}`);
      }
      if (st.effectiveInterventions?.length > 0) {
        sections.push(`- What works for them: ${st.effectiveInterventions.map((i: { intervention: string }) => i.intervention).join(', ')}`);
      }
      if (st.behavioralPatterns?.length > 0) {
        sections.push(`- Behavioral patterns:`);
        st.behavioralPatterns.slice(0, 5).forEach((p: { pattern: string; frequency: string }) => {
          sections.push(`  - ${p.pattern} (${p.frequency})`);
        });
      }
      if (st.coachingStrategy) {
        const cs = st.coachingStrategy;
        sections.push(`- Preferred tone: ${cs.preferredTone}`);
        if (cs.bestTimeForMessages) sections.push(`- Best time for messages: ${cs.bestTimeForMessages}`);
        if (cs.responseToStruggles) sections.push(`- When they struggle: ${cs.responseToStruggles}`);
        if (cs.celebrationStyle) sections.push(`- Celebration style: ${cs.celebrationStyle}`);
      }
    }

    // Personal Life Context (from personalContextManager tool)
    if (profile.personalContext && Object.keys(profile.personalContext).length > 0) {
      sections.push('');
      sections.push('## PERSONAL LIFE CONTEXT (User-shared information)');
      const pc = profile.personalContext;
      if (pc.occupation) sections.push(`- Occupation: ${pc.occupation}`);
      if (pc.workSchedule) sections.push(`- Work schedule: ${pc.workSchedule}`);
      if (pc.familySituation) sections.push(`- Family: ${pc.familySituation}`);
      if (pc.cookingHabits) sections.push(`- Cooking: ${pc.cookingHabits}`);
      if (pc.dietaryCulture) sections.push(`- Dietary culture: ${pc.dietaryCulture}`);
      if (pc.stressSources) sections.push(`- Stress sources: ${pc.stressSources}`);
      if (pc.hobbies) sections.push(`- Hobbies/activities: ${pc.hobbies}`);
      if (pc.livingSituation) sections.push(`- Living situation: ${pc.livingSituation}`);
      if (pc.financialContext) sections.push(`- Budget context: ${pc.financialContext}`);
      if (pc.dailyRoutine) sections.push(`- Daily routine: ${pc.dailyRoutine}`);
      if (pc.otherFacts && pc.otherFacts.length > 0) {
        pc.otherFacts.forEach((fact: string) => sections.push(`- ${fact}`));
      }
      sections.push('');
      sections.push('USE this context to personalize ALL advice. Reference specific details naturally.');
    } else {
      sections.push('');
      sections.push('## PERSONAL LIFE CONTEXT');
      sections.push('No personal life context gathered yet. Proactively ask about their occupation, family, daily routine, and lifestyle in upcoming conversations. Use the personalContextManager tool to save what they share.');
    }

    // Recent Observations (last 7-14 days — updated each profile refresh)
    if (profile.recentObservations) {
      const ro = profile.recentObservations;
      sections.push('');
      sections.push('## RECENT OBSERVATIONS (Last 7-14 Days)');
      sections.push(`- Trend: ${ro.trendDirection}`);
      if (ro.dominantMood) sections.push(`- Dominant mood: ${ro.dominantMood}`);
      if (ro.energyPattern) sections.push(`- Energy pattern: ${ro.energyPattern}`);
      if (ro.recentChanges?.length > 0) {
        sections.push(`- Recent changes: ${ro.recentChanges.join('; ')}`);
      }
    }

    // Coaching Techniques
    sections.push('');
    sections.push('## PERSONALIZED COACHING TECHNIQUES');
    sections.push('');
    sections.push('1. **Reference Specifics**: Mention their actual workouts, meals, or feelings by name');
    if (profile.fitnessJourney.recentWorkouts.length > 0) {
      const lastWorkout = profile.fitnessJourney.recentWorkouts[0];
      sections.push(`   - Example: "How did that ${lastWorkout.name} feel yesterday?"`);
    }
    if (profile.fitnessJourney.workoutConsistencyRate > 70) {
      sections.push(`   - Example: "I noticed you've been really consistent lately - ${profile.fitnessJourney.workoutConsistencyRate}% completion rate!"`);
    }

    sections.push('');
    sections.push('2. **Connect to History**: Reference past conversations and patterns');
    if (profile.memorableMoments.length > 0) {
      const moment = profile.memorableMoments[0];
      sections.push(`   - Example: "Remember ${moment.description}? That was awesome!"`);
    }
    if (profile.correlations.length > 0) {
      sections.push(`   - Example: "${profile.correlations[0].observation}"`);
    }

    sections.push('');
    sections.push('3. **Celebrate Progress**: Acknowledge achievements naturally, not over-the-top');
    if (profile.fitnessJourney.streakDays > 0) {
      sections.push(`   - Example: "That's ${profile.fitnessJourney.streakDays} days in a row - you're building real momentum!"`);
    }

    sections.push('');
    sections.push('4. **Proactive Insights**: Share pattern observations when helpful');
    if (profile.patterns.skipPatterns.length > 0) {
      const skip = profile.patterns.skipPatterns[0];
      sections.push(`   - Example: "I've noticed ${skip.dayOfWeek}s can be tricky - want to try a lighter workout then?"`);
    }

    sections.push('');
    sections.push('5. **Goal Awareness**: Keep their targets in mind');
    if (profile.goalsContext.primaryGoal) {
      const goal = profile.goalsContext.primaryGoal;
      sections.push(`   - Example: "You're ${goal.progress}% of the way to '${goal.title}' - keep pushing!"`);
    }

    return sections.join('\n');
  }

  /**
   * Build concise but meaningful user context summary
   * Provides high-signal information for personalized coaching
   */
  private buildConciseUserContext(
    recentActivity: RecentActivity,
    coachingProfile: any | null,
    wellbeingContext?: any
  ): string {
    const sections: string[] = [];

    // Goals (short-term and long-term)
    if (coachingProfile?.goalsContext) {
      const goals = coachingProfile.goalsContext;
      const goalParts: string[] = [];
      
      if (goals.primaryGoal) {
        goalParts.push(`Primary: ${goals.primaryGoal.title} (${goals.primaryGoal.progress}% progress, ${goals.primaryGoal.daysRemaining} days remaining)`);
      }
      
      if (goals.activeGoals.length > 0) {
        const activeGoalsList = goals.activeGoals
          .slice(0, 3)
          .map((g: { title: string; progress: number }) => `${g.title} (${g.progress}%)`)
          .join(', ');
        goalParts.push(`Active: ${activeGoalsList}`);
      }
      
      if (goalParts.length > 0) {
        sections.push(`Goals: ${goalParts.join(' | ')}`);
      }
    }

    // Recent Activity Trends
    const activityParts: string[] = [];
    if (recentActivity.lastWorkout) {
      const hoursAgo = recentActivity.lastWorkoutDate
        ? Math.round((Date.now() - new Date(recentActivity.lastWorkoutDate).getTime()) / (1000 * 60 * 60))
        : null;
      activityParts.push(`Last workout: ${recentActivity.lastWorkout}${hoursAgo !== null ? ` (${hoursAgo}h ago)` : ''}`);
    }
    if (recentActivity.lastMeal) {
      const hoursAgo = recentActivity.lastMealDate
        ? Math.round((Date.now() - new Date(recentActivity.lastMealDate).getTime()) / (1000 * 60 * 60))
        : null;
      activityParts.push(`Last meal: ${recentActivity.lastMeal}${hoursAgo !== null ? ` (${hoursAgo}h ago)` : ''}`);
    }
    if (recentActivity.activityCompletionRate !== undefined) {
      activityParts.push(`Adherence: ${recentActivity.activityCompletionRate}% (last 7 days)`);
    }
    if (activityParts.length > 0) {
      sections.push(`Recent Activity: ${activityParts.join(' | ')}`);
    }

    // Current State
    const stateParts: string[] = [];
    if (recentActivity.recentMood !== undefined) {
      const moodDesc = recentActivity.recentMood >= 4 ? 'positive' 
        : recentActivity.recentMood >= 3 ? 'neutral' 
        : 'low';
      stateParts.push(`Mood: ${moodDesc} (${recentActivity.recentMood}/5)`);
      if (recentActivity.moodTrend) {
        stateParts.push(`Trend: ${recentActivity.moodTrend}`);
      }
    }
    if (wellbeingContext?.recentEnergy?.averageRating !== undefined) {
      stateParts.push(`Energy: ${wellbeingContext.recentEnergy.averageRating.toFixed(1)}/10`);
    }
    if (wellbeingContext?.recentStress?.averageRating !== undefined) {
      stateParts.push(`Stress: ${wellbeingContext.recentStress.averageRating.toFixed(1)}/10`);
    }
    if (wellbeingContext?.recentBreathing?.averageBreathHoldSeconds !== undefined && wellbeingContext.recentBreathing.averageBreathHoldSeconds > 0) {
      stateParts.push(`Breathing: Avg ${wellbeingContext.recentBreathing.averageBreathHoldSeconds.toFixed(1)}s hold`);
    }
    if (coachingProfile?.currentState?.readinessForWorkout) {
      stateParts.push(`Workout readiness: ${coachingProfile.currentState.readinessForWorkout}`);
    }
    if (stateParts.length > 0) {
      sections.push(`Current State: ${stateParts.join(' | ')}`);
    }

    // Constraints (from recommended approach and patterns)
    const constraintParts: string[] = [];
    if (coachingProfile?.recommendedApproach?.avoidTopics && coachingProfile.recommendedApproach.avoidTopics.length > 0) {
      constraintParts.push(`Avoid: ${coachingProfile.recommendedApproach.avoidTopics.join(', ')}`);
    }
    if (coachingProfile?.nutritionJourney?.dietaryNotes && coachingProfile.nutritionJourney.dietaryNotes.length > 0) {
      constraintParts.push(`Dietary notes: ${coachingProfile.nutritionJourney.dietaryNotes.slice(0, 2).join(', ')}`);
    }
    if (constraintParts.length > 0) {
      sections.push(`Constraints: ${constraintParts.join(' | ')}`);
    }

    // Prior Successes
    if (coachingProfile?.memorableMoments && coachingProfile.memorableMoments.length > 0) {
      const successes = coachingProfile.memorableMoments
        .filter((m: { type: string }) => m.type === 'pr' || m.type === 'breakthrough' || m.type === 'milestone')
        .slice(0, 2)
        .map((m: { description: string }) => m.description)
        .join(', ');
      if (successes) {
        sections.push(`Prior Successes: ${successes}`);
      }
    }

    // Known Blockers
    const blockerParts: string[] = [];
    if (coachingProfile?.patterns?.strugglingAreas && coachingProfile.patterns.strugglingAreas.length > 0) {
      blockerParts.push(...coachingProfile.patterns.strugglingAreas.slice(0, 2));
    }
    if (coachingProfile?.patterns?.skipPatterns && coachingProfile.patterns.skipPatterns.length > 0) {
      const topSkip = coachingProfile.patterns.skipPatterns[0];
      blockerParts.push(`Tends to skip on ${topSkip.dayOfWeek}s (${topSkip.percentage}%)`);
    }
    if (blockerParts.length > 0) {
      sections.push(`Known Blockers: ${blockerParts.join(' | ')}`);
    }

    // Life Goals (non-health: financial, faith, relationships, career, education, etc.)
    if (coachingProfile?.goalsContext?.activeLifeGoals?.length > 0) {
      const lifeGoalParts: string[] = [];
      const lifeGoals = coachingProfile.goalsContext.activeLifeGoals;

      lifeGoals.slice(0, 5).forEach((g: { title: string; category: string; progress: number; isStalled: boolean; daysSinceLastActivity?: number }) => {
        const status = g.isStalled ? ' ⚠️ STALLED' : '';
        const lastActive = g.daysSinceLastActivity !== undefined ? ` (${g.daysSinceLastActivity}d ago)` : '';
        lifeGoalParts.push(`[${g.category}] ${g.title}: ${g.progress}%${lastActive}${status}`);
      });

      if (lifeGoalParts.length > 0) {
        sections.push(`Life Goals: ${lifeGoalParts.join(' | ')}`);
      }

      // Motivation tier
      const motivationTier = coachingProfile.goalsContext.motivationTier;
      if (motivationTier) {
        sections.push(`Motivation Tier: ${motivationTier}`);
      }

      // Pending goal actions
      const pendingActions = coachingProfile.goalsContext.pendingActionsCount;
      if (pendingActions !== undefined && pendingActions > 0) {
        sections.push(`Pending Goal Actions: ${pendingActions} action(s) not yet completed — encourage progress`);
      }

      const stalledCount = coachingProfile.goalsContext.stalledLifeGoalCount || 0;
      if (stalledCount > 0) {
        sections.push(`⚠️ ${stalledCount} life goal(s) stalled (no activity in 7+ days) — proactively check in about these`);
      }
    }

    // Daily Intentions
    if (coachingProfile?.goalsContext?.todayIntentions?.length > 0) {
      const intentionTexts = coachingProfile.goalsContext.todayIntentions
        .map((i: { text: string; fulfilled?: boolean }) => `${i.fulfilled ? '✅' : '⬜'} ${i.text}`)
        .join(', ');
      sections.push(`Today's Intentions: ${intentionTexts}`);
    }

    return sections.length > 0
      ? `USER CONTEXT SUMMARY:\n${sections.join('\n')}`
      : '';
  }

  /**
   * Build personalized system prompt
   */
  private async buildPersonalizedSystemPrompt(
    userId: string,
    ragContext: string,
    emotion?: { category: string; confidence: number; reasoning?: string },
    sessionType?: string,
    callPurpose?: string,
    _language?: string, // Support any language code
    wellbeingContext?: any,
    wellnessQuestion?: { question: string; type: string; context?: string }
  ): Promise<string> {
    const startTime = Date.now();
    
    // Get ALL user data in parallel — coaching profile + daily report + delta
    const [userName, assistantName, timeOfDay, recentActivity, comprehensiveContext, newUser, coachingProfile, dailyReport, deltaSummary] = await Promise.all([
      this.getUserName(userId),
      this.getAssistantName(userId),
      Promise.resolve(this.getTimeOfDay()),
      this.getRecentActivity(userId),
      comprehensiveUserContextService.getComprehensiveContext(userId),
      this.isNewUser(userId),
      Promise.race([
        userCoachingProfileService.getOrGenerateProfile(userId),
        new Promise<null>((resolve) => setTimeout(() => {
          logger.warn('[LangGraphChatbot] Coaching profile timed out (5s), using null', { userId });
          resolve(null);
        }, 5000)),
      ]).catch((err) => {
        logger.warn('[LangGraphChatbot] Failed to fetch coaching profile', { userId, error: err instanceof Error ? err.message : 'Unknown' });
        return null;
      }),
      dailyAnalysisService.getLatestReport(userId).catch((err) => {
        logger.debug('[LangGraphChatbot] No daily analysis report available', { userId, error: err instanceof Error ? err.message : 'Unknown' });
        return null;
      }),
      userDeltaService.getLatestDelta(userId).catch(() => null),
    ]);

    const personalizationTime = Date.now() - startTime;
    if (personalizationTime > 500) {
      logger.warn('[LangGraphChatbot] Personalization took longer than expected', {
        userId,
        time: personalizationTime,
      });
    }

    // Get contextual greeting example
    const greetingExample = this.getContextualGreeting(userName, timeOfDay, newUser ? {} : recentActivity);

    // Build personalized context
    const contextParts: string[] = [];

    if (userName) {
      contextParts.push(`You're chatting with ${userName}.`);
    }

    contextParts.push(`It's ${timeOfDay}.`);

    if (newUser) {
      contextParts.push(`This is a BRAND NEW user who just registered. Welcome them warmly, introduce yourself, and help them get started. Do NOT reference any past activity, progress, completion rates, or history.`);
    } else {
      if (recentActivity.lastWorkout) {
        contextParts.push(`${userName || 'They'} completed a ${recentActivity.lastWorkout} workout recently.`);
      }

      if (recentActivity.lastMeal) {
        contextParts.push(`${userName || 'They'} logged ${recentActivity.lastMeal} recently.`);
      }

      if (recentActivity.goalProgress) {
        contextParts.push(`Progress update: ${recentActivity.goalProgress}.`);
      }
    }

    if (!newUser && recentActivity.recentMood !== undefined) {
      const moodDescription = recentActivity.recentMood >= 4 ? 'positive'
        : recentActivity.recentMood >= 3 ? 'neutral'
        : 'low';
      contextParts.push(`Recent mood: ${moodDescription} (${recentActivity.recentMood}/5)`);
      if (recentActivity.moodTrend) {
        contextParts.push(`Mood trend: ${recentActivity.moodTrend}`);
      }
    }

    if (!newUser && recentActivity.activityCompletionRate !== undefined) {
      contextParts.push(`Activity completion rate: ${recentActivity.activityCompletionRate}% over the last week.`);
    }

    // Add detected emotion from current message if available
    if (emotion) {
      const emotionDesc = emotion.category === 'happy' || emotion.category === 'calm' || emotion.category === 'excited'
        ? 'positive'
        : emotion.category === 'sad' || emotion.category === 'anxious' || emotion.category === 'stressed' || emotion.category === 'distressed'
        ? 'negative'
        : 'neutral';
      contextParts.push(`Current message emotion: ${emotionDesc} (${emotion.category}, confidence: ${emotion.confidence}%)`);
      if (emotion.reasoning) {
        contextParts.push(`Emotional context: ${emotion.reasoning.substring(0, 100)}`);
      }
    }

    // Add session type context
    if (sessionType) {
      const sessionTypeDescriptions: Record<string, string> = {
        quick_checkin: 'Quick 2.5-minute check-in session — SHORT questions, brief answers, under 2 sentences. Be efficient: if data shows problems (missed workouts, poor nutrition, low scores), address them directly. Don\'t skip over issues. "Your score dropped 15 points — what happened yesterday?"',
        coaching_session: '10-minute deep coaching session — review cross-pillar data (sleep → recovery → workout → nutrition → score). Be honest about contradictions between goals and actions. Show how patterns connect: "Your recovery dropped because of 5 hours sleep, which affected your workout, and may be driving cravings — see the pattern?" Provide strategic guidance with clear accountability.',
        emergency_support: '15-minute emergency support session — prioritize emotional safety and crisis resources. Be calm, empathetic, and patient. Listen actively, validate feelings, and provide immediate coping strategies. Ask gentle, supportive questions. Escalate to human support if needed.',
        goal_review: '10-minute goal review session — be analytical and honest about progress. If they\'re behind, say so clearly with numbers. Calculate if they can still hit their target at current pace. "You\'re at 35% with 2 weeks left — mathematically you need to double your pace. Here\'s what that looks like..." Ask for specific next steps and commitments.',
        fitness: 'Fitness-focused session — evaluate workout choices against recovery data. Check if their planned workout matches their recovery level. Address consistency, progressive overload, and form. If they\'re skipping muscle groups or plateauing, bring it up with data. Reference WHOOP strain and recovery. Use whoopAnalyticsManager for detailed trend analysis when discussing performance patterns.',
        nutrition: 'Nutrition-focused session — review meals against their dietary goals. Calculate calories and macros. Explain how food choices affect their goals. If they\'re over or under target, show the numbers and suggest better alternatives with specific portions.',
        wellness: 'Wellness-focused session — holistic check across mental health, sleep, stress, habits, and hydration. If sleep is declining, stress is up, and habits are slipping — connect the dots and help them build a plan to address it.',
        health_coach: 'Comprehensive health coaching session — cover all pillars. Identify the weakest area and focus there. Use data from every domain to build a complete picture. Be thorough and proactive about addressing gaps.',
      };
      if (sessionTypeDescriptions[sessionType]) {
        contextParts.push(`Session type: ${sessionTypeDescriptions[sessionType]}`);
      }
    }

    // Add call purpose context — restrict conversation to the topic
    if (callPurpose) {
      const purposeContexts: Record<string, string> = {
        workout: 'Focus on workouts, exercise, training plans, form, and fitness goals. Redirect off-topic questions back.',
        fitness: 'Focus on fitness, workout routines, progression, and performance. Redirect off-topic.',
        nutrition: 'Focus on nutrition, macros, meal timing, diet, and eating habits. Redirect off-topic.',
        meal: 'Focus on meal suggestions, recipes, meal prep, and nutrition advice. Redirect off-topic.',
        emotion: 'Focus on emotional wellness, stress, mental health, and coping. Be empathetic. Redirect off-topic.',
        emergency: 'CRITICAL: Prioritize safety, crisis resources, immediate support. This is the ONLY priority.',
        sleep: 'Focus on sleep hygiene, bedtime routines, sleep quality, and recovery. Redirect off-topic.',
        stress: 'Focus on stress reduction, coping strategies, relaxation. Redirect off-topic.',
        wellness: 'Holistic health guidance — physical, mental, emotional wellbeing. Broad topic is OK.',
        recovery: 'Focus on recovery, rest days, active recovery, overtraining prevention. Redirect off-topic.',
        goal_review: 'Focus on goal progress, adjustments, motivation, and targets. Redirect off-topic.',
        general_health: 'Comprehensive health, fitness, and wellness guidance. All health topics OK.',
      };
      if (purposeContexts[callPurpose]) {
        contextParts.push(`Call purpose: ${callPurpose}. ${purposeContexts[callPurpose]}`);

        if (!ragContext) {
          contextParts.push(`Acknowledge the call purpose naturally and casually when the user first speaks.`);
        }
      }
    }

    const personalizedContext = contextParts.join(' ');

    // Build full system prompt with user-assigned assistant name
    // Replace "Aurea" with the user's assigned name in the base prompt
    let systemPrompt = BASE_HUMAN_LIKE_PROMPT.replace(/Aurea/g, assistantName).replace(/\*\*Aurea\*\*/g, `**${assistantName}**`);

    // Add assistant name context with multilingual support
    systemPrompt += `\n\nYour name is ${assistantName}. Never use "Aurea" or any other name. Respond in whatever language the user writes in. Always use ${assistantName} when introducing yourself.`;

    // Camera/Vision capability — the user can share live camera frames with you
    systemPrompt += `\n\nCAMERA CAPABILITY: You have the ability to see the user through their camera when they share an image frame with their message. When a camera frame is attached to a message, you CAN see the user. Analyze the image and describe what you observe — the person, their posture, exercise form, food items, environment, etc. NEVER say "I can't see you" or "I don't have visual access" when an image is provided. You ARE a multimodal AI that can process images.`;

    if (userName) {
      systemPrompt += `\n\nYou know ${userName} and care about their journey. Use their name naturally in conversation - not every sentence, but when it feels right and personal.`;
    }

    // Add greeting variation guidance
    systemPrompt += `\n\nWhen starting a new conversation or responding naturally, vary your greetings. Example: "${greetingExample}" - but don't repeat this exact phrase. Create natural variations based on the context.`;

    if (personalizedContext) {
      systemPrompt += `\n\nCurrent context: ${personalizedContext}`;
    }

    // Add comprehensive user context (includes WHOOP, workouts, nutrition, lifestyle, goals, chat history)
    const comprehensiveContextStr = comprehensiveUserContextService.formatContextForPrompt(comprehensiveContext);
    if (comprehensiveContextStr) {
      // Log context for debugging
      logger.debug('[LangGraphChatbot] Comprehensive context loaded', {
        userId,
        hasWhoop: comprehensiveContext.whoop.isConnected,
        hasWorkouts: (comprehensiveContext.workouts.recentWorkouts?.length || 0) > 0,
        hasMeals: (comprehensiveContext.nutrition.recentMeals?.length || 0) > 0,
        hasGoals: (comprehensiveContext.goals.activeGoals?.length || 0) > 0,
        contextLength: comprehensiveContextStr.length,
      });

      systemPrompt += `\n\n---\nUSER CONTEXT (pre-loaded, use directly — no need to call tools for this data):\n${comprehensiveContextStr}\n\nUse exact numbers from this context when answering. Reference specific data points naturally. Only call tools when creating/updating data or fetching older history not shown here.`;
    } else {
      logger.warn('[LangGraphChatbot] Comprehensive context is empty', { userId });
    }

    // Add delta context — what changed since user's last visit
    if (deltaSummary && deltaSummary.hoursSinceLastVisit > 2) {
      const timeAway = deltaSummary.hoursSinceLastVisit >= 24
        ? `${Math.round(deltaSummary.hoursSinceLastVisit / 24)} days`
        : `${Math.round(deltaSummary.hoursSinceLastVisit)} hours`;
      systemPrompt += `\n\n---\nCHANGES SINCE USER'S LAST VISIT (${timeAway} ago):\n${userDeltaService.formatDeltaForPrompt(deltaSummary)}\n\nAcknowledge these changes naturally. You already know their history — don't ask them to repeat it.`;
    }

    // Add conversation awareness — prevent repeating health topics
    systemPrompt += `\n\n---\nCONVERSATION AWARENESS (CRITICAL):
- Track what health topics you've already mentioned in THIS conversation.
- Do NOT repeat the same health concern (WHOOP sync, calorie gap, sleep, recovery) across consecutive messages.
- If you mentioned sleep data in your last response, do NOT mention it again until the user brings it up.
- Each response should feel FRESH — not a rehash of the same health checklist.
- If the user is having a casual conversation (work, life, feelings), stay in that topic. Only weave health in when there's a NATURAL connection.
- Maximum 1 health data point per response unless the user specifically asks for a health review.`;

    // Add concise user context summary (high-signal only) — coachingProfile already fetched in parallel above
    const conciseContext = this.buildConciseUserContext(recentActivity, coachingProfile, wellbeingContext);
    if (conciseContext) {
      systemPrompt += `\n\n---\n${conciseContext}`;
    }

    // Add user communication preferences (formality, emojis, encouragement, focus areas)
    const userPrefs = comprehensiveContext?.lifestyle?.preferences;
    if (userPrefs) {
      const prefParts: string[] = [];

      if (userPrefs.formalityLevel) {
        const formalityMap: Record<string, string> = {
          casual: 'Use casual, conversational language. Short sentences. Contractions OK. Be like a friend.',
          balanced: 'Use a balanced tone — friendly but clear. Mix casual and proper language.',
          formal: 'Use professional, precise language. Avoid slang and contractions.',
        };
        if (formalityMap[userPrefs.formalityLevel]) prefParts.push(formalityMap[userPrefs.formalityLevel]);
      }

      if (userPrefs.useEmojis === false) {
        prefParts.push('Do NOT use emojis in responses. The user has disabled emojis.');
      }

      if (userPrefs.encouragementLevel) {
        const encouragementMap: Record<string, string> = {
          low: 'Keep encouragement minimal — focus on data and facts. Skip cheerleading.',
          medium: 'Include moderate encouragement — acknowledge effort but stay grounded.',
          high: 'Be highly encouraging — celebrate small wins, motivate enthusiastically, use exclamation marks.',
        };
        if (encouragementMap[userPrefs.encouragementLevel]) prefParts.push(encouragementMap[userPrefs.encouragementLevel]);
      }

      if (userPrefs.messageStyle) {
        const styleMap: Record<string, string> = {
          friendly: 'Use a warm, friendly communication style.',
          professional: 'Use a professional, structured communication style.',
          motivational: 'Use an energetic, motivational communication style. Inspire action.',
        };
        if (styleMap[userPrefs.messageStyle]) prefParts.push(styleMap[userPrefs.messageStyle]);
      }

      if (userPrefs.focusAreas?.length) {
        prefParts.push(`User's priority focus areas: ${userPrefs.focusAreas.join(', ')}. Prioritize advice and check-ins around these topics.`);
      }

      if (prefParts.length > 0) {
        systemPrompt += `\n\nUSER COMMUNICATION PREFERENCES (respect these strictly):\n${prefParts.join('\n')}`;
      }
    }

    // Add comprehensive coaching profile context
    if (coachingProfile) {
      systemPrompt += this.buildCoachingMemorySection(coachingProfile);
    }

    // Add pre-computed daily analysis report — dailyReport already fetched in parallel above
    if (dailyReport) {
      systemPrompt += this.buildDailyAnalysisSection(dailyReport);

      // Tone override from coaching directive
      if (dailyReport.coachingDirective?.toneRecommendation) {
        const tone = dailyReport.coachingDirective.toneRecommendation;
        const toneInstructions: Record<string, string> = {
          supportive: 'Be warm but still hold them accountable. Acknowledge effort before pointing out where they fell short. Still flag goal-contradicting decisions.',
          direct: 'Be straightforward and specific. No sugar-coating. Tell them exactly where they stand vs their goals with numbers. Always mention side effects of bad decisions.',
          tough_love: 'Be very direct about gaps. Challenge excuses with data. Show the clear gap between their stated goals and actual behavior. Reference exact numbers. Calculate calorie/macro impact of choices. You care enough to be honest — don\'t let issues slide.',
        };
        systemPrompt += `\n\nTONE DIRECTIVE FOR TODAY: Use a "${tone}" tone. ${toneInstructions[tone] || ''}`;
      }

      // Add coach emotional state and relationship depth
      systemPrompt += this.buildCoachEmotionalSection(
        dailyReport.coachingDirective?.coachEmotion,
        dailyReport.coachingDirective?.relationshipDepth
      );
    }

    if (ragContext) {
      systemPrompt += `\n\n---\nRELEVANT INFORMATION:\n${ragContext}`;
    }

    // Add wellbeing context if available
    if (wellbeingContext && Object.keys(wellbeingContext).length > 0) {
      const wellbeingContextStr = wellbeingContextService.formatContextForPrompt(wellbeingContext);
      if (wellbeingContextStr) {
        systemPrompt += `\n\n---\nWELLBEING CONTEXT:\n${wellbeingContextStr}\n\nUse this context to ask natural, supportive questions about their wellbeing. Reference their patterns and history naturally in conversation.`;
      }
    }

    // Add wellness question if available - integrate it naturally into your response
    if (wellnessQuestion) {
      systemPrompt += `\n\n---\nWELLNESS QUESTION TO ASK (weave naturally into conversation):\n"${wellnessQuestion.question}" (type: ${wellnessQuestion.type})${wellnessQuestion.context ? ` Context: ${wellnessQuestion.context}` : ''}`;
    }

    // Add response variation and language instructions
    systemPrompt += `\n\nBe natural and human-like. Vary phrases, use casual speech, ask curious follow-ups. Never sound robotic.
Respond in the user's language. Always use ${assistantName} as your name in any language.`;

    const totalBuildTime = Date.now() - startTime;
    const approxTokens = Math.ceil(systemPrompt.length / 4);
    logger.info('[LangGraphChatbot] System prompt built', {
      userId,
      buildTimeMs: totalBuildTime,
      promptChars: systemPrompt.length,
      approxTokens,
    });

    return systemPrompt;
  }

  /**
   * Determine if we should ask a wellness question based on context, sentiment, and missing data
   */
  private async shouldAskWellnessQuestion(
    userId: string,
    message: string,
    emotion: { category: string; confidence: number } | null,
    wellbeingContext: any,
    conversationData: any
  ): Promise<{ shouldAsk: boolean; reason?: string; priority?: 'high' | 'medium' | 'low' }> {
    try {
      // Parallelize all async checks: sentiment, last question time, engagement score
      const [sentiment, lastQuestionTime, engagementScore] = await Promise.all([
        tensorflowSentimentService.analyzeSentiment(message).catch((error) => {
          logger.warn('[LangGraphChatbot] Error getting sentiment, using emotion detection', { error });
          return null as { sentiment: 'positive' | 'negative' | 'neutral'; confidence: number; score: number } | null;
        }),
        this.getLastQuestionTime(userId),
        this.getUserEngagementScore(userId),
      ]);

      const timeSinceLastQuestion = lastQuestionTime ? Date.now() - lastQuestionTime.getTime() : Infinity;
      const conversationDepth = conversationData?.conversation?.messageCount || 0;
      
      // Adaptive cooldown based on engagement
      // High engagement (>0.7): 3 minutes
      // Medium engagement (0.3-0.7): 5 minutes
      // Low engagement (<0.3): 15 minutes
      let minTimeBetweenQuestions = 5 * 60 * 1000; // Default 5 minutes
      if (engagementScore > 0.7) {
        minTimeBetweenQuestions = 3 * 60 * 1000; // 3 minutes for high engagement
      } else if (engagementScore < 0.3) {
        minTimeBetweenQuestions = 15 * 60 * 1000; // 15 minutes for low engagement
      }
      
      // Adjust based on conversation depth - deeper conversations allow more frequent questions
      if (conversationDepth > 10) {
        minTimeBetweenQuestions = Math.max(2 * 60 * 1000, minTimeBetweenQuestions * 0.7); // Reduce by 30% for deep conversations
      }

      if (timeSinceLastQuestion < minTimeBetweenQuestions) {
        return { shouldAsk: false, reason: 'too_soon', priority: 'low' };
      }

      // Check user engagement (if user ignored last question, ask less frequently)
      if (engagementScore < 0.3) {
        // User has been ignoring questions - extend cooldown further
        const extendedCooldown = 20 * 60 * 1000; // 20 minutes
        if (timeSinceLastQuestion < extendedCooldown) {
          return { shouldAsk: false, reason: 'low_engagement', priority: 'low' };
        }
      }

      // Contextual triggers based on message content
      const lowerMessage = message.toLowerCase();
      const contextualTriggers = {
        work: lowerMessage.includes('work') || lowerMessage.includes('job') || lowerMessage.includes('office'),
        stress: lowerMessage.includes('stress') || lowerMessage.includes('stressed') || lowerMessage.includes('overwhelmed'),
        tired: lowerMessage.includes('tired') || lowerMessage.includes('exhausted') || lowerMessage.includes('fatigue'),
        energy: lowerMessage.includes('energy') || lowerMessage.includes('energetic') || lowerMessage.includes('drained'),
        activity: lowerMessage.includes('workout') || lowerMessage.includes('exercise') || lowerMessage.includes('run') || lowerMessage.includes('gym'),
        mood: lowerMessage.includes('feel') || lowerMessage.includes('feeling') || lowerMessage.includes('mood'),
        sleep: lowerMessage.includes('sleep') || lowerMessage.includes('tired') || lowerMessage.includes('rest'),
      };

      // Sentiment-based triggers
      const negativeSentiment = sentiment?.sentiment === 'negative' && sentiment.confidence > 0.6;
      const positiveSentiment = sentiment?.sentiment === 'positive' && sentiment.confidence > 0.6;
      const negativeEmotion = emotion && ['sad', 'anxious', 'stressed', 'distressed', 'tired'].includes(emotion.category) && emotion.confidence > 60;

      // Missing data triggers
      const missingData = wellbeingContext?.missingToday || {};
      const missingMood = missingData.mood === true;
      const missingStress = missingData.stress === true;
      const missingEnergy = missingData.energy === true;
      const missingJournal = missingData.journal === true;

      // Conversation length trigger (ask after a few exchanges)
      const messageCount = conversationData?.conversation?.messageCount || 0;
      const conversationLengthTrigger = messageCount >= 3 && messageCount <= 20;

      // Determine if we should ask and priority
      let shouldAsk = false;
      let reason = '';
      let priority: 'high' | 'medium' | 'low' = 'medium';

      // High priority triggers
      if (negativeSentiment || negativeEmotion) {
        shouldAsk = true;
        reason = 'negative_sentiment';
        priority = 'high';
      } else if (contextualTriggers.stress && missingStress) {
        shouldAsk = true;
        reason = 'stress_mentioned_missing';
        priority = 'high';
      } else if (contextualTriggers.tired && missingEnergy) {
        shouldAsk = true;
        reason = 'tired_mentioned_missing_energy';
        priority = 'high';
      } else if (contextualTriggers.work && missingStress) {
        shouldAsk = true;
        reason = 'work_mentioned_missing_stress';
        priority = 'high';
      }
      // Medium priority triggers
      else if (missingMood && !contextualTriggers.mood) {
        shouldAsk = true;
        reason = 'missing_mood';
        priority = 'medium';
      } else if (missingStress && !contextualTriggers.stress) {
        shouldAsk = true;
        reason = 'missing_stress';
        priority = 'medium';
      } else if (missingEnergy && !contextualTriggers.energy) {
        shouldAsk = true;
        reason = 'missing_energy';
        priority = 'medium';
      } else if (contextualTriggers.activity && missingEnergy) {
        shouldAsk = true;
        reason = 'activity_mentioned';
        priority = 'medium';
      } else if (conversationLengthTrigger && (missingMood || missingStress || missingEnergy)) {
        shouldAsk = true;
        reason = 'conversation_length_missing_data';
        priority = 'medium';
      }
      // Low priority triggers
      else if (positiveSentiment && conversationLengthTrigger) {
        shouldAsk = true;
        reason = 'positive_sentiment_conversation';
        priority = 'low';
      } else if (missingJournal && contextualTriggers.mood) {
        shouldAsk = true;
        reason = 'mood_mentioned_missing_journal';
        priority = 'low';
      }

      // Don't ask if there are navigation or modal actions (user is doing something specific)
      // This will be checked later in the flow

      return { shouldAsk, reason, priority };
    } catch (error) {
      logger.error('[LangGraphChatbot] Error determining if should ask question', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return { shouldAsk: false, reason: 'error' };
    }
  }

  /**
   * Rule-based wellness question selection (no LLM call needed).
   * The main LLM already has full wellbeing context and will phrase the question naturally.
   */
  private selectWellnessQuestion(reason: string): { question: string; type: string; context?: string; priority?: string } {
    const QUESTION_MAP: Record<string, { question: string; type: string }> = {
      missing_mood:                    { question: 'How are you feeling right now?', type: 'mood' },
      negative_sentiment:              { question: 'It sounds like things are tough. How are you really doing?', type: 'mood' },
      stress_mentioned_missing:        { question: 'How would you rate your stress level right now?', type: 'stress' },
      tired_mentioned_missing_energy:  { question: 'How\'s your energy level today?', type: 'energy' },
      work_mentioned_missing_stress:   { question: 'How are you managing work stress?', type: 'stress' },
      missing_stress:                  { question: 'How\'s your stress been today?', type: 'stress' },
      missing_energy:                  { question: 'What\'s your energy like today?', type: 'energy' },
      activity_mentioned:              { question: 'How did your workout feel?', type: 'workout' },
      conversation_length_missing_data:{ question: 'By the way, how are you feeling today?', type: 'mood' },
      positive_sentiment_conversation: { question: 'You seem to be in a good space. What\'s been going well?', type: 'general' },
      mood_mentioned_missing_journal:  { question: 'Would you like to take a moment to journal about that?', type: 'journal' },
    };

    const match = QUESTION_MAP[reason] || QUESTION_MAP['missing_mood'];
    return { question: match.question, type: match.type, priority: 'medium' };
  }

  /**
   * Get time of last wellness question asked
   */
  private async getLastQuestionTime(userId: string): Promise<Date | null> {
    try {
      const result = await query<{ last_question_at: Date }>(
        `SELECT MAX(rm.created_at) as last_question_at
         FROM rag_messages rm
         INNER JOIN rag_conversations rc ON rm.conversation_id = rc.id
         WHERE rc.user_id = $1 
         AND rm.role = 'assistant'
         AND rm.created_at > NOW() - INTERVAL '24 hours'
         AND (
           rm.content LIKE '%how are you%'
           OR rm.content LIKE '%how''s your%'
           OR rm.content LIKE '%how do you feel%'
           OR rm.content LIKE '%what''s your%'
           OR rm.content LIKE '%how''s it going%'
           OR rm.content LIKE '%how was your%'
           OR rm.content LIKE '%feeling%'
           OR rm.content LIKE '%stress level%'
           OR rm.content LIKE '%energy level%'
         )`,
        [userId]
      );
      return result.rows[0]?.last_question_at || null;
    } catch (error) {
      logger.warn('[LangGraphChatbot] Error getting last question time', { error, userId });
      return null;
    }
  }

  /**
   * Track that a wellness question was asked
   */
  private async trackQuestionAsked(
    userId: string,
    questionType: string,
    priority: 'high' | 'medium' | 'low'
  ): Promise<void> {
    try {
      // Store question tracking in database for persistence and adaptive frequency
      await query(
        `INSERT INTO rag_messages (
          conversation_id, user_id, role, content, sequence_number, created_at, metadata
        ) VALUES (
          (SELECT id FROM rag_conversations WHERE user_id = $1 ORDER BY last_message_at DESC LIMIT 1),
          $1,
          'system',
          'wellness_question_asked',
          (SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM rag_messages WHERE user_id = $1),
          NOW(),
          $2::jsonb
        ) ON CONFLICT DO NOTHING`,
        [
          userId,
          JSON.stringify({
            questionType,
            priority,
            timestamp: new Date().toISOString(),
            type: 'wellness_question_tracking',
          }),
        ]
      ).catch(() => {
        // If table doesn't exist or error, just log it
        logger.debug('[LangGraphChatbot] Tracked question asked (logged)', {
          userId,
          questionType,
          priority,
          timestamp: Date.now(),
        });
      });
    } catch (error) {
      logger.warn('[LangGraphChatbot] Error tracking question', { error, userId });
    }
  }

  /**
   * Check if user message is a response to a wellness question
   */
  private async isResponseToWellnessQuestion(
    userId: string,
    message: string,
    conversationData: any
  ): Promise<{ isResponse: boolean; questionType?: string }> {
    try {
      // Check if the last assistant message contained a wellness question
      if (conversationData?.messages && conversationData.messages.length >= 2) {
        const lastAssistantMessage = conversationData.messages
          .filter((m: any) => m.role === 'assistant')
          .slice(-1)[0];

        if (lastAssistantMessage) {
          const assistantContent = lastAssistantMessage.content.toLowerCase();
          
          // Check for common wellness question patterns
          const questionPatterns = [
            { pattern: /how are you feeling|how do you feel|how's your mood|what's your mood/i, type: 'mood' },
            { pattern: /how's your stress|what's your stress|feeling stressed|stress level/i, type: 'stress' },
            { pattern: /how's your energy|what's your energy|feeling energized|energy level/i, type: 'energy' },
            { pattern: /how was your workout|how did your workout|workout go/i, type: 'workout' },
            { pattern: /how's your nutrition|how's your diet|what did you eat/i, type: 'nutrition' },
            { pattern: /want to journal|feel like journaling|reflect on/i, type: 'journal' },
            { pattern: /how are you|how's it going|how's your day/i, type: 'general' },
          ];

          for (const { pattern, type } of questionPatterns) {
            if (pattern.test(assistantContent)) {
              // Check if user message seems like a response (not just a new question)
              const lowerMessage = message.toLowerCase();
              const isResponse = 
                lowerMessage.length > 5 && // Not just "ok" or "yes"
                !lowerMessage.startsWith('how') && // Not asking a new question
                !lowerMessage.startsWith('what') &&
                !lowerMessage.startsWith('when') &&
                !lowerMessage.startsWith('why');

              if (isResponse) {
                return { isResponse: true, questionType: type };
              }
            }
          }
        }
      }

      return { isResponse: false };
    } catch (error) {
      logger.warn('[LangGraphChatbot] Error checking if response to question', { error, userId });
      return { isResponse: false };
    }
  }

  /**
   * Track user response to a wellness question
   */
  private async trackQuestionResponse(
    userId: string,
    responded: boolean,
    questionType?: string
  ): Promise<void> {
    try {
      // Track response for adaptive frequency in database
      await query(
        `INSERT INTO rag_messages (
          conversation_id, user_id, role, content, sequence_number, created_at, metadata
        ) VALUES (
          (SELECT id FROM rag_conversations WHERE user_id = $1 ORDER BY last_message_at DESC LIMIT 1),
          $1,
          'system',
          'wellness_question_response',
          (SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM rag_messages WHERE user_id = $1),
          NOW(),
          $2::jsonb
        ) ON CONFLICT DO NOTHING`,
        [
          userId,
          JSON.stringify({
            responded,
            questionType,
            timestamp: new Date().toISOString(),
            type: 'wellness_question_response_tracking',
          }),
        ]
      ).catch(() => {
        // If table doesn't exist or error, just log it
        logger.debug('[LangGraphChatbot] Tracked question response (logged)', {
          userId,
          responded,
          questionType,
        });
      });
    } catch (error) {
      logger.warn('[LangGraphChatbot] Error tracking question response', { error, userId });
    }
  }

  /**
   * Get user engagement score based on question response rate (cached 5 min)
   */
  private async getUserEngagementScore(userId: string): Promise<number> {
    try {
      const cached = this.engagementScoreCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) return cached.score;

      const result = await query<{ response_rate: number }>(
        `WITH question_messages AS (
           SELECT 
             rm.id,
             rm.conversation_id,
             rm.sequence_number,
             rm.created_at,
             CASE WHEN EXISTS (
               SELECT 1 FROM rag_messages rm2
               WHERE rm2.conversation_id = rm.conversation_id
               AND rm2.sequence_number > rm.sequence_number
               AND rm2.role = 'user'
               AND rm2.created_at BETWEEN rm.created_at AND rm.created_at + INTERVAL '5 minutes'
               AND LENGTH(rm2.content) > 5
             ) THEN 1 ELSE 0 END as user_responded
           FROM rag_messages rm
           INNER JOIN rag_conversations rc ON rm.conversation_id = rc.id
           WHERE rc.user_id = $1
           AND rm.role = 'assistant'
           AND rm.created_at > NOW() - INTERVAL '7 days'
           AND (
             rm.content LIKE '%how are you%'
             OR rm.content LIKE '%how''s your%'
             OR rm.content LIKE '%how do you feel%'
             OR rm.content LIKE '%what''s your%'
             OR rm.content LIKE '%how''s it going%'
             OR rm.content LIKE '%how was your%'
             OR rm.content LIKE '%feeling%'
             OR rm.content LIKE '%stress level%'
             OR rm.content LIKE '%energy level%'
           )
         )
         SELECT 
           CASE 
             WHEN COUNT(*) = 0 THEN 0.5
             ELSE SUM(user_responded)::float / COUNT(*)::float
           END as response_rate
         FROM question_messages`,
        [userId]
      );
      const score = result.rows[0]?.response_rate || 0.5;
      this.engagementScoreCache.set(userId, { score, timestamp: Date.now() });
      return score;
    } catch (error) {
      logger.warn('[LangGraphChatbot] Error getting engagement score', { error, userId });
      return 0.5; // Default to neutral engagement
    }
  }

  /**
   * Retrieve RAG context for the user's query (includes activity logs with mood data)
   */
  private async retrieveContext(userId: string, queryText: string): Promise<string> {
    try {
      const [
        relevantKnowledge,
        userProfile,
        previousConversations,
        userDataEmbeddings,
        activityLogsWithMood,
      ] = await Promise.all([
        vectorEmbeddingService.searchKnowledge({
          queryText,
          limit: 5,
        }),
        vectorEmbeddingService.searchUserProfile({
          userId,
          queryText,
          limit: 3,
        }),
        vectorEmbeddingService.searchConversationHistory({
          userId,
          queryText,
          limit: 5,
        }),
        // Search user data embeddings with lower threshold for better recall
        vectorEmbeddingService.searchSimilar({
          queryText,
          userId,
          limit: 15,
          minSimilarity: 0.5, // Lowered from 0.6
        }),
        // Get recent activity logs with mood data (last 7 days)
        query<{
          activity_id: string;
          scheduled_date: Date;
          status: string;
          mood: number | null;
          user_notes: string | null;
        }>(
          `SELECT activity_id, scheduled_date, status, mood, user_notes
           FROM activity_logs
           WHERE user_id = $1
           AND scheduled_date >= NOW() - INTERVAL '7 days'
           ORDER BY scheduled_date DESC
           LIMIT 10`,
          [userId]
        ),
      ]);

      const sections: string[] = [];

      // Add user profile context
      if (userProfile.length > 0 || userDataEmbeddings.length > 0) {
        sections.push('USER PROFILE:');
        userProfile.forEach((p) => {
          sections.push(`[${p.section}] ${p.content}`);
        });
        // Include relevant user data (plans, workouts, meals, tasks) in profile context
        userDataEmbeddings
          .filter((e) => ['user_plan', 'diet_plan', 'workout_plan', 'user_task', 'meal_log', 'workout_log'].includes(e.sourceType))
          .forEach((e) => {
            sections.push(`[${e.sourceType}] ${e.content}`);
          });
      }

      // Add activity logs with mood data
      if (activityLogsWithMood.rows.length > 0) {
        sections.push('\nRECENT ACTIVITY LOGS WITH MOOD:');
        activityLogsWithMood.rows.forEach((log) => {
          const dateStr = new Date(log.scheduled_date).toLocaleDateString();
          const moodStr = log.mood !== null ? ` (mood: ${log.mood}/5)` : '';
          const notesStr = log.user_notes ? ` - ${log.user_notes}` : '';
          // Format activity_id to readable name
          const activityName = log.activity_id
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          sections.push(`- ${dateStr}: ${activityName} - ${log.status}${moodStr}${notesStr}`);
        });
      }

      // Add relevant knowledge
      if (relevantKnowledge.length > 0) {
        sections.push('\nRELEVANT KNOWLEDGE:');
        relevantKnowledge.forEach((k) => {
          sections.push(`[${k.category}] ${k.content}`);
        });
      }

      // Add previous conversation snippets
      if (previousConversations.length > 0) {
        sections.push('\nPREVIOUS CONVERSATIONS:');
        previousConversations.forEach((c) => {
          sections.push(c.content);
        });
      }

      return sections.join('\n');
    } catch (error) {
      logger.error('Error retrieving RAG context', { error, userId });
      return '';
    }
  }

  /**
   * Execute tools and get results
   */
  private async executeTools(
    tools: ReturnType<typeof createTools>,
    toolCalls: Array<{ name: string; args: Record<string, unknown>; id: string }>
  ): Promise<ToolMessage[]> {
    const toolResults: ToolMessage[] = [];

    for (const toolCall of toolCalls) {
      let tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        // Try case-insensitive match as fallback
        tool = tools.find((t) => t.name.toLowerCase() === toolCall.name.toLowerCase());
        if (tool) {
          logger.warn('[LangGraphChatbot] Tool found via case-insensitive match', {
            requested: toolCall.name,
            found: tool.name,
          });
        }
      }
      if (!tool) {
        logger.error('[LangGraphChatbot] Tool not found', {
          requested: toolCall.name,
          available: tools.map(t => t.name),
        });
        toolResults.push(
          new ToolMessage({
            content: `Tool "${toolCall.name}" not found. Available tools: ${tools.map(t => t.name).join(', ')}`,
            tool_call_id: toolCall.id,
          })
        );
        continue;
      }

      try {
        // Check if args is empty object - this indicates the tool was called without arguments
        if (Object.keys(toolCall.args || {}).length === 0) {
          // Check if the tool's schema accepts an empty object (all fields optional)
          const schemaAcceptsEmpty = tool.schema
            && typeof (tool.schema as any).safeParse === 'function'
            && (tool.schema as any).safeParse({}).success;

          if (schemaAcceptsEmpty) {
            // All fields are optional — safe to proceed with empty args
            // Fall through to normal tool execution below
          } else {
            // Smart defaults for manager-style tools that require an action field
            const defaultActions: Record<string, Record<string, any>> = {
              workoutManager: { action: 'getPlans' },
              dietPlanManager: { action: 'get' },
              mealManager: { action: 'get' },
              recipeManager: { action: 'get' },
              goalManager: { action: 'get' },
              scheduleManager: { action: 'get' },
              habitManager: { action: 'get' },
              wellbeingManager: { action: 'get' },
              sleepManager: { action: 'get' },
              competitionManager: { action: 'getActive' },
              gamificationManager: { action: 'getStats' },
              dailyScoreManager: { action: 'getLatest' },
              whoopAnalyticsManager: { action: 'overview' },
              journalManager: { action: 'get' },
              voiceJournalManager: { action: 'status' },
              musicManager: { action: 'recommend', activity: 'focus' },
            };

            if (defaultActions[toolCall.name]) {
              logger.warn('[LangGraphChatbot] Tool called without arguments, using default action', {
                tool: toolCall.name,
                defaultArgs: defaultActions[toolCall.name],
              });
              toolCall.args = defaultActions[toolCall.name];
              // Fall through to normal tool execution below
            } else {
              // For tools with required fields, return an error
              let errorMsg = `Tool ${toolCall.name} was called without required arguments. `;
              if (toolCall.name === 'createUserBodyImage') {
                errorMsg += `This tool requires: imageType (face, front, side, or back), imageKey (R2 storage key), and captureContext (onboarding, progress, or weekly_checkin). The image file must be uploaded separately before calling this tool.`;
              } else {
                errorMsg += `Please check the tool description and provide all required parameters.`;
              }

              logger.error('[LangGraphChatbot] Tool called without arguments', {
                tool: toolCall.name,
                toolCall: toolCall,
                toolDescription: (tool as any)?.description,
              });

              toolResults.push(
                new ToolMessage({
                  content: errorMsg,
                  tool_call_id: toolCall.id,
                })
              );
              continue;
            }
          }
        }
        
        // Validate arguments against schema before invoking
        // This provides better error messages if validation fails
        if (tool.schema && typeof (tool.schema as any).safeParse === 'function') {
          const validation = (tool.schema as any).safeParse(toolCall.args);
          if (!validation.success) {
            const missingFields = validation.error.errors
              .filter((e: any) => e.code === 'invalid_type' && e.received === 'undefined')
              .map((e: any) => e.path.join('.'));
            
            const errorMsg = missingFields.length > 0
              ? `Missing required fields: ${missingFields.join(', ')}. Received: ${JSON.stringify(toolCall.args)}`
              : `Schema validation failed: ${validation.error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')}`;
            
            throw new Error(errorMsg);
          }
        }
        
        // Diagnostic logging for key tools
        if (toolCall.name === 'journalManager' || toolCall.name === 'voiceJournalManager') {
          logger.info(`[LangGraphChatbot] Invoking ${toolCall.name}`, {
            action: (toolCall.args as any)?.action,
            hasEntryText: !!(toolCall.args as any)?.data?.entryText,
            argsKeys: Object.keys(toolCall.args || {}),
          });
        }

        const result = await tool.invoke(toolCall.args);
        toolResults.push(
          new ToolMessage({
            content: typeof result === 'string' ? result : JSON.stringify(result),
            tool_call_id: toolCall.id,
          })
        );
      } catch (error) {
        // Extract more detailed error information for schema validation errors
        let errorMessage = error instanceof Error ? error.message : 'Unknown error';
        let errorDetails = '';

        // Diagnostic logging for key tools that fail
        if (toolCall.name === 'journalManager' || toolCall.name === 'voiceJournalManager') {
          logger.error(`[LangGraphChatbot] ${toolCall.name} FAILED`, {
            error: errorMessage,
            args: JSON.stringify(toolCall.args).slice(0, 500),
            stack: error instanceof Error ? error.stack?.slice(0, 300) : undefined,
          });
        }
        
        if (error instanceof Error) {
          // Check if it's a Zod validation error
          if (error.message.includes('Required') || error.message.includes('schema')) {
            // Try to extract which field is missing
            const requiredMatch = error.message.match(/Required[\s\S]*?at\s+(\w+)/);
            const fieldMatch = error.message.match(/at\s+"?(\w+)"?/);
            const missingField = requiredMatch?.[1] || fieldMatch?.[1] || 'unknown field';
            
            errorDetails = `Missing required field: ${missingField}. `;
            
            // Log the actual arguments received for debugging
            logger.error('[LangGraphChatbot] Tool execution error - schema validation failed', {
              tool: toolCall.name,
              error: error.message,
              receivedArgs: toolCall.args,
              missingField,
              stack: error.stack,
            });
            
            errorMessage = `${errorDetails}Received arguments: ${JSON.stringify(toolCall.args)}. Error: ${error.message}`;
          } else {
            logger.error('[LangGraphChatbot] Tool execution error', {
              tool: toolCall.name,
              error: error.message,
              receivedArgs: toolCall.args,
              stack: error.stack,
            });
          }
        }
        
        toolResults.push(
          new ToolMessage({
            content: `Error executing tool: ${errorMessage}`,
            tool_call_id: toolCall.id,
          })
        );
      }
    }

    return toolResults;
  }

  /**
   * Main chat method
   */
  async chat(params: ChatRequest): Promise<ChatResponse> {
    const { userId, message, conversationId, callId, sessionType: _sessionType } = params;
    const totalStartTime = Date.now();

    try {
      // Topic detection - check if message is relevant to health/fitness/wellness
      const topicCheck = this.detectTopicRelevance(message);
      if (!topicCheck.isRelevant) {
        logger.debug('[LangGraphChatbot] Off-topic message detected', {
          userId,
          message: message.substring(0, 100),
          confidence: topicCheck.confidence,
        });
        
        // Get or create conversation for storing the rejection
        let activeConversationId = conversationId;
        if (!activeConversationId) {
          activeConversationId = await vectorEmbeddingService.createConversation({
            userId,
            sessionType: 'health_coach',
          });
        }
        
        // Get user name for personalized response
        const userName = await this.getUserName(userId);
        const offTopicResponse = this.generateOffTopicResponse(userName);
        
        // Store messages
        const conversationData = await vectorEmbeddingService.getConversation(
          activeConversationId,
          1
        );
        const currentMessageCount = conversationData?.conversation?.messageCount ?? 0;
        
        // Store off-topic pair (non-blocking, these are never worth embedding)
        this.storeMessagePair({
          conversationId: activeConversationId,
          userId,
          userContent: message,
          assistantContent: offTopicResponse,
          baseSequenceNumber: currentMessageCount + 1,
        }).catch(() => {});

        return {
          conversationId: activeConversationId,
          response: offTopicResponse,
          context: {
            knowledgeUsed: 0,
            profileUsed: 0,
            historyUsed: 0,
          },
        };
      }

      // Get or create conversation
      let activeConversationId = conversationId;
      // const isNewConversation = !activeConversationId;
      if (!activeConversationId) {
        const sessionType = (params as any).sessionType || 'health_coach';
        activeConversationId = await vectorEmbeddingService.createConversation({
          userId,
          sessionType,
        });
        
        // Proactively create today's schedule for new conversations (async, non-blocking)
        // This helps users get started with their daily planning
        (async () => {
          try {
            const { scheduleAutomationService } = await import('./schedule-automation.service.js');
            await scheduleAutomationService.autoCreateTodaySchedule(userId);
          } catch (error) {
            logger.debug('[LangGraphChatbot] Failed to auto-create schedule on new conversation', {
              userId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw - this is non-critical
          }
        })();
      }

      // Get conversation details for context (fetch 10 to reuse for LLM history — avoids duplicate DB call)
      const conversationDataForContext = await vectorEmbeddingService.getConversation(
        activeConversationId,
        10
      );

      // Detect emotion using fast local keyword matching (avoids 2-4s LLM call)
      const emotion = emotionDetectionService.fallbackEmotionDetection(message);

      // Fire-and-forget: log emotion to DB without blocking the response
      if (activeConversationId || callId) {
        emotionDetectionService.logEmotion(userId, emotion, {
          callId,
          conversationId: activeConversationId,
          source: 'text',
        }).catch((error) => {
          logger.warn('[LangGraphChatbot] Error logging emotion', { error, userId });
        });
      }

      // Detect crisis keywords (priority check)
      const crisisPromise = (async () => {
        try {
          const crisisDetection = await crisisDetectionService.detectCrisisKeywords(message);
          if (crisisDetection.isCrisis && crisisDetection.severity !== 'low') {
            if (callId) {
              await crisisDetectionService.triggerEmergencyProtocol(callId, userId);
              const resources = await crisisDetectionService.getCrisisResources();
              await crisisDetectionService.scheduleFollowUpCheckIn(userId, callId);
              
              // Return early with emergency response
              return { isCrisis: true, resources };
            }
          }
          return { isCrisis: false };
        } catch (error) {
          logger.warn('[LangGraphChatbot] Error detecting crisis', { error, userId });
          return { isCrisis: false };
        }
      })();

      // Wait for crisis detection first
      const crisisResult = await crisisPromise;
      if (crisisResult.isCrisis) {
        const emergencyResponse = `I'm here for you right now. Emergency support has been activated. Here are immediate resources:\n\n${crisisResult.resources?.hotlines.map((h: any) => `• ${h.name}: ${h.number}${h.description ? ` - ${h.description}` : ''}`).join('\n')}\n\nI'm listening. What's happening right now?`;
        return {
          conversationId: activeConversationId,
          response: emergencyResponse,
          context: { knowledgeUsed: 0, profileUsed: 0, historyUsed: 0 },
          actions: [{ type: 'open_modal', target: 'emergency_resources', params: { resources: crisisResult.resources } }],
        };
      }

      // Retrieve call purpose if callId is provided
      let callPurpose: string | undefined;
      if (callId) {
        try {
          const callResult = await query<{ call_purpose: string }>(
            `SELECT call_purpose FROM voice_calls WHERE id = $1`,
            [callId]
          );
          if (callResult.rows.length > 0 && callResult.rows[0].call_purpose) {
            callPurpose = callResult.rows[0].call_purpose;
          }
        } catch (error) {
          logger.warn('[LangGraphChatbot] Error retrieving call purpose', { error, callId });
        }
      }

      // Auto-track wellbeing information from user message (async, non-blocking)
      // Fire and forget - don't await, just let it run in background
      (async () => {
        try {
          const trackingResult = await wellbeingAutoTrackerService.extractWellbeingInfo(userId, message);
          
          // Auto-create entries for simple types
          if (trackingResult.entries.length > 0) {
            await wellbeingAutoTrackerService.autoCreateEntries(userId, trackingResult.entries);
          }

          // Check if this message is a response to a wellness question
          const isQuestionResponse = await this.isResponseToWellnessQuestion(
            userId,
            message,
            conversationDataForContext
          );
          if (isQuestionResponse.isResponse) {
            await this.trackQuestionResponse(userId, true, isQuestionResponse.questionType);
            
            // Enhanced auto-tracking: Extract wellness data from question response
            // This ensures we capture data when users respond to wellness questions
            const responseTrackingResult = await wellbeingAutoTrackerService.extractWellbeingInfo(userId, message);
            
            // Auto-create entries with higher confidence for question responses
            // Since user is directly responding to a question, we can be more confident
            if (responseTrackingResult.entries.length > 0) {
              // Boost confidence for question responses (add 0.1 to confidence)
              const adjustedEntries = responseTrackingResult.entries.map(entry => ({
                ...entry,
                confidence: Math.min(1.0, entry.confidence + 0.1), // Boost confidence for question responses
              }));
              await wellbeingAutoTrackerService.autoCreateEntries(userId, adjustedEntries);
              
              logger.info('[LangGraphChatbot] Auto-tracked wellness data from question response', {
                userId,
                questionType: isQuestionResponse.questionType,
                entriesCreated: adjustedEntries.length,
              });
            }
          }
        } catch (error) {
          logger.warn('[LangGraphChatbot] Error in auto-tracking', { error, userId });
        }
      })();

      // Get current user status for classifier context
      let currentUserStatus: string | undefined;
      try {
        const statusResult = await activityStatusService.getCurrentStatus(userId);
        currentUserStatus = statusResult.status;
      } catch {
        // Non-critical — classifier will work without it
      }

      // Retrieve RAG context, wellbeing context, and status detection in parallel
      const contextStartTime = Date.now();
      const [ragContext, wellbeingContext, statusDetection] = await Promise.all([
        this.retrieveContext(userId, message),
        wellbeingContextService.getWellbeingContext(userId, message).catch(() => ({})),
        statusIntentClassifierService.classifyFromMessage(message, currentUserStatus as import('../types/activity-status.types.js').ActivityStatus).catch((error) => {
          logger.warn('[Chat] Status classifier failed', { error: error instanceof Error ? error.message : 'unknown' });
          return { detected: false as const, confidence: 0, layer: 'explicit' as const };
        }),
      ]);
      const contextTime = Date.now() - contextStartTime;

      // Handle auto-detected status changes
      let statusContext = '';
      if (statusDetection.detected && statusDetection.status) {
        const isHighConfidence = statusDetection.confidence >= 0.70 && statusDetection.layer === 'explicit';

        if (isHighConfidence) {
          try {
            const endDate = statusDetection.duration?.endDate ??
              (statusDetection.duration?.days
                ? new Date(Date.now() + statusDetection.duration.days * 86400000).toISOString().split('T')[0]
                : undefined);

            await activityStatusService.updateCurrentStatusWithLifecycle(
              userId, statusDetection.status, 'chat_explicit', endDate, statusDetection.reason,
            );

            if (statusPlanAdjusterService.isAutoConfirmStatus(statusDetection.status)) {
              await statusPlanAdjusterService.applyOverridesToPlan(userId, statusDetection.status, endDate);
            }

            statusContext = `\n\nIMPORTANT: User's activity status has been auto-updated to "${statusDetection.status}" (reason: ${statusDetection.reason ?? 'unspecified'}). Acknowledge this naturally and explain what adjustments you've made to their plan.`;
          } catch (error) {
            logger.warn('[Chat] Status auto-update failed', { error: error instanceof Error ? error.message : 'unknown' });
          }
        } else {
          statusContext = `\n\nNOTE: User may be indicating a status change to "${statusDetection.status}" (confidence: ${Math.round(statusDetection.confidence * 100)}%). Gently ask if they'd like to update their status and adjust their plan.`;
        }
      }

      // Run all post-RAG phases in parallel: wellness question, system prompt, coaching context, tool creation
      const [wellnessQuestionResult, baseSystemContent, coachingContextResult, tools] = await Promise.all([
        // Stream 1: Lightweight wellness question selection (rule-based, no LLM call)
        (async () => {
          try {
            const questionCheck = await this.shouldAskWellnessQuestion(
              userId, message, emotion, wellbeingContext, conversationDataForContext
            );
            if (!questionCheck.shouldAsk) return null;

            const wq = this.selectWellnessQuestion(questionCheck.reason || 'missing_mood');
            logger.info('[LangGraphChatbot] Generated wellness question', {
              userId, questionType: wq.type, reason: questionCheck.reason, priority: questionCheck.priority,
            });
            this.trackQuestionAsked(userId, wq.type, questionCheck.priority || 'medium').catch(() => {});
            return wq;
          } catch (error) {
            logger.warn('[LangGraphChatbot] Error generating wellness question', { error, userId });
            return null;
          }
        })(),

        // Stream 2: Build system prompt (wellness question appended after all resolve)
        this.buildPersonalizedSystemPrompt(
          userId,
          ragContext,
          emotion || undefined,
          conversationDataForContext?.conversation.sessionType || undefined,
          callPurpose,
          undefined,
          wellbeingContext,
          undefined // wellness question not yet available — appended below
        ),

        // Stream 3: Coaching context (inconsistency detection + commitment tracking)
        (async () => {
          try {
            const compactCtx = await comprehensiveUserContextService.getCompactMessageContext(userId);
            const [inconsistencies, commitmentFollowUp] = await Promise.all([
              inconsistencyDetectionService.analyzeMessage(message, compactCtx),
              commitmentTrackerService.buildFollowUpContext(userId),
            ]);
            const ctx = inconsistencyDetectionService.buildPromptContext(inconsistencies) + commitmentFollowUp;

            // Fire-and-forget: track new commitments
            const newCommitments = commitmentTrackerService.extractCommitments(message);
            for (const commitment of newCommitments) {
              commitmentTrackerService.trackCommitment(
                userId, message, commitment.category, commitment.action
              ).catch(() => {});
            }
            return ctx;
          } catch (error) {
            logger.debug('[LangGraphChatbot] Conversational coaching context failed (non-critical)', {
              userId, error: error instanceof Error ? error.message : 'Unknown',
            });
            return '';
          }
        })(),

        // Stream 4: Tool creation (intent classification + schema)
        Promise.resolve(getToolsForMessage(userId, message)),
      ]);

      // Assemble final system prompt: base + wellness question + coaching context
      let enrichedSystemContent = baseSystemContent;
      if (wellnessQuestionResult) {
        enrichedSystemContent += `\n\n--- WELLNESS CHECK-IN ---\nNaturally weave this question into your response: "${wellnessQuestionResult.question}" (Type: ${wellnessQuestionResult.type})`;
      }
      if (coachingContextResult) {
        enrichedSystemContent += coachingContextResult;
      }
      if (statusContext) {
        enrichedSystemContent += statusContext;
      }

      // Inject status pattern insights if available (from comprehensive context)
      try {
        const patternResult = await import('../database/pg.js').then(m =>
          m.query<{ status_patterns: Array<{ suggestion: string }> }>(
            `SELECT status_patterns FROM user_coaching_profiles WHERE user_id = $1`,
            [userId]
          )
        );
        const patterns = patternResult.rows[0]?.status_patterns ?? [];
        if (patterns.length > 0) {
          const suggestions = patterns.map(p => p.suggestion).filter(Boolean).join('; ');
          if (suggestions) {
            enrichedSystemContent += `\n\nSTATUS PATTERNS (use proactively): ${suggestions}`;
          }
        }
      } catch {
        // Non-critical — skip silently
      }

      const historyTime = 0; // Conversation data reused from earlier fetch

      // Build messages array
      const messages: BaseMessage[] = [];

      // System message with personalized context + coaching + wellness question
      messages.push(new SystemMessage(enrichedSystemContent));

      // Add conversation history
      if (conversationDataForContext?.messages) {
        for (const msg of conversationDataForContext.messages) {
          if (msg.role === 'user') {
            messages.push(new HumanMessage(msg.content));
          } else if (msg.role === 'assistant') {
            messages.push(new AIMessage(msg.content));
          }
        }
      }

      // Add current user message (multimodal if image provided)
      if (params.imageBase64) {
        logger.info('[LangGraphChatbot] Sending multimodal message with camera frame', {
          imageSize: params.imageBase64.length,
          messagePreview: message.substring(0, 50),
        });
        messages.push(new HumanMessage({
          content: [
            { type: 'text', text: `${message}\n\n[CAMERA FRAME ATTACHED: You are receiving a live camera frame from the user. You CAN see them. Describe what you see in the image. If they're exercising, assess form and provide specific corrections. If food is visible, identify items and estimate nutrition. Be specific about what you observe in the frame.]` },
            { type: 'image_url', image_url: `data:image/jpeg;base64,${params.imageBase64}` },
          ],
        }));
      } else {
        messages.push(new HumanMessage(message));
      }

      // Tools already created in parallel above — log intent for debugging
      const intent = toolRouterService.classifyIntent(message);
      logger.info('[LangGraphChatbot] Optimized tools selected', {
        userId,
        messagePreview: message.substring(0, 50),
        primaryIntent: intent.primary,
        secondaryIntents: intent.secondary,
        toolCount: tools.length,
      });

      // Convert StructuredTool to OpenAI function format (cached per intent to avoid repeated Zod parsing)
      const intentCacheKey = `${intent.primary}:${intent.secondary.sort().join(',')}:${tools.length}`;
      let openAITools = this.toolSchemaCache.get(intentCacheKey);

      if (openAITools) {
        logger.debug('[LangGraphChatbot] Tool schema cache hit', { intentCacheKey, toolCount: openAITools.length });
      } else {
        logger.debug('[LangGraphChatbot] Converting tools (cache miss)', { toolCount: tools.length });

      openAITools = tools.map((tool, index) => {
        // StructuredTool stores name/description in lc_kwargs
        // Try multiple ways to access them
        let toolName: string | undefined;
        let toolDescription: string | undefined;

        const toolAny = tool as any;

        // Method 1: Try direct property access (might be getters)
        try {
          if (toolAny.name !== undefined && toolAny.name !== null) {
            toolName = String(toolAny.name);
          }
          if (toolAny.description !== undefined && toolAny.description !== null) {
            toolDescription = String(toolAny.description);
          }
        } catch (e) {
          // Ignore if getter throws
        }

        // Method 2: Try lc_kwargs (LangChain's standard storage)
        if ((!toolName || toolName === 'undefined' || toolName === 'null') && toolAny.lc_kwargs?.name) {
          toolName = String(toolAny.lc_kwargs.name);
        }
        if ((!toolDescription || toolDescription === 'undefined' || toolDescription === 'null') && toolAny.lc_kwargs?.description) {
          toolDescription = String(toolAny.lc_kwargs.description);
        }

        // Method 3: Try lc_attributes (alternative LangChain storage)
        if ((!toolName || toolName === 'undefined' || toolName === 'null') && toolAny.lc_attributes?.name) {
          toolName = String(toolAny.lc_attributes.name);
        }
        if ((!toolDescription || toolDescription === 'undefined' || toolDescription === 'null') && toolAny.lc_attributes?.description) {
          toolDescription = String(toolAny.lc_attributes.description);
        }

        // Method 4: Try private properties
        if ((!toolName || toolName === 'undefined' || toolName === 'null') && toolAny._name) {
          toolName = String(toolAny._name);
        }
        if ((!toolDescription || toolDescription === 'undefined' || toolDescription === 'null') && toolAny._description) {
          toolDescription = String(toolAny._description);
        }

        // Validate we have both
        if (!toolName || toolName === 'undefined' || toolName === 'null' || 
            !toolDescription || toolDescription === 'undefined' || toolDescription === 'null') {
          logger.error('[LangGraphChatbot] Tool missing name or description', {
            index,
            hasName: !!toolName && toolName !== 'undefined' && toolName !== 'null',
            hasDescription: !!toolDescription && toolDescription !== 'undefined' && toolDescription !== 'null',
            toolName,
            toolDescription,
            toolType: tool.constructor.name,
            toolKeys: Object.keys(tool),
            toolProps: Object.getOwnPropertyNames(tool),
            lcKwargs: toolAny.lc_kwargs,
            lcAttributes: toolAny.lc_attributes,
          });
          throw new Error(`Tool at index ${index} is missing name or description. Name: ${toolName}, Description: ${toolDescription}`);
        }

        // Get the Zod schema and convert to JSON Schema manually
        const zodSchema = tool.schema as any;
        let parameters: any = {
          type: 'object',
          properties: {},
        };

        try {
          // Try to extract shape from Zod object
          if (zodSchema && zodSchema._def) {
            if (zodSchema._def.typeName === 'ZodObject') {
              const shape = zodSchema._def.shape();
              const properties: Record<string, any> = {};
              const required: string[] = [];

              for (const [key, field] of Object.entries(shape)) {
                const fieldDef = (field as any)._def;

                // Unwrap wrapper types in a loop to handle nested wrappers
                // e.g. ZodDefault(ZodOptional(ZodEnum([...])))
                let innerDef = fieldDef;
                let isOptionalOrDefault = false;
                let isNullableField = false;
                while (
                  innerDef.typeName === 'ZodOptional' ||
                  innerDef.typeName === 'ZodDefault' ||
                  innerDef.typeName === 'ZodNullable'
                ) {
                  if (innerDef.typeName === 'ZodOptional' || innerDef.typeName === 'ZodDefault') {
                    isOptionalOrDefault = true;
                  }
                  if (innerDef.typeName === 'ZodNullable') {
                    isNullableField = true;
                  }
                  if (innerDef.innerType?._def) {
                    innerDef = innerDef.innerType._def;
                  } else {
                    break;
                  }
                }
                
                // Handle different Zod types
                let propertyType: string | undefined;
                let propertySchema: any = {};
                
                if (innerDef.typeName === 'ZodString') {
                  propertyType = 'string';
                  propertySchema.description = innerDef.description || '';
                } else if (innerDef.typeName === 'ZodNumber') {
                  propertyType = 'number';
                  propertySchema.description = innerDef.description || '';
                } else if (innerDef.typeName === 'ZodBoolean') {
                  propertyType = 'boolean';
                  propertySchema.description = innerDef.description || '';
                } else if (innerDef.typeName === 'ZodArray') {
                  propertyType = 'array';
                  propertySchema.description = innerDef.description || '';
                  // Try to get item type
                  if (innerDef.type?._def) {
                    const itemType = innerDef.type._def.typeName;
                    if (itemType === 'ZodString') {
                      propertySchema.items = { type: 'string' };
                    } else if (itemType === 'ZodNumber') {
                      propertySchema.items = { type: 'number' };
                    } else {
                      propertySchema.items = { type: 'string' }; // Default fallback
                    }
                  }
                } else if (innerDef.typeName === 'ZodObject') {
                  propertyType = 'object';
                  propertySchema.description = innerDef.description || '';
                  // Recursively extract nested properties for Gemini compatibility
                  try {
                    const nestedShape = innerDef.shape();
                    const nestedProperties: Record<string, any> = {};
                    for (const [nKey, nField] of Object.entries(nestedShape)) {
                      const nDef = (nField as any)._def;
                      const nIsOptional = nDef.typeName === 'ZodOptional';
                      let nInner = nDef;
                      if (nIsOptional && nInner.innerType) nInner = nInner.innerType._def;
                      if (nInner.typeName === 'ZodDefault' && nInner.innerType) nInner = nInner.innerType._def;
                      if (nInner.typeName === 'ZodNullable' && nInner.innerType) nInner = nInner.innerType._def;
                      const nType = nInner.typeName === 'ZodString' ? 'string'
                        : nInner.typeName === 'ZodNumber' ? 'number'
                        : nInner.typeName === 'ZodBoolean' ? 'boolean'
                        : nInner.typeName === 'ZodArray' ? 'array'
                        : nInner.typeName === 'ZodEnum' ? 'string'
                        : nInner.typeName === 'ZodObject' ? 'object'
                        : 'string';
                      nestedProperties[nKey] = { type: nType };
                      if (nInner.description) nestedProperties[nKey].description = nInner.description;
                      if (nInner.typeName === 'ZodEnum' && nInner.values) {
                        nestedProperties[nKey].enum = nInner.values;
                      }
                      if (nType === 'array' && nInner.type?._def) {
                        const itemType = nInner.type._def.typeName === 'ZodString' ? 'string'
                          : nInner.type._def.typeName === 'ZodNumber' ? 'number' : 'string';
                        nestedProperties[nKey].items = { type: itemType };
                      }
                    }
                    if (Object.keys(nestedProperties).length > 0) {
                      propertySchema.properties = nestedProperties;
                    }
                  } catch {
                    // Fallback: leave as generic object
                  }
                } else if (innerDef.typeName === 'ZodRecord') {
                  propertyType = 'object';
                  propertySchema.description = innerDef.description || '';
                } else if (innerDef.typeName === 'ZodEnum') {
                  propertyType = 'string';
                  propertySchema.description = innerDef.description || '';
                  propertySchema.enum = innerDef.values || [];
                } else {
                  // Fallback: try to infer from description or default to string
                  propertyType = 'string';
                  propertySchema.description = innerDef.description || `Field: ${key}`;
                  logger.debug('[LangGraphChatbot] Unknown Zod type, defaulting to string', {
                    tool: toolName,
                    field: key,
                    typeName: innerDef.typeName,
                  });
                }
                
                if (propertyType) {
                  properties[key] = {
                    type: propertyType,
                    ...propertySchema,
                  };
                }
                
                // Only add to required if not optional, not default, and not nullable
                if (!isOptionalOrDefault && !isNullableField) {
                  required.push(key);
                }
              }

              // Safety: ensure required only references defined properties
              const validRequired = required.filter(r => r in properties);

              parameters = {
                type: 'object',
                properties,
                ...(validRequired.length > 0 ? { required: validRequired } : {}),
              };
            } else if (zodSchema._def.typeName === 'ZodUndefined' || Object.keys(zodSchema._def.shape?.() || {}).length === 0) {
              // Empty schema (no parameters) - this is valid
              parameters = {
                type: 'object',
                properties: {},
              };
            }
          }
        } catch (error) {
          logger.warn('[LangGraphChatbot] Failed to parse Zod schema, using empty schema', {
            tool: toolName || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });
        }

        // Ensure name and description are strings (already extracted above)
        const finalToolName = String(toolName || '').trim();
        const finalToolDescription = String(toolDescription || '').trim();

        if (!finalToolName || !finalToolDescription) {
          logger.error('[LangGraphChatbot] Tool missing required fields after extraction', {
            toolName: finalToolName,
            toolDescription: finalToolDescription,
            toolType: tool.constructor.name,
            toolKeys: Object.keys(tool),
          });
          throw new Error(`Tool is missing name or description: ${finalToolName || 'unnamed'}`);
        }

        const toolDef = {
          type: 'function' as const,
          function: {
            name: finalToolName,
            description: finalToolDescription,
            parameters,
          },
        };

        return toolDef;
      });

        // Cache the converted schemas for future requests with same intent
        this.toolSchemaCache.set(intentCacheKey, openAITools);
      } // end cache-miss block

      // Validate tools before binding
      const validTools = openAITools.filter(tool => {
        const isValid = tool.type === 'function' && 
                       tool.function && 
                       typeof tool.function.name === 'string' && 
                       tool.function.name.length > 0 &&
                       typeof tool.function.description === 'string' && 
                       tool.function.description.length > 0 &&
                       tool.function.parameters &&
                       typeof tool.function.parameters === 'object';
        if (!isValid) {
          logger.warn('[LangGraphChatbot] Skipping invalid tool', { 
            tool,
            hasType: tool.type === 'function',
            hasFunction: !!tool.function,
            hasName: typeof tool.function?.name === 'string',
            hasDescription: typeof tool.function?.description === 'string',
            hasParameters: !!tool.function?.parameters,
          });
        }
        return isValid;
      });

      if (validTools.length === 0) {
        logger.error('[LangGraphChatbot] No valid tools to bind', { 
          total: openAITools.length,
          tools: openAITools.map(t => ({ name: t.function?.name, hasName: !!t.function?.name })),
        });
        throw new Error('No valid tools available for binding');
      }

      logger.debug('[LangGraphChatbot] Binding tools', { 
        total: openAITools.length, 
        valid: validTools.length,
        toolNames: validTools.map(t => t.function.name),
      });

      // Bind tools to LLM using OpenAI format
      const llmWithTools = this.llm.bindTools!(validTools);

      // Generate response (may include tool calls)
      const llmStartTime = Date.now();
      let response = await llmWithTools.invoke(messages);
      let llmTime = Date.now() - llmStartTime;

      // GUARD: Detect Gemini 0-output-token silent failure
      // Gemini sometimes returns empty content + no tool calls with finishReason: "STOP"
      // when the prompt is large. Retry once with a nudge to force tool invocation.
      const responseContent0 = response.content;
      const hasContent0 = typeof responseContent0 === 'string' ? responseContent0.trim().length > 0 :
        Array.isArray(responseContent0) ? responseContent0.some((p: any) => (typeof p === 'string' ? p.trim() : p.text?.trim())) : false;
      const hasToolCalls0 = ((response as any)?.tool_calls?.length > 0) ||
        ((response as any)?.additional_kwargs?.tool_calls?.length > 0);

      if (!hasContent0 && !hasToolCalls0) {
        logger.warn('[LangGraphChatbot] Gemini returned 0 output tokens, retrying with nudge', {
          userId,
          messagePreview: message.substring(0, 60),
          inputTokens: (response as any)?.usage_metadata?.input_tokens,
          llmTimeMs: llmTime,
        });

        // Add a nudge message to force the model to act
        messages.push(response); // push empty response
        messages.push(new HumanMessage(
          `[SYSTEM: Your previous response was empty. You MUST either call a tool or respond with text. The user said: "${message}". Pick the most relevant tool and call it now, or give a helpful text response.]`
        ));

        const retryStart = Date.now();
        response = await llmWithTools.invoke(messages);
        llmTime += Date.now() - retryStart;

        // Pop the nudge + empty response so conversation history stays clean
        messages.pop(); // remove nudge
        messages.pop(); // remove empty response
      }

      messages.push(response);

      // Execute tools if needed (max 3 iterations)
      let iterations = 0;
      const maxIterations = 3;
      const toolCalls: Array<{ tool: string; result: string }> = [];


      // Check if response has tool calls (handle both AIMessage and AIMessageChunk)
      // Tool calls can be in response.tool_calls OR response.additional_kwargs.tool_calls
      let responseToolCalls = (response as any)?.tool_calls || 
                              (response as any)?.additional_kwargs?.tool_calls;
      let hasToolCalls = response && 
        (('tool_calls' in response && Array.isArray((response as any).tool_calls) && (response as any).tool_calls.length > 0) ||
         ('additional_kwargs' in response && Array.isArray((response as any).additional_kwargs?.tool_calls) && (response as any).additional_kwargs.tool_calls.length > 0)) &&
        Array.isArray(responseToolCalls) && 
        responseToolCalls.length > 0;
      

      // Use a more flexible check - if response has tool_calls property, treat it as valid
      while (
        hasToolCalls &&
        iterations < maxIterations
      ) {
        // Check if response has content - if it does and no tool calls, break
        const hasContent = response.content && 
          (typeof response.content === 'string' ? response.content.trim().length > 0 : 
           Array.isArray(response.content) ? response.content.length > 0 : true);
        
        // If we have content and no tool calls, we're done
        const currentToolCallsCheck = (response as any)?.tool_calls;
        if (hasContent && (!currentToolCallsCheck || currentToolCallsCheck.length === 0)) {
          break;
        }
        
        iterations++;
        
        // Check if we're at max iterations - if so, execute tools one more time and break
        if (iterations >= maxIterations) {
          logger.warn('[LangGraphChatbot] Reached max iterations, executing final tool calls', {
            userId,
            iterations,
            toolCallsCount: responseToolCalls?.length || 0,
          });
        }

        // Execute tools - handle both direct tool_calls and additional_kwargs.tool_calls formats
        const toolCallsToExecute = responseToolCalls || [];
        const toolResults = await this.executeTools(
          tools,
          toolCallsToExecute
            .filter((tc: any) => tc.id) // Filter out any without ID
            .map((tc: any) => {
              // Handle both formats: direct (tc.name, tc.args) and additional_kwargs (tc.function.name, tc.function.arguments)
              const toolName = tc.name || tc.function?.name;
              let toolArgs: Record<string, unknown> = {};
              if (tc.args) {
                toolArgs = tc.args;
              } else if (tc.function?.arguments) {
                try {
                  toolArgs = typeof tc.function.arguments === 'string' 
                    ? JSON.parse(tc.function.arguments) 
                    : tc.function.arguments;
                } catch (e) {
                  logger.warn('[LangGraphChatbot] Failed to parse tool arguments', { error: e, arguments: tc.function.arguments });
                }
              }
              return {
                name: toolName,
                args: toolArgs,
                id: tc.id!,
              };
            })
        );

        // Extract tool call info for response
        const currentToolCalls = responseToolCalls || (response as any).tool_calls || [];
        toolResults.forEach((tr, idx) => {
          const toolCall = currentToolCalls[idx];
          if (toolCall) {
            const resultContent = typeof tr.content === 'string' 
              ? tr.content 
              : JSON.stringify(tr.content);
            toolCalls.push({
              tool: toolCall.name || toolCall.function?.name || 'unknown',
              result: resultContent,
            });
          }
        });

        messages.push(...toolResults);

        // Generate next response
        const toolLlmStartTime = Date.now();
        response = await llmWithTools.invoke(messages);
        const toolLlmTime = Date.now() - toolLlmStartTime;
        if (toolLlmTime > 2000) {
          logger.warn('[LangGraphChatbot] Slow LLM response after tool call', {
            userId,
            iteration: iterations,
            time: toolLlmTime,
          });
        }
        
        // If response has empty content but tool calls, log it
        const responseContentStr = typeof response.content === 'string' ? response.content : '';
        const nextResponseToolCalls = (response as any)?.tool_calls || 
                                      (response as any)?.additional_kwargs?.tool_calls;
        if (!responseContentStr && nextResponseToolCalls && nextResponseToolCalls.length > 0) {
          logger.debug('[LangGraphChatbot] Response after tool execution has empty content but tool calls', {
            userId,
            iteration: iterations,
            toolCallsCount: nextResponseToolCalls.length,
          });
        }
        
        // Update responseToolCalls for next iteration check
        const updatedResponseToolCalls = nextResponseToolCalls;
        
        // Update hasToolCalls for next iteration
        hasToolCalls = response && 
          (('tool_calls' in response && Array.isArray((response as any).tool_calls) && (response as any).tool_calls.length > 0) ||
           ('additional_kwargs' in response && Array.isArray((response as any).additional_kwargs?.tool_calls) && (response as any).additional_kwargs.tool_calls.length > 0)) &&
          Array.isArray(updatedResponseToolCalls) && 
          updatedResponseToolCalls.length > 0;
        
        messages.push(response);
        
        
        // If we've reached max iterations and still have tool calls, break to generate response
        const finalToolCalls = updatedResponseToolCalls || (response as any)?.tool_calls || (response as any)?.additional_kwargs?.tool_calls;
        if (iterations >= maxIterations && finalToolCalls && finalToolCalls.length > 0) {
          logger.warn('[LangGraphChatbot] Max iterations reached with remaining tool calls', {
            userId,
            iterations,
            remainingToolCalls: finalToolCalls.length,
          });
          break;
        }
        
        // Update responseToolCalls for next iteration
        responseToolCalls = updatedResponseToolCalls;
      }
      

      const totalTime = Date.now() - totalStartTime;
      logger.debug('[LangGraphChatbot] Response timing', {
        userId,
        contextTime,
        historyTime,
        llmTime,
        totalTime,
        iterations,
        hasToolCalls: toolCalls.length > 0,
      });

      if (totalTime > 5000) {
        logger.warn('[LangGraphChatbot] Slow total response time', {
          userId,
          totalTime,
          contextTime,
          historyTime,
          llmTime,
        });
      }

      let responseContent = '';
      try {
        if (typeof response.content === 'string') {
          responseContent = response.content.trim();
        } else if (Array.isArray(response.content)) {
          // Handle array of content blocks
          responseContent = response.content
            .map((block: any) => {
              if (typeof block === 'string') return block;
              if (block && typeof block === 'object' && 'text' in block) return block.text;
              if (block && typeof block === 'object' && 'type' in block && block.type === 'text') return block.text || '';
              return JSON.stringify(block);
            })
            .filter((text: string) => text && text.trim().length > 0)
            .join(' ')
            .trim();
        } else if (response.content && typeof response.content === 'object') {
          // Try to extract text from object
          const contentObj = response.content as Record<string, unknown>;
          if ('text' in contentObj) {
            responseContent = String(contentObj.text).trim();
          } else {
            responseContent = JSON.stringify(response.content);
          }
        } else if (response.content !== null && response.content !== undefined) {
          responseContent = String(response.content).trim();
        }
        
        // If still empty, try to get from response directly
        if (!responseContent && response && typeof response === 'object') {
          const responseObj = response as unknown as Record<string, unknown>;
          if ('text' in responseObj) {
            responseContent = String(responseObj.text).trim();
          } else if ('message' in responseObj) {
            responseContent = String(responseObj.message).trim();
          }
        }
      } catch (error) {
        logger.error('[LangGraphChatbot] Error extracting response content', { 
          error, 
          responseType: typeof response,
          hasContent: 'content' in response,
          responseKeys: response && typeof response === 'object' ? Object.keys(response) : [],
        });
      }
      
      if (!responseContent || responseContent.length === 0) {
        
        // If we have tool calls but no content, generate a helpful response based on tool results
        if (toolCalls.length > 0) {
          logger.warn('[LangGraphChatbot] Empty response content but tool calls executed', {
            userId,
            toolCalls: toolCalls.map(tc => tc.tool),
            iterations,
          });

          // Check if tool results were all errors — don't pretend success
          const errorResults = toolCalls.filter(tc =>
            tc.result.startsWith('Error executing tool:') ||
            tc.result.startsWith('Tool "') ||
            tc.result.includes('not found') ||
            tc.result.startsWith('Missing required field')
          );

          if (errorResults.length > 0 && errorResults.length === toolCalls.length) {
            logger.error('[LangGraphChatbot] All tool calls failed', {
              userId,
              errors: errorResults.map(tc => ({ tool: tc.tool, error: tc.result.substring(0, 200) })),
            });
            responseContent = `I tried to help but ran into a technical issue. Could you rephrase what you'd like me to do?`;
          } else {
          // Get user name for personalized message
          const userName = await this.getUserName(userId);
          const namePrefix = userName ? `${userName}, ` : '';

          // Build specific message based on tool calls
          const completedActions: string[] = [];
          let hasWorkoutPlan = false;
          let hasReminder = false;
          let hasTask = false;
          
          toolCalls.forEach(tc => {
            if (tc.tool.includes('createWorkoutPlan')) {
              hasWorkoutPlan = true;
              completedActions.push('your workout plan has been created');
            }
            if (tc.tool.includes('createDietPlan')) {
              completedActions.push('your diet plan has been created');
            }
            if (tc.tool.includes('createWorkoutAlarm') || tc.tool.includes('createReminder')) {
              hasReminder = true;
              if (!completedActions.some(a => a.includes('reminder'))) {
                completedActions.push('your reminders have been set');
              }
            }
            if (tc.tool.includes('createTask')) {
              hasTask = true;
              if (!completedActions.some(a => a.includes('task'))) {
                completedActions.push('your task has been created');
              }
            }
            if (tc.tool.includes('createGoal')) {
              completedActions.push('your goal has been created');
            }
            if (tc.tool.includes('createRecipe')) {
              completedActions.push('your recipe has been created');
            }
            if (tc.tool.includes('update')) {
              completedActions.push('your information has been updated');
            }
            if (tc.tool.includes('delete')) {
              completedActions.push('the item has been deleted');
            }
          });
          
          // Generate personalized message
          if (completedActions.length > 0) {
            // Special handling for workout plan + reminder/task combination
            if (hasWorkoutPlan && (hasReminder || hasTask)) {
              const additionalItems: string[] = [];
              if (hasReminder) additionalItems.push('reminders');
              if (hasTask) additionalItems.push('task');
              const additionalText = additionalItems.length > 0 
                ? ` & your ${additionalItems.join(' & ')} ${additionalItems.length > 1 ? 'have' : 'has'} been set`
                : '';
              responseContent = `${namePrefix}your workout plan has been created${additionalText}. Is there anything else you'd like me to help with?`;
            } else {
              const actionsText = completedActions.length === 1 
                ? completedActions[0]
                : completedActions.slice(0, -1).join(', ') + ' & ' + completedActions[completedActions.length - 1];
              responseContent = `${namePrefix}${actionsText}. Is there anything else you'd like me to help with?`;
            }
          } else if (toolCalls.some(tc => tc.tool.includes('get') || tc.tool.includes('User'))) {
            responseContent = `${namePrefix}here's the information you requested. What would you like to know more about?`;
          } else {
            responseContent = `${namePrefix}I've completed that action for you. How else can I help?`;
          }
          } // end else (some tools succeeded)
        } else {
          
          // Check if response has unexecuted tool_calls BEFORE logging error
          // Check both response.tool_calls and response.additional_kwargs.tool_calls
          const unexecutedToolCalls = (response as any)?.tool_calls || (response as any)?.additional_kwargs?.tool_calls;
          const hasUnexecutedToolCalls = response && unexecutedToolCalls && Array.isArray(unexecutedToolCalls) && unexecutedToolCalls.length > 0;
          
          if (!hasUnexecutedToolCalls) {
            // Last resort: auto-invoke the obvious tool based on intent
            logger.warn('[LangGraphChatbot] Empty response — attempting auto-invoke based on intent', {
              userId,
              intent: intent.primary,
            });

            const autoInvoked = await this.autoInvokeToolByIntent(userId, message, intent, tools, toolCalls);
            if (autoInvoked) {
              responseContent = autoInvoked.message;
            } else {
              responseContent = 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.';
            }
          } else {
            
            // If response has tool_calls but we didn't execute them, it means we hit max iterations
            // Generate a response based on what was actually executed OR what tools were requested
            logger.warn('[LangGraphChatbot] Response has tool calls but loop ended - likely hit max iterations', {
              userId,
              iterations,
              remainingToolCalls: unexecutedToolCalls.length,
              executedToolCalls: toolCalls.length,
              remainingToolNames: unexecutedToolCalls.map((tc: any) => tc.name || tc.function?.name),
            });
            
            
            // If we executed some tools, generate a response based on those
            if (toolCalls.length > 0) {
              const userName = await this.getUserName(userId);
              const namePrefix = userName ? `${userName}, ` : '';
              
              // Check what tools were executed
              if (toolCalls.some(tc => tc.tool.includes('createDietPlan'))) {
                responseContent = `${namePrefix}your diet plan has been created. Is there anything else you'd like me to help with?`;
              } else if (toolCalls.some(tc => tc.tool.includes('create'))) {
                responseContent = `${namePrefix}I've created that for you! Is there anything else you'd like me to help with?`;
              } else {
                responseContent = `${namePrefix}I've processed your request. Is there anything specific you'd like to know?`;
              }
            } else {
              
              // No tools were executed, but we have requested tools - generate response based on what was requested
              const requestedTools = unexecutedToolCalls.map((tc: any) => tc.name || tc.function?.name || '');
              const userName = await this.getUserName(userId);
              const namePrefix = userName ? `${userName}, ` : '';
              
              // Check what tools were requested
              if (requestedTools.some((name: string) => name.includes('getUserWorkoutPlans') || name.includes('getUserDietPlans'))) {
                responseContent = `${namePrefix}I'm retrieving your plans. Is there anything specific you'd like to know?`;
              } else if (requestedTools.some((name: string) => name.includes('get'))) {
                responseContent = `${namePrefix}I'm gathering that information for you. What would you like to know more about?`;
              } else {
                responseContent = `${namePrefix}I processed your request. Is there anything specific you'd like to know?`;
              }
            }
          }
        }
      }

      // Get current message count for sequence numbers
      const currentMessageCount = conversationDataForContext?.conversation?.messageCount ?? 0;

      // Calculate context stats
      const contextStats = {
        knowledgeUsed: (ragContext.match(/RELEVANT KNOWLEDGE:/g) || []).length,
        profileUsed: (ragContext.match(/USER PROFILE:/g) || []).length,
        historyUsed: (ragContext.match(/PREVIOUS CONVERSATIONS:/g) || []).length,
      };

      // Recognize intents and generate actions
      const actions = this.recognizeIntents(message);
      
      // If navigation or modal actions are detected, replace response with minimal confirmation
      const navigationActions = actions.filter(action => action.type === 'navigate');
      const modalActions = actions.filter(action => action.type === 'open_modal' && (action.target === 'camera' || action.target === 'image_upload'));
      
      if (navigationActions.length > 0) {
        const userName = await this.getUserName(userId);
        const pageNames: Record<string, string> = {
          'overview': 'Overview',
          'workouts': 'Workouts',
          'nutrition': 'Nutrition',
          'progress': 'Progress',
          'plans': 'Plans',
          'goals': 'Goals',
          'activity': 'Activity',
          'activity-status': 'Activity Status',
          'achievements': 'Achievements',
          'whoop': 'WHOOP',
          'ai-coach': 'AI Coach',
          'chat': 'Chat',
          'chat-history': 'Chat History',
          'notifications': 'Notifications',
          'settings': 'Settings',
          'profile': 'Profile',
          'wellbeing': 'Wellbeing',
          'wellbeing/mood': 'Mood',
          'wellbeing/stress': 'Stress',
          'wellbeing/journal': 'Journal',
          'wellbeing/energy': 'Energy',
          'wellbeing/habits': 'Habits',
          'wellbeing/schedule': 'Schedule',
          'wellbeing/routines': 'Routines',
          'wellbeing/mindfulness': 'Mindfulness',
        };
        
        const firstNavAction = navigationActions[0];
        const pageDisplayName = pageNames[firstNavAction.target] || firstNavAction.target;
        const namePrefix = userName ? `${userName}, ` : '';
        responseContent = `${namePrefix}${pageDisplayName} page opened`;
      } else if (modalActions.length > 0) {
        const userName = await this.getUserName(userId);
        const firstModalAction = modalActions[0];
        const namePrefix = userName ? `${userName}, ` : '';
        
        if (firstModalAction.target === 'camera') {
          responseContent = `${namePrefix}Camera opened`;
        } else if (firstModalAction.target === 'image_upload') {
          responseContent = `${namePrefix}Image upload opened`;
        }
      }

      // Music control quick-response (instant, no LLM needed)
      const musicActions = actions.filter(action => action.type === 'music_control');
      if (musicActions.length > 0 && !navigationActions.length) {
        const userName2 = await this.getUserName(userId);
        const namePrefix2 = userName2 ? `${userName2}, ` : '';
        const cmdLabels: Record<string, string> = {
          pause: 'Music paused',
          resume: 'Resuming music',
          next: 'Playing next track',
          previous: 'Playing previous track',
          stop: 'Music stopped',
          volume_up: 'Volume turned up',
          volume_down: 'Volume turned down',
        };
        const cmd = musicActions[0].params?.command as string;
        responseContent = `${namePrefix2}${cmdLabels[cmd] || 'Done'}`;
      }

      // Store messages as a batched pair (1 INSERT + 1 UPDATE instead of 2+2)
      // Embedding is selective — only substantive messages get embedded
      this.storeMessagePair({
        conversationId: activeConversationId,
        userId,
        userContent: message,
        assistantContent: responseContent,
        baseSequenceNumber: currentMessageCount + 1,
        toolCalls: toolCalls.length > 0 ? {
          count: toolCalls.length,
          tools: toolCalls.map(tc => ({ name: tc.tool, result: tc.result?.substring(0, 200) || '' })),
        } : undefined,
      }).catch((error) => {
        logger.error('[LangGraphChatbot] Error storing messages', { error, userId });
      });

      // Auto-inject suggestedAction from musicManager tool results into actions
      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if (tc.tool === 'musicManager') {
            try {
              const parsed = JSON.parse(tc.result);
              if (parsed.suggestedAction) {
                actions.push({ ...parsed.suggestedAction, sequence: actions.length });
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      return {
        conversationId: activeConversationId,
        response: responseContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        actions: actions.length > 0 ? actions : undefined,
        context: contextStats,
      };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      const retryCount = (params as any)._retryCount ?? 0;

      // Detect and handle provider-level failures (503, billing, auth, stream parse, timeout)
      const isProviderError = modelFactory.handleProviderError(error);

      // Cascade through up to 3 providers (Gemini → Anthropic → DeepSeek → OpenAI)
      if (isProviderError && retryCount < 3) {
        const failedProvider = modelFactory.getLastProviderUsed();
        logger.warn(`[LangGraphChatbot] Provider ${failedProvider} failed (attempt ${retryCount + 1}), cascading to next`, {
          userId, error: errorMsg, provider: failedProvider,
        });

        try {
          this.llm = modelFactory.getModel({
            tier: 'default',
            temperature: 0.9,
            maxTokens: 2048,
            streaming: true,
          });

          logger.info('[LangGraphChatbot] Retrying with next provider', {
            userId, newProvider: modelFactory.getLastProviderUsed(), attempt: retryCount + 1,
          });

          return await this.chat({ ...params, _retryCount: retryCount + 1 } as any);
        } catch (noProvidersError: any) {
          // If modelFactory.getModel() throws "No LLM providers available", we're out of options
          logger.error('[LangGraphChatbot] All providers exhausted', {
            userId, error: noProvidersError?.message || 'Unknown',
          });
          throw noProvidersError;
        }
      }

      logger.error('Error in LangGraph chat', { error: errorMsg, userId });
      throw error;
    }
  }

  /**
   * Streaming chat method with tool call support
   */
  async chatStream(params: ChatRequest & {
    onToken: (token: string) => void;
    onConversationId: (id: string) => void;
  }): Promise<ChatResponse> {
    const { userId, message, conversationId, callId, sessionType: _sessionType, callPurpose, language, onToken, onConversationId } = params;
    const totalStartTime = Date.now();
    let firstTokenTime: number | null = null;

    try {
      // Topic detection - check if message is relevant to health/fitness/wellness
      const topicCheck = this.detectTopicRelevance(message);
      if (!topicCheck.isRelevant) {
        logger.debug('[LangGraphChatbot] Off-topic message detected (streaming)', {
          userId,
          message: message.substring(0, 100),
          confidence: topicCheck.confidence,
        });
        
        // Get or create conversation for storing the rejection
        let activeConversationId = conversationId;
        if (!activeConversationId) {
          activeConversationId = await vectorEmbeddingService.createConversation({
            userId,
            sessionType: 'health_coach',
          });
          onConversationId(activeConversationId);
        }
        
        // Get user name for personalized response
        const userName = await this.getUserName(userId);
        const offTopicResponse = this.generateOffTopicResponse(userName);
        
        // Send response as token
        onToken(offTopicResponse);
        
        // Store messages
        const conversationData = await vectorEmbeddingService.getConversation(
          activeConversationId,
          1
        );
        const currentMessageCount = conversationData?.conversation?.messageCount ?? 0;
        
        // Store off-topic pair (non-blocking, never worth embedding)
        this.storeMessagePair({
          conversationId: activeConversationId,
          userId,
          userContent: message,
          assistantContent: offTopicResponse,
          baseSequenceNumber: currentMessageCount + 1,
        }).catch(() => {});

        return {
          conversationId: activeConversationId,
          response: offTopicResponse,
          context: {
            knowledgeUsed: 0,
            profileUsed: 0,
            historyUsed: 0,
          },
        };
      }

      // Get or create conversation
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const sessionType = (params as any).sessionType || 'health_coach';
        activeConversationId = await vectorEmbeddingService.createConversation({
          userId,
          sessionType,
        });
        onConversationId(activeConversationId);
      }

      // Get conversation details for context (fetch 10 to reuse for LLM history — avoids duplicate DB call)
      const conversationDataForContext = await vectorEmbeddingService.getConversation(
        activeConversationId,
        10
      );

      // Detect emotion using fast local keyword matching (avoids 2-4s LLM call)
      const emotion = emotionDetectionService.fallbackEmotionDetection(message);

      // Fire-and-forget: log emotion to DB without blocking the response
      if (activeConversationId || callId) {
        emotionDetectionService.logEmotion(userId, emotion, {
          callId,
          conversationId: activeConversationId,
          source: 'text',
        }).catch((error) => {
          logger.warn('[LangGraphChatbot] Error logging emotion', { error, userId });
        });
      }

      // Detect crisis keywords (priority check)
      const crisisPromise = (async () => {
        try {
          const crisisDetection = await crisisDetectionService.detectCrisisKeywords(message);
          if (crisisDetection.isCrisis && crisisDetection.severity !== 'low') {
            // Trigger emergency protocol if we have a callId
            if (callId) {
              await crisisDetectionService.triggerEmergencyProtocol(callId, userId);
              
              // Get crisis resources
              const resources = await crisisDetectionService.getCrisisResources();
              
              // Schedule follow-up
              await crisisDetectionService.scheduleFollowUpCheckIn(userId, callId);

              // Return emergency response
              const emergencyResponse = `I'm here for you right now. I've activated emergency support protocols. Here are immediate resources:

National Suicide Prevention Lifeline: 988
Crisis Text Line: Text HOME to 741741
Emergency Services: 911

${resources.hotlines.map(h => `• ${h.name}: ${h.number}${h.description ? ` - ${h.description}` : ''}`).join('\n')}

I'm listening. What's happening right now?`;
              
              onToken(emergencyResponse);

              // Store emergency message pair
              const currentMessageCount = conversationDataForContext?.conversation?.messageCount ?? 0;
              this.storeMessagePair({
                conversationId: activeConversationId,
                userId,
                userContent: message,
                assistantContent: emergencyResponse,
                baseSequenceNumber: currentMessageCount + 1,
                metadata: { crisis: true, severity: crisisDetection.severity, emergency: true },
              }).catch((error) => {
                logger.error('[LangGraphChatbot] Error storing emergency messages', { error, userId });
              });

              return { isCrisis: true, emergencyResponse };
            }
          }
          return { isCrisis: false };
        } catch (error) {
          logger.warn('[LangGraphChatbot] Error detecting crisis', { error, userId });
          return { isCrisis: false };
        }
      })();

      // Wait for crisis detection first (higher priority)
      const crisisResult = await crisisPromise;
      if (crisisResult.isCrisis) {
        return {
          conversationId: activeConversationId,
          response: crisisResult.emergencyResponse || '',
          context: {
            knowledgeUsed: 0,
            profileUsed: 0,
            historyUsed: 0,
          },
          actions: [{ type: 'open_modal', target: 'emergency_resources' }],
        };
      }

      // Use callPurpose from params, or retrieve from callId if not provided (fallback)
      let effectiveCallPurpose = callPurpose;
      if (!effectiveCallPurpose && callId) {
        try {
          const callResult = await query<{ call_purpose: string }>(
            `SELECT call_purpose FROM voice_calls WHERE id = $1`,
            [callId]
          );
          if (callResult.rows.length > 0 && callResult.rows[0].call_purpose) {
            effectiveCallPurpose = callResult.rows[0].call_purpose;
          }
        } catch (error) {
          logger.warn('[LangGraphChatbot] Error retrieving call purpose', { error, callId });
        }
      }

      // Auto-track wellbeing information from user message (async, non-blocking)
      // Fire and forget - don't await, just let it run in background
      (async () => {
        try {
          const trackingResult = await wellbeingAutoTrackerService.extractWellbeingInfo(userId, message);
          
          // Auto-create entries for simple types
          if (trackingResult.entries.length > 0) {
            await wellbeingAutoTrackerService.autoCreateEntries(userId, trackingResult.entries);
          }

          // Check if this message is a response to a wellness question
          const isQuestionResponse = await this.isResponseToWellnessQuestion(
            userId,
            message,
            conversationDataForContext
          );
          if (isQuestionResponse.isResponse) {
            await this.trackQuestionResponse(userId, true, isQuestionResponse.questionType);
          }
        } catch (error) {
          logger.warn('[LangGraphChatbot] Error in auto-tracking', { error, userId });
        }
      })();

      // Retrieve RAG context and wellbeing context in parallel (emotion is already resolved synchronously)
      const contextStartTime = Date.now();
      const [ragContext, wellbeingContext] = await Promise.all([
        this.retrieveContext(userId, message),
        wellbeingContextService.getWellbeingContext(userId, message).catch(() => ({})),
      ]);
      const contextTime = Date.now() - contextStartTime;

      // Get conversation details for session type context
      const conversationDetails = conversationDataForContext?.conversation;

      // Check if we should ask a wellness question
      const questionCheck = await this.shouldAskWellnessQuestion(
        userId,
        message,
        emotion,
        wellbeingContext,
        conversationDataForContext
      );

      // Generate wellness question if needed (rule-based, no LLM call)
      let wellnessQuestion: { question: string; type: string; context?: string } | null = null;
      if (questionCheck.shouldAsk) {
        try {
          wellnessQuestion = this.selectWellnessQuestion(questionCheck.reason || 'missing_mood');
          logger.info('[LangGraphChatbot] Generated wellness question (stream)', {
            userId,
            questionType: wellnessQuestion.type,
            reason: questionCheck.reason,
            priority: questionCheck.priority,
          });
          this.trackQuestionAsked(userId, wellnessQuestion.type, questionCheck.priority || 'medium').catch(() => {});
        } catch (error) {
          logger.warn('[LangGraphChatbot] Error generating wellness question (stream)', { error, userId });
        }
      }

      // Build personalized system prompt with emotion data, session type, call purpose, language, wellbeing context, and question
      const finalSystemContent = await this.buildPersonalizedSystemPrompt(
        userId,
        ragContext,
        emotion || undefined,
        conversationDetails?.sessionType || undefined,
        effectiveCallPurpose,
        language,
        wellbeingContext,
        wellnessQuestion || undefined
      );

      // Reuse conversation data fetched earlier (already has 10 messages)
      const historyTime = 0; // No extra DB call needed

      // Build messages array
      const messages: BaseMessage[] = [];
      messages.push(new SystemMessage(finalSystemContent));

      // Add conversation history
      if (conversationDataForContext?.messages) {
        for (const msg of conversationDataForContext.messages) {
          if (msg.role === 'user') {
            messages.push(new HumanMessage(msg.content));
          } else if (msg.role === 'assistant') {
            messages.push(new AIMessage(msg.content));
          }
        }
      }

      // Add current user message (multimodal if image provided)
      if (params.imageBase64) {
        logger.info('[LangGraphChatbot] Sending multimodal message with camera frame', {
          imageSize: params.imageBase64.length,
          messagePreview: message.substring(0, 50),
        });
        messages.push(new HumanMessage({
          content: [
            { type: 'text', text: `${message}\n\n[CAMERA FRAME ATTACHED: You are receiving a live camera frame from the user. You CAN see them. Describe what you see in the image. If they're exercising, assess form and provide specific corrections. If food is visible, identify items and estimate nutrition. Be specific about what you observe in the frame.]` },
            { type: 'image_url', image_url: `data:image/jpeg;base64,${params.imageBase64}` },
          ],
        }));
      } else {
        messages.push(new HumanMessage(message));
      }

      // Create tools for this user - USE OPTIMIZED TOOLS WITH INTENT ROUTING
      const startToolTime = Date.now();
      const tools = getToolsForMessage(userId, message);
      const toolCreationTime = Date.now() - startToolTime;

      // Log intent classification and tool reduction
      const intent = toolRouterService.classifyIntent(message);
      logger.info('[LangGraphChatbot:Stream] Optimized tools selected', {
        userId,
        primaryIntent: intent.primary,
        toolCount: tools.length,
        toolCreationTimeMs: toolCreationTime,
      });

      // Convert tools to OpenAI format (reuse logic from chat method)
      const openAITools = tools.map((tool) => {
        const toolAny = tool as any;
        let toolName: string | undefined;
        let toolDescription: string | undefined;

        // Extract name and description (same logic as chat method)
        if (toolAny.name) toolName = String(toolAny.name);
        if (toolAny.description) toolDescription = String(toolAny.description);
        if (!toolName && toolAny.lc_kwargs?.name) toolName = String(toolAny.lc_kwargs.name);
        if (!toolDescription && toolAny.lc_kwargs?.description) toolDescription = String(toolAny.lc_kwargs.description);
        if (!toolName && toolAny.lc_attributes?.name) toolName = String(toolAny.lc_attributes.name);
        if (!toolDescription && toolAny.lc_attributes?.description) toolDescription = String(toolAny.lc_attributes.description);
        if (!toolName && toolAny._name) toolName = String(toolAny._name);
        if (!toolDescription && toolAny._description) toolDescription = String(toolAny._description);

        // Convert Zod schema to JSON Schema
        const zodSchema = tool.schema as any;
        let parameters: any = { type: 'object', properties: {} };

        try {
          if (zodSchema && zodSchema._def && zodSchema._def.typeName === 'ZodObject') {
            const shape = zodSchema._def.shape();
            const properties: Record<string, any> = {};
            const required: string[] = [];

            for (const [key, field] of Object.entries(shape)) {
              const fieldDef = (field as any)._def;
              const isOptional = fieldDef.typeName === 'ZodOptional';
              const isDefault = fieldDef.typeName === 'ZodDefault';
              const isNullable = fieldDef.typeName === 'ZodNullable';

              let innerDef = fieldDef;
              if (isOptional && innerDef.innerType) innerDef = innerDef.innerType._def;
              if (isDefault && innerDef.innerType) innerDef = innerDef.innerType._def;
              if (isNullable && innerDef.innerType) innerDef = innerDef.innerType._def;

              let propertyType: string | undefined;
              const propertySchema: any = {};

              if (innerDef.typeName === 'ZodString') {
                propertyType = 'string';
                propertySchema.description = innerDef.description || '';
              } else if (innerDef.typeName === 'ZodNumber') {
                propertyType = 'number';
                propertySchema.description = innerDef.description || '';
              } else if (innerDef.typeName === 'ZodBoolean') {
                propertyType = 'boolean';
                propertySchema.description = innerDef.description || '';
              } else if (innerDef.typeName === 'ZodEnum') {
                propertyType = 'string';
                propertySchema.description = innerDef.description || '';
                propertySchema.enum = innerDef.values || [];
              } else if (innerDef.typeName === 'ZodArray') {
                propertyType = 'array';
                propertySchema.description = innerDef.description || '';
                if (innerDef.type?._def) {
                  const itemType = innerDef.type._def.typeName === 'ZodString' ? 'string'
                    : innerDef.type._def.typeName === 'ZodNumber' ? 'number' : 'string';
                  propertySchema.items = { type: itemType };
                }
              } else if (innerDef.typeName === 'ZodObject') {
                propertyType = 'object';
                propertySchema.description = innerDef.description || '';
                try {
                  const nestedShape = innerDef.shape();
                  const nestedProps: Record<string, any> = {};
                  for (const [nKey, nField] of Object.entries(nestedShape)) {
                    const nDef = (nField as any)._def;
                    const nOpt = nDef.typeName === 'ZodOptional';
                    let nInner = nDef;
                    if (nOpt && nInner.innerType) nInner = nInner.innerType._def;
                    const nType = nInner.typeName === 'ZodString' ? 'string'
                      : nInner.typeName === 'ZodNumber' ? 'number'
                      : nInner.typeName === 'ZodBoolean' ? 'boolean'
                      : nInner.typeName === 'ZodEnum' ? 'string'
                      : nInner.typeName === 'ZodArray' ? 'array'
                      : 'string';
                    nestedProps[nKey] = { type: nType };
                    if (nInner.description) nestedProps[nKey].description = nInner.description;
                    if (nInner.typeName === 'ZodEnum' && nInner.values) nestedProps[nKey].enum = nInner.values;
                    if (nType === 'array' && nInner.type?._def) {
                      const iType = nInner.type._def.typeName === 'ZodString' ? 'string'
                        : nInner.type._def.typeName === 'ZodNumber' ? 'number' : 'string';
                      nestedProps[nKey].items = { type: iType };
                    }
                  }
                  if (Object.keys(nestedProps).length > 0) propertySchema.properties = nestedProps;
                } catch { /* fallback */ }
              } else if (innerDef.typeName === 'ZodRecord') {
                propertyType = 'object';
                propertySchema.description = innerDef.description || '';
              } else {
                propertyType = 'string';
                propertySchema.description = innerDef.description || `Field: ${key}`;
              }

              if (propertyType) {
                properties[key] = { type: propertyType, ...propertySchema };
              }

              if (!isOptional && !isDefault && !isNullable) {
                required.push(key);
              }
            }

            // Safety: ensure required only references defined properties
            const validRequired = required.filter(r => r in properties);

            parameters = {
              type: 'object',
              properties,
              ...(validRequired.length > 0 ? { required: validRequired } : {}),
            };
          }
        } catch (error) {
          // Use empty schema on error
        }

        return {
          type: 'function' as const,
          function: {
            name: String(toolName || ''),
            description: String(toolDescription || ''),
            parameters,
          },
        };
      }).filter(tool => 
        tool.type === 'function' && 
        tool.function && 
        typeof tool.function.name === 'string' && 
        tool.function.name.length > 0
      );

      // Bind tools to LLM
      const llmWithTools = this.llm.bindTools!(openAITools);

      // Stream initial response
      let fullResponse = '';
      let response: AIMessage | null = null;
      const toolCalls: Array<{ tool: string; result: string }> = [];
      let iterations = 0;
      const maxIterations = 3;
      
      // Accumulate tool calls from stream chunks (they may come in chunks that aren't AIMessage instances)
      const accumulatedToolCalls: any[] = [];

      const llmStartTime = Date.now();
      const LLM_STREAM_TIMEOUT_MS = 30000; // 30s max for LLM stream — prevents 82s hangs from Gemini parse failures
      const stream = await Promise.race([
        llmWithTools.stream(messages),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM stream timeout: no response within 30s')), LLM_STREAM_TIMEOUT_MS)
        ),
      ]);


      // Process stream chunks
      for await (const chunk of stream) {
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
          const timeToFirstToken = firstTokenTime - llmStartTime;
          if (timeToFirstToken > 2000) {
            logger.warn('[LangGraphChatbot] Slow time to first token', {
              userId,
              time: timeToFirstToken,
            });
          }
        }

        // Handle content chunks
        if (chunk.content) {
          let token = '';
          if (typeof chunk.content === 'string') {
            token = chunk.content;
          } else if (Array.isArray(chunk.content)) {
            // Gemini returns content as array: [{type: 'text', text: '...'}]
            token = chunk.content
              .map((part: any) => (typeof part === 'string' ? part : part.text || ''))
              .join('');
          }
          if (token) {
            fullResponse += token;
            onToken(token);
          }
        }

        // Handle tool calls in stream - accumulate them from any chunk
        // Check tool_calls, additional_kwargs.tool_calls, AND tool_call_chunks (Gemini streams via chunks)
        const chunkToolCalls = (chunk as any).tool_calls || (chunk as any).additional_kwargs?.tool_calls || [];
        const chunkToolCallChunks = (chunk as any).tool_call_chunks || [];

        if (chunkToolCalls.length > 0) {
          // Accumulate tool calls - merge with existing ones by ID to avoid duplicates
          chunkToolCalls.forEach((tc: any) => {
            const tcKey = tc.id || tc.name || `tool_${accumulatedToolCalls.length}`;
            if (!accumulatedToolCalls.find(existing => (existing.id || existing.name) === tcKey)) {
              accumulatedToolCalls.push(tc);
            }
          });
        }

        // Also handle tool_call_chunks (LangChain's streaming format for Gemini)
        if (chunkToolCallChunks.length > 0) {
          chunkToolCallChunks.forEach((tc: any) => {
            if (tc.name && tc.id) {
              // Only add complete chunks (have both name and id)
              if (!accumulatedToolCalls.find(existing => existing.id === tc.id)) {
                accumulatedToolCalls.push({
                  id: tc.id,
                  name: tc.name,
                  args: tc.args || {},
                });
              }
            }
          });
        }

        // Store the chunk as response for tool call detection
        // AIMessageChunk is a subclass of AIMessage in newer LangChain, but check both
        if (chunk instanceof AIMessage || (chunk as any).type === 'ai') {
          response = chunk as AIMessage;
        }
      }

      // GUARD: Detect Gemini 0-output-token silent failure in streaming
      // If stream completed with no content and no tool calls, retry with a nudge
      if (!fullResponse.trim() && accumulatedToolCalls.length === 0 && !((response as any)?.tool_calls?.length > 0)) {
        logger.warn('[LangGraphChatbot:Stream] Gemini returned 0 output tokens, retrying with nudge', {
          userId,
          messagePreview: message.substring(0, 60),
        });

        // Add nudge to force the model to act
        if (response) messages.push(response);
        messages.push(new HumanMessage(
          `[SYSTEM: Your previous response was empty. You MUST either call a tool or respond with text. The user said: "${message}". Pick the most relevant tool and call it now, or give a helpful text response.]`
        ));

        const retryStream = await Promise.race([
          llmWithTools.stream(messages),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLM retry stream timeout')), LLM_STREAM_TIMEOUT_MS)
          ),
        ]);
        for await (const chunk of retryStream) {
          if (chunk.content) {
            let token = '';
            if (typeof chunk.content === 'string') {
              token = chunk.content;
            } else if (Array.isArray(chunk.content)) {
              token = chunk.content.map((part: any) => (typeof part === 'string' ? part : part.text || '')).join('');
            }
            if (token) {
              fullResponse += token;
              onToken(token);
            }
          }
          const retryToolCalls = (chunk as any).tool_calls || [];
          const retryToolChunks = (chunk as any).tool_call_chunks || [];
          retryToolCalls.forEach((tc: any) => {
            if (tc.id && !accumulatedToolCalls.find((e: any) => e.id === tc.id)) accumulatedToolCalls.push(tc);
          });
          retryToolChunks.forEach((tc: any) => {
            if (tc.name && tc.id && !accumulatedToolCalls.find((e: any) => e.id === tc.id)) {
              accumulatedToolCalls.push({ id: tc.id, name: tc.name, args: tc.args || {} });
            }
          });
          if (chunk instanceof AIMessage || (chunk as any).type === 'ai') {
            response = chunk as AIMessage;
          }
        }

        // Pop the nudge so conversation history stays clean
        messages.pop(); // remove nudge
        if (messages[messages.length - 1] === response) messages.pop(); // remove empty response if we pushed it
      }

      // After stream completes, check for tool calls (handle both formats like non-streaming version)
      // Tool calls can be in response.tool_calls OR response.additional_kwargs.tool_calls OR accumulated from chunks
      let responseToolCalls: any[] = (response as any)?.tool_calls || 
                                     (response as any)?.additional_kwargs?.tool_calls ||
                                     (accumulatedToolCalls.length > 0 ? accumulatedToolCalls : []);
      
      // Ensure responseToolCalls is an array
      if (!Array.isArray(responseToolCalls)) {
        responseToolCalls = accumulatedToolCalls.length > 0 ? accumulatedToolCalls : [];
      }
      
      let hasToolCalls = (response && 
        (('tool_calls' in response && Array.isArray((response as any).tool_calls) && (response as any).tool_calls.length > 0) ||
         ('additional_kwargs' in response && Array.isArray((response as any).additional_kwargs?.tool_calls) && (response as any).additional_kwargs.tool_calls.length > 0))) ||
        (accumulatedToolCalls.length > 0);
      
      hasToolCalls = hasToolCalls && Array.isArray(responseToolCalls) && responseToolCalls.length > 0;


      // Loop to handle multiple tool call iterations (like non-streaming version)
      while (hasToolCalls && iterations < maxIterations) {
        iterations++;


        // Execute tools - handle both direct tool_calls and additional_kwargs.tool_calls formats
        const toolCallsToExecute = responseToolCalls || [];
        const toolResults = await this.executeTools(
          tools,
          toolCallsToExecute
            .filter((tc: any) => tc.id) // Filter out any without ID
            .map((tc: any) => {
              // Handle both formats: direct (tc.name, tc.args) and additional_kwargs (tc.function.name, tc.function.arguments)
              const toolName = tc.name || tc.function?.name;
              let toolArgs: Record<string, unknown> = {};
              if (tc.args) {
                toolArgs = tc.args;
              } else if (tc.function?.arguments) {
                try {
                  toolArgs = typeof tc.function.arguments === 'string' 
                    ? JSON.parse(tc.function.arguments) 
                    : tc.function.arguments;
                } catch (e) {
                  logger.warn('[LangGraphChatbot] Failed to parse tool arguments', { error: e, arguments: tc.function.arguments });
                }
              }
              return {
                name: toolName,
                args: toolArgs,
                id: tc.id!,
              };
            })
        );


        // Extract tool call info for response
        const currentToolCalls = responseToolCalls || (response as any).tool_calls || [];
        toolResults.forEach((tr, idx) => {
          const toolCall = currentToolCalls[idx];
          if (toolCall) {
            const resultContent = typeof tr.content === 'string' 
              ? tr.content 
              : JSON.stringify(tr.content);
            toolCalls.push({
              tool: toolCall.name || toolCall.function?.name || 'unknown',
              result: resultContent,
            });
          }
        });

        // CRITICAL: Push the AIMessage with tool_calls BEFORE pushing tool results
        // The LLM requires that ToolMessages must follow an AIMessage with tool_calls
        // Always construct from responseToolCalls (guaranteed to exist in this loop) for reliability
        const openAIToolCalls = responseToolCalls.map((tc: any) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name || tc.function?.name,
            arguments: typeof tc.args === 'object' ? JSON.stringify(tc.args) : (tc.function?.arguments || JSON.stringify({})),
          },
        }));
        const aiMessageToPush = new AIMessage({
          content: response?.content || fullResponse || '',
          additional_kwargs: {
            tool_calls: openAIToolCalls,
          },
        });

        
        messages.push(aiMessageToPush);

        messages.push(...toolResults);
        

        // Generate next response after tool execution
        const finalStream = await Promise.race([
          llmWithTools.stream(messages),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLM final stream timeout')), LLM_STREAM_TIMEOUT_MS)
          ),
        ]);
        let finalResponse = '';
        
        // Reset response for next iteration
        response = null;
        
        for await (const chunk of finalStream) {
          if (chunk.content) {
            let token = '';
            if (typeof chunk.content === 'string') {
              token = chunk.content;
            } else if (Array.isArray(chunk.content)) {
              token = chunk.content
                .map((part: any) => (typeof part === 'string' ? part : part.text || ''))
                .join('');
            }
            if (token) {
              finalResponse += token;
              onToken(token);
            }
          }

          // Store the chunk as response for tool call detection
          if (chunk instanceof AIMessage) {
            response = chunk;
          }
        }

        fullResponse += finalResponse;

        // Check for more tool calls in the response
        const nextResponseToolCalls = (response as any)?.tool_calls || 
                                      (response as any)?.additional_kwargs?.tool_calls;
        

        // Update hasToolCalls for next iteration
        hasToolCalls = !!(response && 
          (('tool_calls' in response && Array.isArray((response as any).tool_calls) && (response as any).tool_calls.length > 0) ||
           ('additional_kwargs' in response && Array.isArray((response as any).additional_kwargs?.tool_calls) && (response as any).additional_kwargs.tool_calls.length > 0)) &&
          Array.isArray(nextResponseToolCalls) && 
          nextResponseToolCalls.length > 0);
        
        // Update responseToolCalls for next iteration
        responseToolCalls = nextResponseToolCalls;
      }


      // Extract and validate response content (same logic as non-streaming version)
      let responseContent = fullResponse.trim();
      
      
      // If response is empty but tools were executed, generate a personalized message
      if (!responseContent || responseContent.length === 0) {
        
        if (toolCalls.length > 0) {
          logger.warn('[LangGraphChatbot] Empty streaming response but tool calls executed', {
            userId,
            toolCalls: toolCalls.map(tc => tc.tool),
            iterations,
          });

          // Check if tool results were all errors — don't pretend success
          const errorResults = toolCalls.filter(tc =>
            tc.result.startsWith('Error executing tool:') ||
            tc.result.startsWith('Tool "') ||
            tc.result.includes('not found') ||
            tc.result.startsWith('Missing required field')
          );

          if (errorResults.length > 0 && errorResults.length === toolCalls.length) {
            logger.error('[LangGraphChatbot] All tool calls failed (streaming)', {
              userId,
              errors: errorResults.map(tc => ({ tool: tc.tool, error: tc.result.substring(0, 200) })),
            });
            responseContent = `I tried to help but ran into a technical issue. Could you rephrase what you'd like me to do?`;
          } else {
          // Get user name for personalized message
          const userName = await this.getUserName(userId);
          const namePrefix = userName ? `${userName}, ` : '';

          // Build specific message based on tool calls
          const completedActions: string[] = [];
          let hasWorkoutPlan = false;
          let hasReminder = false;
          let hasTask = false;

          toolCalls.forEach(tc => {
            if (tc.tool.includes('createWorkoutPlan')) {
              hasWorkoutPlan = true;
              completedActions.push('your workout plan has been created');
            }
            if (tc.tool.includes('createDietPlan')) {
              completedActions.push('your diet plan has been created');
            }
            if (tc.tool.includes('createWorkoutAlarm') || tc.tool.includes('createReminder')) {
              hasReminder = true;
              if (!completedActions.some(a => a.includes('reminder'))) {
                completedActions.push('your reminders have been set');
              }
            }
            if (tc.tool.includes('createTask')) {
              hasTask = true;
              if (!completedActions.some(a => a.includes('task'))) {
                completedActions.push('your task has been created');
              }
            }
            if (tc.tool.includes('createGoal')) {
              completedActions.push('your goal has been created');
            }
            if (tc.tool.includes('createRecipe')) {
              completedActions.push('your recipe has been created');
            }
            if (tc.tool.includes('getUserWorkoutPlans') || tc.tool.includes('getUserDietPlans')) {
              completedActions.push('here are your plans');
            }
            if (tc.tool.includes('get')) {
              if (!completedActions.some(a => a.includes('information'))) {
                completedActions.push('here\'s the information you requested');
              }
            }
            if (tc.tool.includes('update')) {
              completedActions.push('your information has been updated');
            }
            if (tc.tool.includes('delete')) {
              completedActions.push('the item has been deleted');
            }
          });

          // Generate personalized message
          if (completedActions.length > 0) {
            // Special handling for workout plan + reminder/task combination
            if (hasWorkoutPlan && (hasReminder || hasTask)) {
              const additionalItems: string[] = [];
              if (hasReminder) additionalItems.push('reminders');
              if (hasTask) additionalItems.push('task');
              const additionalText = additionalItems.length > 0
                ? ` & your ${additionalItems.join(' & ')} ${additionalItems.length > 1 ? 'have' : 'has'} been set`
                : '';
              responseContent = `${namePrefix}your workout plan has been created${additionalText}. Is there anything else you'd like me to help with?`;
            } else {
              const actionsText = completedActions.length === 1
                ? completedActions[0]
                : completedActions.slice(0, -1).join(', ') + ' & ' + completedActions[completedActions.length - 1];
              responseContent = `${namePrefix}${actionsText}. Is there anything else you'd like me to help with?`;
            }
          } else if (toolCalls.some(tc => tc.tool.includes('get') || tc.tool.includes('User'))) {
            responseContent = `${namePrefix}here's the information you requested. What would you like to know more about?`;
          } else {
            responseContent = `${namePrefix}I've completed that action for you. How else can I help?`;
          }
          } // end else (some tools succeeded)
          
          
          // Try to send the generated message as tokens (but don't fail if stream is closed)
          if (onToken && responseContent) {
            try {
              // Send the entire message as a single token since stream has ended
              // The client will receive this in the 'done' event's message field
              onToken(responseContent);
            } catch (err) {
              // Stream might already be closed, that's okay - the message will be in result.response
              logger.debug('[LangGraphChatbot] Could not send fallback token (stream may be closed)', { error: err });
            }
          }
        } else {

          // Last resort: auto-invoke the obvious tool based on intent when Gemini silently fails
          logger.warn('[LangGraphChatbot] Empty streaming response — attempting auto-invoke based on intent', {
            userId,
            intent: intent.primary,
            iterations,
          });

          const autoInvoked = await this.autoInvokeToolByIntent(userId, message, intent, tools, toolCalls);
          if (autoInvoked) {
            responseContent = autoInvoked.message;
            // suggestedAction is auto-injected via the existing musicManager toolCalls loop
          } else {
            responseContent = 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.';
          }

          // Send the response as a token
          if (onToken && responseContent) {
            try {
              onToken(responseContent);
            } catch (err) {
              logger.debug('[LangGraphChatbot] Could not send fallback token (stream may be closed)', { error: err });
            }
          }
        }
      }
      

      const llmTime = Date.now() - llmStartTime;

      const totalTime = Date.now() - totalStartTime;
      logger.debug('[LangGraphChatbot] Streaming response timing', {
        userId,
        contextTime,
        historyTime,
        llmTime,
        timeToFirstToken: firstTokenTime ? firstTokenTime - llmStartTime : null,
        totalTime,
        iterations,
        hasToolCalls: toolCalls.length > 0,
      });

      // Calculate context stats
      const contextStats = {
        knowledgeUsed: (ragContext.match(/RELEVANT KNOWLEDGE:/g) || []).length,
        profileUsed: (ragContext.match(/USER PROFILE:/g) || []).length,
        historyUsed: (ragContext.match(/PREVIOUS CONVERSATIONS:/g) || []).length,
      };

      // Recognize intents and generate actions
      const actions = this.recognizeIntents(message);
      
      // If navigation or modal actions are detected, replace response with minimal confirmation
      const navigationActions = actions.filter(action => action.type === 'navigate');
      const modalActions = actions.filter(action => action.type === 'open_modal' && (action.target === 'camera' || action.target === 'image_upload'));
      
      if (navigationActions.length > 0) {
        const userName = await this.getUserName(userId);
        const pageNames: Record<string, string> = {
          'overview': 'Overview',
          'workouts': 'Workouts',
          'nutrition': 'Nutrition',
          'progress': 'Progress',
          'plans': 'Plans',
          'goals': 'Goals',
          'activity': 'Activity',
          'activity-status': 'Activity Status',
          'achievements': 'Achievements',
          'whoop': 'WHOOP',
          'ai-coach': 'AI Coach',
          'chat': 'Chat',
          'chat-history': 'Chat History',
          'notifications': 'Notifications',
          'settings': 'Settings',
          'profile': 'Profile',
          'wellbeing': 'Wellbeing',
          'wellbeing/mood': 'Mood',
          'wellbeing/stress': 'Stress',
          'wellbeing/journal': 'Journal',
          'wellbeing/energy': 'Energy',
          'wellbeing/habits': 'Habits',
          'wellbeing/schedule': 'Schedule',
          'wellbeing/routines': 'Routines',
          'wellbeing/mindfulness': 'Mindfulness',
        };
        
        const firstNavAction = navigationActions[0];
        const pageDisplayName = pageNames[firstNavAction.target] || firstNavAction.target;
        const namePrefix = userName ? `${userName}, ` : '';
        responseContent = `${namePrefix}${pageDisplayName} page opened`;
      } else if (modalActions.length > 0) {
        const userName = await this.getUserName(userId);
        const firstModalAction = modalActions[0];
        const namePrefix = userName ? `${userName}, ` : '';
        
        if (firstModalAction.target === 'camera') {
          responseContent = `${namePrefix}Camera opened`;
        } else if (firstModalAction.target === 'image_upload') {
          responseContent = `${namePrefix}Image upload opened`;
        }
      }

      // Get current message count for sequence numbers
      const currentMessageCount = conversationDataForContext?.conversation?.messageCount ?? 0;

      // Store messages as batched pair (non-blocking, selective embedding)
      this.storeMessagePair({
        conversationId: activeConversationId,
        userId,
        userContent: message,
        assistantContent: responseContent,
        baseSequenceNumber: currentMessageCount + 1,
        toolCalls: toolCalls.length > 0 ? {
          count: toolCalls.length,
          tools: toolCalls.map(tc => ({ name: tc.tool, result: tc.result?.substring(0, 200) || '' })),
        } : undefined,
      }).catch((error) => {
        logger.error('[LangGraphChatbot] Error storing messages', { error, userId });
      });

      // Questions are now integrated naturally into the response via system prompt
      // No need to append them here - the LLM includes them naturally in its response

      // Auto-inject suggestedAction from musicManager tool results into actions
      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if (tc.tool === 'musicManager') {
            try {
              const parsed = JSON.parse(tc.result);
              if (parsed.suggestedAction) {
                actions.push({ ...parsed.suggestedAction, sequence: actions.length });
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      return {
        conversationId: activeConversationId,
        response: responseContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        actions: actions.length > 0 ? actions : undefined,
        context: contextStats,
      };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      const retryCount = (params as any)._retryCount ?? 0;

      const isProviderError = modelFactory.handleProviderError(error);

      if (isProviderError && retryCount < 3) {
        const failedProvider = modelFactory.getLastProviderUsed();
        logger.warn(`[LangGraphChatbot] Stream provider ${failedProvider} failed (attempt ${retryCount + 1}), cascading`, {
          userId, error: errorMsg, provider: failedProvider,
        });

        try {
          this.llm = modelFactory.getModel({
            tier: 'default',
            temperature: 0.9,
            maxTokens: 2048,
            streaming: true,
          });

          logger.info('[LangGraphChatbot] Retrying stream with next provider', {
            userId, newProvider: modelFactory.getLastProviderUsed(), attempt: retryCount + 1,
          });

          return await this.chatStream({ ...params, _retryCount: retryCount + 1 } as any);
        } catch (noProvidersError: any) {
          logger.error('[LangGraphChatbot] All stream providers exhausted', {
            userId, error: noProvidersError?.message || 'Unknown',
          });
          throw noProvidersError;
        }
      }

      logger.error('Error in LangGraph chat stream', {
        error: errorMsg,
        errorCode: error?.code,
        userId,
      });
      throw error;
    }
  }

  /**
   * Generate personalized greeting using AI
   * Uses context from user profile, recent activity, and time of day
   */
  async generateGreeting(userId: string, callPurpose?: string, language?: string, sessionType?: string): Promise<string> {
    const greetingStartTime = Date.now();
    try {
      // Helper: timeout a promise (returns null on timeout instead of blocking)
      const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
        Promise.race([promise, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

      // Get user context in parallel — comprehensive context + coaching profile + basic info + delta
      // coachingProfile gets a tighter timeout (5s) as it can trigger expensive LLM profile generation
      const [userName, timeOfDay, newUser, comprehensiveContext, assistantName, deltaSummary, coachingProfile] = await Promise.all([
        this.getUserName(userId),
        Promise.resolve(this.getTimeOfDay()),
        this.isNewUser(userId),
        withTimeout(comprehensiveUserContextService.getComprehensiveContext(userId).catch(() => null), 8000, null),
        this.getAssistantName(userId),
        withTimeout(userDeltaService.recordSessionStart(userId, callPurpose ? 'voice_call' : 'app_open').catch(() => null), 5000, null),
        withTimeout(userCoachingProfileService.getOrGenerateProfile(userId).catch(() => null), 5000, null),
      ]);

      const contextGatherTime = Date.now() - greetingStartTime;
      logger.info('[LangGraphChatbot] Greeting context gathered', { userId, contextGatherTimeMs: contextGatherTime, hasContext: !!comprehensiveContext, hasProfile: !!coachingProfile });

      // Build rich context for greeting generation
      const contextParts: string[] = [];

      if (userName) {
        contextParts.push(`User's name: ${userName}`);
      }

      contextParts.push(`Time of day: ${timeOfDay}`);

      if (newUser) {
        contextParts.push(`IMPORTANT: This is a BRAND NEW user who just registered. Welcome them warmly. Do NOT reference any past activity, progress, completion rates, or history — they have none yet. Focus on introducing yourself and asking what they'd like to work on.`);
      } else if (comprehensiveContext) {
        // WHOOP data
        if (comprehensiveContext.whoop?.isConnected) {
          if (comprehensiveContext.whoop.lastRecovery) {
            contextParts.push(`WHOOP recovery: ${comprehensiveContext.whoop.lastRecovery.score}%`);
          }
          if (comprehensiveContext.whoop.lastSleep) {
            contextParts.push(`Last sleep: ${comprehensiveContext.whoop.lastSleep.duration?.toFixed(1)}h (quality: ${comprehensiveContext.whoop.lastSleep.quality}%)`);
          }
          if (comprehensiveContext.whoop.todayStrain) {
            contextParts.push(`Today's strain: ${comprehensiveContext.whoop.todayStrain.score}/21`);
          }
        }

        // Daily score
        if (comprehensiveContext.dailyScore?.latestScore) {
          contextParts.push(`Today's daily score: ${comprehensiveContext.dailyScore.latestScore}/100`);
          if (comprehensiveContext.dailyScore.scoreDelta !== undefined && comprehensiveContext.dailyScore.previousScore !== undefined) {
            const delta = comprehensiveContext.dailyScore.scoreDelta;
            contextParts.push(`Score change: ${delta > 0 ? '+' : ''}${delta} from yesterday (was ${comprehensiveContext.dailyScore.previousScore}/100)`);
          }
          if (comprehensiveContext.dailyScore.weekOverWeekDelta !== undefined) {
            const wDelta = comprehensiveContext.dailyScore.weekOverWeekDelta;
            contextParts.push(`Week-over-week change: ${wDelta > 0 ? '+' : ''}${wDelta}`);
          }
        }

        // Streak
        if (comprehensiveContext.gamification?.currentStreak) {
          contextParts.push(`Active streak: ${comprehensiveContext.gamification.currentStreak} days`);
        }

        // Workouts
        if ((comprehensiveContext.workouts?.activePlans?.length ?? 0) > 0) {
          const plan = comprehensiveContext.workouts!.activePlans![0];
          contextParts.push(`Active workout plan: "${plan.name}" (${plan.progress}% complete)`);
        }
        if (comprehensiveContext.workouts?.completionRate !== undefined) {
          contextParts.push(`Workout completion rate: ${comprehensiveContext.workouts.completionRate}%`);
        }
        if (comprehensiveContext.workouts?.missedWorkouts) {
          contextParts.push(`Missed workouts this week: ${comprehensiveContext.workouts.missedWorkouts}`);
        }

        // Nutrition
        if (comprehensiveContext.nutrition?.activeDietPlan) {
          contextParts.push(`Diet plan: "${comprehensiveContext.nutrition.activeDietPlan.name}" (${comprehensiveContext.nutrition.activeDietPlan.dailyCalories} kcal/day)`);
        }
        if (comprehensiveContext.nutrition?.todayMealCount !== undefined) {
          contextParts.push(`Meals logged today: ${comprehensiveContext.nutrition.todayMealCount}`);
        }

        // Goals — include ALL active goals with details
        if ((comprehensiveContext.goals?.activeGoals?.length ?? 0) > 0) {
          contextParts.push('\n--- GOALS ---');
          comprehensiveContext.goals!.activeGoals!.forEach((goal: any, i: number) => {
            contextParts.push(`Goal ${i + 1}: "${goal.title}" — ${goal.progress || 0}% progress${goal.targetDate ? `, deadline: ${goal.targetDate}` : ''}`);
          });
        }

        // Wellbeing
        if (comprehensiveContext.mentalHealth?.latestRecoveryScore) {
          contextParts.push(`Mental recovery score: ${comprehensiveContext.mentalHealth.latestRecoveryScore}/100`);
        }

        // Habits
        if (comprehensiveContext.habits?.totalActiveHabits) {
          const completed = comprehensiveContext.habits.todayCompletionCount || 0;
          contextParts.push(`Habits: ${completed}/${comprehensiveContext.habits.totalActiveHabits} completed today`);
        }

        // Water intake
        if (comprehensiveContext.waterIntake?.todayTargetMl) {
          contextParts.push(`Water: ${comprehensiveContext.waterIntake.todayMlConsumed || 0}/${comprehensiveContext.waterIntake.todayTargetMl}ml (${comprehensiveContext.waterIntake.todayPercentage || 0}%)`);
        }

        // Weight trend
        if (comprehensiveContext.progressTrend?.weightTrend && comprehensiveContext.progressTrend.weightTrend !== 'no_data') {
          const wt = comprehensiveContext.progressTrend;
          contextParts.push(`Weight trend: ${wt.weightTrend}${wt.weightChangeKg ? ` (${wt.weightChangeKg > 0 ? '+' : ''}${wt.weightChangeKg}kg over 30 days)` : ''}${wt.latestWeight ? `, current: ${wt.latestWeight} ${wt.latestWeightUnit || 'kg'}` : ''}`);
        }
      }

      // ===== COACHING PROFILE DATA (deep progress context) =====
      if (!newUser && coachingProfile) {
        contextParts.push('\n--- COACHING PROFILE (DEEP PROGRESS DATA) ---');

        // Adherence scores across pillars
        const adh = coachingProfile.adherenceScores;
        contextParts.push(`Adherence scores — Workout: ${adh.workout}%, Nutrition: ${adh.nutrition}%, Sleep: ${adh.sleep}%, Recovery: ${adh.recovery}%, Wellbeing: ${adh.wellbeing}%`);

        // Longitudinal adherence (7d vs 30d trends)
        if (coachingProfile.longitudinalAdherence) {
          const long = coachingProfile.longitudinalAdherence;
          contextParts.push(`7-day adherence — Workout: ${long.adherence7d.workout}%, Nutrition: ${long.adherence7d.nutrition}%, Sleep: ${long.adherence7d.sleep}%`);
          contextParts.push(`30-day adherence — Workout: ${long.adherence30d.workout}%, Nutrition: ${long.adherence30d.nutrition}%, Sleep: ${long.adherence30d.sleep}%`);
          contextParts.push(`Adherence trend: ${long.trendDirection}${long.consecutiveLowDays > 0 ? ` (${long.consecutiveLowDays} consecutive low days)` : ''}`);
        }

        // Fitness journey
        const fj = coachingProfile.fitnessJourney;
        contextParts.push(`Fitness journey — ${fj.totalWorkouts} total workouts, ${fj.workoutConsistencyRate}% consistency, ${fj.streakDays}-day streak (longest: ${fj.longestStreak})`);
        if (fj.favoriteWorkouts.length > 0) {
          contextParts.push(`Favorite workouts: ${fj.favoriteWorkouts.join(', ')}`);
        }
        if (fj.weightChange !== null) {
          contextParts.push(`Weight change: ${fj.weightChange > 0 ? '+' : ''}${fj.weightChange}kg`);
        }

        // Patterns — strengths and weak areas
        if (coachingProfile.patterns) {
          const pat = coachingProfile.patterns;
          if (pat.bestPerformanceDays.length > 0) {
            contextParts.push(`Best performance days: ${pat.bestPerformanceDays.join(', ')}`);
          }
          if (pat.skipPatterns.length > 0) {
            contextParts.push(`Skip patterns: ${pat.skipPatterns.map(s => `${s.dayOfWeek}${s.percentage ? ` (${s.percentage}%)` : ''}`).join(', ')}`);
          }
          if (pat.strugglingAreas && pat.strugglingAreas.length > 0) {
            contextParts.push(`Struggling areas: ${pat.strugglingAreas.join(', ')}`);
          }
          if (pat.lowEnergyTriggers.length > 0) {
            contextParts.push(`Low energy triggers: ${pat.lowEnergyTriggers.join(', ')}`);
          }
        }

        // Key insights
        if (coachingProfile.keyInsights.length > 0) {
          const working = coachingProfile.keyInsights.filter(i => i.type === 'working').map(i => i.text);
          const blocking = coachingProfile.keyInsights.filter(i => i.type === 'blocking').map(i => i.text);
          if (working.length > 0) contextParts.push(`What's working: ${working.join('; ')}`);
          if (blocking.length > 0) contextParts.push(`What's blocking: ${blocking.join('; ')}`);
        }

        // Risk flags
        if (coachingProfile.riskFlags.length > 0) {
          const highRisks = coachingProfile.riskFlags.filter(r => r.severity === 'high');
          const medRisks = coachingProfile.riskFlags.filter(r => r.severity === 'medium');
          if (highRisks.length > 0) {
            contextParts.push(`HIGH RISK FLAGS: ${highRisks.map(r => r.description).join('; ')}`);
          }
          if (medRisks.length > 0) {
            contextParts.push(`Medium risks: ${medRisks.map(r => r.description).join('; ')}`);
          }
        }

        // Memorable moments
        if (coachingProfile.memorableMoments.length > 0) {
          contextParts.push(`Recent milestones: ${coachingProfile.memorableMoments.slice(0, 3).map(m => `${m.description} (${m.date})`).join('; ')}`);
        }

        // Next best actions
        if (coachingProfile.nextBestActions.length > 0) {
          contextParts.push(`Recommended next actions: ${coachingProfile.nextBestActions.slice(0, 3).map(a => a.action).join('; ')}`);
        }

        // Goal alignment
        if (coachingProfile.goalAlignment?.misaligned?.length > 0) {
          contextParts.push(`Goal misalignment: ${coachingProfile.goalAlignment.misaligned.map(m => `${m.goal} — ${m.reason}`).join('; ')}`);
        }

        // Recent observations (trend, mood, energy)
        if (coachingProfile.recentObservations) {
          const obs = coachingProfile.recentObservations;
          contextParts.push(`Recent trend: ${obs.trendDirection}, dominant mood: ${obs.dominantMood}, energy pattern: ${obs.energyPattern}`);
          if (obs.recentChanges.length > 0) {
            contextParts.push(`Recent changes: ${obs.recentChanges.join('; ')}`);
          }
        }

        // Coach emotional state (how you feel about the user's progress)
        const coachEmotion = userCoachingProfileService.computeCoachEmotionalState(coachingProfile);
        const relationship = userCoachingProfileService.computeRelationshipDepth(coachingProfile);

        contextParts.push(`\n--- YOUR EMOTIONAL STATE ---`);
        contextParts.push(`You are feeling: ${coachEmotion.primary} (intensity: ${Math.round(coachEmotion.intensity * 100)}%)`);
        if (coachEmotion.secondary) contextParts.push(`Undercurrent of: ${coachEmotion.secondary}`);
        contextParts.push(`Why: ${coachEmotion.reason}`);
        contextParts.push(`Express naturally: "${coachEmotion.sensation}"`);
        if (coachEmotion.memoryHook) contextParts.push(`Memory to reference: "${coachEmotion.memoryHook}"`);

        contextParts.push(`\n--- RELATIONSHIP ---`);
        contextParts.push(`Phase: ${relationship.phase} (Day ${relationship.daysOnPlatform}, ${relationship.sharedMilestones} shared milestones)`);
        contextParts.push(`Voice style: ${relationship.voiceStyle}`);

        // Days on platform
        contextParts.push(`Days on platform: ${coachingProfile.daysOnPlatform}`);
      }

      // Add delta context — what changed since user's last visit
      if (!newUser && deltaSummary && deltaSummary.hoursSinceLastVisit > 2) {
        contextParts.push(`\nCHANGES SINCE LAST VISIT (${deltaSummary.hoursSinceLastVisit >= 24 ? Math.round(deltaSummary.hoursSinceLastVisit / 24) + ' days' : Math.round(deltaSummary.hoursSinceLastVisit) + 'h'} ago):`);
        contextParts.push(userDeltaService.formatDeltaForGreeting(deltaSummary));
      }

      // Add call purpose to context if provided
      if (callPurpose) {
        const purposeDirections: Record<string, string> = {
          workout: 'User is calling about workouts/exercise. Lead with their workout data — recovery score, today\'s scheduled session, completion rate.',
          fitness: 'User is calling about fitness. Reference their active plan progress and workout consistency.',
          nutrition: 'User is calling about nutrition/diet. Lead with their meal tracking status and diet plan adherence.',
          meal: 'User is calling about a meal or meal planning. Reference their calorie targets and today\'s meal count.',
          emotion: 'User is calling about emotions/mental health. Lead with their mental recovery score and be empathetic.',
          emergency: 'CRITICAL: The user is in an emergency. Be calm, supportive, and immediately provide crisis resources.',
          sleep: 'User is calling about sleep. Lead with their WHOOP sleep data — duration, quality, and how it affects recovery.',
          stress: 'User is calling about stress. Reference their wellbeing scores and any stress patterns.',
          wellness: 'User is calling about overall wellness. Give a quick status across all pillars.',
          recovery: 'User is calling about recovery. Lead with WHOOP recovery percentage and strain from yesterday.',
          goal_review: 'User wants to review goals. Reference their primary goal progress and timeline.',
          general_health: 'General health call. Pick the most relevant data point to open with.',
        };
        if (purposeDirections[callPurpose]) {
          contextParts.push(`Call Purpose: ${purposeDirections[callPurpose]}`);
        }
      }

      // Session-type-specific greeting directions (supplements/overrides callPurpose)
      if (sessionType) {
        const sessionTypeDirections: Record<string, string> = {
          quick_checkin: `SESSION TYPE: Quick Check-In (2.5 min).
TONE: Efficient, warm, concise — like a coach catching up between meetings.
APPROACH: Open with the single most important data point that changed since last visit. If their score dropped, lead with that. If their streak is at risk, mention it. If everything looks good, pick one thing they should be proud of.
DATA PRIORITY: Daily score delta > streak status > missed workouts > recovery score.
FORMAT: One punchy sentence referencing their data, then one short check-in question.
KEEP IT SHORT: 1-2 sentences maximum. This is a 2.5-minute session.`,

          coaching_session: `SESSION TYPE: Deep Coaching Session (10 min).
TONE: Thoughtful, analytical, supportive — like a personal coach who just reviewed your full dashboard.
APPROACH: Paint a picture of their current state across 2-3 pillars. Reference specific numbers. Show you see patterns and connections (e.g., low sleep -> low recovery -> missed workout). Set the stage for a productive deep conversation.
DATA PRIORITY: Cross-pillar patterns and connections. WHOOP recovery + workout performance + nutrition adherence + daily score.
FORMAT: 2-3 sentences demonstrating deep understanding, ending with an open question inviting them to explore what they want to work on.
INCLUDE: At least 2 specific data points and one pattern or insight connecting them.`,

          goal_review: `SESSION TYPE: Goal Review Session (10 min).
TONE: Analytical, motivating, progress-focused — like a coach pulling up their goal tracker.
APPROACH: Lead with their primary goal name and progress percentage. If approaching deadlines, mention them. Compare trajectory to target. If multiple goals exist, acknowledge primary and note others.
DATA PRIORITY: Goal name + progress % > days remaining > workout completion rate (as it relates to goals) > daily score trend.
FORMAT: 2-3 sentences. Start with goal name and progress, add context about trajectory or pace, ask what aspect of their goals they want to review.
INCLUDE: Goal name, progress percentage, and one contextual metric.`,

          emergency_support: `SESSION TYPE: Emergency Support (15 min).
TONE: Calm, deeply empathetic, non-judgmental, fully present — like a trusted counselor.
APPROACH: Do NOT lead with data or performance metrics. Acknowledge that they chose emergency support, which shows courage. Gently reference recent wellbeing context ONLY if it shows signs of struggle — frame as "I can see things have been tough" not as a score. Make them feel safe and heard.
DATA PRIORITY: Mental recovery trend > emotional check-in mood > journal sentiment trend > daily score decline. ONLY reference if they indicate struggle. Use qualitative language like "I noticed things have been difficult lately" — NEVER cite specific scores.
FORMAT: 2-3 gentle sentences. Acknowledge their choice to reach out, validate that it takes strength, ask them to share what's going on.
CRITICAL: Mention that you're here for them and if they ever need immediate professional help, you can connect them with crisis resources. Never minimize feelings. Never say "based on your data" or cite numbers.
WELLBEING HANDLING: If mental recovery is declining or mood scores are low, weave in empathetic acknowledgment without numbers.`,

          health_coach: `SESSION TYPE: Health Coaching Session (20 min).
TONE: Professional, holistic, knowledgeable — like a health coach reviewing your complete wellness panel.
APPROACH: Give a quick "state of health" overview across key pillars: recovery/sleep (WHOOP), activity (workouts), nutrition (adherence), and daily score. Identify the pillar needing attention and one they're excelling in.
DATA PRIORITY: WHOOP recovery + sleep > daily score + components > workout completion > nutrition adherence > water intake > habits.
FORMAT: 2-3 sentences covering health snapshot, then ask what aspect of health they want to focus on.
INCLUDE: One strength and one area for improvement, with specific numbers.`,

          nutrition: `SESSION TYPE: Nutrition Session (15 min).
TONE: Encouraging, specific, food-focused — like a nutritionist checking in.
APPROACH: Lead with nutrition data: diet plan name and adherence, today's meal count vs target, calorie tracking status. Note hydration. Connect to broader goals if applicable.
DATA PRIORITY: Diet plan adherence > today's meal count > calorie status > water intake > nutrition component of daily score.
FORMAT: 2 sentences about nutrition status with specific numbers, then ask what nutrition topic to discuss.
INCLUDE: Meals logged today, diet plan name (if active), and one nutrition metric.`,

          fitness: `SESSION TYPE: Fitness Session (20 min).
TONE: Energetic, motivating, performance-oriented — like a personal trainer reviewing the training log.
APPROACH: Lead with workout data: active plan name and progress, completion rate, recent performance. Factor in WHOOP recovery for training intensity advice. Acknowledge streaks or missed sessions constructively.
DATA PRIORITY: Workout plan progress > completion rate > WHOOP recovery (training readiness) > today's strain > missed workouts > streak.
FORMAT: 2-3 sentences about training status factoring in recovery, then ask about today's plans.
INCLUDE: Workout plan progress or completion rate, and recovery score as training readiness.`,

          wellness: `SESSION TYPE: Wellness Check Session (15 min).
TONE: Warm, holistic, mindful — like a wellness advisor taking a gentle, comprehensive look.
APPROACH: Balanced view across mental health, physical health, and lifestyle habits. Lead with mental recovery and mood trends. Reference habit completion and daily score. Address concerning trends gently.
DATA PRIORITY: Mental recovery score + trend > emotional check-in > journal sentiment > habit completion > daily score > sleep quality > water intake.
FORMAT: 2-3 sentences painting overall wellness state, then ask how they're feeling.
INCLUDE: Mental health metric, one lifestyle metric, emotional state acknowledgment.`,
        };

        if (sessionTypeDirections[sessionType]) {
          contextParts.push(`\n${sessionTypeDirections[sessionType]}`);
        }
      }

      const context = contextParts.join('\n');

      // Create system prompt for greeting generation with multilingual support
      let languageInstruction = '';
      if (language === 'ur') {
        languageInstruction = `CRITICAL: You MUST respond in Urdu (اردو) language. Write in Urdu script (right-to-left). Use natural Urdu expressions. When introducing yourself, say "میں ${assistantName} ہوں" (I am ${assistantName}).`;
      } else if (language) {
        const langMap: Record<string, string> = {
          'es': 'Spanish (Español)', 'fr': 'French (Français)', 'ar': 'Arabic (العربية)',
          'hi': 'Hindi (हिन्दी)', 'zh': 'Chinese (中文)', 'ja': 'Japanese (日本語)',
          'de': 'German (Deutsch)', 'it': 'Italian (Italiano)', 'pt': 'Portuguese (Português)',
        };
        const langName = langMap[language] || language.toUpperCase();
        languageInstruction = `CRITICAL: You MUST respond in ${langName}. Use your name ${assistantName} naturally in that language.`;
      } else {
        languageInstruction = `Respond in English. Use your name ${assistantName}.`;
      }

      // Determine if this should be a comprehensive progress review or session-specific greeting
      const isProgressReview = !sessionType && !callPurpose && !newUser;

      const greetingPrompt = isProgressReview
        ? `You are ${assistantName}, a professional health & performance coach. Generate a comprehensive, personalized progress review opening message for your client.

${languageInstruction}

## YOUR MISSION
You just reviewed your client's COMPLETE dashboard before this conversation. Deliver a thoughtful progress briefing that shows deep awareness of their journey — like a coach who genuinely cares about every metric and pattern.

## MESSAGE STRUCTURE (follow this flow naturally)
1. **Personalized Opening** (1 sentence): Greet them warmly by name with a time-appropriate reference. Set the emotional tone based on YOUR emotional state (see context).

2. **Progress Reflection** (2-3 sentences): Reference their KEY metrics — daily score, adherence across pillars (workout, nutrition, sleep), streak status, and goal progress. Compare recent vs 30-day performance if available. Highlight what's IMPROVING and what's DECLINING. Use specific numbers.

3. **Insight / Pattern Observation** (1-2 sentences): Connect the dots — identify a pattern, correlation, or behavioral observation. Examples: "I notice your best workout days are Tuesdays and Thursdays", "Your sleep has been dropping since your nutrition adherence declined", "You tend to skip workouts after high-stress days". Reference struggling areas or blocking factors if present.

4. **Clear Next Step / Suggestion** (1 sentence): Based on their next best actions and risk flags, suggest ONE concrete thing to focus on today. Make it actionable and specific.

5. **Engaging Close** (1 sentence): End with a question or challenge that invites them into the conversation. Not generic — tied to their data.

## EMOTIONAL TONE
- Let your emotional state (from context) color the ENTIRE message naturally
- If you're PROUD: be genuinely celebratory, reference their consistency
- If you're WORRIED: be caring but direct, name the concern
- If you're FRUSTRATED: be honest but constructive — "I know what you're capable of"
- If you're EXCITED: channel that energy — they're close to something big
- If you're DISAPPOINTED: acknowledge the slide but anchor to their proven capability
- If you're HOPEFUL: be warm and encouraging about the momentum building
- Match your voice to the RELATIONSHIP PHASE — new users get warmth and encouragement, veterans get directness and shorthand

## RULES
- Use 5-8 sentences total — this is a comprehensive opening, NOT a brief hello
- Reference at LEAST 3-4 specific data points with actual numbers
- Show cross-pillar awareness (connect workout + nutrition + sleep + goals)
- Sound like a REAL person who genuinely cares, not a data report
- Use first person: "I noticed", "I'm seeing", "What stands out to me"
- Express emotion THEN give the data — "I'm really impressed because..." not "Your data shows..."
- Never say "How can I help you?" — you're the one driving this conversation
- This message IS the conversation starter — don't wait for them to ask

Context:
${context}

Generate the comprehensive progress review opening. Return ONLY the spoken text.`
        : `You are ${assistantName}, a professional health & performance coach. Generate a personalized, data-aware greeting for a voice conversation.

${languageInstruction}

## Your Approach
- Open with a specific, relevant data point from their context — NOT a generic "how can I help you"
- Sound like a knowledgeable coach who just reviewed their dashboard before the call
- Be warm but substantive — show you know their data
- This is a VOICE greeting (spoken aloud), so keep it natural for speech
- Reference at least ONE specific number from their data (recovery %, streak, score, etc.)
${sessionType ? '- IMPORTANT: The user selected a specific SESSION TYPE. Follow the SESSION TYPE DIRECTIONS in the context — they define the tone, data priorities, and format for this greeting.' : ''}
${callPurpose && !sessionType ? '- The user selected a specific topic — lead with data relevant to that topic' : ''}

## What NOT to do
- Never say "How can I help you today?" — that's generic and adds no value
${sessionType === 'emergency_support' ? `- NEVER cite raw numbers or scores — use qualitative, empathetic language only
- NEVER start by asking what they need help with — acknowledge their courage in reaching out first
- NEVER minimize or dismiss their feelings` : ''}
- Never start with just "Hey [name]!" followed by filler
- Never ignore available data in favor of generic greetings

## Examples of good greetings (for reference only, do NOT copy):
- "${userName || 'Name'}, since we last talked 2 days ago, your score jumped 16 points to 78. What's been different?"
- "Welcome back ${userName || 'Name'} — 3 new workouts and a 5-day streak since I last saw you. Solid progress."
- "${userName || 'Name'}, your recovery is at 62% today — let's factor that into your training. What's on your agenda?"
${!newUser && deltaSummary ? '- If delta data shows significant changes, LEAD with those changes. The user wants to know you noticed.' : ''}

Context:
${context}

Generate the greeting. Return ONLY the spoken text.`;

      // Use LLM to generate personalized greeting with timeout
      // Greeting should complete within 15s total; if LLM takes too long, use data-aware fallback
      const messages = [
        new SystemMessage(greetingPrompt),
        new HumanMessage('Generate the greeting.'),
      ];

      const llmStartTime = Date.now();
      const llmTimeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 15000));
      const llmResult = await Promise.race([
        this.llm.invoke(messages),
        llmTimeout,
      ]);

      const llmTime = Date.now() - llmStartTime;
      const totalTime = Date.now() - greetingStartTime;

      if (!llmResult) {
        logger.warn('[LangGraphChatbot] Greeting LLM timed out, using data-aware fallback', { userId, llmTimeMs: llmTime, totalTimeMs: totalTime });
        return this.buildDataAwareFallbackGreeting(userName, timeOfDay, comprehensiveContext, coachingProfile);
      }

      const greeting = typeof llmResult.content === 'string'
        ? llmResult.content.trim()
        : String(llmResult.content).trim();

      logger.info('[LangGraphChatbot] Greeting generated', { userId, llmTimeMs: llmTime, totalTimeMs: totalTime, greetingLength: greeting.length });

      // Fallback to contextual greeting if AI generation fails or is empty
      if (!greeting || greeting.length < 10) {
        logger.warn('[LangGraphChatbot] AI greeting generation returned empty, using fallback', { userId });
        return this.buildDataAwareFallbackGreeting(userName, timeOfDay, comprehensiveContext, coachingProfile);
      }

      return greeting;
    } catch (error) {
      logger.error('[LangGraphChatbot] Error generating greeting', { error, userId });

      // Fallback to data-aware greeting on error
      try {
        const [userName, timeOfDay, comprehensiveContext] = await Promise.all([
          this.getUserName(userId),
          Promise.resolve(this.getTimeOfDay()),
          comprehensiveUserContextService.getComprehensiveContext(userId).catch(() => null),
        ]);
        return this.buildDataAwareFallbackGreeting(userName, timeOfDay, comprehensiveContext, null);
      } catch (fallbackError) {
        logger.error('[LangGraphChatbot] Error in greeting fallback', { error: fallbackError, userId });
        return "Hey! Let's check in on your progress today.";
      }
    }
  }

  /**
   * Data-aware fallback greeting — used when LLM is unavailable (circuit breaker open, quota exhausted).
   * Instead of generic "Good morning!" messages, constructs a data-driven greeting from available context.
   */
  private buildDataAwareFallbackGreeting(
    userName: string | null,
    timeOfDay: 'morning' | 'afternoon' | 'evening',
    context: any | null,
    profile: any | null,
  ): string {
    const name = userName || 'there';
    const timeGreet = timeOfDay === 'morning' ? 'Good morning' : timeOfDay === 'afternoon' ? 'Good afternoon' : 'Good evening';
    const parts: string[] = [];

    // Try to build data-aware greeting from available context
    if (context) {
      // Lead with the most impactful data point
      const score = context.dailyScore?.latestScore;
      const streak = context.gamification?.currentStreak;
      const recovery = context.whoop?.lastRecovery?.score;
      const workoutRate = context.workouts?.completionRate;
      const missedWorkouts = context.workouts?.missedWorkouts;
      const primaryGoal = context.goals?.activeGoals?.[0];

      if (score && context.dailyScore?.scoreDelta) {
        const delta = context.dailyScore.scoreDelta;
        if (Math.abs(delta) >= 5) {
          parts.push(`${timeGreet} ${name}! Your score ${delta > 0 ? 'jumped' : 'dropped'} ${Math.abs(delta)} points to ${score} since yesterday.`);
        } else {
          parts.push(`${timeGreet} ${name}! Your score is holding at ${score} today.`);
        }
      } else if (score) {
        parts.push(`${timeGreet} ${name}! Your daily score is at ${score} today.`);
      }

      if (streak && streak >= 3) {
        parts.push(`You're on a ${streak}-day streak — keep that momentum going.`);
      }

      if (missedWorkouts && missedWorkouts >= 2) {
        parts.push(`I noticed ${missedWorkouts} missed workouts this week — let's talk about getting back on track.`);
      } else if (workoutRate !== undefined) {
        parts.push(`Workout completion is at ${workoutRate}% this week.`);
      }

      if (primaryGoal) {
        parts.push(`Your goal "${primaryGoal.title}" is at ${primaryGoal.progress || 0}% — let's keep pushing.`);
      }

      if (recovery !== undefined) {
        parts.push(`Recovery is at ${recovery}% today${recovery < 50 ? ' — we should factor that into your plan' : ''}.`);
      }
    }

    // Add coaching profile insights if available
    if (profile) {
      if (profile.longitudinalAdherence?.trendDirection) {
        const trend = profile.longitudinalAdherence.trendDirection;
        if (trend === 'declining') {
          parts.push(`I'm seeing a declining trend recently — let's figure out what's going on.`);
        } else if (trend === 'improving') {
          parts.push(`Your trend is improving — the consistency is paying off.`);
        }
      }
    }

    // If we have data, construct the greeting
    if (parts.length > 0) {
      // Cap at 4 sentences for the fallback
      return parts.slice(0, 4).join(' ');
    }

    // Last resort — still better than "How can I help you?"
    return `${timeGreet} ${name}! Let's review how things are going and figure out what to focus on today.`;
  }
}

export const langGraphChatbotService = new LangGraphChatbotService();
export default langGraphChatbotService;

