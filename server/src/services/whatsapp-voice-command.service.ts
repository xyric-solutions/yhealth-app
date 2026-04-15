import { logger } from './logger.service.js';
import { voiceCallService } from './voice-call.service.js';
import { env } from '../config/env.config.js';

/**
 * WhatsApp Voice Command Service
 * Processes WhatsApp voice messages and extracts call commands
 */
class WhatsAppVoiceCommandService {
  // Voice command patterns (case-insensitive)
  private readonly commandPatterns = [
    /^(call|start|connect)\s+(my\s+)?(coach|ai\s+coach|assistant)$/i,
    /^(hey|hi|hello)\s+(coach|ai\s+coach)$/i,
    /^(voice\s+)?call\s+(coach|my\s+coach)$/i,
    /^connect\s+to\s+(ai\s+)?coach$/i,
  ];

  /**
   * Process incoming WhatsApp message
   * Extracts text from voice message and checks for call commands
   */
  async processMessage(
    from: string,
    messageBody: string,
    messageType: string,
    userId?: string
  ): Promise<{ recognized: boolean; callId?: string; response?: string }> {
    try {
      logger.info('[WhatsAppVoiceCommand] Processing message', {
        from,
        messageType,
        hasUserId: !!userId,
      });

      // If it's a voice message, we need to transcribe it first
      // For now, assume messageBody is already transcribed text
      if (messageType === 'audio' || messageType === 'voice') {
        // TODO: Integrate with speech-to-text service (Twilio, Google Speech-to-Text, etc.)
        // For now, assume the message body is already transcribed
        logger.info('[WhatsAppVoiceCommand] Voice message received, assuming transcribed', {
          from,
        });
      }

      // Check if message matches any command pattern
      const trimmedMessage = messageBody.trim();
      const isCommand = this.commandPatterns.some((pattern) =>
        pattern.test(trimmedMessage)
      );

      if (!isCommand) {
        return {
          recognized: false,
          response: "I didn't catch that. Say 'Call my coach' to start a voice call.",
        };
      }

      // If no userId, we need to look it up by phone number
      if (!userId) {
        // TODO: Look up user by WhatsApp phone number
        // For now, return error
        logger.warn('[WhatsAppVoiceCommand] No userId provided', { from });
        return {
          recognized: false,
          response: 'Please link your WhatsApp number in the app settings first.',
        };
      }

      // Initiate call
      try {
        const result = await voiceCallService.initiateCall(userId, {
          channel: 'whatsapp',
          pre_call_context: 'Initiated via WhatsApp voice command',
        });

        logger.info('[WhatsAppVoiceCommand] Call initiated', {
          userId,
          callId: result.callId,
        });

        return {
          recognized: true,
          callId: result.callId,
          response: 'Call connecting... You will receive a call shortly.',
        };
      } catch (error) {
        logger.error('[WhatsAppVoiceCommand] Error initiating call', { error, userId });
        return {
          recognized: false,
          response: 'Sorry, I encountered an error starting the call. Please try again.',
        };
      }
    } catch (error) {
      logger.error('[WhatsAppVoiceCommand] Error processing message', { error, from });
      return {
        recognized: false,
        response: 'Sorry, I encountered an error. Please try again.',
      };
    }
  }

  /**
   * Send WhatsApp message
   * Uses Twilio WhatsApp API or Meta Cloud API
   */
  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      if (!env.twilio.accountSid || !env.twilio.authToken || !env.twilio.whatsappNumber) {
        logger.warn('[WhatsAppVoiceCommand] Twilio not configured, cannot send message');
        return false;
      }

      // TODO: Implement Twilio WhatsApp API call
      // This would use Twilio SDK to send WhatsApp message
      logger.info('[WhatsAppVoiceCommand] Sending WhatsApp message', { to, messageLength: message.length });
      
      // Placeholder - will be implemented with Twilio SDK
      return true;
    } catch (error) {
      logger.error('[WhatsAppVoiceCommand] Error sending message', { error, to });
      return false;
    }
  }

  /**
   * Verify webhook signature (for security)
   */
  verifyWebhookSignature(
    _signature: string,
    _payload: string,
    _secret: string
  ): boolean {
    // TODO: Implement webhook signature verification
    // This is important for production to verify requests are from WhatsApp
    logger.info('[WhatsAppVoiceCommand] Verifying webhook signature');
    return true; // Placeholder
  }
}

export const whatsappVoiceCommandService = new WhatsAppVoiceCommandService();

