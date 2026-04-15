/**
 * @file Transcription Controller
 * @description Handles speech-to-text transcription using AssemblyAI
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assemblyAIService } from '../services/assemblyai.service.js';
import { logger } from '../services/logger.service.js';
import multer from 'multer';

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept common audio formats
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mp4',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type. Supported: MP3, WAV, WebM, OGG, M4A'));
    }
  },
});

class TranscriptionController {
  /**
   * Transcribe audio file
   * POST /api/transcription/transcribe
   */
  transcribe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    if (!assemblyAIService.isAvailable()) {
      throw ApiError.serviceUnavailable('AssemblyAI transcription is not configured');
    }

    const file = req.file;
    if (!file) {
      throw ApiError.badRequest('Audio file is required');
    }

    const { languageCode, speakerLabels, punctuate, formatText } = req.body as {
      languageCode?: string;
      speakerLabels?: boolean;
      punctuate?: boolean;
      formatText?: boolean;
    };

    logger.info('[TranscriptionController] Starting transcription', {
      userId,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    try {
      const audioBuffer = Buffer.from(file.buffer);
      const text = await assemblyAIService.transcribeAudio(audioBuffer, {
        languageCode: languageCode || 'en',
        speakerLabels: speakerLabels || false,
        punctuate: punctuate !== false,
        formatText: formatText !== false,
      });

      logger.info('[TranscriptionController] Transcription completed', {
        userId,
        textLength: text.length,
      });

      ApiResponse.success(res, {
        text,
        language: languageCode || 'en',
      }, 'Transcription completed successfully');
    } catch (error) {
      logger.error('[TranscriptionController] Transcription failed', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw ApiError.badRequest('Transcription took too long. Please try with a shorter audio file.');
        }
        if (error.message.includes('API key')) {
          throw ApiError.serviceUnavailable('AssemblyAI API key is invalid or missing');
        }
      }

      throw ApiError.internal('Transcription failed. Please try again.');
    }
  });

  /**
   * Upload audio and start transcription (async)
   * POST /api/transcription/start
   */
  startTranscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    if (!assemblyAIService.isAvailable()) {
      throw ApiError.serviceUnavailable('AssemblyAI transcription is not configured');
    }

    const file = req.file;
    if (!file) {
      throw ApiError.badRequest('Audio file is required');
    }

    const { languageCode, speakerLabels, punctuate, formatText } = req.body as {
      languageCode?: string;
      speakerLabels?: boolean;
      punctuate?: boolean;
      formatText?: boolean;
    };

    logger.info('[TranscriptionController] Starting async transcription', {
      userId,
      fileName: file.originalname,
      fileSize: file.size,
    });

    try {
      const audioBuffer = Buffer.from(file.buffer);
      const uploadUrl = await assemblyAIService.uploadAudio(audioBuffer);
      const transcriptId = await assemblyAIService.startTranscription(uploadUrl, {
        languageCode: languageCode || 'en',
        speakerLabels: speakerLabels || false,
        punctuate: punctuate !== false,
        formatText: formatText !== false,
      });

      ApiResponse.success(res, {
        transcriptId,
        status: 'queued',
      }, 'Transcription started successfully');
    } catch (error) {
      logger.error('[TranscriptionController] Failed to start transcription', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw ApiError.internal('Failed to start transcription. Please try again.');
    }
  });

  /**
   * Get transcription status
   * GET /api/transcription/:transcriptId
   */
  getTranscription = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { transcriptId } = req.params;
    if (!transcriptId) {
      throw ApiError.badRequest('Transcript ID is required');
    }

    if (!assemblyAIService.isAvailable()) {
      throw ApiError.serviceUnavailable('AssemblyAI transcription is not configured');
    }

    try {
      const result = await assemblyAIService.getTranscription(transcriptId);

      ApiResponse.success(res, result, 'Transcription status retrieved successfully');
    } catch (error) {
      logger.error('[TranscriptionController] Failed to get transcription', {
        error: error instanceof Error ? error.message : String(error),
        transcriptId,
        userId,
      });
      throw ApiError.internal('Failed to get transcription status. Please try again.');
    }
  });

  /**
   * Check if transcription service is available
   * GET /api/transcription/status
   */
  getStatus = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const isAvailable = assemblyAIService.isAvailable();

    ApiResponse.success(res, {
      available: isAvailable,
      provider: 'assemblyai',
      message: isAvailable
        ? 'AssemblyAI transcription is ready'
        : 'AssemblyAI transcription is not configured. Please set ASSEMBLY_VOICE_API_KEY.',
    });
  });
}

export const transcriptionController = new TranscriptionController();

// Export multer middleware for use in routes
export const transcriptionUpload = upload.single('audio');

