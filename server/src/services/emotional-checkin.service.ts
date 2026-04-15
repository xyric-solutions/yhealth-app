/**
 * @file Emotional Check-In Service
 * @description Handles emotional check-in screening conversations with LLM-powered question generation
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { logger } from './logger.service.js';
import { modelFactory } from './model-factory.service.js';
import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { crisisDetectionService } from './crisis-detection.service.js';
import { moodService } from './wellbeing/mood.service.js';
import { stressService } from './stress.service.js';
import { energyService } from './wellbeing/energy.service.js';
import { emotionalCheckinInsightsService } from './emotional-checkin-insights.service.js';
import { emotionalCheckinTrendsService } from './emotional-checkin-trends.service.js';
import { aiCoachService } from './ai-coach.service.js';
import { wellbeingAutoTrackerService } from './wellbeing-auto-tracker.service.js';
import {
  emotionalCheckInQuestionsService,
  QuestionCategory,
} from './emotional-checkin-questions.service.js';
import { cameraEmotionService, CameraEmotionInput } from './camera-emotion.service.js';

// ============================================
// TYPES
// ============================================

export type ScreeningType = 'light' | 'standard' | 'deep';
export type RiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical';

export interface EmotionalCheckInSession {
  id: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  questionCount: number;
  screeningType: ScreeningType;
  overallAnxietyScore?: number;
  overallMoodScore?: number;
  riskLevel: RiskLevel;
  crisisDetected: boolean;
  insights: Record<string, any>;
  recommendations: Array<{
    type: string;
    title: string;
    description: string;
    duration?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInQuestion {
  id: string;
  question: string;
  type: 'scale' | 'frequency' | 'text';
  options?: string[];
  scaleRange?: { min: number; max: number; labels?: string[] };
}

export interface CheckInResponse {
  questionId: string;
  value: number | string;
  text?: string;
}

export interface ConversationMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

interface SessionRow {
  id: string;
  user_id: string;
  started_at: Date;
  completed_at: Date | null;
  expired_at: Date | null;
  last_activity_at: Date | null;
  duration_seconds: number | null;
  question_count: number;
  screening_type: string;
  overall_anxiety_score: number | null;
  overall_mood_score: number | null;
  overall_energy_score: number | null;
  overall_stress_score: number | null;
  risk_level: string;
  crisis_detected: boolean;
  insights: Record<string, any>;
  recommendations: any[];
  camera_analysis: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

// Routing context for question selection
interface RoutingContext {
  screeningType: ScreeningType;
  questionCount: number;
  answeredCategories: Set<QuestionCategory>;
  currentScores: Map<QuestionCategory, number>;
  baselineScores?: {
    anxiety: number;
    mood: number;
    energy: number;
    stress: number;
  };
}

// ============================================
// SYSTEM PROMPT
// ============================================

const EMOTIONAL_CHECKIN_SYSTEM_PROMPT = `You are Balencia's Emotional Check-In AI — a calm, empathetic wellness guide that helps users reflect on anxiety and low-mood patterns through short, evidence-inspired screening conversations.

## Your Role
- You are NOT a clinician and must NEVER diagnose, label, or prescribe
- Your purpose is awareness, trend-tracking, gentle guidance, and safe escalation when needed
- Your tone is modern, warm, non-judgmental, and culturally sensitive

## Core Objectives
1. Help users notice emotional patterns
2. Reduce stigma around mental health check-ins
3. Provide immediate supportive micro-interventions
4. Track trends across time
5. Encourage professional help when risk is high — without alarmism

## Conversation Style
- Be soothing but modern
- Be concise yet caring
- Be evidence-aware but non-clinical
- Be empowering
- Premium wellness-app quality

## Question Guidelines
- Ask ONE question at a time
- Use time-window framing ("over the past two weeks")
- Use scaled questions (0-10) for intensity
- Use frequency options (never → almost daily) for occurrence
- Cover: worry/nervousness, panic sensations, low mood, loss of interest, energy, sleep, focus, irritability, sense of overwhelm
- Always display: "This is a wellbeing check-in, not a diagnosis"

## Ethical Boundaries
- NO diagnoses - you are not a clinician
- NO medical claims - this is a wellbeing tool
- NO medication advice - defer to professionals
- NO absolute statements - speak in patterns and observations
- Preserve autonomy - users make their own choices
- Respect privacy - handle data sensitively
- Avoid moralizing - no judgment on feelings

## Question Categories to Cover
1. Worry/nervousness (0-10 scale)
2. Panic sensations (frequency: never → almost daily)
3. Low mood (0-10 scale, past two weeks)
4. Loss of interest (frequency)
5. Energy levels (0-10 scale)
6. Sleep quality (0-10 scale)
7. Focus/concentration (0-10 scale)
8. Irritability (frequency)
9. Sense of overwhelm (0-10 scale)

## Adaptive Depth
- Lighter check-in when responses suggest stability
- Deeper screening when patterns worsen
- Ask follow-up questions only when needed for clarity

## Response Format
When generating a question, respond with JSON:
{
  "question": "Your question text here",
  "type": "scale" | "frequency" | "text",
  "scaleRange": { "min": 0, "max": 10, "labels": ["Not at all", "Extremely"] } (for scale type),
  "options": ["never", "rarely", "sometimes", "often", "almost daily"] (for frequency type)
}`;

// ============================================
// SERVICE CLASS
// ============================================

class EmotionalCheckInService {
  private llm: BaseChatModel;

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'default',
      temperature: 0.7,
    });
  }

  /**
   * Start a new emotional check-in session
   */
  async startCheckIn(userId: string, type: ScreeningType = 'standard'): Promise<{
    session: EmotionalCheckInSession;
    greeting: string;
    firstQuestion: CheckInQuestion;
  }> {
    const result = await query<SessionRow>(
      `INSERT INTO emotional_checkin_sessions (user_id, screening_type, started_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, type]
    );

    const session = this.mapRowToSession(result.rows[0]);
    
    logger.info('[EmotionalCheckIn] Started check-in session', {
      userId,
      sessionId: session.id,
      type,
    });

    // Generate greeting and first question
    const greeting = `Hi there. I'm here to help you check in with how you've been feeling. This is a wellbeing check-in, not a diagnosis — just a way to notice patterns and offer support.

This will take about 1-3 minutes. We'll go through a few questions about how you've been feeling over the past two weeks. Ready to begin?`;

    const firstQuestion = await this.generateNextQuestion(session, []);

    return {
      session,
      greeting,
      firstQuestion: firstQuestion || {
        id: `q_${Date.now()}`,
        question: "On a scale of 0 to 10, how much have you been worrying or feeling nervous over the past two weeks?",
        type: "scale",
        scaleRange: {
          min: 0,
          max: 10,
          labels: ["Not at all", "Extremely"],
        },
      },
    };
  }


  /**
   * Process a user response and generate next question
   */
  async processResponse(
    sessionId: string,
    questionId: string,
    response: CheckInResponse,
    conversationHistory: ConversationMessage[]
  ): Promise<{
    nextQuestion?: CheckInQuestion;
    isComplete: boolean;
    message?: string;
  }> {
    // Get session
    const session = await this.getSession(sessionId);
    if (!session) {
      throw ApiError.notFound('Check-in session not found');
    }

    if (session.completedAt) {
      throw ApiError.badRequest('Check-in session already completed');
    }

    // Store response in appropriate wellbeing table
    await this.storeResponse(session.userId, sessionId, questionId, response);

    // Check for crisis indicators
    const responseText = typeof response.value === 'string' 
      ? response.value 
      : response.text || String(response.value);
    const crisisCheck = await crisisDetectionService.detectCrisisKeywords(responseText);

    if (crisisCheck.isCrisis && crisisCheck.severity !== 'low') {
      // Update session with crisis flag
      await query(
        `UPDATE emotional_checkin_sessions 
         SET crisis_detected = true, risk_level = $1
         WHERE id = $2`,
        [crisisCheck.severity === 'critical' ? 'critical' : 'high', sessionId]
      );

      return {
        isComplete: true,
        message: 'I want to make sure you have the support you need right now. Please reach out to trusted people or professional support.',
      };
    }

    // Add response to conversation history
    const updatedHistory: ConversationMessage[] = [
      ...conversationHistory,
      {
        role: 'user',
        content: typeof response.value === 'string' ? response.value : String(response.value),
        timestamp: new Date(),
      },
    ];

    // Generate next question
    const nextQuestion = await this.generateNextQuestion(session, updatedHistory);

    // Update question count
    await query(
      `UPDATE emotional_checkin_sessions 
       SET question_count = question_count + 1
       WHERE id = $1`,
      [sessionId]
    );

    // Check if we should complete (8-12 questions typically)
    const newQuestionCount = session.questionCount + 1;
    const isComplete = newQuestionCount >= 8 && (newQuestionCount >= 12 || !nextQuestion);

    if (isComplete) {
      // Complete the session
      await this.completeSession(sessionId);
    }

    return {
      nextQuestion: nextQuestion || undefined,
      isComplete,
    };
  }

  /**
   * Store response in appropriate wellbeing table
   */
  private async storeResponse(
    userId: string,
    sessionId: string,
    questionId: string,
    response: CheckInResponse
  ): Promise<void> {
    // Determine which table to store in based on question category
    // This is a simplified mapping - in production, you'd have a more sophisticated mapping
    const questionCategory = questionId.split('_')[0];

    try {
      if (questionCategory.includes('mood') || questionCategory.includes('happiness')) {
        await moodService.createMoodLog(userId, {
          mode: 'deep',
          happinessRating: typeof response.value === 'number' ? response.value : undefined,
          contextNote: response.text,
          loggedAt: new Date().toISOString(),
        });

        // Link to session
        await query(
          `UPDATE mood_logs 
           SET emotional_checkin_session_id = $1
           WHERE user_id = $2 AND created_at > NOW() - INTERVAL '1 minute'
           ORDER BY created_at DESC LIMIT 1`,
          [sessionId, userId]
        );
      } else if (questionCategory.includes('stress') || questionCategory.includes('anxiety') || questionCategory.includes('worry')) {
        await stressService.createStressLog(userId, {
          stressRating: typeof response.value === 'number' ? response.value : 5,
          checkInType: 'on_demand',
          clientRequestId: `checkin_${sessionId}_${Date.now()}`,
          note: response.text,
        });

        // Link to session
        await query(
          `UPDATE stress_logs 
           SET emotional_checkin_session_id = $1
           WHERE user_id = $2 AND created_at > NOW() - INTERVAL '1 minute'
           ORDER BY created_at DESC LIMIT 1`,
          [sessionId, userId]
        );
      } else if (questionCategory.includes('energy')) {
        await energyService.createEnergyLog(userId, {
          energyRating: typeof response.value === 'number' ? response.value : 5,
          contextNote: response.text,
        });

        // Link to session
        await query(
          `UPDATE energy_logs 
           SET emotional_checkin_session_id = $1
           WHERE user_id = $2 AND created_at > NOW() - INTERVAL '1 minute'
           ORDER BY created_at DESC LIMIT 1`,
          [sessionId, userId]
        );
      }
    } catch (error) {
      logger.error('[EmotionalCheckIn] Error storing response', {
        sessionId,
        questionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - continue with check-in even if storage fails
    }
  }

  /**
   * Generate next question using hybrid template + LLM approach
   * Templates handle 60-70% of questions, LLM for personalized follow-ups
   */
  private async generateNextQuestion(
    session: EmotionalCheckInSession,
    conversationHistory: ConversationMessage[],
    sessionResponses?: Array<{ questionId: string; category: QuestionCategory; value: number }>
  ): Promise<CheckInQuestion | null> {
    try {
      // Build routing context from session responses
      const routingContext = await this.buildRoutingContext(session, sessionResponses);

      // Try template-based selection first (faster, cheaper, deterministic)
      const templateQuestion = emotionalCheckInQuestionsService.selectNextQuestion(routingContext);

      if (templateQuestion) {
        logger.debug('[EmotionalCheckIn] Using template-based question', {
          sessionId: session.id,
          questionId: templateQuestion.id,
          category: templateQuestion.category,
        });

        return emotionalCheckInQuestionsService.formatQuestion(templateQuestion);
      }

      // Fallback to LLM for personalized follow-ups or when templates exhausted
      logger.debug('[EmotionalCheckIn] Falling back to LLM question generation', {
        sessionId: session.id,
        questionCount: session.questionCount,
      });

      return await this.generateLLMQuestion(session, conversationHistory, routingContext);
    } catch (error) {
      logger.error('[EmotionalCheckIn] Error generating question', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Build routing context from session data
   */
  private async buildRoutingContext(
    session: EmotionalCheckInSession,
    sessionResponses?: Array<{ questionId: string; category: QuestionCategory; value: number }>
  ): Promise<RoutingContext> {
    // Get answered categories and scores from responses
    const answeredCategories = new Set<QuestionCategory>();
    const currentScores = new Map<QuestionCategory, number>();

    if (sessionResponses) {
      for (const response of sessionResponses) {
        if (response.category) {
          answeredCategories.add(response.category);
          currentScores.set(response.category, response.value);
        }
      }
    }

    // Get baseline scores
    const baseline = await emotionalCheckinTrendsService.getUserBaseline(session.userId);

    return {
      screeningType: session.screeningType,
      questionCount: session.questionCount,
      answeredCategories,
      currentScores,
      baselineScores: baseline.sampleSize > 0 ? {
        anxiety: baseline.anxiety,
        mood: baseline.mood,
        energy: baseline.energy,
        stress: baseline.stress,
      } : undefined,
    };
  }

  /**
   * Generate question using LLM (fallback for personalized questions)
   */
  private async generateLLMQuestion(
    session: EmotionalCheckInSession,
    conversationHistory: ConversationMessage[],
    routingContext: RoutingContext
  ): Promise<CheckInQuestion | null> {
    try {
      const historyContext = conversationHistory
        .slice(-6)
        .map((msg) => `${msg.role === 'assistant' ? 'AI' : 'User'}: ${msg.content}`)
        .join('\n');

      const answeredList = Array.from(routingContext.answeredCategories).join(', ');
      const scoresContext = Array.from(routingContext.currentScores.entries())
        .map(([cat, score]) => `${cat}: ${score}`)
        .join(', ');

      const prompt = `${EMOTIONAL_CHECKIN_SYSTEM_PROMPT}

## Current Session Context
- Session Type: ${session.screeningType}
- Questions Asked: ${session.questionCount}
- Categories Covered: ${answeredList || 'none yet'}
- Current Scores: ${scoresContext || 'none yet'}
- User's Baseline: ${routingContext.baselineScores ? JSON.stringify(routingContext.baselineScores) : 'no historical data'}

## Recent Conversation
${historyContext}

## Instructions
Generate a personalized follow-up question. Consider:
1. Focus on areas showing deviation from baseline
2. Explore patterns that need clarification
3. Keep it warm and conversational
4. ONE question only

Respond with ONLY valid JSON:
{"question": "...", "type": "scale|frequency|text", "scaleRange": {"min": 0, "max": 10, "labels": ["...", "..."]}}`;

      const response = await this.llm.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      let questionData: any;
      try {
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          questionData = JSON.parse(jsonMatch[1]);
        } else {
          questionData = JSON.parse(content);
        }
      } catch (_parseError) {
        logger.warn('[EmotionalCheckIn] Failed to parse LLM response', {
          content: content.substring(0, 200),
        });
        return null;
      }

      return {
        id: `llm_${Date.now()}`,
        question: questionData.question,
        type: questionData.type || 'scale',
        options: questionData.options,
        scaleRange: questionData.scaleRange,
      };
    } catch (error) {
      logger.error('[EmotionalCheckIn] LLM question generation failed', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Complete session and generate insights
   */
  async completeSession(sessionId: string): Promise<EmotionalCheckInSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw ApiError.notFound('Check-in session not found');
    }

    // Calculate duration
    const startedAt = new Date(session.startedAt);
    const completedAt = new Date();
    const durationSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);

    // Analyze results and generate insights
    const analysis = await this.analyzeResults(sessionId);

    // Update session
    const result = await query<SessionRow>(
      `UPDATE emotional_checkin_sessions 
       SET completed_at = CURRENT_TIMESTAMP,
           duration_seconds = $1,
           overall_anxiety_score = $2,
           overall_mood_score = $3,
           risk_level = $4,
           insights = $5,
           recommendations = $6
       WHERE id = $7
       RETURNING *`,
      [
        durationSeconds,
        analysis.anxietyScore,
        analysis.moodScore,
        analysis.riskLevel,
        JSON.stringify(analysis.insights),
        JSON.stringify(analysis.recommendations),
        sessionId,
      ]
    );

    return this.mapRowToSession(result.rows[0]);
  }

  /**
   * Analyze results and generate insights
   */
  private async analyzeResults(sessionId: string): Promise<{
    anxietyScore: number;
    moodScore: number;
    riskLevel: RiskLevel;
    insights: Record<string, any>;
    recommendations: Array<{
      type: string;
      title: string;
      description: string;
      duration?: number;
    }>;
  }> {
    // Get all responses for this session
    const responses = await this.getSessionResponses(sessionId);

    // Calculate scores
    const anxietyScore = this.calculateAnxietyScore(responses);
    const moodScore = this.calculateMoodScore(responses);

    // Generate insights
    const insights = await emotionalCheckinInsightsService.generateInsights(
      responses[0]?.userId || '',
      sessionId,
      responses
    );

    // Generate recommendations
    const recommendations = await emotionalCheckinInsightsService.generateRecommendations(
      anxietyScore,
      moodScore,
      responses
    );

    // Determine risk level
    const riskLevel = await this.determineRiskLevel(anxietyScore, moodScore, responses);

    return {
      anxietyScore,
      moodScore,
      riskLevel,
      insights,
      recommendations,
    };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<EmotionalCheckInSession | null> {
    const result = await query<SessionRow>(
      `SELECT * FROM emotional_checkin_sessions WHERE id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSession(result.rows[0]);
  }

  /**
   * Get session responses
   */
  private async getSessionResponses(sessionId: string): Promise<any[]> {
    // Get responses from all linked tables
    const [moodLogs, stressLogs, energyLogs] = await Promise.all([
      query(`SELECT * FROM mood_logs WHERE emotional_checkin_session_id = $1`, [sessionId]),
      query(`SELECT * FROM stress_logs WHERE emotional_checkin_session_id = $1`, [sessionId]),
      query(`SELECT * FROM energy_logs WHERE emotional_checkin_session_id = $1`, [sessionId]),
    ]);

    return [
      ...moodLogs.rows.map((r) => ({ ...r, type: 'mood', userId: r.user_id })),
      ...stressLogs.rows.map((r) => ({ ...r, type: 'stress', userId: r.user_id })),
      ...energyLogs.rows.map((r) => ({ ...r, type: 'energy', userId: r.user_id })),
    ];
  }

  /**
   * Calculate anxiety score from responses
   */
  private calculateAnxietyScore(responses: any[]): number {
    // Extract anxiety-related scores
    const anxietyScores: number[] = [];

    for (const response of responses) {
      if (response.type === 'stress' && response.stress_rating) {
        anxietyScores.push(response.stress_rating);
      } else if (response.type === 'mood' && response.anxiety_rating) {
        anxietyScores.push(response.anxiety_rating);
      }
    }

    if (anxietyScores.length === 0) return 0;
    return anxietyScores.reduce((sum, score) => sum + score, 0) / anxietyScores.length;
  }

  /**
   * Calculate mood score from responses
   */
  private calculateMoodScore(responses: any[]): number {
    // Extract mood-related scores
    const moodScores: number[] = [];

    for (const response of responses) {
      if (response.type === 'mood' && response.happiness_rating) {
        moodScores.push(response.happiness_rating);
      }
    }

    if (moodScores.length === 0) return 5; // Default neutral
    return moodScores.reduce((sum, score) => sum + score, 0) / moodScores.length;
  }

  /**
   * Determine risk level
   */
  private async determineRiskLevel(
    anxietyScore: number,
    moodScore: number,
    responses: any[]
  ): Promise<RiskLevel> {
    // Check for crisis indicators in responses
    for (const response of responses) {
      if (response.note) {
        const crisisCheck = await crisisDetectionService.detectCrisisKeywords(response.note);
        if (crisisCheck.isCrisis) {
          if (crisisCheck.severity === 'critical') return 'critical';
          if (crisisCheck.severity === 'high') return 'high';
        }
      }
    }

    // Risk based on scores
    if (anxietyScore >= 8 || moodScore <= 2) return 'high';
    if (anxietyScore >= 6 || moodScore <= 4) return 'moderate';
    if (anxietyScore >= 4 || moodScore <= 6) return 'low';
    return 'none';
  }

  /**
   * Get check-in history for user
   */
  async getCheckInHistory(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    sessions: EmotionalCheckInSession[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    const [sessionsResult, countResult] = await Promise.all([
      query<SessionRow>(
        `SELECT * FROM emotional_checkin_sessions 
         WHERE user_id = $1 AND completed_at IS NOT NULL
         ORDER BY completed_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM emotional_checkin_sessions 
         WHERE user_id = $1 AND completed_at IS NOT NULL`,
        [userId]
      ),
    ]);

    return {
      sessions: sessionsResult.rows.map((row) => this.mapRowToSession(row)),
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  }

  /**
   * Analyze camera image for emotional check-in
   */
  async analyzeCameraImage(
    sessionId: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<{
    moodIndicators: {
      facialExpression: string;
      energyLevel: string;
      stressIndicators: string[];
      overallAssessment: string;
    };
    scores: {
      mood: number;
      energy: number;
      stress: number;
    };
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw ApiError.notFound('Check-in session not found');
    }

    try {
      // Use AI Coach service to analyze the image (body_photo type for facial analysis)
      const analysisResult = await aiCoachService.analyzeHealthImage(
        imageBuffer,
        'body_photo',
        undefined,
        mimeType
      );

      // Extract wellbeing data from the analysis
      const wellbeingData = await wellbeingAutoTrackerService.extractWellbeingFromImageAnalysis(
        session.userId,
        analysisResult.analysis,
        'body_photo'
      );

      // Extract mood indicators from analysis text
      const moodIndicators = await this.extractMoodIndicatorsFromAnalysis(analysisResult.analysis);
      
      // Calculate scores from extracted data
      const scores = {
        mood: this.calculateMoodFromExtraction(wellbeingData),
        energy: this.calculateEnergyFromExtraction(wellbeingData),
        stress: this.calculateStressFromExtraction(wellbeingData),
      };

      // Store extracted data in wellbeing tables
      if (wellbeingData.entries.length > 0) {
        const createResults = await wellbeingAutoTrackerService.autoCreateEntries(
          session.userId,
          wellbeingData.entries
        );
        
        // Link to session using the returned IDs
        for (const result of createResults) {
          if (result.success && result.id) {
            if (result.type === 'mood') {
              await query(
                `UPDATE mood_logs SET emotional_checkin_session_id = $1 WHERE id = $2`,
                [sessionId, result.id]
              );
            } else if (result.type === 'stress') {
              await query(
                `UPDATE stress_logs SET emotional_checkin_session_id = $1 WHERE id = $2`,
                [sessionId, result.id]
              );
            } else if (result.type === 'energy') {
              await query(
                `UPDATE energy_logs SET emotional_checkin_session_id = $1 WHERE id = $2`,
                [sessionId, result.id]
              );
            }
          }
        }
      }

      return {
        moodIndicators,
        scores,
      };
    } catch (error) {
      logger.error('[EmotionalCheckIn] Error analyzing camera image', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ApiError.internal('Failed to analyze camera image');
    }
  }

  /**
   * Extract mood indicators from analysis text using LLM
   */
  private async extractMoodIndicatorsFromAnalysis(analysisText: string): Promise<{
    facialExpression: string;
    energyLevel: string;
    stressIndicators: string[];
    overallAssessment: string;
  }> {
    try {
      const prompt = `Analyze the following facial/wellness analysis and extract mood indicators in JSON format.

Analysis: "${analysisText.substring(0, 2000)}"

Return JSON with this exact structure:
{
  "facialExpression": "Brief description (e.g., 'neutral and relaxed', 'showing signs of fatigue', 'appears stressed')",
  "energyLevel": "Energy assessment (e.g., 'appears energetic', 'showing signs of fatigue', 'moderate energy')",
  "stressIndicators": ["list of visible stress indicators if any, empty array if none"],
  "overallAssessment": "Brief overall mood/wellbeing assessment"
}

Respond with ONLY valid JSON, no additional text.`;

      const response = await this.llm.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Parse JSON from response
      let extracted: any;
      try {
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          extracted = JSON.parse(jsonMatch[1]);
        } else {
          extracted = JSON.parse(content);
        }
      } catch (parseError) {
        logger.warn('[EmotionalCheckIn] Failed to parse mood indicators from LLM', {
          content: content.substring(0, 200),
          error: parseError,
        });
        // Fallback to simple extraction
        return this.simpleMoodExtraction(analysisText);
      }

      return {
        facialExpression: extracted.facialExpression || 'neutral',
        energyLevel: extracted.energyLevel || 'moderate',
        stressIndicators: Array.isArray(extracted.stressIndicators) ? extracted.stressIndicators : [],
        overallAssessment: extracted.overallAssessment || 'Analysis complete',
      };
    } catch (error) {
      logger.error('[EmotionalCheckIn] Error extracting mood indicators', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fallback to simple extraction
      return this.simpleMoodExtraction(analysisText);
    }
  }

  /**
   * Simple fallback mood extraction
   */
  private simpleMoodExtraction(analysisText: string): {
    facialExpression: string;
    energyLevel: string;
    stressIndicators: string[];
    overallAssessment: string;
  } {
    const lowerAnalysis = analysisText.toLowerCase();
    
    let facialExpression = 'neutral';
    if (lowerAnalysis.includes('tired') || lowerAnalysis.includes('fatigue')) {
      facialExpression = 'showing signs of fatigue';
    } else if (lowerAnalysis.includes('stressed') || lowerAnalysis.includes('tense')) {
      facialExpression = 'appears stressed or tense';
    } else if (lowerAnalysis.includes('relaxed') || lowerAnalysis.includes('calm')) {
      facialExpression = 'appears relaxed and calm';
    }

    let energyLevel = 'moderate';
    if (lowerAnalysis.includes('energetic') || lowerAnalysis.includes('alert')) {
      energyLevel = 'appears energetic';
    } else if (lowerAnalysis.includes('tired') || lowerAnalysis.includes('fatigue')) {
      energyLevel = 'showing signs of fatigue';
    }

    const stressIndicators: string[] = [];
    if (lowerAnalysis.includes('furrowed brow') || lowerAnalysis.includes('tense')) {
      stressIndicators.push('Visible tension in facial features');
    }
    if (lowerAnalysis.includes('dark circles') || lowerAnalysis.includes('bags')) {
      stressIndicators.push('Signs of fatigue around eyes');
    }

    return {
      facialExpression,
      energyLevel,
      stressIndicators,
      overallAssessment: `Based on facial analysis: ${facialExpression}, ${energyLevel}.`,
    };
  }

  /**
   * Calculate mood score from extraction
   */
  private calculateMoodFromExtraction(wellbeingData: any): number {
    if (wellbeingData.entries?.length > 0) {
      const moodEntry = wellbeingData.entries.find((e: any) => e.type === 'mood');
      if (moodEntry?.data?.happinessRating) {
        return moodEntry.data.happinessRating;
      }
    }
    return 5; // Default neutral
  }

  /**
   * Calculate energy score from extraction
   */
  private calculateEnergyFromExtraction(wellbeingData: any): number {
    if (wellbeingData.entries?.length > 0) {
      const energyEntry = wellbeingData.entries.find((e: any) => e.type === 'energy');
      if (energyEntry?.data?.energyRating) {
        return energyEntry.data.energyRating;
      }
    }
    return 5; // Default neutral
  }

  /**
   * Calculate stress score from extraction
   */
  private calculateStressFromExtraction(wellbeingData: any): number {
    if (wellbeingData.entries?.length > 0) {
      const stressEntry = wellbeingData.entries.find((e: any) => e.type === 'stress');
      if (stressEntry?.data?.stressRating) {
        return stressEntry.data.stressRating;
      }
    }
    return 0; // Default no stress
  }

  /**
   * Map database row to session object
   */
  private mapRowToSession(row: SessionRow): EmotionalCheckInSession {
    return {
      id: row.id,
      userId: row.user_id,
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      durationSeconds: row.duration_seconds || undefined,
      questionCount: row.question_count,
      screeningType: row.screening_type as ScreeningType,
      overallAnxietyScore: row.overall_anxiety_score ? parseFloat(String(row.overall_anxiety_score)) : undefined,
      overallMoodScore: row.overall_mood_score ? parseFloat(String(row.overall_mood_score)) : undefined,
      riskLevel: row.risk_level as RiskLevel,
      crisisDetected: row.crisis_detected,
      insights: row.insights || {},
      recommendations: Array.isArray(row.recommendations) ? row.recommendations : [],
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  // ============================================
  // SESSION RECOVERY METHODS
  // ============================================

  /**
   * Find incomplete sessions for user (for recovery)
   */
  async findIncompleteSessions(userId: string): Promise<EmotionalCheckInSession[]> {
    const result = await query<SessionRow>(
      `SELECT * FROM emotional_checkin_sessions
       WHERE user_id = $1
         AND completed_at IS NULL
         AND expired_at IS NULL
         AND started_at > NOW() - INTERVAL '24 hours'
       ORDER BY started_at DESC
       LIMIT 5`,
      [userId]
    );

    return result.rows.map((row) => this.mapRowToSession(row));
  }

  /**
   * Recover an incomplete session
   */
  async recoverSession(sessionId: string, userId: string): Promise<{
    recovered: boolean;
    session?: EmotionalCheckInSession;
    nextQuestion?: CheckInQuestion;
    reason?: string;
  }> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { recovered: false, reason: 'session_not_found' };
    }

    if (session.userId !== userId) {
      return { recovered: false, reason: 'unauthorized' };
    }

    if (session.completedAt) {
      return { recovered: false, reason: 'already_completed' };
    }

    // Check session age (24 hour max)
    const sessionAge = Date.now() - new Date(session.startedAt).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      await this.expireSession(sessionId);
      return { recovered: false, reason: 'expired' };
    }

    // Update last activity
    await query(
      `UPDATE emotional_checkin_sessions
       SET last_activity_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sessionId]
    );

    // Generate next question
    const nextQuestion = await this.generateNextQuestion(session, []);

    logger.info('[EmotionalCheckIn] Session recovered', {
      sessionId,
      userId,
      questionCount: session.questionCount,
    });

    return {
      recovered: true,
      session,
      nextQuestion: nextQuestion || undefined,
    };
  }

  /**
   * Expire an old session
   */
  async expireSession(sessionId: string): Promise<void> {
    await query(
      `UPDATE emotional_checkin_sessions
       SET expired_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sessionId]
    );

    logger.info('[EmotionalCheckIn] Session expired', { sessionId });
  }

  /**
   * Cleanup old incomplete sessions (called by cron job)
   */
  async cleanupOldSessions(): Promise<number> {
    const result = await query(
      `UPDATE emotional_checkin_sessions
       SET expired_at = CURRENT_TIMESTAMP
       WHERE completed_at IS NULL
         AND expired_at IS NULL
         AND started_at < NOW() - INTERVAL '24 hours'
       RETURNING id`
    );

    const count = result.rows.length;
    if (count > 0) {
      logger.info('[EmotionalCheckIn] Cleaned up old sessions', { count });
    }

    return count;
  }

  // ============================================
  // TENSORFLOW CAMERA EMOTION PROCESSING
  // ============================================

  /**
   * Process TensorFlow.js emotion analysis from client
   * This is the new on-device analysis (faster, cheaper, more private)
   */
  async processTensorFlowEmotionAnalysis(
    userId: string,
    input: CameraEmotionInput
  ): Promise<{
    moodScore: number;
    stressScore: number;
    energyScore: number;
    insights: string[];
    emotionalProfile: {
      dominant: string;
      distribution: Record<string, number>;
      engagement: number;
    };
  }> {
    const session = await this.getSession(input.sessionId);
    if (!session) {
      throw ApiError.notFound('Check-in session not found');
    }

    if (session.userId !== userId) {
      throw ApiError.forbidden('Unauthorized access to session');
    }

    // Process using camera emotion service
    const result = await cameraEmotionService.processEmotionAnalysis(userId, input);

    logger.info('[EmotionalCheckIn] TensorFlow emotion analysis processed', {
      sessionId: input.sessionId,
      dominant: input.dominant,
      moodScore: result.moodScore,
      stressScore: result.stressScore,
    });

    return {
      moodScore: result.moodScore,
      stressScore: result.stressScore,
      energyScore: result.energyScore,
      insights: result.insights,
      emotionalProfile: result.emotionalProfile,
    };
  }

  // ============================================
  // RESPONSE STORAGE (EXPLICIT)
  // ============================================

  /**
   * Store response in the explicit responses table
   */
  async storeExplicitResponse(
    sessionId: string,
    userId: string,
    questionIndex: number,
    questionId: string,
    questionText: string,
    questionType: 'scale' | 'frequency' | 'text',
    questionCategory: QuestionCategory | undefined,
    responseValue: number | string,
    responseText?: string
  ): Promise<void> {
    try {
      // Parse response value to numeric
      const numericValue = typeof responseValue === 'number'
        ? responseValue
        : emotionalCheckInQuestionsService.parseResponseValue(responseValue, questionType);

      // Check for crisis keywords
      const textToCheck = responseText || (typeof responseValue === 'string' ? responseValue : '');
      const crisisCheck = await crisisDetectionService.detectCrisisKeywords(textToCheck);

      await query(
        `INSERT INTO emotional_checkin_responses
         (session_id, user_id, question_index, question_id, question_text, question_type, question_category,
          response_value, response_text, response_raw, crisis_flag, crisis_severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (session_id, question_index) DO UPDATE SET
           response_value = EXCLUDED.response_value,
           response_text = EXCLUDED.response_text,
           response_raw = EXCLUDED.response_raw,
           crisis_flag = EXCLUDED.crisis_flag,
           crisis_severity = EXCLUDED.crisis_severity,
           responded_at = CURRENT_TIMESTAMP`,
        [
          sessionId,
          userId,
          questionIndex,
          questionId,
          questionText,
          questionType,
          questionCategory || null,
          numericValue,
          responseText || null,
          String(responseValue),
          crisisCheck.isCrisis,
          crisisCheck.severity || null,
        ]
      );

      logger.debug('[EmotionalCheckIn] Response stored', {
        sessionId,
        questionIndex,
        questionId,
        category: questionCategory,
      });
    } catch (error) {
      logger.error('[EmotionalCheckIn] Error storing explicit response', {
        sessionId,
        questionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - continue with check-in
    }
  }

  /**
   * Get all explicit responses for a session
   */
  async getExplicitResponses(sessionId: string): Promise<Array<{
    questionIndex: number;
    questionId: string;
    questionText: string;
    questionType: string;
    questionCategory: string | null;
    responseValue: number;
    responseText: string | null;
    crisisFlag: boolean;
    respondedAt: string;
  }>> {
    const result = await query(
      `SELECT question_index, question_id, question_text, question_type, question_category,
              response_value, response_text, crisis_flag, responded_at
       FROM emotional_checkin_responses
       WHERE session_id = $1
       ORDER BY question_index ASC`,
      [sessionId]
    );

    return result.rows.map((row: any) => ({
      questionIndex: row.question_index,
      questionId: row.question_id,
      questionText: row.question_text,
      questionType: row.question_type,
      questionCategory: row.question_category,
      responseValue: parseFloat(row.response_value),
      responseText: row.response_text,
      crisisFlag: row.crisis_flag,
      respondedAt: row.responded_at?.toISOString(),
    }));
  }
}

export const emotionalCheckInService = new EmotionalCheckInService();
export default emotionalCheckInService;

