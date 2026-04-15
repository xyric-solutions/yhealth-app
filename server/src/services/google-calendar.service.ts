/**
 * @file Google Calendar Service
 * @description OAuth2 integration with Google Calendar API for event sync.
 * Reads calendar events and stores them in calendar_events table.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
// env not needed — calendar config uses process.env directly

// ============================================
// TYPES
// ============================================

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: string;
  tokenExpiresAt: string;
  calendarIds: string[];
  syncEnabled: boolean;
  lastSyncAt: string | null;
  syncStatus: string;
  syncError: string | null;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  connectionId: string;
  externalId: string;
  calendarId: string | null;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string | null;
  status: string;
  busyStatus: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  status?: string;
  transparency?: string; // 'opaque' = busy, 'transparent' = free
  recurrence?: string[];
}

// ============================================
// CONFIG
// ============================================

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

const DEFAULT_REDIRECT_URI = process.env['GOOGLE_CALENDAR_REDIRECT_URI'] || 'http://localhost:9090/api/calendar/callback';

/**
 * Get user's own calendar credentials from DB
 */
async function getUserCalendarConfig(userId: string) {
  const result = await query<{ client_id: string | null; client_secret: string | null; redirect_uri: string | null }>(
    'SELECT client_id, client_secret, redirect_uri FROM calendar_connections WHERE user_id = $1 AND provider = $2',
    [userId, 'google'],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (!row.client_id || !row.client_secret) return null;
  return {
    clientId: row.client_id,
    clientSecret: row.client_secret,
    redirectUri: row.redirect_uri || DEFAULT_REDIRECT_URI,
  };
}

// ============================================
// SERVICE
// ============================================

class GoogleCalendarService {
  /**
   * Check if Google Calendar is configured (either per-user or global env)
   */
  isConfigured(): boolean {
    // Always return true — users can add their own credentials
    return true;
  }

  /**
   * Check if a specific user has credentials configured
   */
  async isUserConfigured(userId: string): Promise<boolean> {
    const config = await getUserCalendarConfig(userId);
    return !!config;
  }

  /**
   * Save user's own Google Calendar API credentials
   */
  async saveCredentials(userId: string, clientId: string, clientSecret: string, redirectUri?: string): Promise<void> {
    await query(
      `INSERT INTO calendar_connections (user_id, provider, client_id, client_secret, redirect_uri, sync_status)
       VALUES ($1, 'google', $2, $3, $4, 'pending')
       ON CONFLICT (user_id, provider) DO UPDATE SET
         client_id = EXCLUDED.client_id,
         client_secret = EXCLUDED.client_secret,
         redirect_uri = COALESCE(EXCLUDED.redirect_uri, calendar_connections.redirect_uri),
         sync_status = 'pending',
         sync_error = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, clientId, clientSecret, redirectUri || DEFAULT_REDIRECT_URI],
    );
    logger.info('[GoogleCalendar] Credentials saved', { userId });
  }

  /**
   * Get user's credentials (masked for display)
   */
  async getCredentials(userId: string): Promise<{ clientId: string; hasSecret: boolean; redirectUri: string } | null> {
    const config = await getUserCalendarConfig(userId);
    if (!config) return null;
    return {
      clientId: config.clientId.substring(0, 12) + '****' + config.clientId.substring(config.clientId.length - 4),
      hasSecret: true,
      redirectUri: config.redirectUri,
    };
  }

  /**
   * Delete user's credentials
   */
  async deleteCredentials(userId: string): Promise<void> {
    await query('DELETE FROM calendar_events WHERE user_id = $1', [userId]);
    await query('DELETE FROM calendar_connections WHERE user_id = $1 AND provider = $2', [userId, 'google']);
    logger.info('[GoogleCalendar] Credentials deleted', { userId });
  }

  /**
   * Generate OAuth2 authorization URL using user's own credentials
   */
  async getAuthUrl(userId: string): Promise<string> {
    const config = await getUserCalendarConfig(userId);
    if (!config) throw new Error('Please add your Google Calendar credentials first');

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state: userId, // pass userId through state parameter
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens and store connection
   */
  async handleCallback(userId: string, code: string): Promise<CalendarConnection> {
    const config = await getUserCalendarConfig(userId);
    if (!config) throw new Error('No Google Calendar credentials found. Please add credentials first.');

    // Exchange code for tokens using user's own credentials
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('[GoogleCalendar] Token exchange failed', { status: tokenResponse.status, error: errorText });
      throw new Error('Failed to authenticate with Google Calendar');
    }

    const tokens = await tokenResponse.json() as GoogleTokenResponse;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert connection
    const result = await query<{ id: string; user_id: string; provider: string; token_expires_at: Date; sync_enabled: boolean; last_sync_at: Date | null; sync_status: string; sync_error: string | null; created_at: Date }>(
      `INSERT INTO calendar_connections (user_id, provider, access_token, refresh_token, token_expires_at, sync_status)
       VALUES ($1, 'google', $2, $3, $4, 'pending')
       ON CONFLICT (user_id, provider) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_connections.refresh_token),
         token_expires_at = EXCLUDED.token_expires_at,
         sync_status = 'pending',
         sync_error = NULL,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, user_id, provider, token_expires_at, sync_enabled, last_sync_at, sync_status, sync_error, created_at`,
      [userId, tokens.access_token, tokens.refresh_token || '', expiresAt],
    );

    const row = result.rows[0];
    logger.info('[GoogleCalendar] Connection established', { userId, connectionId: row.id });

    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      tokenExpiresAt: row.token_expires_at.toISOString(),
      calendarIds: [],
      syncEnabled: row.sync_enabled,
      lastSyncAt: row.last_sync_at?.toISOString() || null,
      syncStatus: row.sync_status,
      syncError: row.sync_error,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Refresh an expired access token
   */
  async refreshToken(connectionId: string): Promise<void> {
    const connResult = await query<{ client_id: string | null; client_secret: string | null; refresh_token: string }>(
      'SELECT client_id, client_secret, refresh_token FROM calendar_connections WHERE id = $1',
      [connectionId],
    );
    if (connResult.rows.length === 0) return;

    const { client_id, client_secret, refresh_token: refreshTokenVal } = connResult.rows[0];
    if (!client_id || !client_secret) {
      logger.warn('[GoogleCalendar] No credentials for connection', { connectionId });
      return;
    }
    if (!refreshTokenVal) {
      logger.warn('[GoogleCalendar] No refresh token available', { connectionId });
      return;
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id,
        client_secret,
        refresh_token: refreshTokenVal,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      await query(
        `UPDATE calendar_connections SET sync_status = 'error', sync_error = 'Token refresh failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [connectionId],
      );
      return;
    }

    const tokens = await tokenResponse.json() as GoogleTokenResponse;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await query(
      `UPDATE calendar_connections SET access_token = $1, token_expires_at = $2, sync_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [tokens.access_token, expiresAt, connectionId],
    );
  }

  /**
   * Sync events from Google Calendar API into calendar_events table
   */
  async syncEvents(userId: string, connectionId: string, daysBack: number = 7, daysForward: number = 7): Promise<number> {
    // Get access token
    const connResult = await query<{ access_token: string; token_expires_at: Date }>(
      'SELECT access_token, token_expires_at FROM calendar_connections WHERE id = $1 AND user_id = $2',
      [connectionId, userId],
    );
    if (connResult.rows.length === 0) throw new Error('Connection not found');

    let accessToken = connResult.rows[0].access_token;
    const expiresAt = new Date(connResult.rows[0].token_expires_at);

    // Refresh if expired
    if (expiresAt <= new Date()) {
      await this.refreshToken(connectionId);
      const refreshed = await query<{ access_token: string }>(
        'SELECT access_token FROM calendar_connections WHERE id = $1',
        [connectionId],
      );
      accessToken = refreshed.rows[0]?.access_token || accessToken;
    }

    // Set time range
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - daysBack);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + daysForward);

    // Fetch events from Google Calendar API
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      const errorText = await response.text();
      await query(
        `UPDATE calendar_connections SET sync_status = 'error', sync_error = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [`API error: ${response.status}`, connectionId],
      );
      logger.error('[GoogleCalendar] Sync failed', { userId, connectionId, status: response.status, error: errorText });
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const data = await response.json() as { items?: GoogleCalendarEvent[] };
    const events = data.items || [];

    // Upsert events
    let synced = 0;
    for (const event of events) {
      if (!event.id || !event.start) continue;

      const startTime = event.start.dateTime || event.start.date;
      const endTime = event.end?.dateTime || event.end?.date || startTime;
      const allDay = !event.start.dateTime;
      const busyStatus = event.transparency === 'transparent' ? 'free' : 'busy';
      const status = event.status || 'confirmed';

      if (status === 'cancelled') continue;

      await query(
        `INSERT INTO calendar_events (user_id, connection_id, external_id, calendar_id, title, description, start_time, end_time, all_day, location, status, busy_status, recurrence_rule, synced_at)
         VALUES ($1, $2, $3, 'primary', $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
         ON CONFLICT (connection_id, external_id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           all_day = EXCLUDED.all_day,
           location = EXCLUDED.location,
           status = EXCLUDED.status,
           busy_status = EXCLUDED.busy_status,
           synced_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP`,
        [
          userId, connectionId, event.id,
          (event.summary || 'Untitled Event').substring(0, 500),
          event.description?.substring(0, 2000) || null,
          startTime || new Date().toISOString(), endTime || startTime || new Date().toISOString(), allDay,
          event.location || null,
          status, busyStatus,
          event.recurrence?.join(';') || null,
        ],
      );
      synced++;
    }

    // Update connection sync status
    await query(
      `UPDATE calendar_connections SET last_sync_at = CURRENT_TIMESTAMP, sync_status = 'synced', sync_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [connectionId],
    );

    logger.info('[GoogleCalendar] Sync completed', { userId, connectionId, eventsSynced: synced });
    return synced;
  }

  /**
   * Get all connections for a user
   */
  async getConnections(userId: string): Promise<CalendarConnection[]> {
    const result = await query<{
      id: string; user_id: string; provider: string; token_expires_at: Date;
      calendar_ids: string[]; sync_enabled: boolean; last_sync_at: Date | null;
      sync_status: string; sync_error: string | null; created_at: Date;
    }>(
      'SELECT id, user_id, provider, token_expires_at, calendar_ids, sync_enabled, last_sync_at, sync_status, sync_error, created_at FROM calendar_connections WHERE user_id = $1',
      [userId],
    );

    return result.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      provider: r.provider,
      tokenExpiresAt: r.token_expires_at.toISOString(),
      calendarIds: r.calendar_ids || [],
      syncEnabled: r.sync_enabled,
      lastSyncAt: r.last_sync_at?.toISOString() || null,
      syncStatus: r.sync_status,
      syncError: r.sync_error,
      createdAt: r.created_at.toISOString(),
    }));
  }

  /**
   * Get synced calendar events for a date range
   */
  async getEvents(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const result = await query<{
      id: string; user_id: string; connection_id: string; external_id: string;
      calendar_id: string | null; title: string; description: string | null;
      start_time: Date; end_time: Date; all_day: boolean; location: string | null;
      status: string; busy_status: string;
    }>(
      `SELECT id, user_id, connection_id, external_id, calendar_id, title, description,
              start_time, end_time, all_day, location, status, busy_status
       FROM calendar_events
       WHERE user_id = $1 AND start_time >= $2::date AND end_time <= ($3::date + INTERVAL '1 day')
         AND status != 'cancelled'
       ORDER BY start_time ASC`,
      [userId, startDate, endDate],
    );

    return result.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      connectionId: r.connection_id,
      externalId: r.external_id,
      calendarId: r.calendar_id,
      title: r.title,
      description: r.description,
      startTime: r.start_time.toISOString(),
      endTime: r.end_time.toISOString(),
      allDay: r.all_day,
      location: r.location,
      status: r.status,
      busyStatus: r.busy_status,
    }));
  }

  /**
   * Disconnect a calendar connection
   */
  async disconnect(userId: string, connectionId: string): Promise<void> {
    // Delete events first (cascade would handle this, but explicit is clearer)
    await query('DELETE FROM calendar_events WHERE connection_id = $1 AND user_id = $2', [connectionId, userId]);
    await query('DELETE FROM calendar_connections WHERE id = $1 AND user_id = $2', [connectionId, userId]);
    logger.info('[GoogleCalendar] Disconnected', { userId, connectionId });
  }
}

export const googleCalendarService = new GoogleCalendarService();
