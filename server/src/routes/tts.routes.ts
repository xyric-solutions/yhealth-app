import { Router } from 'express';
import { ttsController } from '../controllers/tts.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @route   GET /api/tts/status
 * @desc    Check if TTS service is available
 * @access  Public
 */
router.get('/status', ttsController.getStatus);

/**
 * @route   POST /api/tts/speak
 * @desc    Convert text to speech using ElevenLabs
 * @access  Private
 * @body    { text: string, voiceId?: string, stream?: boolean }
 */
router.post('/speak', authenticate, ttsController.speak);

export default router;

