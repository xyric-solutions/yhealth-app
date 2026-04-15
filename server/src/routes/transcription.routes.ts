/**
 * @file Transcription Routes
 * @description API routes for speech-to-text transcription
 */

import { Router } from 'express';
import { transcriptionController, transcriptionUpload } from '../controllers/transcription.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @route   GET /api/transcription/status
 * @desc    Check if transcription service is available
 * @access  Private
 */
router.get('/status', authenticate, transcriptionController.getStatus);

/**
 * @route   POST /api/transcription/transcribe
 * @desc    Transcribe audio file (synchronous - waits for result)
 * @access  Private
 */
router.post('/transcribe', authenticate, transcriptionUpload, transcriptionController.transcribe);

/**
 * @route   POST /api/transcription/start
 * @desc    Start transcription (asynchronous - returns transcript ID)
 * @access  Private
 */
router.post('/start', authenticate, transcriptionUpload, transcriptionController.startTranscription);

/**
 * @route   GET /api/transcription/:transcriptId
 * @desc    Get transcription status and result
 * @access  Private
 */
router.get('/:transcriptId', authenticate, transcriptionController.getTranscription);

export default router;

