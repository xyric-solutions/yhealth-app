/**
 * @file Spotify Playlist Service
 * @description Curated health playlists, search, recommendations with activity-based audio features
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { spotifyApiRequest, getSpotifyCredentials } from './spotify.service.js';
import {
  getJamendoCuratedPlaylists,
  getJamendoPlaylistTracks,
  searchJamendo,
  getJamendoRecommendations,
  isJamendoConfigured,
} from './jamendo.service.js';
import type { SpotifyActivityCategory, AudioFeatureProfile, SpotifyTrack, SpotifyPlaylist } from '../../../shared/types/domain/spotify.js';

// ============================================
// 403 CIRCUIT BREAKER
// Skip Spotify tracks endpoint when it's consistently returning 403
// (common when app lacks extended quota approval from Spotify)
// ============================================

let spotifyTracks403Count = 0;
const SPOTIFY_403_SKIP_THRESHOLD = 5;   // More lenient (was 3)
const SPOTIFY_403_RESET_MS = 5 * 60 * 1000; // Reset after 5 min (was 30 min)
let lastSpotify403At = 0;

/**
 * Check if Spotify is available (env or user credentials)
 */
async function isSpotifyAvailable(userId: string | null): Promise<boolean> {
  try {
    const creds = await getSpotifyCredentials(userId ?? undefined);
    return !!(creds?.clientId && creds?.clientSecret);
  } catch {
    return false;
  }
}

// Activity-to-audio-feature profiles for intelligent recommendations
const ACTIVITY_AUDIO_PROFILES: Record<SpotifyActivityCategory, AudioFeatureProfile> = {
  workout:    { min_energy: 0.7, min_tempo: 120, target_valence: 0.8, min_danceability: 0.6 },
  running:    { min_energy: 0.8, min_tempo: 140, target_valence: 0.7, min_danceability: 0.5 },
  meditation: { max_energy: 0.3, max_tempo: 80,  target_valence: 0.5, target_instrumentalness: 0.7 },
  sleep:      { max_energy: 0.2, max_tempo: 70,  target_valence: 0.4, target_instrumentalness: 0.8 },
  focus:      { min_energy: 0.4, max_energy: 0.7, target_valence: 0.5, target_instrumentalness: 0.6 },
  recovery:   { max_energy: 0.4, target_valence: 0.6, max_tempo: 100 },
  stretching: { max_energy: 0.5, target_valence: 0.6, max_tempo: 110 },
  yoga:       { max_energy: 0.4, max_tempo: 90,  target_valence: 0.5, target_instrumentalness: 0.5 },
};

// Search queries per activity for curated playlist discovery
const ACTIVITY_SEARCH_QUERIES: Record<SpotifyActivityCategory, string[]> = {
  workout:    ['workout motivation', 'gym beast mode', 'power workout'],
  running:    ['running pace', 'run motivation', 'cardio running'],
  meditation: ['meditation calm', 'mindfulness', 'peaceful meditation'],
  sleep:      ['sleep ambient', 'deep sleep', 'sleep sounds'],
  focus:      ['focus study', 'deep focus', 'concentration'],
  recovery:   ['recovery chill', 'cool down', 'post workout relax'],
  stretching: ['stretching music', 'gentle movement', 'flexibility flow'],
  yoga:       ['yoga flow', 'yoga practice', 'yoga ambient'],
};


/**
 * Get curated playlists for an activity category
 * Uses Client Credentials (no user auth needed) with DB caching
 */
export async function getCuratedPlaylists(
  category: SpotifyActivityCategory,
  userId: string | null = null
): Promise<SpotifyPlaylist[]> {
  // Check if Spotify is available, fallback to Jamendo
  const spotifyAvailable = await isSpotifyAvailable(userId);
  if (!spotifyAvailable && isJamendoConfigured()) {
    logger.info('Spotify not configured, falling back to Jamendo', { category });
    return getJamendoCuratedPlaylists(category);
  }

  // Check cache (gracefully handle missing table)
  try {
    const cached = await query<{
      spotify_playlist_id: string;
      name: string;
      description: string | null;
      image_url: string | null;
      track_count: number;
      last_refreshed_at: Date;
      cached_tracks: unknown;
    }>(
      `SELECT * FROM spotify_cached_playlists
       WHERE category = $1 AND last_refreshed_at > NOW() - INTERVAL '6 hours'
       ORDER BY track_count DESC
       LIMIT 20`,
      [category]
    );

    if (cached.rows.length > 0) {
      return cached.rows.map(row => ({
        id: row.spotify_playlist_id,
        name: row.name,
        description: row.description,
        images: row.image_url ? [{ url: row.image_url, width: 300, height: 300 }] : [],
        tracks: { total: row.track_count },
        owner: { id: 'spotify', display_name: 'Spotify' },
        uri: `spotify:playlist:${row.spotify_playlist_id}`,
        external_urls: { spotify: `https://open.spotify.com/playlist/${row.spotify_playlist_id}` },
      }));
    }
  } catch (error: any) {
    // Table might not exist yet — skip cache, fetch fresh
    if (error?.code === '42P01') {
      logger.warn('spotify_cached_playlists table does not exist, skipping cache');
    } else {
      throw error;
    }
  }

  // Fetch from Spotify API
  const queries = ACTIVITY_SEARCH_QUERIES[category] || [`${category} music`];
  const allPlaylists: SpotifyPlaylist[] = [];

  for (const q of queries) {
    try {
      const result = await spotifyApiRequest<{
        playlists: { items: SpotifyPlaylist[] };
      }>(null, `/search?q=${encodeURIComponent(q)}&type=playlist&limit=10`);

      if (result.playlists?.items) {
        allPlaylists.push(...result.playlists.items.filter(p => p && p.id));
      }
    } catch (error) {
      logger.warn('Spotify playlist search failed', { query: q, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Deduplicate by ID
  const uniquePlaylists = Array.from(
    new Map(allPlaylists.map(p => [p.id, p])).values()
  ).slice(0, 20);

  // Cache results
  for (const p of uniquePlaylists) {
    try {
      await query(
        `INSERT INTO spotify_cached_playlists (category, spotify_playlist_id, name, description, image_url, track_count, last_refreshed_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (category, spotify_playlist_id)
         DO UPDATE SET name = $3, description = $4, image_url = $5, track_count = $6, last_refreshed_at = CURRENT_TIMESTAMP`,
        [category, p.id, p.name, p.description, p.images?.[0]?.url || null, p.tracks?.total || 0]
      );
    } catch {
      // Cache write failures are non-critical
    }
  }

  return uniquePlaylists;
}

/**
 * Get tracks for a playlist
 */
export async function getPlaylistTracks(
  playlistId: string,
  userId: string | null = null,
  limit = 50,
  offset = 0
): Promise<{ tracks: SpotifyTrack[]; total: number }> {
  // Handle Jamendo virtual playlist IDs
  if (playlistId.startsWith('jamendo-')) {
    return getJamendoPlaylistTracks(playlistId, limit, offset);
  }

  // 403 circuit breaker: skip Spotify tracks endpoint when consistently failing
  // (Spotify restricts /playlists/{id}/tracks for non-approved apps)
  const circuitBreakerActive = spotifyTracks403Count >= SPOTIFY_403_SKIP_THRESHOLD &&
    (Date.now() - lastSpotify403At) < SPOTIFY_403_RESET_MS;

  if (circuitBreakerActive) {
    logger.debug('[SpotifyPlaylist] 403 circuit breaker active, skipping Spotify tracks', { playlistId });
  } else {
    // Reset counter if enough time has passed
    if (spotifyTracks403Count > 0 && (Date.now() - lastSpotify403At) >= SPOTIFY_403_RESET_MS) {
      spotifyTracks403Count = 0;
    }

    const endpoint = `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&market=from_token`;

    // Try user auth first, then client credentials (without market=from_token)
    const attempts: { uid: string | null; ep: string }[] = [];
    if (userId) {
      attempts.push({ uid: userId, ep: endpoint });
    }
    // Client credentials can't use market=from_token — use no market parameter
    attempts.push({ uid: null, ep: `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}` });

    for (const { uid, ep } of attempts) {
      try {
        const result = await spotifyApiRequest<{
          items: { track: SpotifyTrack }[];
          total: number;
        }>(uid, ep);

        // Success — reset circuit breaker
        spotifyTracks403Count = 0;
        return {
          tracks: result.items?.map(item => item.track).filter(t => t && t.id) || [],
          total: result.total || 0,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.warn('[SpotifyPlaylist] getPlaylistTracks attempt failed', {
          playlistId,
          authMode: uid ? 'user' : 'client_credentials',
          error: errMsg,
        });

        // Track 403 failures for circuit breaker
        if (errMsg.includes('403') || errMsg.includes('Forbidden') || errMsg.includes('forbidden')) {
          spotifyTracks403Count++;
          lastSpotify403At = Date.now();
        }
      }
    }
  }

  // All Spotify attempts failed — fall back to Jamendo if configured
  if (isJamendoConfigured()) {
    // Look up category from cache to build a meaningful Jamendo query
    let category = 'workout';
    try {
      const cached = await query<{ category: string }>(
        `SELECT category FROM spotify_cached_playlists WHERE spotify_playlist_id = $1 LIMIT 1`,
        [playlistId]
      );
      if (cached.rows.length > 0) {
        category = cached.rows[0].category;
      }
    } catch {
      // Cache lookup failure is non-critical
    }
    logger.info('Spotify playlist tracks unavailable, falling back to Jamendo', { playlistId, category });
    return getJamendoPlaylistTracks(`jamendo-${category}-${category}`, limit, offset);
  }

  return { tracks: [], total: 0 };
}

/**
 * Search tracks, playlists, or artists
 */
export async function searchSpotify(
  queryStr: string,
  type: 'track' | 'playlist' | 'artist' = 'track',
  userId: string | null = null,
  limit = 20
): Promise<{ tracks?: SpotifyTrack[]; playlists?: SpotifyPlaylist[] }> {
  // Fallback to Jamendo when Spotify not available
  const spotifyAvailable = await isSpotifyAvailable(userId);
  if (!spotifyAvailable && isJamendoConfigured()) {
    return searchJamendo(queryStr, limit);
  }

  const result = await spotifyApiRequest<{
    tracks?: { items: SpotifyTrack[] };
    playlists?: { items: SpotifyPlaylist[] };
  }>(userId, `/search?q=${encodeURIComponent(queryStr)}&type=${type}&limit=${limit}`);

  return {
    tracks: result.tracks?.items,
    playlists: result.playlists?.items,
  };
}

/**
 * Get activity-based recommendations using Spotify's recommendation API
 */
export async function getRecommendations(
  activityType: SpotifyActivityCategory,
  userId: string | null = null,
  seedTracks?: string[],
  limit = 30
): Promise<SpotifyTrack[]> {
  const profile = ACTIVITY_AUDIO_PROFILES[activityType];
  if (!profile) {
    throw new Error(`Unknown activity type: ${activityType}`);
  }

  // Fallback to Jamendo when Spotify not available
  const spotifyAvailable = await isSpotifyAvailable(userId);
  if (!spotifyAvailable && isJamendoConfigured()) {
    return getJamendoRecommendations(activityType, limit);
  }

  // Build recommendation parameters from audio profile
  const params = new URLSearchParams();
  params.set('limit', String(limit));

  // Use seed genres if no seed tracks provided
  if (seedTracks && seedTracks.length > 0) {
    params.set('seed_tracks', seedTracks.slice(0, 5).join(','));
  } else {
    // Map activity to genre seeds
    const genreMap: Record<SpotifyActivityCategory, string> = {
      workout: 'work-out',
      running: 'work-out',
      meditation: 'ambient',
      sleep: 'sleep',
      focus: 'study',
      recovery: 'chill',
      stretching: 'chill',
      yoga: 'new-age',
    };
    params.set('seed_genres', genreMap[activityType] || 'pop');
  }

  // Apply audio feature constraints
  if (profile.min_energy !== undefined) params.set('min_energy', String(profile.min_energy));
  if (profile.max_energy !== undefined) params.set('max_energy', String(profile.max_energy));
  if (profile.min_tempo !== undefined) params.set('min_tempo', String(profile.min_tempo));
  if (profile.max_tempo !== undefined) params.set('max_tempo', String(profile.max_tempo));
  if (profile.target_valence !== undefined) params.set('target_valence', String(profile.target_valence));
  if (profile.min_danceability !== undefined) params.set('min_danceability', String(profile.min_danceability));
  if (profile.max_danceability !== undefined) params.set('max_danceability', String(profile.max_danceability));
  if (profile.target_instrumentalness !== undefined) params.set('target_instrumentalness', String(profile.target_instrumentalness));

  try {
    const result = await spotifyApiRequest<{ tracks: SpotifyTrack[] }>(
      userId,
      `/recommendations?${params.toString()}`
    );
    return result.tracks || [];
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // Spotify deprecated /recommendations for new apps (Nov 2024) — returns 404
    // Fall back to search-based discovery or Jamendo
    if (errMsg.includes('404') || errMsg.includes('not found') || errMsg.includes('Not Found')) {
      logger.warn('[SpotifyPlaylist] /recommendations endpoint unavailable (deprecated), using search fallback', { activityType });

      // Try search-based fallback first
      try {
        const searchQueries = ACTIVITY_SEARCH_QUERIES[activityType] || [`${activityType} music`];
        const searchResult = await spotifyApiRequest<{ tracks?: { items: SpotifyTrack[] } }>(
          userId,
          `/search?q=${encodeURIComponent(searchQueries[0])}&type=track&limit=${limit}`
        );
        if (searchResult.tracks?.items?.length) {
          return searchResult.tracks.items;
        }
      } catch {
        // Search also failed
      }

      // Final fallback: Jamendo
      if (isJamendoConfigured()) {
        return getJamendoRecommendations(activityType, limit);
      }
    }
    throw error;
  }
}

/**
 * Get user's saved/library tracks
 */
export async function getUserLibrary(
  userId: string,
  limit = 50,
  offset = 0
): Promise<{ tracks: SpotifyTrack[]; total: number }> {
  const result = await spotifyApiRequest<{
    items: { track: SpotifyTrack }[];
    total: number;
  }>(userId, `/me/tracks?limit=${limit}&offset=${offset}`);

  return {
    tracks: result.items?.map(item => item.track).filter(t => t && t.id) || [],
    total: result.total || 0,
  };
}

/**
 * Get user's playlists
 */
export async function getUserPlaylists(
  userId: string,
  limit = 50,
  offset = 0
): Promise<{ playlists: SpotifyPlaylist[]; total: number }> {
  const result = await spotifyApiRequest<{
    items: SpotifyPlaylist[];
    total: number;
  }>(userId, `/me/playlists?limit=${limit}&offset=${offset}`);

  return {
    playlists: result.items?.filter(p => p && p.id) || [],
    total: result.total || 0,
  };
}

/**
 * Get user's recently played tracks
 */
export async function getRecentlyPlayed(
  userId: string,
  limit = 20
): Promise<SpotifyTrack[]> {
  const result = await spotifyApiRequest<{
    items: { track: SpotifyTrack }[];
  }>(userId, `/me/player/recently-played?limit=${limit}`);

  return result.items?.map(item => item.track).filter(t => t && t.id) || [];
}

export default {
  getCuratedPlaylists,
  getPlaylistTracks,
  searchSpotify,
  getRecommendations,
  getUserLibrary,
  getUserPlaylists,
  getRecentlyPlayed,
  ACTIVITY_AUDIO_PROFILES,
};
