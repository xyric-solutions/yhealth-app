/**
 * @file Camera Emotion Processing Service
 * @description Processes on-device emotion analysis results from TensorFlow.js
 * Converts facial emotion data to wellbeing metrics
 */

import { logger } from './logger.service.js';
import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { moodService } from './wellbeing/mood.service.js';
import { stressService } from './stress.service.js';
import { energyService } from './wellbeing/energy.service.js';

// ============================================
// TYPES
// ============================================

export type EmotionLabel = 'angry' | 'disgust' | 'fear' | 'happy' | 'sad' | 'surprise' | 'neutral';

export interface StressIndicators {
  browFurrow: number; // 0-1
  jawTension: number; // 0-1
  eyeStrain: number; // 0-1
}

export interface CameraEmotionInput {
  sessionId: string;
  dominant: EmotionLabel;
  distribution: Record<EmotionLabel, number>;
  engagement: number; // 0-1
  stressIndicators: StressIndicators;
  averageConfidence: number;
  sampleCount: number;
  analysisWindowMs?: number;
}

export interface ProcessedEmotionResult {
  moodScore: number;
  stressScore: number;
  energyScore: number;
  emotionalProfile: {
    dominant: EmotionLabel;
    distribution: Record<EmotionLabel, number>;
    engagement: number;
  };
  stressIndicators: StressIndicators;
  confidence: number;
  insights: string[];
}

// ============================================
// CONSTANTS
// ============================================

// Emotion to mood score mapping (0-10 scale)
const EMOTION_MOOD_WEIGHTS: Record<EmotionLabel, number> = {
  happy: 9,
  surprise: 7,
  neutral: 5,
  sad: 2,
  fear: 2,
  angry: 2,
  disgust: 1,
};

// Emotion to energy mapping
const EMOTION_ENERGY_WEIGHTS: Record<EmotionLabel, number> = {
  happy: 8,
  surprise: 7,
  angry: 6, // Anger often involves high energy
  fear: 5,
  neutral: 5,
  disgust: 4,
  sad: 2,
};

// High stress emotions
const STRESS_EMOTIONS: EmotionLabel[] = ['angry', 'fear', 'disgust', 'sad'];

/**
 * Clamp a value to the valid rating range (1-10) as INTEGER
 * Database columns expect INTEGER, not decimal
 */
function clampRating(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

// ============================================
// SERVICE CLASS
// ============================================

class CameraEmotionService {
  /**
   * Process camera emotion analysis from client
   * Converts to wellbeing metrics and stores in database
   */
  async processEmotionAnalysis(
    userId: string,
    input: CameraEmotionInput
  ): Promise<ProcessedEmotionResult> {
    const {
      sessionId,
      dominant,
      distribution,
      engagement,
      stressIndicators,
      averageConfidence,
      sampleCount,
    } = input;

    logger.info('[CameraEmotion] Processing emotion analysis', {
      userId,
      sessionId,
      dominant,
      sampleCount,
      confidence: averageConfidence,
    });

    // Validate input
    this.validateInput(input);

    // Calculate wellbeing scores
    const moodScore = this.calculateMoodScore(dominant, distribution);
    const stressScore = this.calculateStressScore(dominant, distribution, stressIndicators);
    const energyScore = this.calculateEnergyScore(dominant, distribution, engagement);

    // Generate insights
    const insights = this.generateInsights(dominant, distribution, stressIndicators, engagement);

    // Store in wellbeing tables
    await this.storeWellbeingData(userId, sessionId, {
      moodScore,
      stressScore,
      energyScore,
      dominant,
      distribution,
      stressIndicators,
      confidence: averageConfidence,
    });

    // Update session with camera analysis
    await this.updateSessionWithCameraAnalysis(sessionId, {
      dominant,
      distribution,
      engagement,
      stressIndicators,
      moodScore,
      stressScore,
      energyScore,
      confidence: averageConfidence,
      sampleCount,
      analyzedAt: new Date().toISOString(),
    });

    const result: ProcessedEmotionResult = {
      moodScore,
      stressScore,
      energyScore,
      emotionalProfile: {
        dominant,
        distribution,
        engagement,
      },
      stressIndicators,
      confidence: averageConfidence,
      insights,
    };

    logger.info('[CameraEmotion] Analysis processed successfully', {
      sessionId,
      moodScore,
      stressScore,
      energyScore,
    });

    return result;
  }

  /**
   * Validate input data
   */
  private validateInput(input: CameraEmotionInput): void {
    const { averageConfidence, sampleCount, distribution } = input;

    // Check confidence threshold
    if (averageConfidence < 0.3) {
      throw ApiError.badRequest(
        'Analysis confidence too low. Please ensure good lighting and face visibility.'
      );
    }

    // Check sample count
    if (sampleCount < 5) {
      throw ApiError.badRequest(
        'Not enough samples collected. Please complete the full analysis.'
      );
    }

    // Validate distribution sums to ~1
    const distributionSum = Object.values(distribution).reduce((sum, val) => sum + val, 0);
    if (Math.abs(distributionSum - 1) > 0.1) {
      logger.warn('[CameraEmotion] Distribution sum not normalized', { distributionSum });
    }
  }

  /**
   * Calculate mood score from emotion data (1-10 scale)
   */
  private calculateMoodScore(
    _dominant: EmotionLabel,
    distribution: Record<EmotionLabel, number>
  ): number {
    // Weighted average of all emotions
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [emotion, ratio] of Object.entries(distribution)) {
      const weight = EMOTION_MOOD_WEIGHTS[emotion as EmotionLabel] || 5;
      weightedSum += weight * ratio;
      totalWeight += ratio;
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 5;
    return clampRating(score); // Ensure 1-10 range
  }

  /**
   * Calculate stress score from emotion data (1-10 scale, higher = more stress)
   */
  private calculateStressScore(
    _dominant: EmotionLabel,
    distribution: Record<EmotionLabel, number>,
    stressIndicators: StressIndicators
  ): number {
    // Emotion-based stress (40% weight)
    const stressEmotionRatio = STRESS_EMOTIONS.reduce(
      (sum, emotion) => sum + (distribution[emotion] || 0),
      0
    );

    // Physical stress indicators (60% weight)
    const { browFurrow, jawTension, eyeStrain } = stressIndicators;
    const physicalStress = browFurrow * 0.4 + jawTension * 0.4 + eyeStrain * 0.2;

    // Combined score (raw is 0-1, scale to 1-10)
    const rawScore = stressEmotionRatio * 0.4 + physicalStress * 0.6;
    // Scale from 0-1 to 1-10 range (add 1 to ensure minimum is 1)
    const score = rawScore * 9 + 1;

    return clampRating(score);
  }

  /**
   * Calculate energy score from emotion data (1-10 scale)
   */
  private calculateEnergyScore(
    _dominant: EmotionLabel,
    distribution: Record<EmotionLabel, number>,
    engagement: number
  ): number {
    // Weighted average of energy from emotions (50% weight)
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [emotion, ratio] of Object.entries(distribution)) {
      const weight = EMOTION_ENERGY_WEIGHTS[emotion as EmotionLabel] || 5;
      weightedSum += weight * ratio;
      totalWeight += ratio;
    }

    const emotionEnergy = totalWeight > 0 ? weightedSum / totalWeight : 5;

    // Engagement contributes to perceived energy (50% weight)
    // Scale engagement (0-1) to 1-10 range
    const engagementEnergy = engagement * 9 + 1;

    const score = emotionEnergy * 0.5 + engagementEnergy * 0.5;
    return clampRating(score);
  }

  /**
   * Generate insights based on emotion analysis
   */
  private generateInsights(
    dominant: EmotionLabel,
    distribution: Record<EmotionLabel, number>,
    stressIndicators: StressIndicators,
    engagement: number
  ): string[] {
    const insights: string[] = [];

    // Dominant emotion insight
    const emotionInsights: Record<EmotionLabel, string> = {
      happy: 'Your facial expressions suggest a positive emotional state.',
      surprise: 'Your expressions show alertness and engagement.',
      neutral: 'Your expressions appear calm and balanced.',
      sad: 'Your expressions suggest you may be feeling down. Consider a mood-lifting activity.',
      fear: 'Your expressions indicate some tension or anxiety.',
      angry: 'Your expressions suggest elevated stress or frustration.',
      disgust: 'Your expressions indicate possible discomfort or displeasure.',
    };

    insights.push(emotionInsights[dominant]);

    // Physical stress insights
    const avgPhysicalStress =
      (stressIndicators.browFurrow + stressIndicators.jawTension + stressIndicators.eyeStrain) / 3;

    if (avgPhysicalStress > 0.6) {
      insights.push(
        'Significant facial tension detected. Consider facial relaxation exercises or a brief break.'
      );
    } else if (stressIndicators.browFurrow > 0.7) {
      insights.push('Elevated brow tension detected. Try relaxing your forehead muscles.');
    } else if (stressIndicators.jawTension > 0.7) {
      insights.push('Jaw tension detected. Consider jaw stretches or relaxation techniques.');
    } else if (stressIndicators.eyeStrain > 0.7) {
      insights.push('Eye strain indicators present. Consider the 20-20-20 rule for eye rest.');
    }

    // Engagement insight
    if (engagement < 0.3) {
      insights.push(
        'Your expressions appear relatively flat. This could indicate fatigue or low energy.'
      );
    } else if (engagement > 0.7) {
      insights.push('High emotional expressiveness detected, indicating active engagement.');
    }

    // Mixed emotions insight
    const hasSignificantMixedEmotions = Object.values(distribution).filter((v) => v > 0.2).length > 2;
    if (hasSignificantMixedEmotions) {
      insights.push(
        'Multiple emotions detected, which is normal. Emotions often blend together.'
      );
    }

    return insights;
  }

  /**
   * Store wellbeing data in appropriate tables
   */
  private async storeWellbeingData(
    userId: string,
    sessionId: string,
    data: {
      moodScore: number;
      stressScore: number;
      energyScore: number;
      dominant: EmotionLabel;
      distribution: Record<EmotionLabel, number>;
      stressIndicators: StressIndicators;
      confidence: number;
    }
  ): Promise<void> {
    try {
      // Create mood log with enhanced context note that includes camera analysis details
      const contextNote = `Camera analysis: ${data.dominant} expression detected (confidence: ${Math.round(data.confidence * 100)}%)`;
      
      const moodLog = await moodService.createMoodLog(userId, {
        mode: 'deep',
        happinessRating: data.moodScore,
        anxietyRating: data.stressScore,
        energyRating: data.energyScore,
        contextNote,
        loggedAt: new Date().toISOString(),
      });

      // Link to session (metadata column doesn't exist, so we only update session_id)
      if (moodLog?.id) {
        await query(
          `UPDATE mood_logs SET emotional_checkin_session_id = $1 WHERE id = $2`,
          [sessionId, moodLog.id]
        );
      }

      // Create stress log
      const stressLog = await stressService.createStressLog(userId, {
        stressRating: data.stressScore,
        checkInType: 'on_demand',
        clientRequestId: `camera_${sessionId}_${Date.now()}`,
        note: `Camera analysis - Physical stress indicators: brow=${Math.round(data.stressIndicators.browFurrow * 100)}%, jaw=${Math.round(data.stressIndicators.jawTension * 100)}%`,
      });

      // Link to session
      if (stressLog?.id) {
        await query(
          `UPDATE stress_logs SET emotional_checkin_session_id = $1 WHERE id = $2`,
          [sessionId, stressLog.id]
        );
      }

      // Create energy log
      const energyLog = await energyService.createEnergyLog(userId, {
        energyRating: data.energyScore,
        contextNote: `Camera analysis engagement level`,
      });

      // Link to session
      if (energyLog?.id) {
        await query(
          `UPDATE energy_logs SET emotional_checkin_session_id = $1 WHERE id = $2`,
          [sessionId, energyLog.id]
        );
      }
    } catch (error) {
      logger.error('[CameraEmotion] Error storing wellbeing data', {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - continue even if storage fails
    }
  }

  /**
   * Update session with camera analysis results
   */
  private async updateSessionWithCameraAnalysis(
    sessionId: string,
    cameraAnalysis: Record<string, any>
  ): Promise<void> {
    try {
      await query(
        `UPDATE emotional_checkin_sessions
         SET camera_analysis = $1,
             last_activity_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(cameraAnalysis), sessionId]
      );
    } catch (error) {
      logger.error('[CameraEmotion] Error updating session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get emotion-to-mood mapping for a single emotion
   */
  getMoodForEmotion(emotion: EmotionLabel): number {
    return EMOTION_MOOD_WEIGHTS[emotion] || 5;
  }

  /**
   * Get stress level description
   */
  getStressDescription(stressScore: number): string {
    if (stressScore >= 8) return 'High stress detected';
    if (stressScore >= 6) return 'Moderate stress detected';
    if (stressScore >= 4) return 'Mild stress detected';
    if (stressScore >= 2) return 'Low stress detected';
    return 'Minimal stress detected';
  }
}

export const cameraEmotionService = new CameraEmotionService();
export default cameraEmotionService;
