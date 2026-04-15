/**
 * @file Yoga Coach Service
 * @description AI-powered yoga pose analysis using Gemini 2.0 Flash Vision (F7.9)
 */

import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';
import type { CoachingResult, CoachAnalyseResponse, PoseTargets } from '../../../shared/types/domain/yoga.js';
import { coachResponseSchema } from '../validators/yoga-coach.validator.js';

// ============================================
// TYPES
// ============================================

interface AnalysePoseInput {
  poseSlug: string;
  poseName: string;
  frameBase64: string;
  currentAngles: Record<string, number>;
  poseTargets: PoseTargets | null;
  elapsedSeconds: number;
}

// ============================================
// CONSTANTS
// ============================================

const GEMINI_MODEL = process.env['GEMINI_MODEL'] || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 25_000;

const FALLBACK_RESULT: CoachingResult = {
  overallScore: 50,
  overallFeedback: 'Keep practicing! Focus on your alignment.',
  primaryCorrection: 'Hold steady and focus on your breath.',
  bodyParts: [{ part: 'Overall', status: 'needs_adjustment', feedback: 'Continue holding the pose' }],
  breathingCue: 'Breathe deeply through your nose',
  encouragement: 'You are doing great, keep it up!',
  coachEmotion: 'encouraging',
};

// ============================================
// SERVICE
// ============================================

class YogaCoachService {
  /**
   * Analyse a yoga pose frame using Gemini Vision and return coaching feedback.
   * Never throws -- returns a graceful fallback on any failure.
   */
  async analysePose(input: AnalysePoseInput): Promise<CoachAnalyseResponse> {
    try {
      if (!env.gemini.apiKey) {
        logger.warn('Gemini API key not configured, returning fallback coaching result');
        return this.buildResponse(FALLBACK_RESULT);
      }

      const prompt = this.buildPrompt(input);
      const result = await this.callGeminiVision(prompt, input.frameBase64);

      return this.buildResponse(result);
    } catch (error) {
      logger.error('Yoga coach analysis failed, returning fallback', {
        error: error instanceof Error ? error.message : String(error),
        poseSlug: input.poseSlug,
      });
      return this.buildResponse(FALLBACK_RESULT);
    }
  }

  // ------------------------------------------
  // PROMPT CONSTRUCTION
  // ------------------------------------------

  private buildPrompt(input: AnalysePoseInput): string {
    const anglesDescription = Object.entries(input.currentAngles)
      .map(([joint, angle]) => `  ${joint}: ${angle}°`)
      .join('\n');

    const targetsSection = input.poseTargets
      ? '\nTarget joint angles for this pose:\n' +
        Object.entries(input.poseTargets)
          .map(([joint, t]) => `  ${joint}: ${t.angle}° (tolerance: ±${t.tolerance}°)`)
          .join('\n')
      : '';

    return `You are Coach Maya — a passionate, experienced yoga instructor with 15 years of teaching. You have a warm but no-nonsense personality. You genuinely care about your students' progress and safety.

YOUR EMOTIONAL RANGE (use naturally based on what you see):
- "proud" — when form is excellent (score 80+). You light up! "YES! Look at that alignment!"
- "encouraging" — when they're trying hard but need work (score 50-79). Warm and supportive.
- "calm" — during gentle corrections. Soothing, mindful tone.
- "strict" — when you spot a safety risk (bad knee angle, rounded back). Firm but caring: "No no no, straighten that back NOW before you hurt yourself!"
- "concerned" — when alignment is poor or risky (score below 30). Worried about injury.
- "celebratory" — when they nail a hard pose or show big improvement. Pure joy!
- "playful" — for light moments, easy poses, or when they're overthinking. "Relax! You look like a statue!"
- "intense" — for challenging holds, pushing through. "Stay with it! 10 more seconds, you've GOT this!"

Analyse the attached image of a person performing "${input.poseName}" (${input.poseSlug}).
They have been holding for ${input.elapsedSeconds} seconds.

Detected joint angles:
${anglesDescription}
${targetsSection}

Respond ONLY with valid JSON (no markdown fences). ALL fields are REQUIRED:
{
  "overallScore": <0-100>,
  "coachEmotion": "<proud|encouraging|calm|strict|concerned|celebratory|playful|intense>",
  "overallFeedback": "<max 250 chars — speak naturally as Coach Maya, use contractions, be real>",
  "primaryCorrection": "<max 180 chars — the ONE thing to fix right now, spoken directly>",
  "bodyParts": [
    { "part": "<body part>", "status": "correct"|"needs_adjustment"|"incorrect", "feedback": "<max 80 chars — short, direct>" }
  ],
  "breathingCue": "<max 80 chars — natural breathing instruction>",
  "encouragement": "<max 80 chars — genuine, emotional, matches your current mood>"
}

Rules:
- bodyParts: 3-6 entries for key body parts of this pose.
- Talk like a REAL coach — use "you", contractions, short punchy sentences. Not robotic.
- If score 90+: be genuinely excited. If below 30: be concerned about safety first.
- EVEN IF the image only shows partial body (face/upper body), you MUST still:
  1. Score based on what IS visible (posture, shoulder alignment, facial tension).
  2. Provide specific step-by-step instructions for the pose: where to place hands, feet, how to arch the back, breathing pattern, common mistakes to avoid.
  3. Fill bodyParts with coaching tips for ALL key body parts of this pose (hands, feet, spine, hips, shoulders, head) — tell the user exactly what each body part should be doing.
  4. NEVER just say "I can't see" and stop. Always coach. You're teaching, not just judging.
- Track PROGRESS across the session: if elapsed > 20s, comment on hold endurance. If elapsed > 45s, praise their stamina.
- KEEP STRINGS SHORT. Respect character limits strictly.`;
  }

  // ------------------------------------------
  // GEMINI VISION CALL
  // ------------------------------------------

  private async callGeminiVision(prompt: string, frameBase64: string): Promise<CoachingResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.gemini.apiKey}`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: frameBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Empty response from Gemini Vision');
      }

      logger.debug('Gemini Vision raw response', { textLength: text.length, textPreview: text.slice(0, 300) });

      // Step 1: Try parsing the raw text directly (responseMimeType should give clean JSON)
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Step 2: Strip markdown fences and light cleanup
        const clean = text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/,\s*([}\]])/g, '$1')
          .trim();

        // Step 3: Extract JSON object if there's surrounding text
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          // Step 3b: Try repairing truncated JSON by closing open braces/brackets
          const repaired = this.repairTruncatedJson(clean);
          if (repaired) {
            parsed = repaired;
          } else {
            logger.error('No JSON object found in Gemini response', { rawText: text.slice(0, 500) });
            throw new Error('No JSON object found in response');
          }
        }

        if (!parsed) {
          try {
            parsed = JSON.parse(jsonMatch![0]);
          } catch {
            // Step 4: Try repairing truncated JSON
            const repaired = this.repairTruncatedJson(jsonMatch![0]);
            if (repaired) {
              parsed = repaired;
            } else {
              // Step 5: Aggressive fallback — fix single quotes, control chars
              const aggressive = jsonMatch![0]
                .replace(/'/g, '"')
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/,\s*,/g, ',')
                .replace(/,\s*([}\]])/g, '$1');
              parsed = JSON.parse(aggressive);
            }
          }
        }
      }

      // Truncate long strings instead of rejecting
      if (parsed) {
        this.truncateStrings(parsed);
      }

      const validated = coachResponseSchema.safeParse(parsed);

      if (!validated.success) {
        logger.warn('Gemini response failed Zod validation', {
          errors: validated.error.issues,
          rawText: text.slice(0, 500),
        });
        throw new Error('Response validation failed');
      }

      return validated.data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Gemini Vision request timed out after 15s');
      }

      throw error;
    }
  }

  // ------------------------------------------
  // JSON REPAIR HELPERS
  // ------------------------------------------

  /**
   * Attempt to repair truncated JSON by closing open strings, arrays, objects.
   * Returns parsed object or null if repair fails.
   */
  private repairTruncatedJson(text: string): any | null {
    try {
      let repaired = text.trim();

      // If we're inside a string value, close it
      const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        repaired += '"';
      }

      // Remove any trailing comma
      repaired = repaired.replace(/,\s*$/, '');

      // Count open vs close braces/brackets and close them
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;

      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

      const result = JSON.parse(repaired);
      logger.debug('Successfully repaired truncated JSON');
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Truncate string fields to fit Zod schema limits instead of rejecting.
   */
  private truncateStrings(obj: any): void {
    const limits: Record<string, number> = {
      overallFeedback: 300,
      primaryCorrection: 200,
      breathingCue: 100,
      encouragement: 100,
      holdRecommendation: 100,
    };

    for (const [key, maxLen] of Object.entries(limits)) {
      if (typeof obj[key] === 'string' && obj[key].length > maxLen) {
        obj[key] = obj[key].slice(0, maxLen - 1) + '…';
      }
    }

    // Truncate bodyParts feedback
    if (Array.isArray(obj.bodyParts)) {
      for (const bp of obj.bodyParts) {
        if (typeof bp.feedback === 'string' && bp.feedback.length > 150) {
          bp.feedback = bp.feedback.slice(0, 149) + '…';
        }
        if (typeof bp.part === 'string' && bp.part.length > 50) {
          bp.part = bp.part.slice(0, 49) + '…';
        }
      }
    }
  }

  // ------------------------------------------
  // RESPONSE BUILDER
  // ------------------------------------------

  private buildResponse(result: CoachingResult): CoachAnalyseResponse {
    const ttsText = [result.overallFeedback, result.primaryCorrection, result.breathingCue]
      .filter(Boolean)
      .join('. ');

    return {
      coaching: result,
      ttsText: ttsText || undefined,
    };
  }
}

export const yogaCoachService = new YogaCoachService();
