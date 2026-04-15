/**
 * @file Emotional Check-In Insights Service
 * @description Generates insights and recommendations from check-in responses
 */

// Reserved for future use
// import { logger } from './logger.service.js';
// import { query } from '../database/pg.js';
import { emotionalCheckinTrendsService } from './emotional-checkin-trends.service.js';

// ============================================
// TYPES
// ============================================

export interface Insight {
  category: string;
  description: string;
  severity: 'mild' | 'moderate' | 'significant';
  trend?: 'improving' | 'stable' | 'declining';
}

export interface Recommendation {
  type: string;
  title: string;
  description: string;
  duration?: number; // in minutes
  priority: 'high' | 'medium' | 'low';
}

// ============================================
// SERVICE CLASS
// ============================================

class EmotionalCheckInInsightsService {
  /**
   * Generate insights from check-in responses
   */
  async generateInsights(
    userId: string,
    _sessionId: string,
    responses: any[]
  ): Promise<Record<string, any>> {
    const insights: Insight[] = [];

    // Get user baseline for comparison
    const baseline = await emotionalCheckinTrendsService.getUserBaseline(userId);

    // Analyze anxiety patterns
    const anxietyScores = responses
      .filter((r) => r.type === 'stress' || (r.type === 'mood' && r.anxiety_rating))
      .map((r) => r.stress_rating || r.anxiety_rating || 0);

    if (anxietyScores.length > 0) {
      const avgAnxiety = anxietyScores.reduce((sum, s) => sum + s, 0) / anxietyScores.length;
      const baselineAnxiety = baseline.anxiety || 0;

      if (avgAnxiety > baselineAnxiety + 2) {
        insights.push({
          category: 'anxiety',
          description: `Your responses suggest higher-than-usual anxiety this week compared to your recent average.`,
          severity: avgAnxiety >= 7 ? 'significant' : 'moderate',
          trend: 'declining',
        });
      } else if (avgAnxiety < baselineAnxiety - 1) {
        insights.push({
          category: 'anxiety',
          description: `Your anxiety levels appear lower than your recent average.`,
          severity: 'mild',
          trend: 'improving',
        });
      }
    }

    // Analyze mood patterns
    const moodScores = responses
      .filter((r) => r.type === 'mood' && r.happiness_rating)
      .map((r) => r.happiness_rating || 5);

    if (moodScores.length > 0) {
      const avgMood = moodScores.reduce((sum, s) => sum + s, 0) / moodScores.length;
      const baselineMood = baseline.mood || 5;

      if (avgMood < baselineMood - 2) {
        insights.push({
          category: 'mood',
          description: `Your responses suggest lower mood than your recent average.`,
          severity: avgMood <= 3 ? 'significant' : 'moderate',
          trend: 'declining',
        });
      } else if (avgMood > baselineMood + 1) {
        insights.push({
          category: 'mood',
          description: `Your mood appears more positive than your recent average.`,
          severity: 'mild',
          trend: 'improving',
        });
      }
    }

    // Analyze energy patterns
    const energyScores = responses
      .filter((r) => r.type === 'energy' && r.energy_rating)
      .map((r) => r.energy_rating || 5);

    if (energyScores.length > 0) {
      const avgEnergy = energyScores.reduce((sum, s) => sum + s, 0) / energyScores.length;
      const baselineEnergy = baseline.energy || 5;

      if (avgEnergy < baselineEnergy - 2) {
        insights.push({
          category: 'energy',
          description: `Your energy levels are lower than your recent average.`,
          severity: avgEnergy <= 3 ? 'significant' : 'moderate',
          trend: 'declining',
        });
      }
    }

    return {
      summary: insights.length > 0 ? insights[0].description : 'Your responses suggest patterns worth noticing.',
      details: insights,
      patterns: this.identifyPatterns(responses),
    };
  }

  /**
   * Identify patterns in responses
   */
  private identifyPatterns(responses: any[]): Record<string, any> {
    const patterns: Record<string, any> = {};

    // Check for sleep-related issues
    const sleepResponses = responses.filter((r) => 
      r.context_note?.toLowerCase().includes('sleep') ||
      r.note?.toLowerCase().includes('sleep')
    );

    if (sleepResponses.length > 0) {
      patterns.sleep = {
        mentioned: true,
        correlation: 'Sleep patterns may be affecting your wellbeing.',
      };
    }

    // Check for work-related stress
    const workStress = responses.filter((r) => 
      r.triggers?.includes('Work') ||
      r.context_note?.toLowerCase().includes('work') ||
      r.note?.toLowerCase().includes('work')
    );

    if (workStress.length > 0) {
      patterns.workStress = {
        mentioned: true,
        correlation: 'Work-related factors appear in your responses.',
      };
    }

    return patterns;
  }

  /**
   * Generate recommendations based on scores and responses
   */
  async generateRecommendations(
    anxietyScore: number,
    moodScore: number,
    responses: any[]
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Determine severity
    const severity = this.determineSeverity(anxietyScore, moodScore);

    // Base recommendations on severity
    if (severity === 'high' || anxietyScore >= 7 || moodScore <= 3) {
      // High severity - prioritize grounding and professional support
      recommendations.push({
        type: 'breathing',
        title: '4-7-8 Breathing Exercise',
        description: 'A simple breathing technique to help calm your nervous system. Inhale for 4 counts, hold for 7, exhale for 8. Repeat 4 times.',
        duration: 2,
        priority: 'high',
      });

      recommendations.push({
        type: 'professional',
        title: 'Consider Professional Support',
        description: 'If these feelings persist or feel overwhelming, speaking with a mental health professional can provide valuable support.',
        priority: 'high',
      });
    } else if (severity === 'moderate' || anxietyScore >= 5 || moodScore <= 5) {
      // Moderate severity - mix of grounding and activity
      recommendations.push({
        type: 'meditation',
        title: '5-Minute Mindfulness',
        description: 'Take a few minutes to sit quietly and focus on your breath. Notice thoughts without judgment.',
        duration: 5,
        priority: 'medium',
      });

      recommendations.push({
        type: 'movement',
        title: 'Gentle Movement',
        description: 'A short walk or light stretching can help shift your energy and mood.',
        duration: 10,
        priority: 'medium',
      });
    } else {
      // Low severity - maintenance and prevention
      recommendations.push({
        type: 'gratitude',
        title: 'Gratitude Practice',
        description: 'Take a moment to write down or think about three things you\'re grateful for today.',
        duration: 3,
        priority: 'low',
      });

      recommendations.push({
        type: 'routine',
        title: 'Sleep Routine Check',
        description: 'Consider your sleep schedule. Consistent sleep can significantly impact mood and energy.',
        priority: 'low',
      });
    }

    // Add context-specific recommendations
    const contextRecs = this.getContextSpecificRecommendations(responses);
    recommendations.push(...contextRecs);

    // Limit to 2-4 recommendations
    return recommendations.slice(0, 4);
  }

  /**
   * Determine overall severity
   */
  private determineSeverity(anxietyScore: number, moodScore: number): 'high' | 'moderate' | 'low' {
    if (anxietyScore >= 7 || moodScore <= 3) return 'high';
    if (anxietyScore >= 5 || moodScore <= 5) return 'moderate';
    return 'low';
  }

  /**
   * Get context-specific recommendations
   */
  private getContextSpecificRecommendations(responses: any[]): Recommendation[] {
    const recs: Recommendation[] = [];

    // Check for sleep mentions
    const hasSleepIssues = responses.some((r) =>
      r.context_note?.toLowerCase().includes('sleep') ||
      r.note?.toLowerCase().includes('sleep') ||
      r.context_note?.toLowerCase().includes('tired')
    );

    if (hasSleepIssues) {
      recs.push({
        type: 'sleep',
        title: 'Sleep Hygiene Tips',
        description: 'Consider establishing a consistent bedtime routine. Avoid screens 1 hour before bed, and try to wake up at the same time each day.',
        priority: 'medium',
      });
    }

    // Check for energy issues
    const hasEnergyIssues = responses.some((r) =>
      r.type === 'energy' && r.energy_rating && r.energy_rating <= 4
    );

    if (hasEnergyIssues) {
      recs.push({
        type: 'hydration',
        title: 'Hydration Check',
        description: 'Low energy can sometimes be related to hydration. Try drinking a glass of water and see if you notice a difference.',
        duration: 1,
        priority: 'low',
      });
    }

    return recs;
  }
}

export const emotionalCheckinInsightsService = new EmotionalCheckInInsightsService();
export default emotionalCheckinInsightsService;

