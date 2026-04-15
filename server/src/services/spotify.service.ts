/**
 * @file Spotify Integration Service
 * @description OAuth 2.0 + PKCE flow, token management, and API wrapper for Spotify
 *
 * Two parallel flows:
 * 1. User OAuth (PKCE) — personal library, playback control, SDK access
 * 2. Client Credentials — curated health playlists (no user auth needed)
 */

import crypto from 'crypto';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.config.js';

// Spotify API Configuration
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Scopes for user OAuth
const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming',
  'user-library-read',
  'playlist-read-private',
  'user-read-recently-played',
  'user-read-email',
  'user-read-private',
].join(' ');

interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
}

// Cached client credentials token
let clientCredentialsToken: { token: string; expiresAt: Date } | null = null;

// In-memory lock for token refresh operations
const refreshLocks = new Map<string, Promise<string>>();

// ─── PKCE Helpers ────────────────────────────────────────────

/**
 * Generate PKCE code verifier and challenge
 */
export function generateSpotifyPKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

// ─── User OAuth Flow ─────────────────────────────────────────

/**
 * Initiate Spotify OAuth flow with PKCE
 */
export async function initiateSpotifyOAuth(
  userId: string,
  redirectUri?: string
): Promise<{ authUrl: string; state: string }> {
  const creds = await getSpotifyCredentials(userId);
  if (!creds) {
    throw ApiError.badRequest('Spotify not configured. Please add your Spotify Client ID and Client Secret in Settings.');
  }
  const clientId = creds.clientId;

  const finalRedirectUri = redirectUri || env.spotify.redirectUri;
  const state = crypto.randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = generateSpotifyPKCE();

  // Store PKCE data in user_integrations (pending state)
  await query(
    `INSERT INTO user_integrations (user_id, provider, access_token, status)
     VALUES ($1, 'spotify', $2, 'pending')
     ON CONFLICT (user_id, provider)
     DO UPDATE SET access_token = $2, status = 'pending', updated_at = CURRENT_TIMESTAMP`,
    [userId, JSON.stringify({ codeVerifier, codeChallenge, state, redirectUri: finalRedirectUri })]
  );

  // Build OAuth URL
  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', finalRedirectUri);
  authUrl.searchParams.set('scope', SPOTIFY_SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('show_dialog', 'true');

  logger.info('Spotify OAuth initiated', { userId, state, redirectUri: finalRedirectUri, clientId });
  return { authUrl: authUrl.toString(), state };
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeSpotifyOAuthCode(
  userId: string,
  code: string,
  state: string
): Promise<SpotifyTokens> {
  const creds = await getSpotifyCredentials(userId);
  if (!creds) {
    throw ApiError.badRequest('Spotify not configured.');
  }
  const clientId = creds.clientId;
  const clientSecret = creds.clientSecret;

  // Retrieve stored PKCE data
  const storedData = await query<{ access_token: string }>(
    `SELECT access_token FROM user_integrations
     WHERE user_id = $1 AND provider = 'spotify' AND status = 'pending'`,
    [userId]
  );

  if (storedData.rows.length === 0) {
    throw ApiError.badRequest('No pending Spotify OAuth flow found.');
  }

  const stored = JSON.parse(storedData.rows[0].access_token);
  if (stored.state !== state) {
    throw ApiError.badRequest('Invalid state parameter — possible CSRF attack.');
  }

  // Exchange code for tokens
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: stored.redirectUri || env.spotify.redirectUri,
    client_id: clientId,
    code_verifier: stored.codeVerifier,
  });

  const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: tokenParams,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    logger.error('Spotify token exchange failed', { userId, status: tokenResponse.status, error: errorText });
    throw ApiError.badRequest(`Spotify token exchange failed: ${errorText}`);
  }

  const tokenData = await tokenResponse.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : undefined;

  const tokens: SpotifyTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    tokenType: tokenData.token_type || 'Bearer',
  };

  // Fetch user profile to get display name
  let profileData: { display_name?: string; product?: string; images?: { url: string }[]; email?: string } | null = null;
  try {
    const profileRes = await fetch(`${SPOTIFY_API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
    });
    if (profileRes.ok) {
      profileData = await profileRes.json() as { display_name?: string; product?: string; images?: { url: string }[]; email?: string };
    }
  } catch {
    // Profile fetch is optional
  }

  // Store tokens and activate integration
  await query(
    `UPDATE user_integrations
     SET access_token = $1,
         refresh_token = $2,
         token_expiry = $3,
         status = 'active',
         connected_at = CURRENT_TIMESTAMP,
         scopes = $4,
         device_info = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $6 AND provider = 'spotify'`,
    [
      tokens.accessToken,
      tokens.refreshToken || null,
      tokens.expiresAt || null,
      tokenData.scope?.split(' ') || [],
      profileData ? JSON.stringify({
        display_name: profileData.display_name,
        account_type: profileData.product || 'free',
        avatar_url: profileData.images?.[0]?.url || null,
        email: profileData.email,
      }) : null,
      userId,
    ]
  );

  logger.info('Spotify OAuth completed', {
    userId,
    displayName: profileData?.display_name,
    accountType: profileData?.product,
  });

  return tokens;
}

/**
 * Refresh Spotify access token
 */
export async function refreshSpotifyToken(refreshToken: string, userId?: string): Promise<SpotifyTokens> {
  const creds = await getSpotifyCredentials(userId);
  if (!creds) {
    throw ApiError.internal('Spotify not configured.');
  }
  const clientId = creds.clientId;
  const clientSecret = creds.clientSecret;

  const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    logger.error('Spotify token refresh failed', { status: tokenResponse.status, error: errorText });
    throw ApiError.badRequest(`Spotify token refresh failed: ${errorText}`);
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

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || refreshToken, // Spotify may or may not return new refresh token
    expiresAt,
    tokenType: tokenData.token_type || 'Bearer',
  };
}

// ─── Client Credentials Flow ────────────────────────────────

/**
 * Get app-level access token via Client Credentials flow
 * Used for browsing curated playlists (no user auth needed)
 */
export async function getClientCredentialsToken(userId?: string): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  if (clientCredentialsToken && new Date() < new Date(clientCredentialsToken.expiresAt.getTime() - 5 * 60 * 1000)) {
    return clientCredentialsToken.token;
  }

  const creds = await getSpotifyCredentials(userId);
  if (!creds) {
    throw ApiError.internal('Spotify not configured. Add your Client ID and Client Secret in Settings.');
  }
  const clientId = creds.clientId;
  const clientSecret = creds.clientSecret;

  const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    logger.error('Spotify client credentials failed', { status: tokenResponse.status, error: errorText });
    throw ApiError.internal('Failed to obtain Spotify app token.');
  }

  const data = await tokenResponse.json() as { access_token: string; expires_in: number };

  clientCredentialsToken = {
    token: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };

  return clientCredentialsToken.token;
}

// ─── Token Management ────────────────────────────────────────

/**
 * Get user's Spotify access token with auto-refresh
 */
export async function getSpotifyAccessToken(userId: string): Promise<string> {
  const integrationResult = await query<{
    access_token: string;
    refresh_token: string | null;
    token_expiry: Date | null;
    status: string;
  }>(
    `SELECT access_token, refresh_token, token_expiry, status
     FROM user_integrations
     WHERE user_id = $1 AND provider = 'spotify'`,
    [userId]
  );

  if (integrationResult.rows.length === 0) {
    throw ApiError.notFound('Spotify not connected. Please connect your Spotify account in Settings.');
  }

  const integration = integrationResult.rows[0];

  if (integration.status !== 'active') {
    throw ApiError.badRequest('Spotify integration is not active. Please reconnect.');
  }

  // Check if token needs refresh (expired or within 5 min of expiry)
  const now = new Date();
  const expiry = integration.token_expiry;
  const needsRefresh = !expiry || now >= new Date(expiry.getTime() - 5 * 60 * 1000);

  if (!needsRefresh) {
    return integration.access_token;
  }

  if (!integration.refresh_token) {
    throw ApiError.badRequest('Refresh token missing. Please reconnect Spotify.');
  }

  // Use lock to prevent concurrent refreshes
  const existingRefresh = refreshLocks.get(userId);
  if (existingRefresh) {
    try {
      return await existingRefresh;
    } catch {
      refreshLocks.delete(userId);
    }
  }

  const refreshPromise = (async (): Promise<string> => {
    try {
      const newTokens = await refreshSpotifyToken(integration.refresh_token!, userId);

      await query(
        `UPDATE user_integrations
         SET access_token = $1, refresh_token = $2, token_expiry = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4 AND provider = 'spotify'`,
        [newTokens.accessToken, newTokens.refreshToken || integration.refresh_token, newTokens.expiresAt || null, userId]
      );

      logger.info('Spotify token refreshed', { userId });
      return newTokens.accessToken;
    } catch (error) {
      logger.error('Spotify token refresh failed', { userId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      refreshLocks.delete(userId);
    }
  })();

  refreshLocks.set(userId, refreshPromise);
  return refreshPromise;
}

// ─── API Wrapper ─────────────────────────────────────────────

/**
 * Make authenticated Spotify API request
 * @param userId - null for client credentials, string for user token
 */
export async function spotifyApiRequest<T>(
  userId: string | null,
  endpoint: string,
  options: { method?: string; body?: unknown; _retried?: boolean } = {}
): Promise<T> {
  let token: string;
  try {
    token = userId
      ? await getSpotifyAccessToken(userId)
      : await getClientCredentialsToken();
  } catch {
    // Fall back to client credentials if user token unavailable
    token = await getClientCredentialsToken();
  }

  const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_API_BASE}${endpoint}`;

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 204) {
    return {} as T; // No content (e.g., play/pause commands)
  }

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Spotify API request failed', {
      endpoint,
      status: response.status,
      error: errorText,
      userId: userId || 'client_credentials',
    });

    // On 401, force token refresh and retry once (token may have expired mid-request)
    if (response.status === 401 && userId && !options._retried) {
      logger.info('Spotify 401 — forcing token refresh and retrying', { userId, endpoint });
      // Invalidate cached token by setting expiry to past
      await query(
        `UPDATE user_integrations SET token_expiry = NOW() - INTERVAL '1 hour' WHERE user_id = $1 AND provider = 'spotify'`,
        [userId]
      ).catch(() => {});
      return spotifyApiRequest<T>(userId, endpoint, { ...options, _retried: true });
    }
    if (response.status === 401) {
      throw ApiError.unauthorized('Spotify token expired. Please reconnect.');
    }
    if (response.status === 403) {
      // Parse the actual Spotify error for better diagnostics
      let spotifyMessage = 'Forbidden';
      try {
        const parsed = JSON.parse(errorText);
        spotifyMessage = parsed?.error?.message || spotifyMessage;
      } catch { /* use default */ }
      throw ApiError.forbidden(`Spotify API forbidden: ${spotifyMessage}. Check app permissions and OAuth scopes.`);
    }
    if (response.status === 404) {
      throw ApiError.notFound('Spotify resource not found.');
    }
    if (response.status === 429) {
      throw ApiError.tooManyRequests('Spotify rate limit exceeded. Please try again shortly.');
    }

    throw ApiError.internal(`Spotify API error: ${response.status}`);
  }

  return await response.json() as T;
}

/**
 * Get Spotify connection status for a user
 */
export async function getSpotifyConnectionStatus(userId: string): Promise<{
  isConnected: boolean;
  displayName?: string;
  accountType?: string;
  connectedAt?: string;
  avatarUrl?: string;
}> {
  const result = await query<{
    status: string;
    connected_at: Date;
    device_info: { display_name?: string; account_type?: string; avatar_url?: string } | null;
  }>(
    `SELECT status, connected_at, device_info
     FROM user_integrations
     WHERE user_id = $1 AND provider = 'spotify'`,
    [userId]
  );

  if (result.rows.length === 0 || result.rows[0].status !== 'active') {
    return { isConnected: false };
  }

  const row = result.rows[0];
  return {
    isConnected: true,
    displayName: row.device_info?.display_name,
    accountType: row.device_info?.account_type,
    connectedAt: row.connected_at?.toISOString(),
    avatarUrl: row.device_info?.avatar_url,
  };
}

/**
 * Disconnect Spotify integration
 */
export async function disconnectSpotify(userId: string): Promise<void> {
  await query(
    `UPDATE user_integrations
     SET status = 'disconnected',
         access_token = NULL,
         refresh_token = NULL,
         token_expiry = NULL,
         disconnected_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND provider = 'spotify'`,
    [userId]
  );
  logger.info('Spotify disconnected', { userId });
}

/**
 * Check if Spotify integration is configured (env vars set)
 */
export function isSpotifyConfigured(): boolean {
  return !!(env.spotify.clientId && env.spotify.clientSecret);
}

// ─── Per-User Credentials ───────────────────────────────────

/**
 * Get Spotify credentials for a user: per-user DB first, then env vars
 */
export async function getSpotifyCredentials(userId?: string): Promise<{ clientId: string; clientSecret: string } | null> {
  // Check per-user credentials in DB
  if (userId) {
    const result = await query<{ client_id: string | null; client_secret: string | null }>(
      `SELECT client_id, client_secret FROM user_integrations
       WHERE user_id = $1 AND provider = 'spotify'`,
      [userId]
    );
    if (result.rows.length > 0 && result.rows[0].client_id && result.rows[0].client_secret) {
      return { clientId: result.rows[0].client_id, clientSecret: result.rows[0].client_secret };
    }
  }

  // Fall back to env vars
  if (env.spotify.clientId && env.spotify.clientSecret) {
    return { clientId: env.spotify.clientId, clientSecret: env.spotify.clientSecret };
  }

  return null;
}

/**
 * Check if Spotify is configured for a specific user (per-user credentials OR env vars)
 */
export async function isSpotifyConfiguredForUser(userId: string): Promise<boolean> {
  const creds = await getSpotifyCredentials(userId);
  return creds !== null;
}

/**
 * Store per-user Spotify credentials
 */
export async function storeSpotifyCredentials(
  userId: string,
  clientId: string,
  clientSecret: string
): Promise<{ id: string; status: string; requiresReauth?: boolean }> {
  // Check if integration row exists
  const existing = await query<{ id: string; status: string; client_id: string | null; access_token: string | null }>(
    `SELECT id, status, client_id, access_token FROM user_integrations WHERE user_id = $1 AND provider = 'spotify'`,
    [userId]
  );

  if (existing.rows.length === 0) {
    // Create new integration with credentials (no tokens yet)
    const result = await query<{ id: string; status: string }>(
      `INSERT INTO user_integrations (user_id, provider, client_id, client_secret, status)
       VALUES ($1, 'spotify', $2, $3, 'pending')
       RETURNING id, status`,
      [userId, clientId, clientSecret]
    );
    logger.info('Spotify credentials stored', { userId });
    return { id: result.rows[0].id, status: result.rows[0].status };
  }

  const row = existing.rows[0];

  // If credentials changed and user was connected, require re-auth
  if (row.client_id && row.client_id !== clientId && row.access_token) {
    const result = await query<{ id: string; status: string }>(
      `UPDATE user_integrations SET
       client_id = $1, client_secret = $2, access_token = NULL, refresh_token = NULL,
       token_expiry = NULL, status = 'pending', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3 AND provider = 'spotify'
       RETURNING id, status`,
      [clientId, clientSecret, userId]
    );
    // Invalidate cached client credentials token
    clientCredentialsToken = null;
    logger.info('Spotify credentials updated - tokens cleared (re-auth required)', { userId });
    return { id: result.rows[0].id, status: result.rows[0].status, requiresReauth: true };
  }

  // Update credentials without clearing tokens
  const result = await query<{ id: string; status: string }>(
    `UPDATE user_integrations SET
     client_id = $1, client_secret = $2, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $3 AND provider = 'spotify'
     RETURNING id, status`,
    [clientId, clientSecret, userId]
  );
  // Invalidate cached client credentials token so it uses new creds
  clientCredentialsToken = null;
  logger.info('Spotify credentials updated', { userId });
  return { id: result.rows[0].id, status: result.rows[0].status };
}

/**
 * Delete per-user Spotify credentials and disconnect
 */
export async function deleteSpotifyCredentials(userId: string): Promise<void> {
  await query(
    `UPDATE user_integrations SET
     client_id = NULL, client_secret = NULL, access_token = NULL, refresh_token = NULL,
     token_expiry = NULL, status = 'disconnected', disconnected_at = CURRENT_TIMESTAMP,
     updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND provider = 'spotify'`,
    [userId]
  );
  clientCredentialsToken = null;
  logger.info('Spotify credentials deleted', { userId });
}

/**
 * Get masked credentials status for a user
 */
export async function getSpotifyCredentialsStatus(userId: string): Promise<{
  hasCredentials: boolean;
  clientIdMasked?: string;
  source?: 'user' | 'env';
}> {
  // Check per-user first
  const result = await query<{ client_id: string | null; client_secret: string | null }>(
    `SELECT client_id, client_secret FROM user_integrations
     WHERE user_id = $1 AND provider = 'spotify'`,
    [userId]
  );

  if (result.rows.length > 0 && result.rows[0].client_id && result.rows[0].client_secret) {
    const id = result.rows[0].client_id;
    return {
      hasCredentials: true,
      clientIdMasked: id.length > 8 ? `${id.slice(0, 4)}${'*'.repeat(id.length - 8)}${id.slice(-4)}` : '****',
      source: 'user',
    };
  }

  // Check env vars
  if (env.spotify.clientId && env.spotify.clientSecret) {
    const id = env.spotify.clientId;
    return {
      hasCredentials: true,
      clientIdMasked: id.length > 8 ? `${id.slice(0, 4)}${'*'.repeat(id.length - 8)}${id.slice(-4)}` : '****',
      source: 'env',
    };
  }

  return { hasCredentials: false };
}

/**
 * Find the user who initiated an OAuth flow by the state parameter.
 * Used when the callback doesn't have an auth token (redirect from Spotify).
 */
export async function findUserByOAuthState(state: string): Promise<string | null> {
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM user_integrations
     WHERE provider = 'spotify' AND status = 'pending'
       AND access_token::jsonb->>'state' = $1`,
    [state]
  );
  return result.rows[0]?.user_id || null;
}

export default {
  generateSpotifyPKCE,
  initiateSpotifyOAuth,
  exchangeSpotifyOAuthCode,
  findUserByOAuthState,
  refreshSpotifyToken,
  getClientCredentialsToken,
  getSpotifyAccessToken,
  spotifyApiRequest,
  getSpotifyConnectionStatus,
  disconnectSpotify,
  isSpotifyConfigured,
  getSpotifyCredentials,
  isSpotifyConfiguredForUser,
  storeSpotifyCredentials,
  deleteSpotifyCredentials,
  getSpotifyCredentialsStatus,
};
