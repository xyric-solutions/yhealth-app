import type { Response } from 'express';
import { BaseController } from './base.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { searchYouTubeVideos } from '../services/youtube.service.js';

class YouTubeController extends BaseController {
  constructor() {
    super('YouTubeController');
  }

  search = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const q = req.query['q'] as string;
    if (!q || q.trim().length === 0) {
      throw ApiError.badRequest('Search query (q) is required.');
    }

    const maxResults = Math.min(parseInt(req.query['maxResults'] as string) || 3, 5);
    const videos = await searchYouTubeVideos(q, maxResults);

    this.success(res, { videos, query: q });
  });
}

export const youtubeController = new YouTubeController();
