/**
 * @file Voice Schedule Controller
 * @description Handles voice and schedule customization endpoints
 */

import { Response } from 'express';
import { voiceScheduleService } from '../services/voice-schedule.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedRequest } from '../types/index.js';

class VoiceScheduleController {
  /**
   * @route   GET /api/voice-schedule/preferences
   * @desc    Get voice and schedule preferences
   * @access  Private
   */
  getPreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const preferences = await voiceScheduleService.getPreferences(userId);
    ApiResponse.success(res, preferences, 'Preferences retrieved successfully');
  });

  /**
   * @route   PATCH /api/voice-schedule/voice
   * @desc    Update voice settings
   * @access  Private
   */
  updateVoiceSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { voiceId, speechPace, voicePreviewPlayed } = req.body as {
      voiceId?: string;
      speechPace?: number;
      voicePreviewPlayed?: boolean;
    };

    const settings = await voiceScheduleService.updateVoiceSettings(userId, {
      voiceId: voiceId as any,
      speechPace,
      voicePreviewPlayed,
    });

    ApiResponse.success(res, settings, 'Voice settings updated successfully');
  });

  /**
   * @route   PATCH /api/voice-schedule/schedule
   * @desc    Update schedule settings
   * @access  Private
   */
  updateScheduleSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const {
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      dndDays,
      aiCallFrequency,
      preferredCallTimes,
    } = req.body as {
      quietHoursEnabled?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
      dndDays?: number[];
      aiCallFrequency?: string;
      preferredCallTimes?: string[];
    };

    const settings = await voiceScheduleService.updateScheduleSettings(userId, {
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      dndDays,
      aiCallFrequency: aiCallFrequency as any,
      preferredCallTimes,
    });

    ApiResponse.success(res, settings, 'Schedule settings updated successfully');
  });

  /**
   * @route   GET /api/voice-schedule/voices
   * @desc    Get available voice options
   * @access  Private
   */
  getVoiceOptions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const voices = voiceScheduleService.getVoiceOptions();
    ApiResponse.success(res, { voices }, 'Voice options retrieved successfully');
  });

  /**
   * @route   GET /api/voice-schedule/frequencies
   * @desc    Get AI call frequency options
   * @access  Private
   */
  getFrequencyOptions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const frequencies = voiceScheduleService.getFrequencyOptions();
    ApiResponse.success(res, { frequencies }, 'Frequency options retrieved successfully');
  });

  /**
   * @route   GET /api/voice-schedule/can-call
   * @desc    Check if AI can initiate a call now
   * @access  Private
   */
  canInitiateCall = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const result = await voiceScheduleService.canInitiateCall(userId);
    ApiResponse.success(res, result, 'Call permission checked');
  });
}

export const voiceScheduleController = new VoiceScheduleController();

