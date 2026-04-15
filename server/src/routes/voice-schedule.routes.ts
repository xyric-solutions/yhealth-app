/**
 * @file Voice Schedule Routes
 * @description API routes for voice and schedule customization
 */

import { Router } from 'express';
import { voiceScheduleController } from '../controllers/voice-schedule.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/voice-schedule/preferences
 * @desc    Get voice and schedule preferences
 * @access  Private
 */
router.get('/preferences', voiceScheduleController.getPreferences);

/**
 * @route   GET /api/voice-schedule/voices
 * @desc    Get available voice options
 * @access  Private
 */
router.get('/voices', voiceScheduleController.getVoiceOptions);

/**
 * @route   GET /api/voice-schedule/frequencies
 * @desc    Get AI call frequency options
 * @access  Private
 */
router.get('/frequencies', voiceScheduleController.getFrequencyOptions);

/**
 * @route   GET /api/voice-schedule/can-call
 * @desc    Check if AI can initiate a call now
 * @access  Private
 */
router.get('/can-call', voiceScheduleController.canInitiateCall);

/**
 * @route   PATCH /api/voice-schedule/voice
 * @desc    Update voice settings
 * @access  Private
 */
router.patch('/voice', voiceScheduleController.updateVoiceSettings);

/**
 * @route   PATCH /api/voice-schedule/schedule
 * @desc    Update schedule settings
 * @access  Private
 */
router.patch('/schedule', voiceScheduleController.updateScheduleSettings);

export default router;

