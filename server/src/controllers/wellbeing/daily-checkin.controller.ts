/**
 * @file Daily Check-in Controller
 * @description API endpoints for daily check-in flow
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { dailyCheckinService } from '../../services/wellbeing/daily-checkin.service.js';

class DailyCheckinController {
  /**
   * @route   POST /api/v1/journal/checkin
   * @desc    Create or update today's daily check-in (morning or evening)
   * @access  Private
   */
  createOrUpdate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const {
      mood_score, energy_score, sleep_quality, stress_score, tags, day_summary,
      checkin_type,
      // Morning fields
      predicted_mood, predicted_energy, known_stressors,
      // Evening fields
      day_rating, went_well, didnt_go_well, evening_lessons, tomorrow_focus,
      // Screen time
      screen_time_minutes,
    } = req.body;

    // Validate scores
    if (mood_score !== undefined && (mood_score < 1 || mood_score > 10)) {
      throw ApiError.badRequest('mood_score must be between 1 and 10');
    }
    if (energy_score !== undefined && (energy_score < 1 || energy_score > 10)) {
      throw ApiError.badRequest('energy_score must be between 1 and 10');
    }
    if (sleep_quality !== undefined && (sleep_quality < 1 || sleep_quality > 5)) {
      throw ApiError.badRequest('sleep_quality must be between 1 and 5');
    }
    if (stress_score !== undefined && (stress_score < 1 || stress_score > 10)) {
      throw ApiError.badRequest('stress_score must be between 1 and 10');
    }
    if (predicted_mood !== undefined && (predicted_mood < 1 || predicted_mood > 10)) {
      throw ApiError.badRequest('predicted_mood must be between 1 and 10');
    }
    if (predicted_energy !== undefined && (predicted_energy < 1 || predicted_energy > 10)) {
      throw ApiError.badRequest('predicted_energy must be between 1 and 10');
    }
    if (day_rating !== undefined && (day_rating < 1 || day_rating > 10)) {
      throw ApiError.badRequest('day_rating must be between 1 and 10');
    }
    if (screen_time_minutes !== undefined && (screen_time_minutes < 0 || screen_time_minutes > 1440)) {
      throw ApiError.badRequest('screen_time_minutes must be between 0 and 1440');
    }

    const checkin = await dailyCheckinService.createOrUpdateCheckin(userId, {
      moodScore: mood_score,
      energyScore: energy_score,
      sleepQuality: sleep_quality,
      stressScore: stress_score,
      tags,
      daySummary: day_summary,
      checkinType: checkin_type,
      predictedMood: predicted_mood,
      predictedEnergy: predicted_energy,
      knownStressors: known_stressors,
      dayRating: day_rating,
      wentWell: went_well,
      didntGoWell: didnt_go_well,
      eveningLessons: evening_lessons,
      tomorrowFocus: tomorrow_focus,
      screenTimeMinutes: screen_time_minutes,
    });

    ApiResponse.success(
      res,
      { checkin },
      { message: 'Daily check-in saved successfully', statusCode: 201 },
      undefined,
      req
    );
  });

  /**
   * @route   GET /api/v1/journal/checkin/today
   * @desc    Get today's check-in (or null)
   * @access  Private
   */
  getToday = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const checkinType = req.query.type as string | undefined;
    const checkin = await dailyCheckinService.getTodayCheckin(userId, checkinType as any);

    ApiResponse.success(
      res,
      { checkin, hasCheckedIn: checkin !== null },
      'Today\'s check-in retrieved',
      undefined,
      req
    );
  });

  /**
   * @route   GET /api/v1/journal/checkin/morning
   * @desc    Get today's morning check-in
   * @access  Private
   */
  getMorning = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const date = req.query.date as string | undefined;
    const checkin = await dailyCheckinService.getMorningCheckin(userId, date);

    ApiResponse.success(res, { checkin }, 'Morning check-in retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/journal/checkin/evening
   * @desc    Get today's evening review
   * @access  Private
   */
  getEvening = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const date = req.query.date as string | undefined;
    const checkin = await dailyCheckinService.getEveningReview(userId, date);

    ApiResponse.success(res, { checkin }, 'Evening review retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/journal/checkin/comparison
   * @desc    Get predicted vs actual comparison for a day
   * @access  Private
   */
  getComparison = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const date = req.query.date as string | undefined;
    const comparison = await dailyCheckinService.getDayComparison(userId, date);

    ApiResponse.success(res, { comparison }, 'Day comparison retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/journal/checkin/history
   * @desc    Get check-in history (paginated)
   * @access  Private
   */
  getHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const checkinType = req.query.type as string | undefined;

    const result = await dailyCheckinService.getCheckinHistory(userId, {
      page, limit, startDate, endDate, checkinType: checkinType as any,
    });

    ApiResponse.success(res, result, 'Check-in history retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/journal/checkin/streak
   * @desc    Get check-in streak info
   * @access  Private
   */
  getStreak = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const streak = await dailyCheckinService.getCheckinStreak(userId);

    ApiResponse.success(res, { streak }, 'Check-in streak retrieved', undefined, req);
  });
}

export const dailyCheckinController = new DailyCheckinController();
export default dailyCheckinController;
