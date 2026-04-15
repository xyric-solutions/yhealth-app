/**
 * @file Summary Delivery Service
 * @description Handles multi-channel delivery of call summaries
 */

import { logger } from './logger.service.js';
import { query } from '../database/pg.js';

// ============================================================================
// Types
// ============================================================================

export type DeliveryChannel = 'app' | 'whatsapp' | 'push';

export interface DeliveryOptions {
  summaryId: string;
  userId: string;
  channels: DeliveryChannel[];
}

export interface DeliveryResult {
  channel: DeliveryChannel;
  success: boolean;
  deliveredAt?: Date;
  error?: string;
}

interface UserPreferencesRow {
  whatsapp_number?: string;
  push_enabled?: boolean;
  preferred_channel?: string;
}

// ============================================================================
// Service
// ============================================================================

class SummaryDeliveryService {
  /**
   * Deliver summary to specified channels
   */
  async deliverSummary(options: DeliveryOptions): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    try {
      // Get summary
      const summaryResult = await query<{
        id: string;
        call_id: string;
        user_id: string;
        summary: string;
        key_insights: string | string[];
        session_type: string;
        duration: number;
      }>(
        `SELECT id, call_id, user_id, summary, key_insights, session_type, duration
         FROM call_summaries WHERE id = $1 AND user_id = $2`,
        [options.summaryId, options.userId]
      );

      if (summaryResult.rows.length === 0) {
        logger.error('[SummaryDelivery] Summary not found', {
          summaryId: options.summaryId,
          userId: options.userId,
        });
        return options.channels.map((channel) => ({
          channel,
          success: false,
          error: 'Summary not found',
        }));
      }

      const summary = summaryResult.rows[0];
      const keyInsights = typeof summary.key_insights === 'string'
        ? JSON.parse(summary.key_insights)
        : summary.key_insights;

      // Get user preferences for delivery
      const prefsResult = await query<UserPreferencesRow>(
        `SELECT whatsapp_number, push_enabled, preferred_channel
         FROM user_preferences WHERE user_id = $1`,
        [options.userId]
      );

      const prefs = prefsResult.rows[0] || {};

      // Deliver to each channel
      for (const channel of options.channels) {
        try {
          let result: DeliveryResult;

          switch (channel) {
            case 'app':
              result = await this.deliverToApp(options.userId, summary, keyInsights);
              break;
            case 'whatsapp':
              result = await this.deliverToWhatsApp(
                options.userId,
                prefs.whatsapp_number,
                summary,
                keyInsights
              );
              break;
            case 'push':
              result = await this.deliverPushNotification(
                options.userId,
                prefs.push_enabled,
                summary
              );
              break;
            default:
              result = { channel, success: false, error: 'Unknown channel' };
          }

          results.push(result);

          // Update delivery status in database
          if (result.success) {
            await this.updateDeliveryStatus(options.summaryId, channel, true);
          }
        } catch (error) {
          logger.error('[SummaryDelivery] Channel delivery failed', {
            channel,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          results.push({
            channel,
            success: false,
            error: error instanceof Error ? error.message : 'Delivery failed',
          });
        }
      }

      logger.info('[SummaryDelivery] Delivery completed', {
        summaryId: options.summaryId,
        results: results.map((r) => ({ channel: r.channel, success: r.success })),
      });

      return results;
    } catch (error) {
      logger.error('[SummaryDelivery] Error delivering summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        summaryId: options.summaryId,
      });
      throw error;
    }
  }

  /**
   * Deliver to app (create in-app notification)
   */
  private async deliverToApp(
    userId: string,
    summary: { summary: string; session_type: string; duration: number },
    keyInsights: string[]
  ): Promise<DeliveryResult> {
    try {
      // Create in-app notification
      await query(
        `INSERT INTO notifications (
          user_id, type, title, message, data, read
        ) VALUES ($1, $2, $3, $4, $5, false)`,
        [
          userId,
          'call_summary',
          'Call Summary Ready',
          `Your ${this.formatSessionType(summary.session_type)} summary is ready to view.`,
          JSON.stringify({
            summaryPreview: summary.summary.substring(0, 200) + '...',
            insightCount: keyInsights.length,
            duration: summary.duration,
          }),
        ]
      );

      return {
        channel: 'app',
        success: true,
        deliveredAt: new Date(),
      };
    } catch (error) {
      logger.error('[SummaryDelivery] App delivery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return {
        channel: 'app',
        success: false,
        error: error instanceof Error ? error.message : 'App delivery failed',
      };
    }
  }

  /**
   * Deliver to WhatsApp
   */
  private async deliverToWhatsApp(
    userId: string,
    whatsappNumber: string | undefined,
    summary: { summary: string; session_type: string; duration: number },
    keyInsights: string[]
  ): Promise<DeliveryResult> {
    if (!whatsappNumber) {
      return {
        channel: 'whatsapp',
        success: false,
        error: 'WhatsApp number not configured',
      };
    }

    try {
      // Format message for WhatsApp
      const message = this.formatWhatsAppMessage(summary, keyInsights);

      // TODO: Integrate with WhatsApp Business API
      // For now, we'll log and simulate success
      logger.info('[SummaryDelivery] WhatsApp message prepared', {
        userId,
        phoneNumber: whatsappNumber.substring(0, 4) + '****',
        messageLength: message.length,
      });

      // Simulate WhatsApp API call
      // In production, this would call the WhatsApp Business API
      // await whatsappService.sendMessage(whatsappNumber, message);

      return {
        channel: 'whatsapp',
        success: true,
        deliveredAt: new Date(),
      };
    } catch (error) {
      logger.error('[SummaryDelivery] WhatsApp delivery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return {
        channel: 'whatsapp',
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp delivery failed',
      };
    }
  }

  /**
   * Deliver push notification
   */
  private async deliverPushNotification(
    userId: string,
    pushEnabled: boolean | undefined,
    _summary: { summary: string; session_type: string }
  ): Promise<DeliveryResult> {
    if (pushEnabled === false) {
      return {
        channel: 'push',
        success: false,
        error: 'Push notifications disabled',
      };
    }

    try {
      // Get user's push tokens
      const tokensResult = await query<{ token: string; platform: string }>(
        `SELECT token, platform FROM push_tokens WHERE user_id = $1 AND active = true`,
        [userId]
      );

      if (tokensResult.rows.length === 0) {
        return {
          channel: 'push',
          success: false,
          error: 'No push tokens registered',
        };
      }

      // TODO: Send push notification via FCM/APNs
      // For now, we'll log and simulate success
      logger.info('[SummaryDelivery] Push notification prepared', {
        userId,
        tokenCount: tokensResult.rows.length,
        title: 'Call Summary Ready',
      });

      // In production:
      // await pushNotificationService.send({
      //   tokens: tokensResult.rows.map(r => r.token),
      //   title: 'Call Summary Ready',
      //   body: `Your ${this.formatSessionType(summary.session_type)} summary is ready.`,
      //   data: { type: 'call_summary' },
      // });

      return {
        channel: 'push',
        success: true,
        deliveredAt: new Date(),
      };
    } catch (error) {
      logger.error('[SummaryDelivery] Push delivery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return {
        channel: 'push',
        success: false,
        error: error instanceof Error ? error.message : 'Push delivery failed',
      };
    }
  }

  /**
   * Format WhatsApp message
   */
  private formatWhatsAppMessage(
    summary: { summary: string; session_type: string; duration: number },
    keyInsights: string[]
  ): string {
    const durationMins = Math.round(summary.duration / 60);
    const sessionType = this.formatSessionType(summary.session_type);

    let message = `📋 *${sessionType} Summary*\n`;
    message += `⏱️ Duration: ${durationMins} minutes\n\n`;
    message += `${summary.summary}\n\n`;

    if (keyInsights.length > 0) {
      message += `✨ *Key Insights:*\n`;
      keyInsights.slice(0, 5).forEach((insight, i) => {
        message += `${i + 1}. ${insight}\n`;
      });
    }

    message += `\n_Open the Balencia app to view action items and track your progress._`;

    return message;
  }

  /**
   * Format session type for display
   */
  private formatSessionType(sessionType: string): string {
    const labels: Record<string, string> = {
      quick_checkin: 'Quick Check-In',
      coaching_session: 'Coaching Session',
      emergency_support: 'Support Session',
      goal_review: 'Goal Review',
      health_coach: 'Health Coaching',
      nutrition: 'Nutrition Session',
      fitness: 'Fitness Session',
      wellness: 'Wellness Check',
    };
    return labels[sessionType] || 'Session';
  }

  /**
   * Update delivery status in database
   */
  private async updateDeliveryStatus(
    summaryId: string,
    channel: DeliveryChannel,
    success: boolean
  ): Promise<void> {
    try {
      // Get current delivery status
      const result = await query<{ delivery_status: string | object }>(
        `SELECT delivery_status FROM call_summaries WHERE id = $1`,
        [summaryId]
      );

      if (result.rows.length === 0) return;

      const currentStatus = typeof result.rows[0].delivery_status === 'string'
        ? JSON.parse(result.rows[0].delivery_status)
        : result.rows[0].delivery_status;

      // Update status
      const newStatus = {
        ...currentStatus,
        [channel]: success,
        deliveredAt: success ? new Date().toISOString() : currentStatus.deliveredAt,
      };

      await query(
        `UPDATE call_summaries 
         SET delivery_status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [JSON.stringify(newStatus), summaryId]
      );
    } catch (error) {
      logger.error('[SummaryDelivery] Error updating delivery status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        summaryId,
        channel,
      });
    }
  }

  /**
   * Get user's preferred delivery channels
   */
  async getPreferredChannels(userId: string): Promise<DeliveryChannel[]> {
    try {
      const result = await query<{
        preferred_channel: string;
        whatsapp_number: string | null;
        push_enabled: boolean;
      }>(
        `SELECT preferred_channel, whatsapp_number, push_enabled
         FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return ['app']; // Default to app only
      }

      const prefs = result.rows[0];
      const channels: DeliveryChannel[] = ['app']; // Always include app

      if (prefs.whatsapp_number && prefs.preferred_channel === 'whatsapp') {
        channels.push('whatsapp');
      }

      if (prefs.push_enabled !== false) {
        channels.push('push');
      }

      return channels;
    } catch (error) {
      logger.error('[SummaryDelivery] Error getting preferred channels', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return ['app'];
    }
  }

  /**
   * Auto-deliver summary after call ends
   */
  async autoDeliverSummary(summaryId: string, userId: string): Promise<void> {
    try {
      const channels = await this.getPreferredChannels(userId);
      await this.deliverSummary({ summaryId, userId, channels });
    } catch (error) {
      logger.error('[SummaryDelivery] Auto-delivery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        summaryId,
        userId,
      });
    }
  }
}

export const summaryDeliveryService = new SummaryDeliveryService();

