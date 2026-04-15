import type { Response } from 'express';
import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../services/logger.service.js';
import { env } from '../config/env.config.js';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  initiateWhoopOAuth,
  exchangeWhoopOAuthCode,
  generatePKCE,
} from '../services/whoop.service.js';
import { whoopDataService } from '../services/whoop-data.service.js';
import { socketService } from '../services/socket.service.js';
import type {
  SelectIntegrationsInput,
  InitiateOAuthInput,
  CompleteOAuthInput,
  TriggerSyncInput,
  UpdateIntegrationInput,
  ManageWhoopTokensInput,
  StoreWhoopCredentialsInput,
} from '../validators/integration.validator.js';

// Type definitions
type IntegrationProvider = 'whoop' | 'apple_health' | 'fitbit' | 'garmin' | 'oura' | 'samsung_health' | 'myfitnesspal' | 'nutritionix' | 'cronometer' | 'strava' | 'spotify';
type SyncStatus = 'active' | 'paused' | 'error' | 'disconnected' | 'pending';
type DataType = 'heart_rate' | 'hrv' | 'sleep' | 'steps' | 'workouts' | 'calories' | 'nutrition' | 'strain' | 'recovery' | 'body_temp' | 'vo2_max' | 'training_load' | 'gps_activities';

interface UserIntegrationRow {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  access_token: string;
  refresh_token: string | null;
  token_expiry: Date | null;
  scopes: string[];
  status: SyncStatus;
  connected_at: Date;
  disconnected_at: Date | null;
  last_sync_at: Date | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  sync_retry_count: number;
  next_sync_at: Date | null;
  initial_sync_complete: boolean;
  initial_sync_progress: object | null;
  is_primary_for_data_types: DataType[];
  is_enabled: boolean;
  device_info: object | null;
  client_id: string | null;
  client_secret: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SyncLogRow {
  id: string;
  user_id: string;
  integration_id: string;
  provider: IntegrationProvider;
  sync_type: string;
  started_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;
  status: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  sync_errors: object | null;
  date_range_start: Date | null;
  date_range_end: Date | null;
  created_at: Date;
}

// Integration metadata interface
interface IIntegrationMeta {
  provider: IntegrationProvider;
  displayName: string;
  description: string;
  tier: number;
  dataTypes: DataType[];
  syncFrequencyMinutes: number;
  authType: 'oauth2' | 'api_key' | 'native';
  scopes: string[];
}

// Golden source priority configuration
const GOLDEN_SOURCE_PRIORITY: Record<DataType, IntegrationProvider[]> = {
  heart_rate: ['whoop', 'apple_health', 'fitbit', 'garmin'],
  hrv: ['whoop', 'oura', 'apple_health', 'garmin'],
  sleep: ['oura', 'whoop', 'apple_health', 'fitbit'],
  steps: ['apple_health', 'fitbit', 'garmin', 'samsung_health'],
  workouts: ['strava', 'garmin', 'apple_health', 'fitbit'],
  calories: ['myfitnesspal', 'cronometer', 'apple_health', 'fitbit'],
  nutrition: ['myfitnesspal', 'cronometer', 'nutritionix'],
  strain: ['whoop'],
  recovery: ['whoop', 'oura'],
  body_temp: ['oura', 'apple_health'],
  vo2_max: ['garmin', 'apple_health'],
  training_load: ['garmin', 'whoop'],
  gps_activities: ['strava', 'garmin', 'apple_health'],
};

// Integration metadata
const INTEGRATION_METADATA: IIntegrationMeta[] = [
  {
    provider: 'whoop',
    displayName: 'WHOOP',
    description: 'Advanced recovery and strain data',
    tier: 1,
    dataTypes: ['heart_rate', 'hrv', 'sleep', 'strain', 'recovery'],
    syncFrequencyMinutes: 15,
    authType: 'oauth2',
    scopes: ['read:recovery', 'read:sleep', 'read:workout', 'read:cycles', 'read:profile', 'read:body_measurement', 'offline'],
  },
  {
    provider: 'apple_health',
    displayName: 'Apple Health',
    description: 'Continuous heart rate, activity, and workout data',
    tier: 1,
    dataTypes: ['heart_rate', 'hrv', 'sleep', 'steps', 'workouts', 'calories'],
    syncFrequencyMinutes: 0,
    authType: 'native',
    scopes: ['activity', 'workouts', 'heart_rate', 'sleep_analysis'],
  },
  {
    provider: 'fitbit',
    displayName: 'Fitbit',
    description: 'Steps, heart rate, sleep, and active minutes tracking',
    tier: 1,
    dataTypes: ['heart_rate', 'sleep', 'steps', 'workouts', 'calories'],
    syncFrequencyMinutes: 15,
    authType: 'oauth2',
    scopes: ['activity', 'heartrate', 'sleep', 'profile'],
  },
  {
    provider: 'garmin',
    displayName: 'Garmin',
    description: 'GPS activities, heart rate, VO2 max, and training load',
    tier: 1,
    dataTypes: ['heart_rate', 'hrv', 'workouts', 'vo2_max', 'training_load', 'gps_activities'],
    syncFrequencyMinutes: 15,
    authType: 'oauth2',
    scopes: ['read:all'],
  },
  {
    provider: 'oura',
    displayName: 'Oura Ring',
    description: 'Best sleep tracking in the industry',
    tier: 1,
    dataTypes: ['sleep', 'hrv', 'recovery', 'body_temp'],
    syncFrequencyMinutes: 360,
    authType: 'oauth2',
    scopes: ['daily', 'personal', 'session'],
  },
  {
    provider: 'myfitnesspal',
    displayName: 'MyFitnessPal',
    description: 'Nutrition tracking',
    tier: 2,
    dataTypes: ['nutrition', 'calories'],
    syncFrequencyMinutes: 60,
    authType: 'oauth2',
    scopes: ['diary', 'nutrition'],
  },
  {
    provider: 'strava',
    displayName: 'Strava',
    description: 'GPS activities and performance metrics',
    tier: 3,
    dataTypes: ['workouts', 'gps_activities'],
    syncFrequencyMinutes: 0,
    authType: 'oauth2',
    scopes: ['read:all', 'activity:read'],
  },
  {
    provider: 'spotify',
    displayName: 'Spotify',
    description: 'Music for workouts, meditation, and recovery',
    tier: 3,
    dataTypes: [],
    syncFrequencyMinutes: 0,
    authType: 'oauth2',
    scopes: ['user-read-playback-state', 'user-modify-playback-state', 'streaming', 'user-library-read', 'playlist-read-private', 'user-read-recently-played'],
  },
];

// OAuth URLs for each provider
const OAUTH_URLS: Record<IntegrationProvider, { auth: string; token: string }> = {
  whoop: {
    auth: 'https://api.prod.whoop.com/oauth/oauth2/auth',
    token: 'https://api.prod.whoop.com/oauth/oauth2/token',
  },
  apple_health: { auth: '', token: '' },
  fitbit: {
    auth: 'https://www.fitbit.com/oauth2/authorize',
    token: 'https://api.fitbit.com/oauth2/token',
  },
  garmin: {
    auth: 'https://connect.garmin.com/oauthConfirm',
    token: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
  },
  oura: {
    auth: 'https://cloud.ouraring.com/oauth/authorize',
    token: 'https://api.ouraring.com/oauth/token',
  },
  samsung_health: { auth: '', token: '' },
  myfitnesspal: {
    auth: 'https://www.myfitnesspal.com/api/auth/oauth/authorize',
    token: 'https://www.myfitnesspal.com/api/auth/oauth/token',
  },
  nutritionix: { auth: '', token: '' },
  cronometer: {
    auth: 'https://cronometer.com/oauth/authorize',
    token: 'https://cronometer.com/oauth/token',
  },
  strava: {
    auth: 'https://www.strava.com/oauth/authorize',
    token: 'https://www.strava.com/oauth/token',
  },
  spotify: {
    auth: 'https://accounts.spotify.com/authorize',
    token: 'https://accounts.spotify.com/api/token',
  },
};

/**
 * S01.4.1: Get Available Integrations
 * GET /api/integrations
 */
export const getIntegrations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const connectedResult = await query<UserIntegrationRow>(
    `SELECT * FROM user_integrations WHERE user_id = $1 AND status != 'disconnected'`,
    [userId]
  );

  const connectedProviders = new Set(connectedResult.rows.map(i => i.provider));

  const integrations = INTEGRATION_METADATA.map(meta => ({
    ...meta,
    isConnected: connectedProviders.has(meta.provider),
    connectionStatus: connectedResult.rows.find(c => c.provider === meta.provider)?.status,
    lastSyncAt: connectedResult.rows.find(c => c.provider === meta.provider)?.last_sync_at,
  }));

  integrations.sort((a, b) => {
    if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
    return a.tier - b.tier;
  });

  ApiResponse.success(res, {
    integrations,
    connectedCount: connectedResult.rows.length,
    minimumRequired: 1,
    hasMinimum: connectedResult.rows.length >= 1,
  });
});

/**
 * Select Integrations to Connect
 * POST /api/integrations/select
 */
export const selectIntegrations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as SelectIntegrationsInput;

  const selectedMeta = INTEGRATION_METADATA.filter(m =>
    data.integrations.includes(m.provider)
  );

  logger.info('Integrations selected', { userId, integrations: data.integrations });

  ApiResponse.success(res, {
    selected: selectedMeta,
    nextStep: 'connect',
  }, 'Integrations selected');
});

/**
 * S01.4.2: Initiate OAuth Flow
 * POST /api/integrations/oauth/initiate
 */
export const initiateOAuth = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as InitiateOAuthInput;
  const { provider } = data;

  const meta = INTEGRATION_METADATA.find(m => m.provider === provider);
  if (!meta) throw ApiError.badRequest('Unknown integration provider');

  if (meta.authType === 'native') {
    ApiResponse.success(res, {
      authType: 'native',
      message: `${meta.displayName} uses native SDK authentication.`,
    });
    return;
  }

  if (meta.authType === 'api_key') {
    ApiResponse.success(res, {
      authType: 'api_key',
      message: `${meta.displayName} requires an API key.`,
    });
    return;
  }

  // Special handling for WHOOP (uses PKCE, credentials can be per-user or app-level)
  if (provider === 'whoop') {
    // During OAuth initiation, we ONLY need client_id and client_secret
    // We should NOT be checking for access_token or refresh_token - those come AFTER OAuth completion
    // Get per-user credentials from database, or fall back to environment variables
    const integrationResult = await query<{
      client_id: string | null;
      client_secret: string | null;
    }>(
      `SELECT client_id, client_secret
       FROM user_integrations
       WHERE user_id = $1 AND provider = 'whoop'
       LIMIT 1`,
      [userId]
    );
    
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    
    if (integrationResult.rows.length > 0 && integrationResult.rows[0].client_id && integrationResult.rows[0].client_secret) {
      // Use per-user credentials
      clientId = integrationResult.rows[0].client_id;
      clientSecret = integrationResult.rows[0].client_secret;
    } else {
      // Fall back to environment variables
      clientId = process.env.WHOOP_CLIENT_ID;
      clientSecret = process.env.WHOOP_CLIENT_SECRET;
    }
    
    if (!clientId || !clientSecret) {
      throw ApiError.badRequest('WHOOP OAuth not configured. Please add your WHOOP Client ID and Client Secret in settings, or set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables.');
    }
    
    logger.info('WHOOP OAuth initiation - using credentials only (no token check)', {
      userId,
      hasPerUserCredentials: !!(integrationResult.rows.length > 0 && integrationResult.rows[0].client_id),
    });
    
    // Use client-side callback URL for OAuth redirect
    const redirectUri = data.redirectUri || `${env.client.url}/auth/whoop/callback`;
    
    // Generate PKCE
    const { codeVerifier } = generatePKCE();
    
    // Initiate WHOOP OAuth (credentials can be per-user or from env vars)
    const { authUrl, state } = await initiateWhoopOAuth(
      {
        userId,
        redirectUri,
        scopes: meta.scopes,
      },
      codeVerifier,
      clientId,
      clientSecret
    );
    
    logger.info('WHOOP OAuth initiated', { userId, usingPerUserCredentials: !!integrationResult.rows[0]?.client_id });
    
    ApiResponse.success(res, { authUrl, provider, scopes: meta.scopes, state, expiresIn: 600 });
    return;
  }

  const oauthConfig = OAUTH_URLS[provider];
  if (!oauthConfig.auth) {
    throw ApiError.badRequest('OAuth not configured for this provider');
  }

  const state = Buffer.from(JSON.stringify({
    userId,
    provider,
    timestamp: Date.now(),
  })).toString('base64');

  const redirectUri = data.redirectUri || `${env.api.prefix}/integrations/oauth/callback`;
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];

  if (!clientId) {
    throw ApiError.internal(`${meta.displayName} OAuth not configured`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: meta.scopes.join(' '),
    state,
  });

  const authUrl = `${oauthConfig.auth}?${params.toString()}`;

  logger.info('OAuth initiated', { userId, provider });

  ApiResponse.success(res, { authUrl, provider, scopes: meta.scopes, expiresIn: 600 });
});

/**
 * Complete OAuth Flow
 * POST /api/integrations/oauth/complete
 */
export const completeOAuth = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as CompleteOAuthInput;
  const { provider, code, state } = data;

  logger.info('OAuth completion started', {
    userId,
    provider,
    hasCode: !!code,
    hasState: !!state,
  });

  // Request deduplication: Check if this OAuth code has already been processed
  // This prevents duplicate processing when client retries or multiple tabs call the endpoint
  if (code) {
    const { cache } = await import('../services/cache.service.js');
    const dedupeKey = `oauth:complete:${provider}:${code}:${userId}`;
    const existing = cache.get<string>(dedupeKey);
    
    if (existing) {
      logger.warn('OAuth completion attempted with already processed code', {
        userId,
        provider,
        code: code.substring(0, 10) + '...',
      });
      // Return success to prevent client retries, but don't process again
      ApiResponse.success(res, { message: 'OAuth flow already completed', alreadyCompleted: true });
      return;
    }
    
    // Mark this code as being processed (5 minute TTL - codes expire quickly anyway)
    cache.set(dedupeKey, 'processing', 300);
  }

  const meta = INTEGRATION_METADATA.find(m => m.provider === provider);
  if (!meta) throw ApiError.badRequest('Unknown integration provider');

  // Special handling for WHOOP (uses PKCE, credentials can be per-user or app-level)
  let tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date } | null = null;
  
  if (provider === 'whoop') {
    logger.info('WHOOP OAuth completion - starting token exchange', { userId });
    
    // Get credentials from integration (per-user or from env vars)
    // During OAuth completion, we should NOT be checking for access_token/refresh_token
    // We only need client_id/client_secret and PKCE data
    const integrationResult = await query<{
      client_id: string | null;
      client_secret: string | null;
      access_token: string | null; // This temporarily stores PKCE data during OAuth flow
    }>(
      `SELECT client_id, client_secret, access_token
       FROM user_integrations
       WHERE user_id = $1 AND provider = 'whoop'`,
      [userId]
    );
    
    // Get credentials (per-user or from env vars)
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    
    if (integrationResult.rows.length > 0 && integrationResult.rows[0].client_id && integrationResult.rows[0].client_secret) {
      // Use per-user credentials
      clientId = integrationResult.rows[0].client_id;
      clientSecret = integrationResult.rows[0].client_secret;
    } else {
      // Fall back to environment variables
      clientId = process.env.WHOOP_CLIENT_ID;
      clientSecret = process.env.WHOOP_CLIENT_SECRET;
    }
    
    if (!clientId || !clientSecret) {
      throw ApiError.badRequest('WHOOP OAuth not configured. Please add your WHOOP Client ID and Client Secret in settings, or set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables.');
    }
    
    // Get PKCE code verifier from temporary storage (stored in access_token during initiation)
    // Note: access_token column is used temporarily to store PKCE data before OAuth completion
    if (integrationResult.rows.length === 0 || !integrationResult.rows[0].access_token) {
      throw ApiError.badRequest('No pending WHOOP OAuth flow found. Please initiate the OAuth flow first by clicking "Connect WHOOP".');
    }
    
    let codeVerifier: string;
    try {
      const storedData = JSON.parse(integrationResult.rows[0].access_token);
      codeVerifier = storedData.codeVerifier;
    } catch (parseError) {
      logger.error('Failed to parse PKCE data from integration', { userId, error: parseError });
      throw ApiError.badRequest('Invalid OAuth flow state. Please initiate the OAuth flow again by clicking "Connect WHOOP".');
    }
    
    if (!codeVerifier) {
      throw ApiError.badRequest('PKCE code verifier not found. Please initiate the OAuth flow again by clicking "Connect WHOOP".');
    }
    
    // Get stored state from PKCE data (if not provided in request)
    let storedState: string | undefined;
    try {
      const storedData = JSON.parse(integrationResult.rows[0].access_token || '{}');
      storedState = storedData.state;
    } catch {
      // If we can't parse, that's okay - state might be in the request
    }
    
    // Exchange code for tokens (credentials can be per-user or from env vars)
    // Use client-side callback URL (must match what was used in initiateOAuth)
    logger.info('WHOOP OAuth - calling exchangeWhoopOAuthCode', {
      userId,
      hasCode: !!code,
      hasCodeVerifier: !!codeVerifier,
      hasState: !!(state || storedState),
      redirectUri: `${env.client.url}/auth/whoop/callback`,
    });
    
    // Use state from request, or fall back to stored state
    // If neither is available, this is an error (state should always be present)
    if (!state && !storedState) {
      throw ApiError.badRequest('OAuth state parameter is missing. Please initiate the OAuth flow again by clicking "Connect WHOOP".');
    }
    const finalState = state || storedState!;
    
    tokens = await exchangeWhoopOAuthCode(
      {
        userId,
        redirectUri: `${env.client.url}/auth/whoop/callback`,
        scopes: meta.scopes,
      },
      code,
      codeVerifier,
      finalState,
      clientId,
      clientSecret
    );
    
    logger.info('WHOOP OAuth - exchangeWhoopOAuthCode completed', {
      userId,
      hasAccessToken: !!tokens?.accessToken,
      hasRefreshToken: !!tokens?.refreshToken,
      expiresAt: tokens?.expiresAt?.toISOString(),
    });
  } else {
    // Use generic OAuth exchange for other providers
    tokens = await exchangeOAuthCode(provider, code);
  }

  if (!tokens) throw ApiError.badRequest('Failed to complete authorization');
  
  // Validate tokens structure (especially for WHOOP)
  if (provider === 'whoop') {
    if (!tokens.accessToken || typeof tokens.accessToken !== 'string') {
      logger.error('WHOOP tokens invalid structure', {
        userId,
        tokens: tokens ? Object.keys(tokens) : 'null',
        accessTokenType: typeof tokens?.accessToken,
        accessTokenPreview: tokens?.accessToken ? tokens.accessToken.substring(0, 50) : 'missing',
      });
      throw ApiError.badRequest('Invalid token structure received from WHOOP');
    }
    
    // Ensure accessToken is not JSON (should be a plain string token)
    if (tokens.accessToken.trim().startsWith('{')) {
      logger.error('WHOOP accessToken appears to be JSON instead of token string', {
        userId,
        accessTokenPreview: tokens.accessToken.substring(0, 100),
      });
      throw ApiError.badRequest('Invalid access token format received from WHOOP');
    }
    
    logger.info('WHOOP tokens validated before storage', {
      userId,
      accessTokenLength: tokens.accessToken.length,
      hasRefreshToken: !!tokens.refreshToken,
      expiresAt: tokens.expiresAt?.toISOString(),
    });
  }

  // Upsert integration
  const existingResult = await query<UserIntegrationRow>(
    'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );

  // For WHOOP, store the client_id and client_secret used during token exchange
  // This is critical for token refresh - must use the same client_id that was used during initial auth
  let whoopClientId: string | undefined;
  let whoopClientSecret: string | undefined;
  
  if (provider === 'whoop') {
    // Get the credentials that were used during token exchange
    // Check pending integration first (where credentials might be stored)
    const pendingResult = await query<{
      client_id: string | null;
      client_secret: string | null;
    }>(
      `SELECT client_id, client_secret
       FROM user_integrations
       WHERE user_id = $1 AND provider = 'whoop' AND status = 'pending'
       LIMIT 1`,
      [userId]
    );
    
    if (pendingResult.rows.length > 0 && pendingResult.rows[0].client_id && pendingResult.rows[0].client_secret) {
      // Use per-user credentials from pending integration
      whoopClientId = pendingResult.rows[0].client_id;
      whoopClientSecret = pendingResult.rows[0].client_secret;
    } else if (existingResult.rows.length > 0 && existingResult.rows[0].client_id && existingResult.rows[0].client_secret) {
      // Use existing per-user credentials if available
      whoopClientId = existingResult.rows[0].client_id;
      whoopClientSecret = existingResult.rows[0].client_secret;
    } else {
      // Fall back to environment variables (what was used during token exchange)
      whoopClientId = process.env.WHOOP_CLIENT_ID;
      whoopClientSecret = process.env.WHOOP_CLIENT_SECRET;
    }
    
    logger.info('WHOOP OAuth - storing credentials for token refresh', {
      userId,
      hasClientId: !!whoopClientId,
      hasClientSecret: !!whoopClientSecret,
      usingPerUserCredentials: !!(pendingResult.rows[0]?.client_id || existingResult.rows[0]?.client_id),
    });
  }

  let integration: UserIntegrationRow;
  if (existingResult.rows.length > 0) {
    // Update existing integration with tokens and credentials (for WHOOP)
    // Always update access_token with the actual token (not PKCE data)
    if (provider === 'whoop' && whoopClientId && whoopClientSecret) {
      // Update with credentials
      const updateResult = await query<UserIntegrationRow>(
        `UPDATE user_integrations SET
          access_token = $1, refresh_token = $2, token_expiry = $3,
          client_id = $4, client_secret = $5,
          status = 'active', connected_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $6 AND provider = $7
        RETURNING *`,
        [tokens.accessToken, tokens.refreshToken || null, tokens.expiresAt || null, whoopClientId, whoopClientSecret, userId, provider]
      );
      integration = updateResult.rows[0];
    } else if (provider === 'whoop') {
      // WHOOP but no credentials - still update tokens, just don't update client_id/secret
      const updateResult = await query<UserIntegrationRow>(
        `UPDATE user_integrations SET
          access_token = $1, refresh_token = $2, token_expiry = $3,
          status = 'active', connected_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $4 AND provider = $5
        RETURNING *`,
        [tokens.accessToken, tokens.refreshToken || null, tokens.expiresAt || null, userId, provider]
      );
      integration = updateResult.rows[0];
    } else {
      // Non-WHOOP provider
      const updateResult = await query<UserIntegrationRow>(
        `UPDATE user_integrations SET
          access_token = $1, refresh_token = $2, token_expiry = $3,
          status = 'active', connected_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $4 AND provider = $5
        RETURNING *`,
        [tokens.accessToken, tokens.refreshToken || null, tokens.expiresAt || null, userId, provider]
      );
      integration = updateResult.rows[0];
    }
    
    // Verify the update worked correctly
    if (provider === 'whoop') {
      const verifyResult = await query<{ access_token: string }>(
        `SELECT access_token FROM user_integrations WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
      );
      const storedToken = verifyResult.rows[0]?.access_token;
      // Check if it's still PKCE data (JSON) instead of a token (should be a string without JSON structure)
      if (storedToken && storedToken.trim().startsWith('{')) {
        logger.error('WHOOP access_token still contains PKCE data after update', {
          userId,
          provider,
          storedTokenPreview: storedToken.substring(0, 100),
        });
        // Force update again with explicit token
        await query(
          `UPDATE user_integrations SET access_token = $1 WHERE user_id = $2 AND provider = $3`,
          [tokens.accessToken, userId, provider]
        );
      }
    }
  } else {
    // Create new integration with tokens and credentials (for WHOOP)
    const insertParams = provider === 'whoop' && whoopClientId && whoopClientSecret
      ? [userId, provider, tokens.accessToken, tokens.refreshToken || null, tokens.expiresAt || null, whoopClientId, whoopClientSecret, meta.scopes]
      : [userId, provider, tokens.accessToken, tokens.refreshToken || null, tokens.expiresAt || null, meta.scopes];
    
    const insertQuery = provider === 'whoop' && whoopClientId && whoopClientSecret
      ? `INSERT INTO user_integrations (
          user_id, provider, access_token, refresh_token, token_expiry,
          client_id, client_secret, scopes, status, connected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', CURRENT_TIMESTAMP)
        RETURNING *`
      : `INSERT INTO user_integrations (
          user_id, provider, access_token, refresh_token, token_expiry,
          scopes, status, connected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP)
        RETURNING *`;
    
    const createResult = await query<UserIntegrationRow>(insertQuery, insertParams);
    integration = createResult.rows[0];
  }

  // For WHOOP, fetch user profile and trigger initial sync
  if (provider === 'whoop') {
    try {
      // Fetch user profile (email, name, etc.) from WHOOP
      const { fetchWhoopUserProfile } = await import('../services/whoop.service.js');
      const userProfile = await fetchWhoopUserProfile(tokens.accessToken);
      
      // Store user profile in device_info JSONB column
      if (userProfile) {
        await query(
          `UPDATE user_integrations 
           SET device_info = $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND provider = 'whoop'`,
          [JSON.stringify({
            whoop_user_id: userProfile.user_id,
            email: userProfile.email,
            first_name: userProfile.first_name,
            last_name: userProfile.last_name,
            profile_fetched_at: new Date().toISOString(),
            ...userProfile, // Include any additional fields
          }), userId]
        );
        
        logger.info('WHOOP user profile stored', {
          userId,
          whoopUserId: userProfile.user_id,
          hasEmail: !!userProfile.email,
        });
      }
      
      // Trigger initial sync with 90-day backfill
      const syncResult = await whoopDataService.fetchHistoricalData(userId, 90);
      logger.info('WHOOP initial sync completed', {
        userId,
        recovery: syncResult.recovery,
        sleep: syncResult.sleep,
        workouts: syncResult.workouts,
      });
    } catch (error) {
      logger.error('WHOOP setup failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't fail the OAuth completion if profile fetch or sync fails
    }
  }

  await triggerInitialSync(integration);

  logger.info('OAuth completed', { userId, provider });

  // Mark OAuth code as successfully completed (prevent duplicate processing)
  if (code) {
    const { cache } = await import('../services/cache.service.js');
    const dedupeKey = `oauth:complete:${provider}:${code}:${userId}`;
    cache.set(dedupeKey, 'completed', 300); // 5 minute TTL
  }

  ApiResponse.success(res, {
    provider,
    status: 'connected',
    message: `${meta.displayName} connected!`,
  }, 'Integration connected successfully');
});

/**
 * Get Integration Status
 * GET /api/integrations/:provider/status
 */
export const getIntegrationStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { provider } = req.params as { provider: IntegrationProvider };

    const integrationResult = await query<UserIntegrationRow>(
      'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
      [userId, provider]
    );

    if (integrationResult.rows.length === 0) {
      ApiResponse.success(res, { isConnected: false, provider });
      return;
    }

    const integration = integrationResult.rows[0];

    const syncsResult = await query<SyncLogRow>(
      `SELECT * FROM sync_logs WHERE integration_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [integration.id]
    );

    ApiResponse.success(res, {
      isConnected: true,
      provider,
      status: integration.status,
      connectedAt: integration.connected_at,
      lastSyncAt: integration.last_sync_at,
      lastSyncStatus: integration.last_sync_status,
      initialSyncComplete: integration.initial_sync_complete,
      initialSyncProgress: integration.initial_sync_progress,
      recentSyncs: syncsResult.rows.map(s => ({
        syncType: s.sync_type,
        status: s.status,
        recordsProcessed: s.records_processed,
        completedAt: s.completed_at,
      })),
    });
  }
);

/**
 * S01.4.3: Trigger Sync
 * POST /api/integrations/:provider/sync
 */
export const triggerSync = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { provider } = req.params as { provider: IntegrationProvider };
  const data = req.body as TriggerSyncInput;

  const integrationResult = await query<UserIntegrationRow>(
    'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );

  if (integrationResult.rows.length === 0) throw ApiError.notFound('Integration not found');

  const integration = integrationResult.rows[0];

  // For WHOOP, we need access_token to sync data (obtained after OAuth completion)
  // OAuth initiation only requires clientId/clientSecret (stored in DB)
  const hasAccessToken = !!(integration.access_token && integration.access_token.trim().length > 0);
  
  // Check integration status and provide helpful error messages
  if (integration.status === 'error') {
    const errorMessage = integration.last_sync_error || 
      'WHOOP integration is in an error state. Please disconnect and reconnect your WHOOP account.';
    
    // If the error is due to credentials mismatch, clear tokens and allow reconnection
    const isCredentialsMismatch = errorMessage.includes('credentials have changed') || 
                                   errorMessage.includes('Client ID') ||
                                   errorMessage.includes('does not match');
    
    if (isCredentialsMismatch && integration.access_token) {
      // Clear invalid tokens and set status to pending so user can reconnect
      logger.info('Clearing invalid tokens due to credentials mismatch', { userId });
      await query(
        `UPDATE user_integrations SET
         access_token = NULL, refresh_token = NULL, token_expiry = NULL,
         status = 'pending', last_sync_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
      );
      
      throw ApiError.badRequest(
        'WHOOP credentials have changed. Your tokens have been cleared. Please click "Connect WHOOP" to reconnect with your current credentials.'
      );
    }
    
    throw ApiError.badRequest(errorMessage);
  }
  
  if (integration.status === 'disconnected') {
    throw ApiError.badRequest('WHOOP integration is disconnected. Please connect your WHOOP account first.');
  }
  
  // Check if OAuth has been completed (we have access_token)
  // If status is 'pending' but we have an access_token, update status to 'active'
  if (integration.status === 'pending' && hasAccessToken) {
    logger.info('WHOOP integration has access_token but status is pending - updating to active', { userId });
    await query(
      `UPDATE user_integrations SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND provider = $2`,
      [userId, provider]
    );
  } else if (!hasAccessToken) {
    // No access token means OAuth hasn't been completed yet
    // Check if credentials are configured
    const hasCredentials = !!(integration.client_id && integration.client_secret) || 
                           !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
    
    if (!hasCredentials) {
      throw ApiError.badRequest(
        'WHOOP credentials not configured. Please add your WHOOP Client ID and Client Secret in settings first, then click "Connect WHOOP" to complete the OAuth flow.'
      );
    }
    
    // Credentials exist but OAuth not completed - provide clear next steps
    throw ApiError.badRequest(
      'WHOOP OAuth authorization required. Your credentials are saved. Please go to the WHOOP page and click "Connect WHOOP" to authorize access. After authorization, you can sync your data.'
    );
  }
  
  // Final validation: ensure we have access_token before proceeding with sync
  if (!hasAccessToken) {
    throw ApiError.badRequest(
      'WHOOP integration is not connected. Please complete the OAuth flow to get an access token.'
    );
  }

  const startedAt = new Date();

  const syncLogResult = await query<SyncLogRow>(
    `INSERT INTO sync_logs (
      user_id, integration_id, provider, sync_type, started_at, status,
      records_processed, records_created, records_updated, records_skipped
    ) VALUES ($1, $2, $3, $4, $5, 'success', 0, 0, 0, 0)
    RETURNING *`,
    [userId, integration.id, provider, data.syncType || 'manual', startedAt]
  );

  const syncLog = syncLogResult.rows[0];

  try {
    const result = await performSync(integration, data);

    await query(
      `UPDATE sync_logs SET
        completed_at = CURRENT_TIMESTAMP,
        duration_ms = $1,
        status = $2,
        records_processed = $3,
        records_created = $4,
        records_updated = $5,
        date_range_start = $6,
        date_range_end = $7
      WHERE id = $8`,
      [
        Date.now() - startedAt.getTime(),
        result.status,
        result.recordsProcessed,
        result.recordsCreated,
        result.recordsUpdated,
        result.dateRangeStart || null,
        result.dateRangeEnd || null,
        syncLog.id,
      ]
    );

    await query(
      `UPDATE user_integrations SET
        last_sync_at = CURRENT_TIMESTAMP,
        last_sync_status = $1,
        sync_retry_count = 0
      WHERE id = $2`,
      [result.status, integration.id]
    );

    // Notify frontend so WHOOP page auto-refreshes
    socketService.emitToUser(userId, 'whoop-data-synced', {
      syncedAt: new Date().toISOString(),
      type: 'manual',
    });
  } catch (error) {
    await query(
      `UPDATE sync_logs SET
        status = 'failed',
        sync_errors = $1
      WHERE id = $2`,
      [JSON.stringify([{
        code: 'SYNC_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      }]), syncLog.id]
    );

    await query(
      `UPDATE user_integrations SET
        last_sync_status = 'failed',
        sync_retry_count = sync_retry_count + 1
      WHERE id = $1`,
      [integration.id]
    );
  }

  const updatedSyncResult = await query<SyncLogRow>(
    'SELECT * FROM sync_logs WHERE id = $1',
    [syncLog.id]
  );

  const updatedSyncLog = updatedSyncResult.rows[0];

  logger.info('Sync completed', {
    userId,
    provider,
    status: updatedSyncLog.status,
    records: updatedSyncLog.records_processed,
  });

  ApiResponse.success(res, {
    syncId: syncLog.id,
    status: updatedSyncLog.status,
    recordsProcessed: updatedSyncLog.records_processed,
    duration: updatedSyncLog.duration_ms,
  });
});

/**
 * Update Integration Settings
 * PATCH /api/integrations/:provider
 */
export const updateIntegration = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { provider } = req.params as { provider: IntegrationProvider };
  const data = req.body as UpdateIntegrationInput;

  const integrationResult = await query<UserIntegrationRow>(
    'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );

  if (integrationResult.rows.length === 0) throw ApiError.notFound('Integration not found');

  const updates: string[] = [];
  const values: (string | boolean | DataType[])[] = [];
  let paramIndex = 1;

  if (data.isEnabled !== undefined) {
    updates.push(`is_enabled = $${paramIndex++}`);
    values.push(data.isEnabled);
    updates.push(`status = $${paramIndex++}`);
    values.push(data.isEnabled ? 'active' : 'paused');
  }

  if (data.isPrimaryForDataTypes) {
    updates.push(`is_primary_for_data_types = $${paramIndex++}`);
    values.push(data.isPrimaryForDataTypes as DataType[]);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(integrationResult.rows[0].id);

  const updateResult = await query<UserIntegrationRow>(
    `UPDATE user_integrations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  logger.info('Integration updated', { userId, provider });

  ApiResponse.success(res, { integration: updateResult.rows[0] }, 'Integration updated');
});

/**
 * Disconnect Integration
 * DELETE /api/integrations/:provider
 */
export const disconnectIntegration = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { provider } = req.params as { provider: IntegrationProvider };

    const integrationResult = await query<UserIntegrationRow>(
      'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
      [userId, provider]
    );

    if (integrationResult.rows.length === 0) throw ApiError.notFound('Integration not found');

    await query(
      `UPDATE user_integrations SET
        status = 'disconnected',
        disconnected_at = CURRENT_TIMESTAMP,
        access_token = '',
        refresh_token = NULL
      WHERE id = $1`,
      [integrationResult.rows[0].id]
    );

    logger.info('Integration disconnected', { userId, provider });

    ApiResponse.success(res, null, 'Integration disconnected');
  }
);

/**
 * Get Sync Dashboard
 * GET /api/integrations/sync/status
 */
export const getSyncDashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const integrationsResult = await query<UserIntegrationRow>(
    `SELECT * FROM user_integrations WHERE user_id = $1 AND status != 'disconnected'`,
    [userId]
  );

  const dashboard = integrationsResult.rows.map(integration => {
    const meta = INTEGRATION_METADATA.find(m => m.provider === integration.provider);

    let statusIcon = '✅';
    if (integration.status === 'error') statusIcon = '❌';
    else if (integration.status === 'paused') statusIcon = '⏸️';
    else if (
      integration.last_sync_at &&
      Date.now() - integration.last_sync_at.getTime() > 24 * 60 * 60 * 1000
    ) {
      statusIcon = '⚠️';
    }

    return {
      provider: integration.provider,
      displayName: meta?.displayName || integration.provider,
      status: integration.status,
      statusIcon,
      lastSyncAt: integration.last_sync_at,
      lastSyncStatus: integration.last_sync_status,
      initialSyncComplete: integration.initial_sync_complete,
      isEnabled: integration.is_enabled,
    };
  });

  ApiResponse.success(res, { integrations: dashboard });
});

/**
 * Get Golden Source Configuration
 * GET /api/integrations/golden-source
 */
export const getGoldenSourceConfig = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const integrationsResult = await query<UserIntegrationRow>(
      `SELECT * FROM user_integrations WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const connectedProviders = integrationsResult.rows.map(i => i.provider);

    const config: Partial<Record<DataType, IntegrationProvider[]>> = {};

    for (const [dataType, providers] of Object.entries(GOLDEN_SOURCE_PRIORITY)) {
      config[dataType as DataType] = providers.filter(p => connectedProviders.includes(p));
    }

    ApiResponse.success(res, { config });
  }
);

/**
 * Complete Integrations Step
 * POST /api/integrations/complete
 */
export const completeIntegrationsStep = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM user_integrations WHERE user_id = $1 AND status IN ('active', 'pending')`,
      [userId]
    );
    const connectedCount = parseInt(countResult.rows[0].count, 10);

    if (connectedCount === 0) {
      throw ApiError.badRequest('At least one integration is required');
    }

    await query(
      'UPDATE users SET onboarding_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['preferences_pending', userId]
    );

    logger.info('Integrations step completed', { userId, connectedCount });

    ApiResponse.success(res, {
      connectedCount,
      nextStep: 'preferences',
    }, 'Integration setup complete');
  }
);

// Helper Functions

async function exchangeOAuthCode(
  _provider: IntegrationProvider,
  _code: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date } | null> {
  // Placeholder - implement actual OAuth token exchange
  return {
    accessToken: 'mock_access_token_' + Date.now(),
    refreshToken: 'mock_refresh_token_' + Date.now(),
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };
}

async function triggerInitialSync(integration: UserIntegrationRow): Promise<void> {
  await query(
    `UPDATE user_integrations SET
      status = 'active',
      initial_sync_progress = $1
    WHERE id = $2`,
    [JSON.stringify({
      totalDays: 30,
      syncedDays: 0,
      startedAt: new Date(),
    }), integration.id]
  );

  logger.info('Initial sync triggered', {
    integrationId: integration.id,
    provider: integration.provider,
  });
}

async function performSync(
  integration: UserIntegrationRow,
  options: TriggerSyncInput
): Promise<{
  status: 'success' | 'partial' | 'failed';
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
}> {
  // WHOOP-specific sync
  if (integration.provider === 'whoop') {
    try {
      const days = options.dateRange?.startDate
        ? Math.ceil((new Date().getTime() - new Date(options.dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 7; // Default to 7 days if no range specified
      
      const result = await whoopDataService.fetchHistoricalData(integration.user_id, days);
      const totalRecords = result.recovery + result.sleep + result.workouts;
      
      return {
        status: totalRecords > 0 ? 'success' : 'partial',
        recordsProcessed: totalRecords,
        recordsCreated: totalRecords,
        recordsUpdated: 0,
        dateRangeStart: options.dateRange?.startDate 
          ? (typeof options.dateRange.startDate === 'string' 
              ? new Date(options.dateRange.startDate) 
              : options.dateRange.startDate)
          : new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        dateRangeEnd: options.dateRange?.endDate
          ? (typeof options.dateRange.endDate === 'string'
              ? new Date(options.dateRange.endDate)
              : options.dateRange.endDate)
          : new Date(),
      };
    } catch (error) {
      logger.error('WHOOP sync failed', {
        integrationId: integration.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        status: 'failed',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
      };
    }
  }
  
  // Placeholder for other providers
  return {
    status: 'success',
    recordsProcessed: Math.floor(Math.random() * 100),
    recordsCreated: Math.floor(Math.random() * 50),
    recordsUpdated: Math.floor(Math.random() * 30),
    dateRangeStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    dateRangeEnd: new Date(),
  };
}

/**
 * WHOOP-Specific Endpoints
 */

/**
 * Register WHOOP Webhook
 * POST /api/integrations/whoop/webhook/register
 */
export const registerWhoopWebhook = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { webhookUrl, webhookSecret } = req.body as {
      webhookUrl: string;
      webhookSecret?: string;
    };

    if (!webhookUrl) {
      throw ApiError.badRequest('webhookUrl is required');
    }

    // Update integration with webhook URL
    await query(
      `UPDATE user_integrations SET
       webhook_url = $1, webhook_secret = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3 AND provider = 'whoop'`,
      [webhookUrl, webhookSecret || null, userId]
    );

    logger.info('WHOOP webhook registered', { userId, webhookUrl });

    ApiResponse.success(res, { registered: true }, 'Webhook URL registered');
  }
);

/**
 * Get WHOOP Status
 * GET /api/integrations/whoop/status
 * Cached for 10 seconds to reduce database load for frequently polled endpoint
 */
export const getWhoopStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Check cache first (10 second TTL for status checks)
    const { cache } = await import('../services/cache.service.js');
    const cacheKey = `whoop:status:${userId}`;
    const cached = cache.get<{
      isConnected: boolean;
      hasCredentials: boolean;
      hasPerUserCredentials: boolean;
      status: string;
      connectedAt: Date | null;
      lastSyncAt: Date | null;
      webhookRegistered: boolean;
      initialSyncComplete: boolean;
      provider: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      whoopUserId?: number;
    }>(cacheKey);
    
    if (cached) {
      ApiResponse.success(res, cached);
      return;
    }

    // Query to get WHOOP integration status
    const integrationResult = await query<{
      id: string;
      status: string;
      connected_at: Date | null;
      last_sync_at: Date | null;
      webhook_url: string | null;
      webhook_secret: string | null;
      initial_sync_complete: boolean;
      device_info: Record<string, unknown> | null;
      client_id: string | null;
      client_secret: string | null;
    }>(
      `SELECT 
        id, 
        status, 
        connected_at, 
        last_sync_at, 
        webhook_url,
        webhook_secret,
        initial_sync_complete,
        device_info,
        client_id,
        client_secret
       FROM user_integrations
       WHERE user_id = $1 AND provider = 'whoop'
       LIMIT 1`,
      [userId]
    );

    // Check if application-level credentials are configured
    const hasAppCredentials = !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);

    if (integrationResult.rows.length === 0) {
      logger.info('WHOOP integration not found', { userId, hasAppCredentials });
      const notFoundResponse = {
        isConnected: false,
        hasCredentials: hasAppCredentials,
        provider: 'whoop',
        status: 'pending',
      };
      // Cache the "not found" response for 10 seconds
      cache.set(cacheKey, notFoundResponse, 10);
      ApiResponse.success(res, notFoundResponse);
      return;
    }

    const integration = integrationResult.rows[0];
    
    // Check if per-user credentials exist
    const hasPerUserCredentials = !!(integration.client_id && integration.client_secret);
    // Credentials are available if either per-user or app-level credentials exist
    const hasCredentials = hasPerUserCredentials || hasAppCredentials;
    
    // Extract user profile data from device_info
    const deviceInfo = integration.device_info as {
      email?: string;
      first_name?: string;
      last_name?: string;
      whoop_user_id?: number;
      [key: string]: unknown;
    } | null;

    const statusResponse = {
      isConnected: integration.status === 'active',
      hasCredentials: hasCredentials,
      hasPerUserCredentials: hasPerUserCredentials,
      status: integration.status,
      connectedAt: integration.connected_at,
      lastSyncAt: integration.last_sync_at,
      webhookRegistered: !!integration.webhook_url && String(integration.webhook_url).trim().length > 0,
      initialSyncComplete: integration.initial_sync_complete,
      provider: 'whoop',
      // Include user profile data if available
      email: deviceInfo?.email,
      whoopUserId: deviceInfo?.whoop_user_id,
      firstName: deviceInfo?.first_name,
      lastName: deviceInfo?.last_name,
    };
    
    // Cache the response for 10 seconds to reduce database load
    cache.set(cacheKey, statusResponse, 10);
    
    ApiResponse.success(res, statusResponse);
  }
);

/**
 * Store WHOOP Credentials
 * POST /api/integrations/whoop/credentials
 */
export const storeWhoopCredentials = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as StoreWhoopCredentialsInput;
    const { clientId, clientSecret } = data;

    // Validate credentials
    if (!clientId || clientId.trim().length === 0) {
      throw ApiError.badRequest('Client ID is required');
    }
    if (!clientSecret || clientSecret.trim().length === 0) {
      throw ApiError.badRequest('Client secret is required');
    }

    // Check if integration exists
    const existingResult = await query<UserIntegrationRow>(
      'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
      [userId, 'whoop']
    );

    if (existingResult.rows.length === 0) {
      // Create new integration with credentials (no tokens yet - will be set after OAuth)
      // access_token is not included - it will be NULL (requires migration to make column nullable)
      const createResult = await query<UserIntegrationRow>(
        `INSERT INTO user_integrations (
          user_id, provider, client_id, client_secret, status
        ) VALUES ($1, 'whoop', $2, $3, 'pending')
        RETURNING *`,
        [userId, clientId, clientSecret]
      );

      logger.info('WHOOP credentials stored', { userId });
      ApiResponse.success(res, {
        id: createResult.rows[0].id,
        status: createResult.rows[0].status,
      }, 'WHOOP credentials stored successfully');
    } else {
      const existing = existingResult.rows[0];
      const credentialsChanged = 
        existing.client_id !== clientId || 
        existing.client_secret !== clientSecret;
      
      // If credentials changed and tokens exist, we need to invalidate tokens
      // because tokens were issued with the old client_id and won't work with the new one
      if (credentialsChanged && existing.access_token) {
        logger.warn('WHOOP credentials changed - invalidating existing tokens', {
          userId,
          hadTokens: !!existing.access_token,
          oldClientId: existing.client_id?.substring(0, 20) + '...',
          newClientId: clientId.substring(0, 20) + '...',
        });
        
        // Clear tokens and set status to pending - user must re-authenticate
        const updateResult = await query<UserIntegrationRow>(
          `UPDATE user_integrations SET
           client_id = $1, client_secret = $2,
           access_token = NULL, refresh_token = NULL, token_expiry = NULL,
           status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $3 AND provider = 'whoop'
           RETURNING *`,
          [clientId, clientSecret, userId]
        );

        logger.info('WHOOP credentials updated - tokens cleared (re-authentication required)', { userId });
        ApiResponse.success(res, {
          id: updateResult.rows[0].id,
          status: updateResult.rows[0].status,
          requiresReauth: true,
        }, 'WHOOP credentials updated. Please reconnect your WHOOP account to continue.');
      } else {
        // Credentials unchanged or no tokens exist - safe to update
        const updateResult = await query<UserIntegrationRow>(
          `UPDATE user_integrations SET
           client_id = $1, client_secret = $2, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $3 AND provider = 'whoop'
           RETURNING *`,
          [clientId, clientSecret, userId]
        );

        logger.info('WHOOP credentials updated', { userId });
        ApiResponse.success(res, {
          id: updateResult.rows[0].id,
          status: updateResult.rows[0].status,
        }, 'WHOOP credentials updated successfully');
      }
    }
  }
);

/**
 * Delete/Disconnect WHOOP Credentials
 * DELETE /api/integrations/whoop/credentials
 */
export const deleteWhoopCredentials = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Check if integration exists
    const existingResult = await query<UserIntegrationRow>(
      'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
      [userId, 'whoop']
    );

    if (existingResult.rows.length === 0) {
      throw ApiError.badRequest('WHOOP credentials not found');
    }

    // Update integration to disconnected state and clear webhook
    await query(
      `UPDATE user_integrations SET
       status = 'disconnected',
       webhook_url = NULL,
       webhook_secret = NULL,
       disconnected_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND provider = 'whoop'`,
      [userId]
    );

    logger.info('WHOOP credentials disconnected', { userId });

    ApiResponse.success(res, { disconnected: true }, 'WHOOP credentials disconnected successfully');
  }
);

/**
 * Manage WHOOP Tokens (Add/Update)
 * POST /api/integrations/whoop/tokens
 */
export const manageWhoopTokens = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as ManageWhoopTokensInput;
    const { accessToken, refreshToken, tokenExpiry } = data;

    // Validate tokens
    if (!accessToken || accessToken.trim().length === 0) {
      throw ApiError.badRequest('Access token is required');
    }

    // Parse token expiry if provided
    let expiresAt: Date | null = null;
    if (tokenExpiry) {
      // tokenExpiry is always a string from the validator
      expiresAt = new Date(tokenExpiry);
      if (isNaN(expiresAt.getTime())) {
        throw ApiError.badRequest('Invalid token expiry date format');
      }
    }

    // Check if integration exists
    const existingResult = await query<UserIntegrationRow>(
      'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
      [userId, 'whoop']
    );

    if (existingResult.rows.length === 0) {
      // Create new integration
      const createResult = await query<UserIntegrationRow>(
        `INSERT INTO user_integrations (
          user_id, provider, access_token, refresh_token, token_expiry,
          scopes, status, connected_at
        ) VALUES ($1, 'whoop', $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          userId,
          accessToken,
          refreshToken || null,
          expiresAt,
          ['read:recovery', 'read:sleep', 'read:workout', 'read:cycles', 'read:profile', 'read:body_measurement', 'offline'],
        ]
      );

      logger.info('WHOOP tokens added', { userId });

      ApiResponse.success(res, {
        id: createResult.rows[0].id,
        status: createResult.rows[0].status,
        connectedAt: createResult.rows[0].connected_at,
      }, 'WHOOP tokens added successfully');
    } else {
      // Update existing integration
      const updateResult = await query<UserIntegrationRow>(
        `UPDATE user_integrations SET
         access_token = $1,
         refresh_token = COALESCE($2, refresh_token),
         token_expiry = COALESCE($3, token_expiry),
         status = 'active',
         connected_at = COALESCE(connected_at, CURRENT_TIMESTAMP),
         disconnected_at = NULL,
         updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4 AND provider = 'whoop'
         RETURNING *`,
        [accessToken, refreshToken || null, expiresAt, userId]
      );

      logger.info('WHOOP tokens updated', { userId });

      ApiResponse.success(res, {
        id: updateResult.rows[0].id,
        status: updateResult.rows[0].status,
        connectedAt: updateResult.rows[0].connected_at,
      }, 'WHOOP tokens updated successfully');
    }
  }
);

/**
 * Get WHOOP Tokens (masked for security, or unmasked if requested)
 * GET /api/integrations/whoop/tokens?unmasked=true
 */
export const getWhoopTokens = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Check if unmasked tokens are requested (for form prefilling)
    const unmasked = req.query.unmasked === 'true';

    const integrationResult = await query<{
      id: string;
      access_token: string;
      refresh_token: string | null;
      token_expiry: Date | null;
      status: string;
      connected_at: Date | null;
    }>(
      `SELECT id, access_token, refresh_token, token_expiry, status, connected_at
       FROM user_integrations
       WHERE user_id = $1 AND provider = 'whoop'
       LIMIT 1`,
      [userId]
    );

    if (integrationResult.rows.length === 0) {
      ApiResponse.success(res, { hasTokens: false });
      return;
    }

    const integration = integrationResult.rows[0];

    // If unmasked is requested, return full tokens (only for the authenticated user)
    if (unmasked) {
      // Format token expiry for datetime-local input (YYYY-MM-DDTHH:mm)
      let tokenExpiryFormatted: string | null = null;
      if (integration.token_expiry) {
        const date = new Date(integration.token_expiry);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        tokenExpiryFormatted = `${year}-${month}-${day}T${hours}:${minutes}`;
      }

      ApiResponse.success(res, {
        hasTokens: true,
        accessToken: integration.access_token,
        refreshToken: integration.refresh_token,
        tokenExpiry: tokenExpiryFormatted,
        tokenExpiryISO: integration.token_expiry?.toISOString() || null,
        status: integration.status,
        connectedAt: integration.connected_at,
      });
      return;
    }

    // Mask tokens for security (show first 4 and last 4 characters)
    const maskToken = (token: string | null): string | null => {
      if (!token) return null;
      if (token.length <= 8) return '****';
      return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
    };

    ApiResponse.success(res, {
      hasTokens: true,
      accessTokenMasked: maskToken(integration.access_token),
      refreshTokenMasked: maskToken(integration.refresh_token),
      tokenExpiry: integration.token_expiry,
      status: integration.status,
      connectedAt: integration.connected_at,
    });
  }
);

/**
 * Delete WHOOP Tokens
 * DELETE /api/integrations/whoop/tokens
 */
export const deleteWhoopTokens = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const existingResult = await query<UserIntegrationRow>(
      'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
      [userId, 'whoop']
    );

    if (existingResult.rows.length === 0) {
      throw ApiError.notFound('WHOOP tokens not found');
    }

    // Delete tokens but keep integration record
    await query(
      `UPDATE user_integrations SET
       access_token = '',
       refresh_token = NULL,
       token_expiry = NULL,
       status = 'disconnected',
       disconnected_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND provider = 'whoop'`,
      [userId]
    );

    logger.info('WHOOP tokens deleted', { userId });

    ApiResponse.success(res, { deleted: true }, 'WHOOP tokens deleted successfully');
  }
);

/**
 * Disable/Enable WHOOP Integration
 * PATCH /api/integrations/whoop/tokens/disable
 */
export const toggleWhoopTokens = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { disabled } = req.body as { disabled?: boolean };
    const newStatus = disabled ? 'paused' : 'active';

    const existingResult = await query<UserIntegrationRow>(
      'SELECT * FROM user_integrations WHERE user_id = $1 AND provider = $2',
      [userId, 'whoop']
    );

    if (existingResult.rows.length === 0) {
      throw ApiError.notFound('WHOOP integration not found');
    }

    await query(
      `UPDATE user_integrations SET
       status = $1,
       updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND provider = 'whoop'`,
      [newStatus, userId]
    );

    logger.info(`WHOOP integration ${disabled ? 'disabled' : 'enabled'}`, { userId });

    ApiResponse.success(res, {
      status: newStatus,
      disabled: disabled ?? false,
    }, `WHOOP integration ${disabled ? 'disabled' : 'enabled'} successfully`);
  }
);

export default {
  getIntegrations,
  selectIntegrations,
  initiateOAuth,
  completeOAuth,
  getIntegrationStatus,
  triggerSync,
  updateIntegration,
  disconnectIntegration,
  getSyncDashboard,
  getGoldenSourceConfig,
  completeIntegrationsStep,
  registerWhoopWebhook,
  getWhoopStatus,
  storeWhoopCredentials,
  deleteWhoopCredentials,
  manageWhoopTokens,
  getWhoopTokens,
  deleteWhoopTokens,
  toggleWhoopTokens,
};
