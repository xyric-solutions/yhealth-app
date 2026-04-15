import type { Response } from 'express';
import { BaseController } from './base.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { elevenlabsService } from '../services/elevenlabs.service.js';
import { googleCloudTTSService, type VoiceGender } from '../services/google-cloud-tts.service.js';
import { logger } from '../services/logger.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * TTS Controller
 * Handles text-to-speech with fallback chain:
 * Google Cloud TTS (Chirp 3 HD) → ElevenLabs → client browser TTS
 */
class TTSController extends BaseController {
  constructor() {
    super('TTSController');
  }

  /**
   * Convert text to speech with fallback chain
   * POST /api/tts/speak
   */
  speak = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { text, voiceId, stream, voiceGender, languageCode } = req.body as {
      text: string;
      voiceId?: string;
      stream?: boolean;
      voiceGender?: VoiceGender;
      languageCode?: string;
    };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw ApiError.badRequest('Text is required and cannot be empty');
    }

    // Try Google Cloud TTS first (Chirp 3 HD)
    if (googleCloudTTSService.isAvailable()) {
      try {
        const audioBuffer = await googleCloudTTSService.textToSpeech(text, {
          voiceGender: voiceGender || 'female',
          languageCode: languageCode || 'en-US',
        });

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');
        res.setHeader('Content-Length', audioBuffer.length.toString());
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-TTS-Provider', 'google-cloud');

        res.send(audioBuffer);
        return;
      } catch (error) {
        logger.warn('[TTS] Google Cloud TTS failed, falling back to ElevenLabs', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to ElevenLabs
      }
    }

    // Fallback: ElevenLabs
    if (elevenlabsService.isAvailable()) {
      try {
        if (stream) {
          const audioStream = await elevenlabsService.textToSpeechStream(text, { voiceId });

          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('X-TTS-Provider', 'elevenlabs');

          const reader = audioStream.getReader();
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  res.end();
                  break;
                }
                res.write(Buffer.from(value));
              }
            } catch (error) {
              logger.error('Error streaming audio', { error });
              if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream audio' });
              } else {
                res.end();
              }
            }
          };

          pump();
          return;
        } else {
          const audioBuffer = await elevenlabsService.textToSpeech(text, { voiceId });

          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');
          res.setHeader('Content-Length', audioBuffer.length.toString());
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('X-TTS-Provider', 'elevenlabs');

          res.send(audioBuffer);
          return;
        }
      } catch (error) {
        logger.warn('[TTS] ElevenLabs failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to error
      }
    }

    // No TTS provider available - client will use browser speechSynthesis
    throw ApiError.serviceUnavailable(
      'All TTS providers unavailable. Please use browser speech synthesis.'
    );
  });

  /**
   * Check TTS service status with all providers
   * GET /api/tts/status
   */
  getStatus = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const elevenLabsAvailable = elevenlabsService.isAvailable();
    const googleCloudAvailable = googleCloudTTSService.isAvailable();
    const anyAvailable = elevenLabsAvailable || googleCloudAvailable;

    const providers: Array<{ name: string; available: boolean }> = [
      { name: 'google-cloud', available: googleCloudAvailable },
      { name: 'elevenlabs', available: elevenLabsAvailable },
      { name: 'browser', available: true },
    ];

    // Determine active provider (first available in chain)
    let activeProvider = 'browser';
    if (googleCloudAvailable) activeProvider = 'google-cloud';
    else if (elevenLabsAvailable) activeProvider = 'elevenlabs';

    this.success(res, {
      available: anyAvailable,
      provider: activeProvider,
      providers,
      message: anyAvailable
        ? `TTS ready (${activeProvider})`
        : 'Cloud TTS not configured. Using browser speech synthesis.',
    });
  });
}

export const ttsController = new TTSController();
