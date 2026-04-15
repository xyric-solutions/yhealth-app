import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// Notification types matching the database enum
type NotificationType =
  | 'achievement'
  | 'goal_progress'
  | 'goal_completed'
  | 'streak'
  | 'reminder'
  | 'plan_update'
  | 'system'
  | 'social'
  | 'integration'
  | 'coaching'
  | 'celebration'
  | 'warning'
  | 'tip';

type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  category?: string;
  priority?: NotificationPriority;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
}

/**
 * Notification Service
 * Creates notifications for various user events
 */
class NotificationService {
  /**
   * Create a notification for a user
   */
  async create(params: CreateNotificationParams): Promise<NotificationRow | null> {
    try {
      const result = await query<NotificationRow>(
        `INSERT INTO notifications (
          user_id, type, title, message, icon, image_url, action_url, action_label,
          category, priority, related_entity_type, related_entity_id, metadata, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, user_id, type, title, message`,
        [
          params.userId,
          params.type,
          params.title,
          params.message,
          params.icon || null,
          params.imageUrl || null,
          params.actionUrl || null,
          params.actionLabel || null,
          params.category || null,
          params.priority || 'normal',
          params.relatedEntityType || null,
          params.relatedEntityId || null,
          params.metadata ? JSON.stringify(params.metadata) : null,
          params.expiresAt || null,
        ]
      );

      logger.debug('Notification created', {
        userId: params.userId,
        type: params.type,
        title: params.title,
      });

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to create notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        params: { userId: params.userId, type: params.type },
      });
      return null;
    }
  }

  /**
   * Welcome notification for new users
   */
  async welcomeUser(userId: string, userName?: string): Promise<void> {
    await this.create({
      userId,
      type: 'celebration',
      title: 'Welcome to Balencia! 🎉',
      message: userName
        ? `Hey ${userName}! Your health journey starts here. We're excited to help you achieve your goals.`
        : "Your health journey starts here. We're excited to help you achieve your goals!",
      icon: '🎉',
      actionUrl: '/onboarding',
      actionLabel: 'Get Started',
      category: 'onboarding',
      priority: 'high',
    });

    // Also send a tip notification
    await this.create({
      userId,
      type: 'tip',
      title: 'Quick Tip: Set Your First Goal',
      message: 'Users who set goals within 24 hours are 3x more likely to succeed. Start with something small and achievable!',
      icon: '💡',
      actionUrl: '/goals',
      actionLabel: 'Set a Goal',
      category: 'onboarding',
      priority: 'normal',
    });
  }

  /**
   * Notification when user creates a new goal
   */
  async goalCreated(
    userId: string,
    goalId: string,
    goalTitle: string,
    isPrimary: boolean
  ): Promise<void> {
    await this.create({
      userId,
      type: 'celebration',
      title: isPrimary ? 'Primary Goal Set! 🎯' : 'New Goal Created! ✨',
      message: isPrimary
        ? `You've set "${goalTitle}" as your primary goal. Let's make it happen!`
        : `New goal added: "${goalTitle}". Every step counts towards your success!`,
      icon: isPrimary ? '🎯' : '✨',
      actionUrl: `/goals`,
      actionLabel: 'View Goal',
      category: 'goals',
      priority: isPrimary ? 'high' : 'normal',
      relatedEntityType: 'goal',
      relatedEntityId: goalId,
    });
  }

  /**
   * Notification when goal progress is updated
   */
  async goalProgressUpdated(
    userId: string,
    goalId: string,
    goalTitle: string,
    progress: number,
    previousProgress: number
  ): Promise<void> {
    // Only notify on significant progress (every 25% or when reaching milestones)
    const milestones = [25, 50, 75, 90, 100];
    const crossedMilestone = milestones.find(
      (m) => progress >= m && previousProgress < m
    );

    if (crossedMilestone) {
      const isComplete = crossedMilestone === 100;
      await this.create({
        userId,
        type: isComplete ? 'goal_completed' : 'goal_progress',
        title: isComplete
          ? 'Goal Completed! 🏆'
          : `${crossedMilestone}% Progress! 🔥`,
        message: isComplete
          ? `Congratulations! You've completed "${goalTitle}". What an achievement!`
          : `You're ${crossedMilestone}% of the way to completing "${goalTitle}". Keep going!`,
        icon: isComplete ? '🏆' : '🔥',
        actionUrl: `/goals`,
        actionLabel: isComplete ? 'Celebrate' : 'View Progress',
        category: 'goals',
        priority: isComplete ? 'high' : 'normal',
        relatedEntityType: 'goal',
        relatedEntityId: goalId,
        metadata: { progress, milestone: crossedMilestone },
      });
    }
  }

  /**
   * Notification when goal is completed
   */
  async goalCompleted(
    userId: string,
    goalId: string,
    goalTitle: string
  ): Promise<void> {
    await this.create({
      userId,
      type: 'goal_completed',
      title: 'Goal Achieved! 🏆',
      message: `Amazing work! You've successfully completed "${goalTitle}". Time to set a new challenge!`,
      icon: '🏆',
      actionUrl: `/goals`,
      actionLabel: 'Set New Goal',
      category: 'goals',
      priority: 'high',
      relatedEntityType: 'goal',
      relatedEntityId: goalId,
    });
  }

  /**
   * Notification when preferences are updated
   */
  async preferencesUpdated(userId: string, updatedFields: string[]): Promise<void> {
    const fieldDescriptions: Record<string, string> = {
      coachingStyle: 'coaching style',
      coachingIntensity: 'coaching intensity',
      notificationChannels: 'notification preferences',
      quietHoursStart: 'quiet hours',
      quietHoursEnd: 'quiet hours',
      timezone: 'timezone',
      language: 'language',
      measurementUnit: 'measurement units',
    };

    const updatedDescriptions = updatedFields
      .map((f) => fieldDescriptions[f])
      .filter(Boolean);

    if (updatedDescriptions.length === 0) return;

    const uniqueDescriptions = [...new Set(updatedDescriptions)];
    const description =
      uniqueDescriptions.length === 1
        ? uniqueDescriptions[0]
        : uniqueDescriptions.slice(0, -1).join(', ') +
          ' and ' +
          uniqueDescriptions.slice(-1);

    await this.create({
      userId,
      type: 'system',
      title: 'Preferences Updated ⚙️',
      message: `Your ${description} ${uniqueDescriptions.length === 1 ? 'has' : 'have'} been updated successfully.`,
      icon: '⚙️',
      actionUrl: '/dashboard?tab=preferences',
      actionLabel: 'View Preferences',
      category: 'settings',
      priority: 'low',
    });
  }

  /**
   * Notification when integration is connected
   */
  async integrationConnected(
    userId: string,
    provider: string,
    integrationId: string
  ): Promise<void> {
    const providerNames: Record<string, string> = {
      google_fit: 'Google Fit',
      apple_health: 'Apple Health',
      fitbit: 'Fitbit',
      garmin: 'Garmin',
      whoop: 'Whoop',
      oura: 'Oura Ring',
      strava: 'Strava',
    };

    const providerName = providerNames[provider] || provider;

    await this.create({
      userId,
      type: 'integration',
      title: `${providerName} Connected! 🔗`,
      message: `Your ${providerName} account is now connected. We'll sync your health data automatically.`,
      icon: '🔗',
      actionUrl: '/dashboard?tab=preferences',
      actionLabel: 'Manage Integrations',
      category: 'integrations',
      priority: 'normal',
      relatedEntityType: 'integration',
      relatedEntityId: integrationId,
    });
  }

  /**
   * Notification when integration is disconnected
   */
  async integrationDisconnected(userId: string, provider: string): Promise<void> {
    const providerNames: Record<string, string> = {
      google_fit: 'Google Fit',
      apple_health: 'Apple Health',
      fitbit: 'Fitbit',
      garmin: 'Garmin',
      whoop: 'Whoop',
      oura: 'Oura Ring',
      strava: 'Strava',
    };

    const providerName = providerNames[provider] || provider;

    await this.create({
      userId,
      type: 'integration',
      title: `${providerName} Disconnected`,
      message: `Your ${providerName} account has been disconnected. You can reconnect anytime from settings.`,
      icon: '🔌',
      actionUrl: '/dashboard?tab=preferences',
      actionLabel: 'Reconnect',
      category: 'integrations',
      priority: 'low',
    });
  }

  /**
   * Notification when assessment is completed
   */
  async assessmentCompleted(
    userId: string,
    assessmentType: 'quick' | 'deep'
  ): Promise<void> {
    await this.create({
      userId,
      type: 'celebration',
      title: 'Assessment Complete! 📋',
      message:
        assessmentType === 'deep'
          ? "Great job completing your deep assessment! We now have a comprehensive understanding of your health profile."
          : "Quick assessment done! Let's set up your personalized goals based on your responses.",
      icon: '📋',
      actionUrl: '/goals',
      actionLabel: 'View Goals',
      category: 'onboarding',
      priority: 'normal',
    });
  }

  /**
   * Notification for streak milestones
   */
  async streakMilestone(
    userId: string,
    streakDays: number,
    streakType: string
  ): Promise<void> {
    const milestoneMessages: Record<number, { title: string; message: string }> = {
      3: {
        title: '3-Day Streak! 🔥',
        message: "You're building momentum! Keep it up for a week to form a lasting habit.",
      },
      7: {
        title: 'Week Streak! 🌟',
        message: 'One full week of consistency! You are doing amazing.',
      },
      14: {
        title: '2-Week Streak! 💪',
        message: "Two weeks strong! You're in the habit-forming zone now.",
      },
      30: {
        title: 'Month Streak! 🏅',
        message: 'A full month of dedication! This is what champions are made of.',
      },
      60: {
        title: '60-Day Streak! 🎖️',
        message: 'Two months of consistency! Your commitment is truly inspiring.',
      },
      90: {
        title: '90-Day Streak! 👑',
        message: "Three months! You've proven you can make lasting changes. Incredible!",
      },
      365: {
        title: 'One Year Streak! 🏆',
        message: "A FULL YEAR! You're a legend. This is a life-changing achievement!",
      },
    };

    const milestone = milestoneMessages[streakDays];
    if (!milestone) return;

    await this.create({
      userId,
      type: 'streak',
      title: milestone.title,
      message: milestone.message,
      icon: streakDays >= 30 ? '🏅' : '🔥',
      actionUrl: '/dashboard',
      actionLabel: 'View Stats',
      category: 'achievements',
      priority: streakDays >= 30 ? 'high' : 'normal',
      metadata: { streakDays, streakType },
    });
  }

  /**
   * Achievement unlocked notification
   */
  async achievementUnlocked(
    userId: string,
    achievementId: string,
    achievementTitle: string,
    achievementDescription: string,
    icon: string
  ): Promise<void> {
    await this.create({
      userId,
      type: 'achievement',
      title: `Achievement Unlocked: ${achievementTitle}`,
      message: achievementDescription,
      icon,
      actionUrl: '/dashboard?tab=achievements',
      actionLabel: 'View Achievements',
      category: 'achievements',
      priority: 'high',
      relatedEntityType: 'achievement',
      relatedEntityId: achievementId,
    });
  }

  /**
   * Daily reminder notification
   */
  async dailyReminder(
    userId: string,
    reminderType: 'workout' | 'meals' | 'water' | 'sleep' | 'general'
  ): Promise<void> {
    const reminders: Record<string, { title: string; message: string; icon: string }> = {
      workout: {
        title: 'Time to Move! 🏃',
        message: "Don't forget your workout today. Even 10 minutes makes a difference!",
        icon: '🏃',
      },
      meals: {
        title: 'Log Your Meals 🍽️',
        message: "Have you logged your meals today? Tracking helps you stay accountable.",
        icon: '🍽️',
      },
      water: {
        title: 'Stay Hydrated 💧',
        message: "Remember to drink water! Staying hydrated boosts energy and focus.",
        icon: '💧',
      },
      sleep: {
        title: 'Wind Down Time 😴',
        message: "It's almost bedtime! Start your wind-down routine for better sleep.",
        icon: '😴',
      },
      general: {
        title: 'Check In 📱',
        message: "How's your day going? Take a moment to log your progress.",
        icon: '📱',
      },
    };

    const reminder = reminders[reminderType];
    if (!reminder) return;

    await this.create({
      userId,
      type: 'reminder',
      title: reminder.title,
      message: reminder.message,
      icon: reminder.icon,
      actionUrl: '/dashboard',
      actionLabel: 'Log Now',
      category: 'reminders',
      priority: 'normal',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
    });
  }

  /**
   * Coaching tip notification
   */
  async coachingTip(userId: string, tip: string, category?: string): Promise<void> {
    await this.create({
      userId,
      type: 'coaching',
      title: 'Coach Tip 💡',
      message: tip,
      icon: '💡',
      category: category || 'coaching',
      priority: 'low',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
    });
  }

  /**
   * Warning notification
   */
  async warning(userId: string, title: string, message: string): Promise<void> {
    await this.create({
      userId,
      type: 'warning',
      title,
      message,
      icon: '⚠️',
      category: 'warnings',
      priority: 'high',
    });
  }

  /**
   * Plan created/updated notification
   */
  async planUpdated(
    userId: string,
    planId: string,
    planName: string,
    isNew: boolean
  ): Promise<void> {
    await this.create({
      userId,
      type: 'plan_update',
      title: isNew ? 'New Plan Created! 📝' : 'Plan Updated 📝',
      message: isNew
        ? `Your "${planName}" plan is ready! Check out your personalized schedule.`
        : `Your "${planName}" plan has been updated with new activities.`,
      icon: '📝',
      actionUrl: '/plans',
      actionLabel: 'View Plan',
      category: 'plans',
      priority: isNew ? 'high' : 'normal',
      relatedEntityType: 'plan',
      relatedEntityId: planId,
    });
  }

  /**
   * Activity logged notification
   */
  async activityLogged(
    userId: string,
    activityType: string,
    activityName: string
  ): Promise<void> {
    await this.create({
      userId,
      type: 'celebration',
      title: 'Activity Logged! ✅',
      message: `Great job completing "${activityName}"! Every activity brings you closer to your goals.`,
      icon: '✅',
      actionUrl: '/dashboard?tab=activity',
      actionLabel: 'View Activity',
      category: 'activity',
      priority: 'low',
      metadata: { activityType },
    });
  }

  /**
   * Profile completed notification
   */
  async profileCompleted(userId: string): Promise<void> {
    await this.create({
      userId,
      type: 'celebration',
      title: 'Profile Complete! 🌟',
      message: 'Your profile is now complete. You are all set to get the most out of Balencia!',
      icon: '🌟',
      actionUrl: '/dashboard?tab=profile',
      actionLabel: 'View Profile',
      category: 'onboarding',
      priority: 'normal',
    });
  }

  /**
   * Onboarding completed notification
   */
  async onboardingCompleted(userId: string): Promise<void> {
    await this.create({
      userId,
      type: 'celebration',
      title: 'Onboarding Complete! 🚀',
      message: "You're all set up! Your personalized health journey begins now. Let's crush those goals!",
      icon: '🚀',
      actionUrl: '/dashboard',
      actionLabel: 'Go to Dashboard',
      category: 'onboarding',
      priority: 'high',
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

export default notificationService;
