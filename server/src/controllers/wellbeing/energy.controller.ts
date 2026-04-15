/**
 * @file Energy Controller
 * @description API endpoints for energy level monitoring (F7.4)
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { energyService } from '../../services/wellbeing/energy.service.js';

class EnergyController {
  /**
   * @route   POST /api/v1/wellbeing/energy
   * @desc    Log energy level
   * @access  Private
   */
  createEnergyLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { energy_rating, context_tag, context_note, logged_at } = req.body;

    if (!energy_rating || typeof energy_rating !== 'number') {
      throw ApiError.badRequest('energy_rating is required and must be a number');
    }

    const energyLog = await energyService.createEnergyLog(userId, {
      energyRating: energy_rating,
      contextTag: context_tag,
      contextNote: context_note,
      loggedAt: logged_at,
    });

    ApiResponse.success(
      res,
      { energyLog },
      {
        message: 'Energy level logged successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   GET /api/v1/wellbeing/energy
   * @desc    List energy records
   * @access  Private
   */
  getEnergyLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await energyService.getEnergyLogs(userId, {
      startDate,
      endDate,
      page,
      limit,
    });

    ApiResponse.success(res, result, 'Energy logs retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/energy/timeline
   * @desc    Get energy timeline data for visualization
   * @access  Private
   */
  getEnergyTimeline = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      throw ApiError.badRequest('startDate and endDate query parameters are required');
    }

    const timeline = await energyService.getEnergyTimeline(userId, startDate, endDate);

    ApiResponse.success(res, { timeline }, 'Energy timeline retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/energy/patterns
   * @desc    Get energy pattern insights
   * @access  Private
   */
  getEnergyPatterns = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const days = parseInt(req.query.days as string) || 30;

    const patterns = await energyService.getEnergyPatterns(userId, days);

    ApiResponse.success(res, { patterns }, 'Energy patterns retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/energy/:id
   * @desc    Get a single energy log by ID
   * @access  Private
   */
  getEnergyLogById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const energyLog = await energyService.getEnergyLogById(userId, id);

    ApiResponse.success(res, { energyLog }, 'Energy log retrieved successfully', undefined, req);
  });

  /**
   * @route   PUT /api/v1/wellbeing/energy/:id
   * @desc    Update an energy log
   * @access  Private
   */
  updateEnergyLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const { energy_rating, context_tag, context_note } = req.body;

    const energyLog = await energyService.updateEnergyLog(userId, id, {
      energyRating: energy_rating,
      contextTag: context_tag,
      contextNote: context_note,
    });

    ApiResponse.success(res, { energyLog }, 'Energy log updated successfully', undefined, req);
  });

  /**
   * @route   DELETE /api/v1/wellbeing/energy/:id
   * @desc    Delete an energy log
   * @access  Private
   */
  deleteEnergyLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    await energyService.deleteEnergyLog(userId, id);

    ApiResponse.success(res, null, 'Energy log deleted successfully', undefined, req);
  });
}

export const energyController = new EnergyController();
export default energyController;

