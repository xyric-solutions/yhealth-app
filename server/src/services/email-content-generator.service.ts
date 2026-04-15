/**
 * Email Content Generator Service
 * Uses AI to generate personalized email content (digests, coaching, re-engagement).
 */

import { aiProviderService } from './ai-provider.service.js';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================================================
// Types
// ============================================================================

export interface WeeklyDigestContent {
  subject: string;
  highlights: Array<{ icon: string; title: string; description: string }>;
  coachMessage: string;
  insights: string[];
  nextWeekFocus: string;
}

export interface CoachingEmailContent {
  subject: string;
  body: string;
  cta: string;
}

export interface ReEngagementContent {
  subject: string;
  message: string;
  incentives: string[];
}

// ============================================================================
// Service
// ============================================================================

class EmailContentGenerator {
  /**
   * Generate personalized weekly digest content
   */
  async generateWeeklyDigest(userId: string): Promise<WeeklyDigestContent> {
    // Gather user data from the last 7 days
    const [userData, weeklyStats] = await Promise.all([
      this.getUserContext(userId),
      this.getWeeklyStats(userId),
    ]);

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt: `You are a friendly AI health coach writing a personalized weekly email digest.
Write in a warm, encouraging tone. Keep it concise and actionable.
Return ONLY valid JSON with this exact structure:
{
  "subject": "Personalized email subject line (max 60 chars)",
  "highlights": [{"icon": "emoji", "title": "short title", "description": "1 sentence"}],
  "coachMessage": "2-3 sentence personalized coaching message",
  "insights": ["insight 1", "insight 2"],
  "nextWeekFocus": "1 sentence focus area for next week"
}`,
        userPrompt: `Generate a weekly digest email for this user:
Name: ${userData.firstName}
Weekly Stats: ${JSON.stringify(weeklyStats)}
Goals: ${userData.activeGoals}`,
        maxTokens: 800,
        temperature: 0.7,
        jsonMode: true,
      });

      const parsed = JSON.parse(response.content);
      return {
        subject: parsed.subject || `${userData.firstName}, here's your week in review`,
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 4) : [],
        coachMessage: parsed.coachMessage || 'Keep up the great work this week!',
        insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 3) : [],
        nextWeekFocus: parsed.nextWeekFocus || 'Stay consistent with your daily habits.',
      };
    } catch (error) {
      logger.error('[EmailContentGenerator] Failed to generate weekly digest', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback content
      return {
        subject: `${userData.firstName}, your weekly health summary`,
        highlights: [{
          icon: '📊',
          title: 'Week Complete',
          description: 'You completed another week of your health journey!',
        }],
        coachMessage: `Great job staying active this week, ${userData.firstName}! Keep building on your momentum.`,
        insights: ['Consistency is key to long-term results.'],
        nextWeekFocus: 'Focus on maintaining your daily routines.',
      };
    }
  }

  /**
   * Generate personalized coaching email content
   */
  async generateCoachingEmail(
    userId: string,
    context: { trigger: string; messagePreview?: string },
  ): Promise<CoachingEmailContent> {
    const userData = await this.getUserContext(userId);

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt: `You are an AI health coach writing a brief, motivating email.
Keep it personal, warm, and under 100 words for the body.
Return ONLY valid JSON: {"subject": "...", "body": "...", "cta": "..."}`,
        userPrompt: `Write a coaching email for ${userData.firstName}.
Trigger: ${context.trigger}
${context.messagePreview ? `Context: ${context.messagePreview}` : ''}
Goals: ${userData.activeGoals}`,
        maxTokens: 400,
        temperature: 0.7,
        jsonMode: true,
      });

      const parsed = JSON.parse(response.content);
      return {
        subject: parsed.subject || 'A message from your AI Coach',
        body: parsed.body || 'Your coach has a new insight for you.',
        cta: parsed.cta || 'Open Chat',
      };
    } catch {
      return {
        subject: 'Your AI Coach has a message for you',
        body: `Hi ${userData.firstName}, your AI coach has a new insight waiting for you. Tap below to read it!`,
        cta: 'Open Chat',
      };
    }
  }

  /**
   * Generate re-engagement content for inactive users
   */
  async generateReEngagementContent(
    userId: string,
    daysAway: number,
  ): Promise<ReEngagementContent> {
    const userData = await this.getUserContext(userId);

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt: `You are a caring AI health coach writing a re-engagement email.
Be warm, non-judgmental, and motivating. Don't guilt-trip.
Return ONLY valid JSON: {"subject": "...", "message": "...", "incentives": ["...", "..."]}`,
        userPrompt: `Write a re-engagement email for ${userData.firstName} who has been away for ${daysAway} days.
Their goals were: ${userData.activeGoals}`,
        maxTokens: 400,
        temperature: 0.7,
        jsonMode: true,
      });

      const parsed = JSON.parse(response.content);
      return {
        subject: parsed.subject || `${userData.firstName}, we've been thinking about you`,
        message: parsed.message || `It's been a while! Your health journey is waiting for you.`,
        incentives: Array.isArray(parsed.incentives) ? parsed.incentives.slice(0, 3) : ['Pick up right where you left off'],
      };
    } catch {
      return {
        subject: `${userData.firstName}, we miss you!`,
        message: `It's been ${daysAway} days since your last check-in. Your AI coach is ready to help you get back on track!`,
        incentives: ['Pick up right where you left off', 'No judgment — every day is a fresh start'],
      };
    }
  }

  // ============================================================================
  // Data Helpers
  // ============================================================================

  private async getUserContext(userId: string): Promise<{
    firstName: string;
    activeGoals: string;
  }> {
    try {
      const userResult = await query<{ first_name: string }>(
        `SELECT first_name FROM users WHERE id = $1`,
        [userId]
      );
      const firstName = userResult.rows[0]?.first_name || 'there';

      const goalsResult = await query<{ title: string; category: string }>(
        `SELECT title, category FROM user_goals WHERE user_id = $1 AND status != 'completed' LIMIT 5`,
        [userId]
      );
      const activeGoals = goalsResult.rows.map(g => `${g.title} (${g.category})`).join(', ') || 'No active goals';

      return { firstName, activeGoals };
    } catch {
      return { firstName: 'there', activeGoals: 'No active goals' };
    }
  }

  private async getWeeklyStats(userId: string): Promise<Record<string, unknown>> {
    try {
      const [workouts, meals, moods, checkIns] = await Promise.all([
        query<{ count: string }>(
          `SELECT COUNT(*) as count FROM workout_logs
           WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
          [userId]
        ),
        query<{ count: string }>(
          `SELECT COUNT(*) as count FROM meal_logs
           WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
          [userId]
        ),
        query<{ avg_score: string }>(
          `SELECT ROUND(AVG(mood_score)::numeric, 1) as avg_score FROM mood_logs
           WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
          [userId]
        ),
        query<{ count: string }>(
          `SELECT COUNT(*) as count FROM daily_checkins
           WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
          [userId]
        ),
      ]);

      return {
        workoutsCompleted: parseInt(workouts.rows[0]?.count || '0'),
        mealsLogged: parseInt(meals.rows[0]?.count || '0'),
        avgMoodScore: parseFloat(moods.rows[0]?.avg_score || '0'),
        checkInsCompleted: parseInt(checkIns.rows[0]?.count || '0'),
      };
    } catch {
      return {};
    }
  }
}

export const emailContentGenerator = new EmailContentGenerator();
