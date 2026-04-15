/**
 * @file Calendar Routes
 * @description Google Calendar OAuth + sync + event retrieval endpoints
 */

import { Router, type Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { googleCalendarService } from '../services/google-calendar.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/calendar/auth-url
 * Get Google Calendar OAuth2 authorization URL
 */
router.get(
  '/auth-url',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const hasCredentials = await googleCalendarService.isUserConfigured(userId);
    if (!hasCredentials) {
      throw ApiError.badRequest('Please add your Google Calendar credentials first');
    }

    const url = await googleCalendarService.getAuthUrl(userId);
    ApiResponse.success(res, { url }, 'Authorization URL generated');
  }),
);

/**
 * POST /api/calendar/credentials
 * Save user's own Google Calendar API credentials
 */
router.post(
  '/credentials',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { clientId, clientSecret, redirectUri } = req.body;
    if (!clientId || !clientSecret) {
      throw ApiError.badRequest('Client ID and Client Secret are required');
    }

    await googleCalendarService.saveCredentials(userId, clientId, clientSecret, redirectUri);
    ApiResponse.success(res, null, 'Google Calendar credentials saved');
  }),
);

/**
 * GET /api/calendar/credentials
 * Get user's masked credentials
 */
router.get(
  '/credentials',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const credentials = await googleCalendarService.getCredentials(userId);
    ApiResponse.success(res, { credentials, hasCredentials: !!credentials });
  }),
);

/**
 * DELETE /api/calendar/credentials
 * Remove credentials and disconnect calendar
 */
router.delete(
  '/credentials',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    await googleCalendarService.deleteCredentials(userId);
    ApiResponse.success(res, null, 'Google Calendar credentials removed');
  }),
);

/**
 * GET /api/calendar/callback
 * Handle OAuth2 callback from Google
 */
router.get(
  '/callback',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || (req.query.state as string);
    const code = req.query.code as string;

    if (!userId || !code) {
      throw ApiError.badRequest('Missing authorization code or user state');
    }

    const connection = await googleCalendarService.handleCallback(userId, code);

    // Trigger initial sync
    googleCalendarService.syncEvents(userId, connection.id).catch((err) => {
      console.error('[Calendar] Initial sync failed:', err);
    });

    // Redirect to settings page or return JSON based on Accept header
    if (req.headers.accept?.includes('text/html')) {
      res.redirect('/settings?calendar=connected');
    } else {
      ApiResponse.success(res, { connection }, 'Google Calendar connected');
    }
  }),
);

/**
 * GET /api/calendar/connections
 * List user's calendar connections
 */
router.get(
  '/connections',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const connections = await googleCalendarService.getConnections(userId);
    ApiResponse.success(res, { connections, configured: googleCalendarService.isConfigured() });
  }),
);

/**
 * DELETE /api/calendar/connections/:id
 * Disconnect a calendar connection
 */
router.delete(
  '/connections/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    await googleCalendarService.disconnect(userId, req.params.id);
    ApiResponse.success(res, null, 'Calendar disconnected');
  }),
);

/**
 * POST /api/calendar/sync
 * Trigger manual sync for all user connections
 */
router.post(
  '/sync',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const connections = await googleCalendarService.getConnections(userId);
    let totalSynced = 0;

    for (const conn of connections) {
      if (!conn.syncEnabled) continue;
      try {
        const count = await googleCalendarService.syncEvents(userId, conn.id);
        totalSynced += count;
      } catch (err) {
        console.error('[Calendar] Sync failed for connection', conn.id, err);
      }
    }

    ApiResponse.success(res, { eventsSynced: totalSynced }, 'Calendar sync completed');
  }),
);

/**
 * GET /api/calendar/events
 * Get synced calendar events for a date range
 */
router.get(
  '/events',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const startDate = (req.query.start as string) || new Date().toISOString().split('T')[0];
    const endDate = (req.query.end as string) || startDate;

    const events = await googleCalendarService.getEvents(userId, startDate, endDate);
    ApiResponse.success(res, { events, count: events.length });
  }),
);

export default router;
