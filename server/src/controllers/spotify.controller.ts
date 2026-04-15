import type { Response } from 'express';
import { BaseController } from './base.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  initiateSpotifyOAuth,
  exchangeSpotifyOAuthCode,
  findUserByOAuthState,
  getSpotifyAccessToken,
  spotifyApiRequest,
  getSpotifyConnectionStatus,
  disconnectSpotify,
  isSpotifyConfiguredForUser,
  storeSpotifyCredentials,
  deleteSpotifyCredentials as deleteSpotifyCredentialsSvc,
  getSpotifyCredentialsStatus,
} from '../services/spotify.service.js';
import {
  getCuratedPlaylists,
  getPlaylistTracks,
  searchSpotify,
  getRecommendations,
  getUserLibrary,
  getUserPlaylists,
  getRecentlyPlayed,
} from '../services/spotify-playlist.service.js';
import { isJamendoConfigured } from '../services/jamendo.service.js';
import type { SpotifyActivityCategory, SpotifyPlaybackState } from '../../../shared/types/domain/spotify.js';

class SpotifyController extends BaseController {
  constructor() {
    super('SpotifyController');
  }

  // ─── OAuth ──────────────────────────────────────────────

  /**
   * Initiate Spotify OAuth flow
   * POST /api/spotify/auth/connect
   */
  connect = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { redirectUri } = (req.body || {}) as { redirectUri?: string };
    const result = await initiateSpotifyOAuth(userId, redirectUri);

    this.success(res, result);
  });

  /**
   * Complete OAuth callback
   * POST /api/spotify/auth/callback
   * Supports both authenticated (token) and unauthenticated (state lookup) flows
   */
  callback = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code, state } = (req.body || {}) as { code: string; state: string };
    if (!code || !state) throw ApiError.badRequest('Code and state are required.');

    // Try auth token first, fall back to state-based user lookup
    const userId = req.user?.userId || await findUserByOAuthState(state);
    if (!userId) throw ApiError.badRequest('Invalid or expired OAuth state.');

    await exchangeSpotifyOAuthCode(userId, code, state);
    const status = await getSpotifyConnectionStatus(userId);

    this.success(res, status, 'Spotify connected successfully.');
  });

  /**
   * Disconnect Spotify
   * DELETE /api/spotify/auth/disconnect
   */
  disconnect = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    await disconnectSpotify(userId);
    this.success(res, { isConnected: false }, 'Spotify disconnected.');
  });

  /**
   * Get connection status
   * GET /api/spotify/auth/status
   */
  getStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Gracefully handle missing 'spotify' enum value in DB
    let status = { isConnected: false } as { isConnected: boolean; displayName?: string; accountType?: string; connectedAt?: string; avatarUrl?: string };
    let credStatus: { hasCredentials: boolean; clientIdMasked?: string; source?: 'user' | 'env' } = { hasCredentials: false };
    let configured = false;

    try {
      [status, credStatus, configured] = await Promise.all([
        getSpotifyConnectionStatus(userId),
        getSpotifyCredentialsStatus(userId),
        isSpotifyConfiguredForUser(userId),
      ]);
    } catch (error: any) {
      // If 'spotify' enum doesn't exist yet (22P02), return defaults
      if (error?.code === '22P02' || error?.message?.includes('invalid input value for enum')) {
        // DB migration hasn't run yet — return safe defaults
      } else {
        throw error;
      }
    }

    this.success(res, {
      ...status,
      isConfigured: configured,
      hasCredentials: credStatus.hasCredentials,
      clientIdMasked: credStatus.clientIdMasked,
      credentialSource: credStatus.source,
      hasJamendoFallback: isJamendoConfigured(),
    });
  });

  // ─── Credentials ──────────────────────────────────────

  /**
   * Store Spotify credentials (Client ID + Client Secret)
   * POST /api/spotify/credentials
   */
  saveCredentials = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { clientId, clientSecret } = req.body as { clientId: string; clientSecret: string };
    if (!clientId?.trim()) throw ApiError.badRequest('Client ID is required.');
    if (!clientSecret?.trim()) throw ApiError.badRequest('Client Secret is required.');

    const result = await storeSpotifyCredentials(userId, clientId.trim(), clientSecret.trim());
    this.success(res, result, result.requiresReauth
      ? 'Spotify credentials updated. Please reconnect your Spotify account.'
      : 'Spotify credentials saved successfully.');
  });

  /**
   * Get Spotify credentials status (masked)
   * GET /api/spotify/credentials
   */
  getCredentials = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const status = await getSpotifyCredentialsStatus(userId);
    this.success(res, status);
  });

  /**
   * Delete Spotify credentials and disconnect
   * DELETE /api/spotify/credentials
   */
  removeCredentials = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    await deleteSpotifyCredentialsSvc(userId);
    this.success(res, { deleted: true }, 'Spotify credentials deleted.');
  });

  // ─── Playlists ──────────────────────────────────────────

  /**
   * Get curated playlists by activity category
   * GET /api/spotify/playlists/:category
   */
  getPlaylists = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { category } = req.params as { category: string };
    const validCategories: SpotifyActivityCategory[] = [
      'workout', 'running', 'meditation', 'sleep', 'focus', 'recovery', 'stretching', 'yoga',
    ];

    if (!validCategories.includes(category as SpotifyActivityCategory)) {
      throw ApiError.badRequest(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }

    const userId = req.user?.userId || null;
    const playlists = await getCuratedPlaylists(category as SpotifyActivityCategory, userId);
    this.success(res, { playlists, category });
  });

  /**
   * Get playlist tracks
   * GET /api/spotify/playlists/:id/tracks
   */
  getTracks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const limit = parseInt(req.query['limit'] as string) || 50;
    const offset = parseInt(req.query['offset'] as string) || 0;
    const userId = req.user?.userId || null;

    const result = await getPlaylistTracks(id, userId, limit, offset);
    this.success(res, result);
  });

  // ─── Search ─────────────────────────────────────────────

  /**
   * Search Spotify catalog
   * GET /api/spotify/search
   */
  search = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const q = req.query['q'] as string;
    const type = (req.query['type'] as string) || 'track';
    const limit = parseInt(req.query['limit'] as string) || 20;

    if (!q || q.trim().length === 0) throw ApiError.badRequest('Search query is required.');

    const userId = req.user?.userId || null;
    const results = await searchSpotify(q, type as 'track' | 'playlist' | 'artist', userId, limit);
    this.success(res, results);
  });

  // ─── Recommendations ───────────────────────────────────

  /**
   * Get activity-based recommendations
   * GET /api/spotify/recommendations
   */
  getRecommendations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const activityType = req.query['activityType'] as SpotifyActivityCategory;
    const seedTracks = req.query['seedTracks'] ? (req.query['seedTracks'] as string).split(',') : undefined;
    const limit = parseInt(req.query['limit'] as string) || 30;

    if (!activityType) throw ApiError.badRequest('activityType is required.');

    const userId = req.user?.userId || null;
    const tracks = await getRecommendations(activityType, userId, seedTracks, limit);
    this.success(res, { tracks, activityType });
  });

  // ─── User Library ───────────────────────────────────────

  /**
   * Get user's saved tracks and playlists
   * GET /api/spotify/me/library
   */
  getLibrary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const limit = parseInt(req.query['limit'] as string) || 50;
    const offset = parseInt(req.query['offset'] as string) || 0;

    const [tracks, playlists, recentlyPlayed] = await Promise.all([
      getUserLibrary(userId, limit, offset),
      getUserPlaylists(userId, limit, offset),
      getRecentlyPlayed(userId, 20),
    ]);

    this.success(res, {
      savedTracks: tracks,
      playlists,
      recentlyPlayed,
    });
  });

  // ─── Playback ───────────────────────────────────────────

  /**
   * Get SDK access token for Web Playback SDK
   * GET /api/spotify/playback/token
   */
  getPlaybackToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const accessToken = await getSpotifyAccessToken(userId);

    // Check if user has Premium (required for SDK)
    const status = await getSpotifyConnectionStatus(userId);
    const isPremium = status.accountType === 'premium';

    this.success(res, {
      accessToken,
      isPremium,
      expiresIn: 3600, // Spotify tokens expire in 1 hour
    });
  });

  /**
   * Get current playback state
   * GET /api/spotify/playback/state
   */
  getPlaybackState = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    try {
      const state = await spotifyApiRequest<SpotifyPlaybackState>(userId, '/me/player');
      this.success(res, state);
    } catch {
      // No active device returns empty
      this.success(res, { is_playing: false, item: null, device: null });
    }
  });

  /**
   * Control playback (play, pause, next, previous, seek, volume, shuffle, repeat)
   * PUT /api/spotify/playback/control
   */
  controlPlayback = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { action, value, uris, context_uri, offset: playOffset } = req.body as {
      action: string;
      value?: number | boolean | string;
      uris?: string[];
      context_uri?: string;
      offset?: { position: number };
    };

    if (!action) throw ApiError.badRequest('Action is required.');

    switch (action) {
      case 'play': {
        const body: Record<string, unknown> = {};
        if (uris) body.uris = uris;
        if (context_uri) body.context_uri = context_uri;
        if (playOffset) body.offset = playOffset;
        await spotifyApiRequest(userId, '/me/player/play', { method: 'PUT', body: Object.keys(body).length > 0 ? body : undefined });
        break;
      }
      case 'pause':
        await spotifyApiRequest(userId, '/me/player/pause', { method: 'PUT' });
        break;
      case 'next':
        await spotifyApiRequest(userId, '/me/player/next', { method: 'POST' });
        break;
      case 'previous':
        await spotifyApiRequest(userId, '/me/player/previous', { method: 'POST' });
        break;
      case 'seek':
        if (typeof value !== 'number') throw ApiError.badRequest('Seek value (ms) is required.');
        await spotifyApiRequest(userId, `/me/player/seek?position_ms=${value}`, { method: 'PUT' });
        break;
      case 'volume':
        if (typeof value !== 'number') throw ApiError.badRequest('Volume value (0-100) is required.');
        await spotifyApiRequest(userId, `/me/player/volume?volume_percent=${value}`, { method: 'PUT' });
        break;
      case 'shuffle':
        await spotifyApiRequest(userId, `/me/player/shuffle?state=${value ?? true}`, { method: 'PUT' });
        break;
      case 'repeat':
        await spotifyApiRequest(userId, `/me/player/repeat?state=${value || 'off'}`, { method: 'PUT' });
        break;
      default:
        throw ApiError.badRequest(`Unknown action: ${action}`);
    }

    this.success(res, { action, success: true });
  });
}

export const spotifyController = new SpotifyController();
