/**
 * @file Vision Coaching Service
 * @description Real-time Gemini vision analysis for continuous exercise coaching.
 * Manages per-user vision sessions with exercise state tracking, rep counting,
 * posture correction, and attention monitoring.
 */

import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';

// ============================================
// INTERFACES
// ============================================

export interface PostureSnapshot {
  timestamp: Date;
  exerciseDetected: string | null;
  postureNotes: string;
  confidence: number;
}

export interface VisionSession {
  userId: string;
  startedAt: Date;
  lastFrameAt: Date;
  currentExercise: string | null;
  repCount: number;
  postureHistory: PostureSnapshot[];
  lastCoachingFeedback: string | null;
  lastCoachingAt: Date | null;
  isProcessing: boolean;
  frameInterval: number;
  attentionState: 'focused' | 'distracted' | 'unknown';
  lastFrameHash: number;
  consecutiveErrors: number;
}

export interface VisionAnalysisResult {
  exerciseDetected: string | null;
  repDelta: number;
  postureCorrection: string | null;
  attentionState: 'focused' | 'distracted' | 'unknown';
  foodDetected: string | null;
  objectsDetected: string[];
  confidence: number;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_FRAME_INTERVAL = 3000;
const MAX_FRAME_INTERVAL = 8000;
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_POSTURE_HISTORY = 10;
const MAX_CONCURRENT_SESSIONS = 10;
const COACHING_COOLDOWN_MS = 10000; // Don't repeat same coaching within 10s
const FRAME_SIMILARITY_THRESHOLD = 5; // Skip if brightness delta < 5

// ============================================
// VISION PROMPT
// ============================================

function buildVisionPrompt(session: VisionSession): string {
  const contextParts: string[] = [];

  if (session.currentExercise) {
    contextParts.push(`Current exercise being performed: ${session.currentExercise}`);
    contextParts.push(`Current rep count: ${session.repCount}`);
  }

  if (session.postureHistory.length > 0) {
    const recent = session.postureHistory.slice(-3);
    const historyStr = recent.map(p =>
      `[${p.exerciseDetected || 'unknown'}] ${p.postureNotes} (confidence: ${Math.round(p.confidence * 100)}%)`
    ).join('; ');
    contextParts.push(`Recent posture history: ${historyStr}`);
  }

  const context = contextParts.length > 0
    ? `\n\nSESSION CONTEXT:\n${contextParts.join('\n')}`
    : '';

  return `You are a real-time AI fitness and wellness vision coach analyzing camera frames from a user's device.

ANALYSIS INSTRUCTIONS:
1. Analyze the image for: human body posture, exercise movements, food items, objects (phone, equipment), and attention level.
2. If an exercise is being performed, identify it and determine if a new repetition has been completed since the last frame.
3. Assess posture quality — only flag issues that need immediate correction.
4. Detect if the person appears distracted (looking at phone, not focused on exercise).
5. If food is visible, identify the items.

RESPONSE FORMAT — Return ONLY valid JSON (no markdown, no code fences):
{
  "exerciseDetected": "squat" | "push_up" | "bicep_curl" | "deadlift" | "plank" | "lunge" | "bench_press" | "shoulder_press" | "pull_up" | "sit_up" | "jumping_jack" | "burpee" | "rowing" | "stretching" | null,
  "repDelta": 0 or 1,
  "postureCorrection": "brief correction tip" or null,
  "attentionState": "focused" | "distracted" | "unknown",
  "foodDetected": "food item name" or null,
  "objectsDetected": ["phone", "dumbbell", "mat", etc.],
  "confidence": 0.0 to 1.0
}

RULES:
- repDelta should be 1 ONLY if a full repetition cycle is visible/completed in this frame compared to context. If unsure, use 0.
- postureCorrection should be null if form is acceptable. Only flag significant issues.
- Be concise in corrections — max 15 words.
- If no person is visible, return all nulls with confidence 0.
- objectsDetected should list notable objects visible in the frame.${context}`;
}

// ============================================
// GEMINI VISION CALL
// ============================================

async function callGeminiVision(frameBase64: string, prompt: string): Promise<string> {
  // Vision requires a fast, non-thinking model — gemini-2.5-flash is a thinking model
  // that adds latency and often fails with timeouts on real-time frame analysis.
  // Use gemini-2.5-flash-lite for vision (fast, multimodal, no thinking overhead).
  // Avoid thinking models (gemini-2.5-flash/pro) — internal reasoning tokens add latency.
  const model = env.gemini.visionModel || 'gemini-2.5-flash-lite';
  const apiKey = env.gemini.apiKey;

  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: frameBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      maxOutputTokens: 300,
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

  if (resp.status === 429) {
    throw new Error('RATE_LIMITED');
  }

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini vision error (${resp.status}): ${errText.substring(0, 200)}`);
  }

  const data = await resp.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini vision blocked: ${data.promptFeedback.blockReason}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
  if (!text) {
    throw new Error('Gemini vision returned empty response');
  }

  return text;
}

// ============================================
// FRAME SIMILARITY
// ============================================

/**
 * Simple brightness hash for frame similarity detection.
 * Compares to previous frame — if similar, skip analysis.
 */
function computeFrameHash(base64Data: string): number {
  // Sample ~100 bytes from different positions in the base64 string
  const len = base64Data.length;
  if (len < 200) return 0;
  let sum = 0;
  const step = Math.floor(len / 100);
  for (let i = 0; i < 100; i++) {
    sum += base64Data.charCodeAt(i * step);
  }
  return sum;
}

// ============================================
// SERVICE
// ============================================

class VisionCoachingService {
  private sessions = new Map<string, VisionSession>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  /**
   * Get or create a vision session for a user
   */
  getOrCreateSession(userId: string): VisionSession {
    let session = this.sessions.get(userId);
    if (!session) {
      if (this.sessions.size >= MAX_CONCURRENT_SESSIONS) {
        // Evict oldest session
        let oldestKey: string | null = null;
        let oldestTime = Date.now();
        for (const [key, s] of this.sessions) {
          if (s.lastFrameAt.getTime() < oldestTime) {
            oldestTime = s.lastFrameAt.getTime();
            oldestKey = key;
          }
        }
        if (oldestKey) {
          this.sessions.delete(oldestKey);
          logger.info('[VisionCoaching] Evicted oldest session', { evictedUserId: oldestKey });
        }
      }

      session = {
        userId,
        startedAt: new Date(),
        lastFrameAt: new Date(),
        currentExercise: null,
        repCount: 0,
        postureHistory: [],
        lastCoachingFeedback: null,
        lastCoachingAt: null,
        isProcessing: false,
        frameInterval: DEFAULT_FRAME_INTERVAL,
        attentionState: 'unknown',
        lastFrameHash: 0,
        consecutiveErrors: 0,
      };
      this.sessions.set(userId, session);
      logger.info('[VisionCoaching] Session created', { userId });
    }

    return session;
  }

  /**
   * End a vision session
   */
  endSession(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      logger.info('[VisionCoaching] Session ended', {
        userId,
        duration: Date.now() - session.startedAt.getTime(),
        totalReps: session.repCount,
        lastExercise: session.currentExercise,
      });
      this.sessions.delete(userId);
    }
  }

  /**
   * Analyze a camera frame for the user
   */
  async analyzeFrame(userId: string, frameBase64: string): Promise<VisionAnalysisResult | null> {
    const session = this.getOrCreateSession(userId);

    // Frame similarity check — skip if frame hasn't changed much
    const hash = computeFrameHash(frameBase64);
    if (Math.abs(hash - session.lastFrameHash) < FRAME_SIMILARITY_THRESHOLD && session.postureHistory.length > 0) {
      logger.debug('[VisionCoaching] Skipping similar frame', { userId });
      return null; // null = no new analysis, reuse previous state
    }
    session.lastFrameHash = hash;
    session.lastFrameAt = new Date();

    // Build prompt with session context
    const prompt = buildVisionPrompt(session);

    // Call Gemini vision
    const startTime = Date.now();
    const rawResponse = await callGeminiVision(frameBase64, prompt);
    const analysisTime = Date.now() - startTime;

    logger.debug('[VisionCoaching] Frame analyzed', { userId, analysisTime, responseLength: rawResponse.length });

    // Parse JSON response
    let result: VisionAnalysisResult;
    try {
      // Strip markdown code fences if present
      const cleaned = rawResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      logger.warn('[VisionCoaching] Failed to parse Gemini response', { userId, rawResponse: rawResponse.substring(0, 200) });
      return null;
    }

    // Update session state
    if (result.exerciseDetected) {
      if (session.currentExercise !== result.exerciseDetected) {
        // Exercise changed — reset rep count
        session.currentExercise = result.exerciseDetected;
        session.repCount = result.repDelta;
        logger.info('[VisionCoaching] Exercise changed', { userId, exercise: result.exerciseDetected });
      } else {
        session.repCount += result.repDelta;
      }
    }

    session.attentionState = result.attentionState;

    // Update posture history
    session.postureHistory.push({
      timestamp: new Date(),
      exerciseDetected: result.exerciseDetected,
      postureNotes: result.postureCorrection || 'good form',
      confidence: result.confidence,
    });
    if (session.postureHistory.length > MAX_POSTURE_HISTORY) {
      session.postureHistory.shift();
    }

    // Coaching cooldown — don't repeat same feedback within cooldown
    if (result.postureCorrection && session.lastCoachingFeedback === result.postureCorrection) {
      if (session.lastCoachingAt && (Date.now() - session.lastCoachingAt.getTime()) < COACHING_COOLDOWN_MS) {
        result.postureCorrection = null; // Suppress duplicate
      }
    }
    if (result.postureCorrection) {
      session.lastCoachingFeedback = result.postureCorrection;
      session.lastCoachingAt = new Date();
    }

    // Update result with accumulated rep count
    return {
      ...result,
      repDelta: result.repDelta, // Keep delta for the event
    };
  }

  /**
   * Get current session state for a user
   */
  getSessionState(userId: string): {
    exerciseDetected: string | null;
    repCount: number;
    attentionState: string;
  } | null {
    const session = this.sessions.get(userId);
    if (!session) return null;
    return {
      exerciseDetected: session.currentExercise,
      repCount: session.repCount,
      attentionState: session.attentionState,
    };
  }

  /**
   * Handle rate limiting — increase frame interval
   */
  handleRateLimit(userId: string): number {
    const session = this.sessions.get(userId);
    if (!session) return MAX_FRAME_INTERVAL;

    session.frameInterval = Math.min(session.frameInterval + 2000, MAX_FRAME_INTERVAL);
    logger.warn('[VisionCoaching] Rate limited, increasing interval', {
      userId,
      newInterval: session.frameInterval,
    });
    return session.frameInterval;
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastFrameAt.getTime() > SESSION_EXPIRY_MS) {
        this.sessions.delete(userId);
        logger.info('[VisionCoaching] Session expired', { userId });
      }
    }
  }

  /**
   * Shutdown cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}

export const visionCoachingService = new VisionCoachingService();
