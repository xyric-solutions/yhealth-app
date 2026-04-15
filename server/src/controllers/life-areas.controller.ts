import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { lifeAreasService } from '../services/life-areas.service.js';
import { LIFE_AREA_DOMAINS } from '../config/life-area-domains.js';

export const listDomains = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  ApiResponse.success(res, { domains: LIFE_AREA_DOMAINS }, 'Domains retrieved');
});

export const listLifeAreas = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();
  const areas = await lifeAreasService.list(userId, {
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    domain: typeof req.query.domain === 'string' ? (req.query.domain as never) : undefined,
  });
  ApiResponse.success(res, { areas }, 'Life areas retrieved');
});

export const getLifeArea = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();
  const area = await lifeAreasService.getById(userId, req.params.id);
  if (!area) throw ApiError.notFound('Life area not found');
  const links = await lifeAreasService.listLinks(userId, area.id);
  ApiResponse.success(res, { area, links }, 'Life area retrieved');
});

export const createLifeArea = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();
  try {
    const area = await lifeAreasService.create(userId, req.body);
    ApiResponse.created(res, { area }, 'Life area created');
  } catch (e) {
    if (e instanceof Error && /already exists/i.test(e.message)) throw ApiError.badRequest(e.message);
    throw e;
  }
});

export const updateLifeArea = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();
  const area = await lifeAreasService.update(userId, req.params.id, req.body);
  if (!area) throw ApiError.notFound('Life area not found');
  ApiResponse.success(res, { area }, 'Life area updated');
});

export const archiveLifeArea = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();
  const ok = await lifeAreasService.archive(userId, req.params.id);
  if (!ok) throw ApiError.notFound('Life area not found');
  ApiResponse.success(res, {}, 'Life area archived');
});

export const linkEntity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();
  try {
    const link = await lifeAreasService.link(userId, req.params.id, req.body);
    ApiResponse.created(res, { link }, 'Entity linked');
  } catch (e) {
    if (e instanceof Error && /already linked|not found/i.test(e.message)) throw ApiError.badRequest(e.message);
    throw e;
  }
});
