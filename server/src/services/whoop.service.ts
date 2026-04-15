/**
 * @file WHOOP Integration Service
 * @description OAuth 2.0 + PKCE flow, token management, and webhook registration for WHOOP API
 */

import crypto from 'crypto';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { ApiError } from '../utils/ApiError.js';

// WHOOP API Configuration
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer';
const WHOOP_OAUTH_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_OAUTH_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

interface WhoopTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
}

export interface WhoopUserProfile {
  user_id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown; // Allow for additional fields
}

interface WhoopOAuthParams {
  userId: string;
  redirectUri: string;
  scopes?: string[];
}

export interface WhoopRecoveryData {
  cycle_id: string;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
}

export interface WhoopSleepData {
  id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score: {
    stage_summary: {
      total_sleep_time_milli: number;
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
    };
    sleep_efficiency_percentage: number;
    sleep_consistency_percentage: number;
    sleep_performance_percentage: number;
    respiratory_rate: number;
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
  };
}

export interface WhoopWorkoutData {
  id: string;
  user_id: number;
  sport_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  score: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    percent_recorded: number;
  };
  distance_meter?: number;
  altitude_gain_meter?: number;
  zone_duration?: {
    zone_zero_milli: number;
    zone_one_milli: number;
    zone_two_milli: number;
    zone_three_milli: number;
    zone_four_milli: number;
    zone_five_milli: number;
  };
}

/**
 * Generate PKCE code verifier and challenge
 */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // Generate code verifier (43-128 characters, URL-safe)
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  
  // Generate code challenge (SHA256 hash, base64url encoded)
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

/**
 * Initiate WHOOP OAuth flow with PKCE
 * Credentials can be provided as parameters (per-user) or read from environment variables (fallback)
 */
export async function initiateWhoopOAuth(
  params: WhoopOAuthParams,
  codeVerifier: string,
  clientId?: string,
  clientSecret?: string
): Promise<{ authUrl: string; state: string }> {
  const { redirectUri, scopes } = params;
  
  // Use provided credentials or fall back to environment variables
  const finalClientId = clientId || process.env.WHOOP_CLIENT_ID;
  const finalClientSecret = clientSecret || process.env.WHOOP_CLIENT_SECRET;

  console.log('finalClientId:', finalClientId);
  console.log('finalClientSecret:', finalClientSecret);
  
  if (!finalClientId || !finalClientSecret) {
    throw ApiError.internal('WHOOP OAuth not configured. Please provide client ID and secret, or set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables.');
  }
  
  // Generate state for CSRF protection
  // WHOOP spec: "The state parameter must be eight characters long if you need to generate it yourself"
  // Using 8 bytes (16 hex chars) for better security while still being compliant
  const state = crypto.randomBytes(8).toString('hex'); // 16 hex characters (8 bytes * 2)
  
  // Generate code challenge from the provided code verifier (PKCE requirement)
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  // Store code verifier and state in session/database (for later verification)
  await query(
    `INSERT INTO user_integrations (user_id, provider, access_token, status)
     VALUES ($1, 'whoop', $2, 'pending')
     ON CONFLICT (user_id, provider) 
     DO UPDATE SET access_token = $2, status = 'pending'`,
    [params.userId, JSON.stringify({ codeVerifier, state, codeChallenge })]
  );
  
  // Build OAuth URL
  const scopeString = (scopes || [
    'read:recovery',
    'read:sleep',
    'read:workout',
    'read:cycles',
    'read:profile',
    'read:body_measurement',
    'offline',
  ]).join(' ');
  
  const authUrl = new URL(WHOOP_OAUTH_AUTH_URL);
  authUrl.searchParams.set('client_id', finalClientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopeString);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  logger.info('WHOOP OAuth initiated', {
    userId: params.userId,
    state,
  });
  
  return { authUrl: authUrl.toString(), state };
}

/**
 * Exchange OAuth code for access token
 * Credentials can be provided as parameters (per-user) or read from environment variables (fallback)
 */
export async function exchangeWhoopOAuthCode(
  params: WhoopOAuthParams,
  code: string,
  codeVerifier: string,
  state: string,
  clientId?: string,
  clientSecret?: string
): Promise<WhoopTokens> {
  const { redirectUri, userId } = params;
  
  // Use provided credentials or fall back to environment variables
  const finalClientId = clientId || process.env.WHOOP_CLIENT_ID;
  const finalClientSecret = clientSecret || process.env.WHOOP_CLIENT_SECRET;
  
  if (!finalClientId || !finalClientSecret) {
    throw ApiError.internal('WHOOP OAuth not configured. Please provide client ID and secret, or set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables.');
  }
  
  // Verify state (CSRF protection)
  const storedData = await query<{ access_token: string }>(
    `SELECT access_token FROM user_integrations 
     WHERE user_id = $1 AND provider = 'whoop' AND status = 'pending'`,
    [userId]
  );
  
  if (storedData.rows.length === 0) {
    throw ApiError.badRequest('No pending OAuth flow found');
  }
  
  const stored = JSON.parse(storedData.rows[0].access_token);
  if (stored.state !== state) {
    throw ApiError.badRequest('Invalid state parameter');
  }
  
  // Exchange code for tokens (OAuth 2.0 Authorization Code Flow with PKCE)
  // WHOOP OAuth Token URL: https://api.prod.whoop.com/oauth/oauth2/token
  // Required parameters: grant_type, code, code_verifier, redirect_uri, client_id, client_secret
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: finalClientId,
    client_secret: finalClientSecret,
  });
  
  logger.info('WHOOP token exchange request', {
    userId,
    url: WHOOP_OAUTH_TOKEN_URL,
    hasCode: !!code,
    hasCodeVerifier: !!codeVerifier,
    redirectUri,
    hasClientId: !!finalClientId,
    hasClientSecret: !!finalClientSecret,
  });
  
  const tokenResponse = await fetch(WHOOP_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams,
  });
  
  logger.debug('WHOOP token exchange response status', {
    userId,
    status: tokenResponse.status,
    statusText: tokenResponse.statusText,
    ok: tokenResponse.ok,
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    let errorMessage = 'Token exchange failed';
    let errorData: any = null;
    
    try {
      errorData = JSON.parse(errorText);
      errorMessage = errorData.error_description || errorData.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    logger.error('WHOOP token exchange failed', {
      userId,
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      error: errorMessage,
      errorDetails: errorData,
      responseBody: errorText.substring(0, 500),
      requestUrl: WHOOP_OAUTH_TOKEN_URL,
      note: tokenResponse.status === 400 
        ? 'Request may be malformed or code expired' 
        : tokenResponse.status === 401
        ? 'Invalid client credentials'
        : 'Unknown error',
    });
    
    throw ApiError.badRequest(`Token exchange failed: ${errorMessage}`);
  }
  
  const responseText = await tokenResponse.text();
  let tokenData: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  
  try {
    tokenData = JSON.parse(responseText);
  } catch (parseError) {
    logger.error('WHOOP token exchange - failed to parse response', {
      userId,
      responsePreview: responseText.substring(0, 500),
      error: parseError instanceof Error ? parseError.message : 'Unknown error',
    });
    throw ApiError.badRequest('Invalid response from WHOOP token endpoint');
  }
  
  if (!tokenData.access_token) {
    logger.error('WHOOP token exchange - missing access_token in response', {
      userId,
      responseData: tokenData,
    });
    throw ApiError.badRequest('No access token received from WHOOP');
  }
  
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : undefined;
  
  const tokens: WhoopTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    tokenType: tokenData.token_type || 'Bearer',
  };
  
  logger.info('WHOOP tokens obtained successfully', {
    userId,
    hasAccessToken: !!tokens.accessToken,
    hasRefreshToken: !!tokens.refreshToken,
    expiresAt: tokens.expiresAt?.toISOString(),
    expiresIn: tokenData.expires_in,
    tokenType: tokens.tokenType,
    note: !tokens.refreshToken ? 'No refresh token - user may need to reconnect when token expires' : 'Refresh token obtained',
  });
  
  return tokens;
}

/**
 * Fetch WHOOP user profile (including email)
 * GET /developer/v2/user/profile/basic
 */
export async function fetchWhoopUserProfile(
  accessToken: string
): Promise<WhoopUserProfile | null> {
  try {
    const profileResponse = await fetch(`${WHOOP_API_BASE}/v2/user/profile/basic`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!profileResponse.ok) {
      const error = await profileResponse.text();
      logger.warn('WHOOP profile fetch failed', {
        status: profileResponse.status,
        error,
      });
      // Don't throw - profile is optional
      return null;
    }

    const profileData = await profileResponse.json() as WhoopUserProfile;
    
    logger.info('WHOOP user profile fetched', {
      userId: profileData.user_id,
      hasEmail: !!profileData.email,
      hasName: !!(profileData.first_name || profileData.last_name),
    });

    return profileData;
  } catch (error) {
    logger.error('WHOOP profile fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - profile is optional
    return null;
  }
}

/**
 * Refresh WHOOP access token
 * Credentials can be provided as parameters (per-user) or read from environment variables (fallback)
 * Includes 'offline' scope to ensure refresh token is returned
 */
export async function refreshWhoopToken(
  refreshToken: string,
  clientId?: string,
  clientSecret?: string,
  userId?: string,
  redirectUri?: string
): Promise<WhoopTokens> {
  // Use provided credentials or fall back to environment variables
  const finalClientId = clientId || process.env.WHOOP_CLIENT_ID;
  const finalClientSecret = clientSecret || process.env.WHOOP_CLIENT_SECRET;
  
  if (!finalClientId || !finalClientSecret) {
    throw ApiError.internal('WHOOP OAuth not configured. Please provide client ID and secret, or set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables.');
  }
  
  // Get redirect_uri - use provided one, or construct from env
  // WHOOP requires redirect_uri to match exactly what was used during initial authorization
  let finalRedirectUri = redirectUri;
  if (!finalRedirectUri) {
    // Construct from environment variables (same pattern as in integration.controller.ts)
    const clientUrl = process.env.CLIENT_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000';
    finalRedirectUri = `${clientUrl}/auth/whoop/callback`;
  }
  
  // WHOOP refresh token request
  // According to WHOOP documentation, refresh requests MUST include:
  // - scope: "offline"
  // - redirect_uri: must match the one used during initial authorization
  // See: https://developer.whoop.com/docs/developing/oauth
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: finalClientId,
    client_secret: finalClientSecret,
    redirect_uri: finalRedirectUri, // Required by WHOOP - must match initial authorization
    scope: 'offline', // Required by WHOOP API for refresh requests
  });
  
  const requestBody = params.toString();
  
  logger.debug('WHOOP refresh token request', {
    url: WHOOP_OAUTH_TOKEN_URL,
    hasRefreshToken: !!refreshToken,
    refreshTokenLength: refreshToken?.length || 0,
    hasClientId: !!finalClientId,
    hasClientSecret: !!finalClientSecret,
    bodyParams: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken ? `${refreshToken.substring(0, 20)}...` : 'missing',
      client_id: finalClientId || 'missing',
      client_secret: finalClientSecret ? '***' : 'missing',
    },
  });
  
  const tokenResponse = await fetch(WHOOP_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestBody,
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    let errorMessage = 'Token refresh failed';
    let errorData: any = null;
    let isClientIdMismatch = false;
    
    try {
      errorData = JSON.parse(errorText);
      errorMessage = errorData.error_description || errorData.error || errorMessage;
      
      // Check if the error is specifically about client_id mismatch
      // This happens when tokens were issued with a different client_id than we're using now
      const errorHint = errorData.error_hint || '';
      const errorDesc = errorData.error_description || '';
      isClientIdMismatch = (
        errorHint.includes('Client ID') && 
        (errorHint.includes('does not match') || errorHint.includes('initial token issuance'))
      ) || (
        errorDesc.includes('Client ID') && 
        (errorDesc.includes('does not match') || errorDesc.includes('initial token issuance'))
      );
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    logger.error('WHOOP token refresh failed', {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      error: errorMessage,
      errorDetails: errorData,
      responseBody: errorText.substring(0, 500),
      requestUrl: WHOOP_OAUTH_TOKEN_URL,
      isClientIdMismatch,
      note: isClientIdMismatch
        ? 'CRITICAL: Client ID mismatch - tokens were issued with different client_id. User must reconnect.'
        : tokenResponse.status === 401 
        ? 'Refresh token may be invalidated - user needs to reconnect' 
        : tokenResponse.status === 400
        ? 'Request format may be incorrect or refresh token invalid'
        : 'Unknown error',
    });
    
    // Provide more specific error messages
    if (tokenResponse.status === 401) {
      throw ApiError.unauthorized('Refresh token invalidated. Please reconnect your WHOOP account.');
    }
    
    // Special handling for client_id mismatch - this means the tokens were issued with a different client_id
    // The user needs to reconnect so new tokens are issued with the current client_id
    if (isClientIdMismatch) {
      // Clear tokens and mark integration as needing reconnection
      // This happens when credentials were updated after tokens were issued
      // IMPORTANT: Clear last_sync_error to prevent sync endpoint from detecting this as an error state
      if (userId) {
        try {
          await query(
            `UPDATE user_integrations
             SET access_token = NULL, refresh_token = NULL, token_expiry = NULL,
             status = 'pending', last_sync_error = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND provider = 'whoop'`,
            [userId]
          );
          
          logger.warn('WHOOP tokens cleared due to client_id mismatch', {
            userId,
            note: 'Credentials were updated after tokens were issued. User must reconnect. Status set to pending, error cleared.',
          });
        } catch (clearError) {
          logger.error('Failed to clear tokens after client_id mismatch', {
            userId,
            error: clearError instanceof Error ? clearError.message : 'Unknown error',
          });
        }
      }
      
      throw ApiError.badRequest(
        'Token refresh failed: The WHOOP credentials have changed. Please click "Connect WHOOP" to reconnect your account.'
      );
    }
    
    throw ApiError.badRequest(`Token refresh failed: ${errorMessage}`);
  }
  
  const tokenData = await tokenResponse.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : undefined;
  
  // WHOOP invalidates old refresh tokens when you refresh
  // Always save the new refresh token if provided, otherwise use the old one
  const newRefreshToken = tokenData.refresh_token || refreshToken;
  
  logger.info('WHOOP token refreshed', {
    hasNewRefreshToken: !!tokenData.refresh_token,
    expiresAt: expiresAt?.toISOString(),
  });
  
  return {
    accessToken: tokenData.access_token,
    refreshToken: newRefreshToken,
    expiresAt,
    tokenType: tokenData.token_type || 'Bearer',
  };
}

/**
 * Register webhook with WHOOP (if supported)
 * Note: WHOOP API may not support webhooks - this is a placeholder
 * Check WHOOP API docs for webhook support: https://developer.whoop.com/docs/developing/webhooks
 */
export async function registerWhoopWebhook(
  _accessToken: string,
  webhookUrl: string
): Promise<boolean> {
  // WHOOP API v2 may not have webhook registration endpoint
  // This is a placeholder for future implementation
  // For now, we'll use polling as fallback
  
  logger.info('WHOOP webhook registration attempted', {
    webhookUrl,
    note: 'WHOOP API may not support webhooks - using polling fallback',
  });
  
  // TODO: Implement webhook registration when WHOOP API supports it
  // Check: https://developer.whoop.com/docs/developing/webhooks
  
  return false; // Indicates webhook not registered (use polling)
}

/**
 * Normalize WHOOP recovery data to Balencia schema
 */
export function normalizeRecoveryData(
  whoopData: WhoopRecoveryData,
  userId: string
): {
  user_id: string;
  provider: string;
  entity_type: string;
  source_record_id: string;
  timestamp: string;
  recovery_score: number;
  hrv_rmssd_ms: number;
  resting_heart_rate_bpm: number;
  spo2_percent?: number;
  skin_temp_celsius?: number;
  calibrating: boolean;
  related_sleep_id: string;
} {
  return {
    user_id: userId,
    provider: 'whoop',
    entity_type: 'recovery',
    source_record_id: whoopData.cycle_id,
    timestamp: whoopData.created_at,
    recovery_score: whoopData.score.recovery_score,
    hrv_rmssd_ms: whoopData.score.hrv_rmssd_milli,
    resting_heart_rate_bpm: whoopData.score.resting_heart_rate,
    spo2_percent: whoopData.score.spo2_percentage,
    skin_temp_celsius: whoopData.score.skin_temp_celsius,
    calibrating: whoopData.score.user_calibrating,
    related_sleep_id: whoopData.sleep_id,
  };
}

/**
 * Normalize WHOOP sleep data to Balencia schema
 */
export function normalizeSleepData(
  whoopData: WhoopSleepData,
  userId: string
): {
  user_id: string;
  provider: string;
  entity_type: string;
  source_record_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  sleep_quality_score: number;
  sleep_efficiency_percent: number;
  sleep_consistency_percent: number;
  stages: {
    awake_minutes: number;
    light_minutes: number;
    deep_minutes: number;
    rem_minutes: number;
    no_data_minutes: number;
  };
  respiratory_rate_bpm: number;
  sleep_need_minutes: number;
  sleep_debt_minutes: number;
  is_nap: boolean;
  timezone_offset: string;
} {
  const stageSummary = whoopData.score.stage_summary;
  const durationMs = stageSummary.total_sleep_time_milli;
  
  return {
    user_id: userId,
    provider: 'whoop',
    entity_type: 'sleep',
    source_record_id: whoopData.id,
    start_time: whoopData.start,
    end_time: whoopData.end,
    duration_minutes: Math.round(durationMs / 60000),
    sleep_quality_score: whoopData.score.sleep_performance_percentage,
    sleep_efficiency_percent: whoopData.score.sleep_efficiency_percentage,
    sleep_consistency_percent: whoopData.score.sleep_consistency_percentage,
    stages: {
      awake_minutes: Math.round(stageSummary.total_awake_time_milli / 60000),
      light_minutes: Math.round(stageSummary.total_light_sleep_time_milli / 60000),
      deep_minutes: Math.round(stageSummary.total_slow_wave_sleep_time_milli / 60000),
      rem_minutes: Math.round(stageSummary.total_rem_sleep_time_milli / 60000),
      no_data_minutes: Math.round(stageSummary.total_no_data_time_milli / 60000),
    },
    respiratory_rate_bpm: whoopData.score.respiratory_rate,
    sleep_need_minutes: Math.round(whoopData.score.sleep_needed.baseline_milli / 60000),
    sleep_debt_minutes: Math.round(whoopData.score.sleep_needed.need_from_sleep_debt_milli / 60000),
    is_nap: whoopData.nap,
    timezone_offset: whoopData.timezone_offset,
  };
}

/**
 * Normalize WHOOP workout data to Balencia schema
 */
export function normalizeWorkoutData(
  whoopData: WhoopWorkoutData,
  userId: string
): {
  user_id: string;
  provider: string;
  entity_type: string;
  source_record_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  activity_type: string;
  strain_score: number;
  strain_score_normalized: number;
  calories_kcal: number;
  distance_meters?: number;
  altitude_gain_meters?: number;
  avg_heart_rate_bpm: number;
  max_heart_rate_bpm: number;
  heart_rate_zones?: {
    zone_0_minutes: number;
    zone_1_minutes: number;
    zone_2_minutes: number;
    zone_3_minutes: number;
    zone_4_minutes: number;
    zone_5_minutes: number;
  };
  percent_recorded: number;
} {
  const start = new Date(whoopData.start);
  const end = new Date(whoopData.end);
  const durationMs = end.getTime() - start.getTime();
  
  // Map WHOOP sport_id to activity type (simplified - full mapping in config)
  const sportIdMap: Record<number, string> = {
    1: 'running',
    2: 'cycling',
    43: 'strength_training',
    44: 'crossfit',
    46: 'yoga',
  };
  
  const activityType = sportIdMap[whoopData.sport_id] || 'other';
  const strainScore = whoopData.score.strain;
  const strainScoreNormalized = (strainScore / 21) * 100; // Convert 0-21 to 0-100
  
  return {
    user_id: userId,
    provider: 'whoop',
    entity_type: 'workout',
    source_record_id: whoopData.id,
    start_time: whoopData.start,
    end_time: whoopData.end,
    duration_minutes: Math.round(durationMs / 60000),
    activity_type: activityType,
    strain_score: strainScore,
    strain_score_normalized: strainScoreNormalized,
    calories_kcal: Math.round(whoopData.score.kilojoule / 4.184), // Convert kJ to kcal
    distance_meters: whoopData.distance_meter,
    altitude_gain_meters: whoopData.altitude_gain_meter,
    avg_heart_rate_bpm: whoopData.score.average_heart_rate,
    max_heart_rate_bpm: whoopData.score.max_heart_rate,
    heart_rate_zones: whoopData.zone_duration ? {
      zone_0_minutes: Math.round(whoopData.zone_duration.zone_zero_milli / 60000),
      zone_1_minutes: Math.round(whoopData.zone_duration.zone_one_milli / 60000),
      zone_2_minutes: Math.round(whoopData.zone_duration.zone_two_milli / 60000),
      zone_3_minutes: Math.round(whoopData.zone_duration.zone_three_milli / 60000),
      zone_4_minutes: Math.round(whoopData.zone_duration.zone_four_milli / 60000),
      zone_5_minutes: Math.round(whoopData.zone_duration.zone_five_milli / 60000),
    } : undefined,
    percent_recorded: whoopData.score.percent_recorded,
  };
}

// In-memory lock for token refresh operations (prevents race conditions)
// Key: userId, Value: Promise<string> (the refresh operation)
const refreshLocks = new Map<string, Promise<string>>();

/**
 * Get WHOOP API access token (with automatic refresh if needed)
 * Uses distributed locking to prevent concurrent refresh attempts
 * Credentials are read from environment variables (application-level)
 */
export async function getWhoopAccessToken(
  userId: string
): Promise<string> {
  // Check integration status first - allow 'active' and 'pending', but not 'error' or 'disconnected'
  const integrationResult = await query<{
    access_token: string;
    refresh_token: string | null;
    token_expiry: Date | null;
    status: string;
    last_sync_error: string | null;
    client_id: string | null;
    client_secret: string | null;
  }>(
    `SELECT access_token, refresh_token, token_expiry, status, last_sync_error, client_id, client_secret
     FROM user_integrations
     WHERE user_id = $1 AND provider = 'whoop'`,
    [userId]
  );
  
  if (integrationResult.rows.length === 0) {
    throw ApiError.notFound('WHOOP integration not found. Please connect your WHOOP account.');
  }
  
  const integration = integrationResult.rows[0];
  
  // Check if integration is in an error state
  if (integration.status === 'error' || integration.status === 'disconnected') {
    const errorMessage = integration.last_sync_error || 
      'WHOOP integration is disconnected or in an error state. Please disconnect and reconnect your WHOOP account.';
    
    // If it's a credentials mismatch error and tokens exist, clear them automatically
    const isCredentialsMismatch = errorMessage.includes('credentials have changed') || 
                                   errorMessage.includes('Client ID') ||
                                   errorMessage.includes('does not match');
    
    if (isCredentialsMismatch && integration.access_token) {
      logger.info('Auto-clearing tokens due to credentials mismatch in getWhoopAccessToken', { userId });
      await query(
        `UPDATE user_integrations SET
         access_token = NULL, refresh_token = NULL, token_expiry = NULL,
         status = 'pending', last_sync_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND provider = 'whoop'`,
        [userId]
      );
      throw ApiError.badRequest(
        'WHOOP credentials have changed. Your tokens have been cleared. Please click "Connect WHOOP" to reconnect with your current credentials.'
      );
    }
    
    logger.warn('WHOOP integration in error state', {
      userId,
      status: integration.status,
      error: integration.last_sync_error,
    });
    
    throw ApiError.badRequest(errorMessage);
  }
  
  // Check if integration is still pending (not yet active)
  if (integration.status === 'pending') {
    logger.warn('WHOOP integration still pending', { userId });
    throw ApiError.badRequest('WHOOP integration is still pending. Please complete the OAuth flow.');
  }
  
  // If status is not 'active', log warning but continue (for backwards compatibility)
  if (integration.status !== 'active') {
    logger.warn('WHOOP integration has unexpected status', {
      userId,
      status: integration.status,
    });
  }
  
  // Check if token is expired or about to expire (within 5 minutes)
  // Also refresh if token_expiry is null (unknown expiry - token might be expired)
  const now = new Date();
  const expiry = integration.token_expiry;
  const needsRefresh = 
    !expiry || // No expiry set - force refresh to ensure token is valid
    now >= new Date(expiry.getTime() - 5 * 60 * 1000); // Expired or expiring within 5 minutes
  
  if (!needsRefresh) {
    return integration.access_token;
  }
  
  // Token expired, expiring soon, or expiry unknown - refresh it with locking
  if (!integration.refresh_token) {
    logger.error('WHOOP refresh token missing', { userId });
    throw ApiError.badRequest('Refresh token not available. Please reconnect your WHOOP account.');
  }
  
  // Double-check status before attempting refresh (another process may have changed it)
  const statusRecheck = await query<{ status: string; last_sync_error: string | null }>(
    `SELECT status, last_sync_error FROM user_integrations WHERE user_id = $1 AND provider = 'whoop'`,
    [userId]
  );
  
  if (statusRecheck.rows.length > 0 && statusRecheck.rows[0].status === 'error') {
    const errorMessage = statusRecheck.rows[0].last_sync_error || '';
    const isCredentialsMismatch = errorMessage.includes('credentials have changed') ||
                                  errorMessage.includes('Client ID') ||
                                  errorMessage.includes('does not match');
    
    if (isCredentialsMismatch) {
      // Clear tokens and set status to pending - don't attempt refresh
      logger.warn('WHOOP integration has credentials mismatch error - clearing tokens and skipping refresh', { userId });
      await query(
        `UPDATE user_integrations SET
         access_token = NULL, refresh_token = NULL, token_expiry = NULL,
         status = 'pending', last_sync_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND provider = 'whoop'`,
        [userId]
      );
      throw ApiError.badRequest(
        'WHOOP credentials have changed. Your tokens have been cleared. Please click "Connect WHOOP" to reconnect with your current credentials.'
      );
    }
    
    // Status changed to error (non-credentials issue) - don't attempt refresh
    logger.warn('WHOOP integration status changed to error - skipping token refresh', { userId });
    throw ApiError.badRequest('WHOOP integration is in an error state. Please reconnect your account.');
  }
  
  // Check if a refresh is already in progress for this user
  const existingRefresh = refreshLocks.get(userId);
  if (existingRefresh) {
    // Another request is already refreshing - wait for it
    logger.info('WHOOP token refresh already in progress, waiting', { userId });
    try {
      return await existingRefresh;
    } catch (error) {
      // If the existing refresh failed, we'll try again below
      logger.warn('Existing refresh failed, retrying', { userId, error });
      refreshLocks.delete(userId);
    }
  }
  
  // Create a new refresh operation
  const refreshPromise = (async (): Promise<string> => {
    try {
      // Double-check token status from DB (another process may have refreshed)
      // Don't filter by status='active' - check current status to avoid refreshing invalid tokens
      const recheckResult = await query<{
        access_token: string;
        refresh_token: string | null;
        token_expiry: Date | null;
        status: string;
      }>(
        `SELECT access_token, refresh_token, token_expiry, status
         FROM user_integrations
         WHERE user_id = $1 AND provider = 'whoop'`,
        [userId]
      );
      
      if (recheckResult.rows.length === 0) {
        throw ApiError.notFound('WHOOP integration not found');
      }
      
      const recheckIntegration = recheckResult.rows[0];
      
      // If status is not 'active', don't try to refresh (tokens might be invalid)
      if (recheckIntegration.status !== 'active') {
        logger.warn('WHOOP integration status is not active - skipping token refresh', {
          userId,
          status: recheckIntegration.status,
        });
        throw ApiError.badRequest(
          `WHOOP integration is not active (status: ${recheckIntegration.status}). Please reconnect your account.`
        );
      }
      
      if (!recheckIntegration.refresh_token) {
        throw ApiError.badRequest('Refresh token not available. Please reconnect your WHOOP account.');
      }
      const recheckExpiry = recheckIntegration.token_expiry;
      const stillNeedsRefresh = recheckExpiry && now >= new Date(recheckExpiry.getTime() - 5 * 60 * 1000);
      
      if (!stillNeedsRefresh) {
        // Token was refreshed by another process
        logger.info('WHOOP token already refreshed by another process', { userId });
        return recheckIntegration.access_token;
      }
      
      // Get credentials (per-user or from env vars)
      const credResult = await query<{
        client_id: string | null;
        client_secret: string | null;
      }>(
        `SELECT client_id, client_secret
         FROM user_integrations
         WHERE user_id = $1 AND provider = 'whoop'`,
        [userId]
      );
      
      let clientId: string | undefined;
      let clientSecret: string | undefined;
      
      if (credResult.rows.length > 0 && credResult.rows[0].client_id && credResult.rows[0].client_secret) {
        clientId = credResult.rows[0].client_id;
        clientSecret = credResult.rows[0].client_secret;
      } else {
        clientId = process.env.WHOOP_CLIENT_ID;
        clientSecret = process.env.WHOOP_CLIENT_SECRET;
      }
      
      // Perform the refresh
      // Get redirect_uri from env config
      const { env } = await import('../config/env.config.js');
      const redirectUri = `${env.client.url}/auth/whoop/callback`;
      
      const newTokens = await refreshWhoopToken(
        recheckIntegration.refresh_token!, 
        clientId, 
        clientSecret,
        userId,
        redirectUri
      );
      
      // Update stored tokens (always save new refresh token - WHOOP invalidates old one)
      await query(
        `UPDATE user_integrations
         SET access_token = $1, refresh_token = $2, token_expiry = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4 AND provider = 'whoop'`,
        [
          newTokens.accessToken,
          newTokens.refreshToken || recheckIntegration.refresh_token || null, // Fallback to existing if not provided
          newTokens.expiresAt || null,
          userId,
        ]
      );
      
      logger.info('WHOOP token refreshed successfully', { userId });
      
      return newTokens.accessToken;
    } catch (error) {
      logger.error('WHOOP token refresh failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      // Remove lock after operation completes (success or failure)
      refreshLocks.delete(userId);
    }
  })();
  
  // Store the promise in the lock map
  refreshLocks.set(userId, refreshPromise);
  
  return refreshPromise;
}

export default {
  generatePKCE,
  initiateWhoopOAuth,
  exchangeWhoopOAuthCode,
  refreshWhoopToken,
  registerWhoopWebhook,
  normalizeRecoveryData,
  normalizeSleepData,
  normalizeWorkoutData,
  getWhoopAccessToken,
};

