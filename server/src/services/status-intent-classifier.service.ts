import { aiProviderService } from './ai-provider.service.js';
import { logger } from './logger.service.js';
import type { ActivityStatus, StatusDetection } from '../types/activity-status.types.js';

const VALID_STATUSES: ActivityStatus[] = [
  'working', 'sick', 'injury', 'rest', 'vacation', 'travel', 'stress',
  'excellent', 'good', 'fair', 'poor',
];

const KEYWORD_MAP: Record<string, { status: ActivityStatus; confidence: number }[]> = {
  // Working (returning to normal)
  "i'm working": [{ status: 'working', confidence: 0.80 }],
  'working today': [{ status: 'working', confidence: 0.80 }],
  'at work': [{ status: 'working', confidence: 0.75 }],
  'back to work': [{ status: 'working', confidence: 0.85 }],
  'busy working': [{ status: 'working', confidence: 0.75 }],
  'at the office': [{ status: 'working', confidence: 0.75 }],
  "i'm back": [{ status: 'working', confidence: 0.70 }],
  'back to normal': [{ status: 'working', confidence: 0.80 }],
  'feeling better now': [{ status: 'working', confidence: 0.75 }],
  // Sick
  "i'm sick": [{ status: 'sick', confidence: 0.80 }],
  'not feeling well': [{ status: 'sick', confidence: 0.75 }],
  'got the flu': [{ status: 'sick', confidence: 0.80 }],
  'under the weather': [{ status: 'sick', confidence: 0.75 }],
  'feeling unwell': [{ status: 'sick', confidence: 0.75 }],
  'have a fever': [{ status: 'sick', confidence: 0.80 }],
  'have a cold': [{ status: 'sick', confidence: 0.75 }],
  // Injury
  'hurt my': [{ status: 'injury', confidence: 0.75 }],
  'injured my': [{ status: 'injury', confidence: 0.80 }],
  'pulled a muscle': [{ status: 'injury', confidence: 0.80 }],
  'twisted my': [{ status: 'injury', confidence: 0.75 }],
  "i'm injured": [{ status: 'injury', confidence: 0.80 }],
  'sprained my': [{ status: 'injury', confidence: 0.80 }],
  // Travel
  'traveling to': [{ status: 'travel', confidence: 0.80 }],
  "i'm traveling": [{ status: 'travel', confidence: 0.80 }],
  'on a trip': [{ status: 'travel', confidence: 0.75 }],
  'flying out': [{ status: 'travel', confidence: 0.75 }],
  'on the road': [{ status: 'travel', confidence: 0.70 }],
  // Vacation
  'on vacation': [{ status: 'vacation', confidence: 0.85 }],
  'on holiday': [{ status: 'vacation', confidence: 0.80 }],
  'taking time off': [{ status: 'vacation', confidence: 0.75 }],
  'on leave': [{ status: 'vacation', confidence: 0.75 }],
  // Stress
  'so stressed': [{ status: 'stress', confidence: 0.70 }],
  'really stressed': [{ status: 'stress', confidence: 0.70 }],
  'burning out': [{ status: 'stress', confidence: 0.75 }],
  'overwhelmed': [{ status: 'stress', confidence: 0.65 }],
  // Rest
  'need a rest day': [{ status: 'rest', confidence: 0.80 }],
  'taking it easy': [{ status: 'rest', confidence: 0.70 }],
  'recovery day': [{ status: 'rest', confidence: 0.75 }],
  // Excellent / Good / Fair / Poor
  'feeling amazing': [{ status: 'excellent', confidence: 0.80 }],
  'feeling great': [{ status: 'excellent', confidence: 0.75 }],
  'on top of the world': [{ status: 'excellent', confidence: 0.80 }],
  'doing well': [{ status: 'good', confidence: 0.70 }],
  'feeling good': [{ status: 'good', confidence: 0.70 }],
  'feeling okay': [{ status: 'fair', confidence: 0.65 }],
  'could be better': [{ status: 'fair', confidence: 0.65 }],
  'not great': [{ status: 'poor', confidence: 0.65 }],
  'feeling terrible': [{ status: 'poor', confidence: 0.75 }],
  'feeling awful': [{ status: 'poor', confidence: 0.75 }],
};

const CLASSIFICATION_SYSTEM_PROMPT = `You are an activity status classifier for a health coaching app.
Analyze the user's message to detect if they are declaring or implying a change in their activity status.

Activity statuses: working, sick, injury, rest, vacation, travel, stress, excellent, good, fair, poor

Respond with ONLY a JSON object:
{
  "detected": boolean,
  "status": "working" | "sick" | "injury" | "rest" | "vacation" | "travel" | "stress" | "excellent" | "good" | "fair" | "poor" | null,
  "confidence": 0.0-1.0,
  "duration": { "days": number | null, "endDate": "YYYY-MM-DD" | null } | null,
  "reason": "brief description of what was detected" | null,
  "layer": "explicit" | "inferred"
}

Rules:
- "explicit": user directly states their status ("I'm sick", "traveling to X", "I'm working today", "back to work")
- "inferred": emotional language suggests a status ("I can't cope with anything" → stress, "feeling amazing" → excellent)
- "working" means the user is back to their normal routine (at work, busy, productive, recovered)
- "excellent/good/fair/poor" reflect the user's general wellbeing state
- Extract duration if mentioned ("for 3 days", "until Friday", "for a week")
- If no status change detected, return detected: false with low confidence
- Do NOT classify normal complaints as status changes ("this workout was hard" is NOT injury)
- Be conservative: only flag real status changes, not passing mentions`;

const NOT_DETECTED: StatusDetection = {
  detected: false,
  confidence: 0,
  layer: 'explicit',
};

class StatusIntentClassifierService {
  async classifyFromMessage(
    message: string,
    currentStatus?: ActivityStatus,
  ): Promise<StatusDetection> {
    // Input validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NOT_DETECTED;
    }

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
        userPrompt: `Current status: ${currentStatus ?? 'working'}\nUser message: "${message}"`,
        maxTokens: 300,
        temperature: 0.2,
        jsonMode: true,
      });

      const parsed = this.parseClassificationResponse(response.content);
      if (parsed.detected && parsed.status && !VALID_STATUSES.includes(parsed.status)) {
        logger.warn('[StatusClassifier] Invalid status from LLM', { status: parsed.status });
        return NOT_DETECTED;
      }

      // Don't re-detect same status
      if (parsed.detected && parsed.status === currentStatus) {
        return NOT_DETECTED;
      }

      return parsed;
    } catch (error) {
      logger.warn('[StatusClassifier] LLM classification failed, using keyword fallback', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      return this.fallbackKeywordDetection(message);
    }
  }

  fallbackKeywordDetection(message: string): StatusDetection {
    const lower = message.toLowerCase();

    // Check keywords in order of specificity (longer phrases first)
    const sortedKeywords = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length);

    for (const keyword of sortedKeywords) {
      if (lower.includes(keyword)) {
        const match = KEYWORD_MAP[keyword]![0]!;
        return {
          detected: true,
          status: match.status,
          confidence: match.confidence,
          layer: 'explicit',
          reason: keyword,
        };
      }
    }

    return NOT_DETECTED;
  }

  private parseClassificationResponse(content: string): StatusDetection {
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned) as StatusDetection;

      // Validate and sanitize duration
      let duration = parsed.duration ?? undefined;
      if (duration) {
        if (typeof duration.days === 'number' && (duration.days < 0 || duration.days > 365)) {
          duration = undefined;
        }
        if (duration?.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(duration.endDate)) {
          duration = { ...duration, endDate: undefined };
        }
      }

      return {
        detected: parsed.detected ?? false,
        status: parsed.status ?? undefined,
        confidence: Math.max(0, Math.min(1, typeof parsed.confidence === 'number' ? parsed.confidence : 0)),
        duration,
        reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : undefined,
        layer: parsed.layer === 'inferred' ? 'inferred' : 'explicit',
      };
    } catch {
      logger.warn('[StatusClassifier] Failed to parse LLM response', { content: content.slice(0, 200) });
      return NOT_DETECTED;
    }
  }
}

export const statusIntentClassifierService = new StatusIntentClassifierService();
