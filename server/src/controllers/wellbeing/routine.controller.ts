/**
 * @file Routine Controller
 * @description API endpoints for wellbeing routines (F7.6)
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { routineService } from '../../services/wellbeing/routine.service.js';

class RoutineController {
  getTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templates = await routineService.getTemplates();
    ApiResponse.success(res, { templates }, 'Routine templates retrieved successfully', undefined, req);
  });

  createRoutine = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { routine_name, routine_type, steps, frequency, specific_days, trigger_time, template_id } = req.body;
    
    const routine = await routineService.createRoutine(userId, {
      routineName: routine_name,
      routineType: routine_type,
      steps,
      frequency,
      specificDays: specific_days,
      triggerTime: trigger_time,
      templateId: template_id,
    });

    ApiResponse.success(res, { routine }, { message: 'Routine created successfully', statusCode: 201 }, undefined, req);
  });

  getRoutines = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const includeArchived = req.query.includeArchived === 'true';
    const routines = await routineService.getRoutines(userId, includeArchived);

    ApiResponse.success(res, { routines }, 'Routines retrieved successfully', undefined, req);
  });

  getRoutine = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const routine = await routineService.getRoutineById(userId, id);

    ApiResponse.success(res, { routine }, 'Routine retrieved successfully', undefined, req);
  });

  completeRoutine = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const { steps_completed, started_at, completed_at } = req.body;

    const completion = await routineService.completeRoutine(userId, id, {
      stepsCompleted: steps_completed,
      startedAt: started_at,
      completedAt: completed_at,
    });

    ApiResponse.success(res, { completion }, { message: 'Routine completed successfully', statusCode: 201 }, undefined, req);
  });

  getProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const progress = await routineService.getRoutineProgress(userId, id, days);

    ApiResponse.success(res, { progress }, 'Routine progress retrieved successfully', undefined, req);
  });
}

export const routineController = new RoutineController();
export default routineController;

