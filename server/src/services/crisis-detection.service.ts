/**
 * @file Crisis Detection Service
 * @description Detects crisis situations and triggers emergency protocols
 */

import { logger } from './logger.service.js';
import { query } from '../database/pg.js';
import type { EmotionDetection } from './emotion-detection.service.js';

// ============================================
// TYPES
// ============================================

export interface CrisisDetection {
  isCrisis: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
  reasoning?: string;
  confidence: number; // 0-100
}

export interface DistressLevel {
  level: 'none' | 'mild' | 'moderate' | 'severe' | 'critical';
  score: number; // 0-100
  indicators: string[];
}

export interface CrisisResources {
  country?: string;
  hotlines: Array<{
    name: string;
    number: string;
    type: 'suicide_prevention' | 'crisis_text' | 'emergency' | 'local';
    description?: string;
  }>;
}

// Crisis keywords (from story requirements)
const CRISIS_KEYWORDS = {
  critical: [
    'hurt myself',
    'kill myself',
    'end it all',
    'suicide',
    'end my life',
    'don\'t want to be here',
    'don\'t want to live',
    'rather be dead',
    'better off dead',
    'nobody would miss me',
    'everyone would be better without me',
  ],
  high: [
    'can\'t take it anymore',
    'can\'t go on',
    'give up',
    'hopeless',
    'no way out',
    'trapped',
    'desperate',
    'nothing matters',
    'pointless',
  ],
  medium: [
    'want to die',
    'thinking about dying',
    'wish I was dead',
    'want to disappear',
    'want to stop existing',
    'can\'t cope',
    'overwhelmed',
    'breaking down',
  ],
  low: [
    'really depressed',
    'extremely sad',
    'miserable',
    'can\'t handle',
    'too much',
    'stressed out',
  ],
};

// Default crisis resources (US)
const DEFAULT_CRISIS_RESOURCES: CrisisResources = {
  country: 'US',
  hotlines: [
    {
      name: 'National Suicide Prevention Lifeline',
      number: '988',
      type: 'suicide_prevention',
      description: '24/7 free and confidential support for people in distress',
    },
    {
      name: 'Crisis Text Line',
      number: 'Text HOME to 741741',
      type: 'crisis_text',
      description: 'Free 24/7 crisis support via text message',
    },
    {
      name: 'Emergency Services',
      number: '911',
      type: 'emergency',
      description: 'For life-threatening emergencies',
    },
  ],
};

// ============================================
// SERVICE CLASS
// ============================================

class CrisisDetectionService {
  /**
   * Detect crisis keywords in text
   */
  async detectCrisisKeywords(text: string): Promise<CrisisDetection> {
    try {
      const lowerText = text.toLowerCase();
      const detectedKeywords: string[] = [];
      let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let severityScore = 0;

      // Check for critical keywords
      for (const keyword of CRISIS_KEYWORDS.critical) {
        if (lowerText.includes(keyword)) {
          detectedKeywords.push(keyword);
          maxSeverity = 'critical';
          severityScore = Math.max(severityScore, 100);
        }
      }

      // Check for high severity keywords (only if no critical found)
      if (maxSeverity !== 'critical') {
        for (const keyword of CRISIS_KEYWORDS.high) {
          if (lowerText.includes(keyword)) {
            detectedKeywords.push(keyword);
            maxSeverity = 'high';
            severityScore = Math.max(severityScore, 75);
          }
        }
      }

      // Check for medium severity keywords (only if no critical/high found)
      if (maxSeverity !== 'critical' && maxSeverity !== 'high') {
        for (const keyword of CRISIS_KEYWORDS.medium) {
          if (lowerText.includes(keyword)) {
            detectedKeywords.push(keyword);
            maxSeverity = 'medium';
            severityScore = Math.max(severityScore, 50);
          }
        }
      }

      // Check for low severity keywords (only if no higher severity found)
      if (
        maxSeverity !== 'critical' &&
        maxSeverity !== 'high' &&
        maxSeverity !== 'medium'
      ) {
        for (const keyword of CRISIS_KEYWORDS.low) {
          if (lowerText.includes(keyword)) {
            detectedKeywords.push(keyword);
            maxSeverity = 'low';
            severityScore = Math.max(severityScore, 25);
          }
        }
      }

      const isCrisis = detectedKeywords.length > 0 && maxSeverity !== 'low';

      // Calculate confidence based on keyword count and severity
      let confidence = 0;
      if (detectedKeywords.length > 0) {
        confidence = Math.min(
          100,
          severityScore + detectedKeywords.length * 10
        );
      }

      const detection: CrisisDetection = {
        isCrisis,
        severity: maxSeverity,
        keywords: detectedKeywords,
        confidence,
        reasoning:
          detectedKeywords.length > 0
            ? `Detected ${detectedKeywords.length} crisis-related keyword(s): ${detectedKeywords.join(', ')}`
            : undefined,
      };

      if (isCrisis) {
        logger.warn('[CrisisDetection] Crisis keywords detected', {
          severity: maxSeverity,
          keywords: detectedKeywords,
          confidence,
          textLength: text.length,
        });
      }

      return detection;
    } catch (error) {
      logger.error('[CrisisDetection] Error detecting crisis keywords', {
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length,
      });
      // On error, return no crisis (safe default)
      return {
        isCrisis: false,
        severity: 'low',
        keywords: [],
        confidence: 0,
      };
    }
  }

  /**
   * Analyze overall distress level from text, emotion, and tone
   */
  async analyzeDistressLevel(
    text: string,
    emotion: EmotionDetection,
    tone?: { intensity?: number; pace?: number; pitch?: number }
  ): Promise<DistressLevel> {
    try {
      // Start with emotion-based score
      let distressScore = 0;
      const indicators: string[] = [];

      // Emotion contribution
      const negativeEmotions: Array<{ category: EmotionDetection['category']; weight: number }> = [
        { category: 'distressed', weight: 100 },
        { category: 'sad', weight: 60 },
        { category: 'anxious', weight: 70 },
        { category: 'stressed', weight: 75 },
        { category: 'angry', weight: 50 },
        { category: 'tired', weight: 30 },
      ];

      const emotionMatch = negativeEmotions.find(e => e.category === emotion.category);
      if (emotionMatch) {
        distressScore += (emotionMatch.weight * emotion.confidence) / 100;
        indicators.push(`Emotion: ${emotion.category} (confidence: ${emotion.confidence}%)`);
      }

      // Crisis keyword contribution
      const crisisDetection = await this.detectCrisisKeywords(text);
      if (crisisDetection.isCrisis) {
        const crisisScore = crisisDetection.severity === 'critical' ? 100 :
                          crisisDetection.severity === 'high' ? 75 :
                          crisisDetection.severity === 'medium' ? 50 : 25;
        distressScore = Math.max(distressScore, crisisScore);
        indicators.push(`Crisis keywords: ${crisisDetection.keywords.join(', ')}`);
      }

      // Tone contribution (if available)
      if (tone) {
        // Higher intensity might indicate distress
        if (tone.intensity && tone.intensity > 0.8) {
          distressScore += 10;
          indicators.push('High voice intensity detected');
        }
        // Faster pace might indicate anxiety
        if (tone.pace && tone.pace > 0.8) {
          distressScore += 10;
          indicators.push('Rapid speech pace detected');
        }
      }

      // Cap score at 100
      distressScore = Math.min(100, Math.round(distressScore));

      // Determine level
      let level: DistressLevel['level'] = 'none';
      if (distressScore >= 80) {
        level = 'critical';
      } else if (distressScore >= 60) {
        level = 'severe';
      } else if (distressScore >= 40) {
        level = 'moderate';
      } else if (distressScore >= 20) {
        level = 'mild';
      }

      if (level !== 'none') {
        logger.warn('[CrisisDetection] Distress level detected', {
          level,
          score: distressScore,
          indicators,
        });
      }

      return {
        level,
        score: distressScore,
        indicators,
      };
    } catch (error) {
      logger.error('[CrisisDetection] Error analyzing distress level', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Safe default
      return {
        level: 'none',
        score: 0,
        indicators: [],
      };
    }
  }

  /**
   * Trigger emergency protocol
   */
  async triggerEmergencyProtocol(callId: string, userId: string): Promise<void> {
    try {
      logger.warn('[CrisisDetection] Emergency protocol triggered', { callId, userId });

      // Update call/conversation to emergency status
      await query(
        `UPDATE voice_calls 
         SET emergency_triggered = true, 
             status = 'active',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2`,
        [callId, userId]
      );

      // Update conversation if it exists
      const callResult = await query<{ conversation_id: string | null }>(
        `SELECT conversation_id FROM voice_calls WHERE id = $1`,
        [callId]
      );

      if (callResult.rows.length > 0 && callResult.rows[0].conversation_id) {
        await query(
          `UPDATE rag_conversations
           SET emergency_triggered = true,
               session_type = 'emergency_support',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [callResult.rows[0].conversation_id]
        );
      }

      // Check if safety team notification is enabled
      const preferencesResult = await query<{ safety_team_notification: boolean }>(
        `SELECT safety_team_notification 
         FROM user_preferences 
         WHERE user_id = $1`,
        [userId]
      );

      if (
        preferencesResult.rows.length > 0 &&
        preferencesResult.rows[0].safety_team_notification === true
      ) {
        // TODO: Send notification to safety team (implement when safety team system is available)
        logger.info('[CrisisDetection] Safety team notification enabled', { userId, callId });
        // For now, just log it - implement actual notification system later
      }

      logger.info('[CrisisDetection] Emergency protocol activated', { callId, userId });
    } catch (error) {
      logger.error('[CrisisDetection] Error triggering emergency protocol', {
        error: error instanceof Error ? error.message : 'Unknown error',
        callId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get crisis resources (crisis hotlines)
   */
  async getCrisisResources(userLocation?: string): Promise<CrisisResources> {
    try {
      // TODO: Implement location-based resource lookup
      // For now, return default US resources
      // In the future, this could:
      // 1. Detect user location from preferences or IP
      // 2. Lookup country-specific resources
      // 3. Include local resources if available

      let resources = DEFAULT_CRISIS_RESOURCES;

      // If user location provided, try to get country-specific resources
      if (userLocation) {
        // TODO: Implement country-specific resource lookup
        // For now, use default
      }

      // Check if user has custom emergency resources configured
      // This would be stored in user_preferences.emergency_resources_configured

      logger.info('[CrisisDetection] Crisis resources retrieved', {
        country: resources.country,
        hotlineCount: resources.hotlines.length,
      });

      return resources;
    } catch (error) {
      logger.error('[CrisisDetection] Error getting crisis resources', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userLocation,
      });
      // Return default resources on error
      return DEFAULT_CRISIS_RESOURCES;
    }
  }

  /**
   * Schedule follow-up check-in (24 hours after emergency session)
   */
  async scheduleFollowUpCheckIn(userId: string, callId: string): Promise<void> {
    try {
      // Schedule follow-up for 24 hours from now
      const followUpTime = new Date();
      followUpTime.setHours(followUpTime.getHours() + 24);

      // TODO: Integrate with notification/scheduling system
      // For now, we'll create a reminder/notification record
      // This should create a notification that triggers in 24 hours

      logger.info('[CrisisDetection] Follow-up check-in scheduled', {
        userId,
        callId,
        followUpTime: followUpTime.toISOString(),
      });

      // Store in database for notification service to pick up
      // We can use the notifications table or a separate follow-ups table
      // For now, log it - implement when notification system supports scheduled notifications
    } catch (error) {
      logger.error('[CrisisDetection] Error scheduling follow-up check-in', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        callId,
      });
      // Don't throw - follow-up is important but not critical to emergency protocol
    }
  }
}

export const crisisDetectionService = new CrisisDetectionService();

