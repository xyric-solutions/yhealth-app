import { Router } from 'express';
import { whatsappVoiceCommandService } from '../../services/whatsapp-voice-command.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { logger } from '../../services/logger.service.js';
import type { Request, Response } from 'express';

const router = Router();

/**
 * @route   POST /api/webhooks/whatsapp/voice-command
 * @desc    Webhook endpoint for WhatsApp voice commands
 * @access  Public (but should verify webhook signature)
 */
router.post(
  '/voice-command',
  asyncHandler(async (req: Request, res: Response) => {
    const { From, Body, MessageType, MediaUrl0 } = req.body;

    if (!From) {
      ApiResponse.badRequest(res, 'Missing From field');
      return;
    }

    logger.info('[WhatsAppWebhook] Received message', {
      from: From,
      messageType: MessageType,
      hasBody: !!Body,
      hasMedia: !!MediaUrl0,
    });

    // Extract phone number (remove whatsapp: prefix if present)
    const phoneNumber = From.replace(/^whatsapp:/, '');

    // TODO: Look up user by phone number
    // For now, we'll need userId to be passed or looked up
    const userId = req.body.userId; // This should come from database lookup

    // Process the message
    const result = await whatsappVoiceCommandService.processMessage(
      phoneNumber,
      Body || '',
      MessageType || 'text',
      userId
    );

    // Send response back to WhatsApp
    if (result.response) {
      await whatsappVoiceCommandService.sendMessage(From, result.response);
    }

    ApiResponse.success(res, {
      recognized: result.recognized,
      callId: result.callId,
    }, 'Message processed');
  })
);

/**
 * @route   GET /api/webhooks/whatsapp/verify
 * @desc    Webhook verification endpoint (for Meta/Facebook)
 * @access  Public
 */
router.get('/verify', (req: Request, res: Response) => {
  // WhatsApp webhook verification
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env['WHATSAPP_VERIFY_TOKEN'] || 'balencia_verify_token';

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[WhatsAppWebhook] Verification successful');
    res.status(200).send(challenge);
  } else {
    logger.warn('[WhatsAppWebhook] Verification failed', { mode, token });
    res.sendStatus(403);
  }
});

export default router;

