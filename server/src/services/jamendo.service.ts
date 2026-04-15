/**
 * @file Jamendo Service
 * @description Free CC-licensed music fallback when Spotify is not configured.
 * Returns data in the same SpotifyTrack/SpotifyPlaylist shape for client compatibility.
 */

import env from '../config/env.config.js';
import { logger } from './logger.service.js';
import type { SpotifyTrack, SpotifyPlaylist, SpotifyActivityCategory } from '../../../shared/types/domain/spotify.js';

const JAMENDO_API = 'https://api.jamendo.com/v3.0';

// Map activity categories to Jamendo tags
const ACTIVITY_TAGS: Record<SpotifyActivityCategory, string[]> = {
  workout:    ['workout', 'energetic', 'power', 'hiphop'],
  running:    ['running', 'uptempo', 'electronic', 'dance'],
  meditation: ['meditation', 'ambient', 'relaxing', 'calm'],
  sleep:      ['sleep', 'ambient', 'lullaby', 'peaceful'],
  focus:      ['focus', 'study', 'instrumental', 'lofi'],
  recovery:   ['chill', 'downtempo', 'relaxing', 'acoustic'],
  stretching: ['gentle', 'acoustic', 'newage', 'relaxing'],
  yoga:       ['yoga', 'ambient', 'newage', 'spiritual'],
};

// Speed/BPM ranges per activity for the Jamendo speed filter
const ACTIVITY_SPEED: Record<SpotifyActivityCategory, string> = {
  workout:    'high+veryhigh',
  running:    'high+veryhigh',
  meditation: 'verylow+low',
  sleep:      'verylow',
  focus:      'medium',
  recovery:   'low+medium',
  stretching: 'low+medium',
  yoga:       'verylow+low',
};

function getClientId(): string {
  return env.jamendo.clientId || '';
}

function isConfigured(): boolean {
  return !!getClientId();
}

/**
 * Fetch from Jamendo API
 */
async function jamendoRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Jamendo client ID not configured');
  }

  const url = new URL(`${JAMENDO_API}${endpoint}`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.error('[Jamendo] API request failed', { endpoint, status: response.status, error: errorBody.substring(0, 200) });
    throw new Error(`Jamendo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { headers: { status: string; results_count: number }; results: T };
  logger.debug('[Jamendo] API response', { endpoint, status: data.headers?.status, resultsCount: data.headers?.results_count });

  if (!data.results || (Array.isArray(data.results) && data.results.length === 0)) {
    logger.warn('[Jamendo] Empty results from API', { endpoint, params });
  }

  return data.results;
}

/**
 * Convert a Jamendo track to SpotifyTrack shape
 */
function toSpotifyTrack(track: JamendoTrack): SpotifyTrack {
  return {
    id: `jamendo-${track.id}`,
    name: track.name,
    artists: [{ id: `jamendo-artist-${track.artist_id}`, name: track.artist_name }],
    album: {
      id: `jamendo-album-${track.album_id || '0'}`,
      name: track.album_name || 'Single',
      images: track.album_image
        ? [{ url: track.album_image, width: 300, height: 300 }]
        : track.image
          ? [{ url: track.image, width: 300, height: 300 }]
          : [],
    },
    duration_ms: (track.duration || 0) * 1000,
    preview_url: track.audio || null,        // Jamendo provides full free audio URLs
    uri: `jamendo:track:${track.id}`,
    external_urls: { spotify: track.shareurl || `https://www.jamendo.com/track/${track.id}` },
    is_playable: true,
  };
}

// Jamendo response types
interface JamendoTrack {
  id: string;
  name: string;
  artist_id: string;
  artist_name: string;
  album_id?: string;
  album_name?: string;
  album_image?: string;
  image?: string;
  duration: number;
  audio: string;
  audiodownload?: string;
  shareurl?: string;
}

/**
 * Get curated tracks for an activity category
 * Returns tracks grouped as a pseudo-playlist
 */
export async function getJamendoTracks(
  category: SpotifyActivityCategory,
  limit = 30
): Promise<SpotifyTrack[]> {
  if (!isConfigured()) return [];

  const tags = ACTIVITY_TAGS[category] || ['music'];
  const speed = ACTIVITY_SPEED[category] || 'medium';

  try {
    // Try with first tag only (most specific) — combined tags often return 0 results
    // because Jamendo requires ALL tags to match when joined with +
    let tracks = await jamendoRequest<JamendoTrack[]>('/tracks/', {
      tags: tags[0],
      speed,
      limit: String(limit),
      order: 'popularity_week',
      include: 'musicinfo',
      audioformat: 'mp32',
    });

    // Fallback: try without speed filter if no results
    if (!tracks || tracks.length === 0) {
      logger.debug('[Jamendo] No results with speed filter, retrying without speed', { category, tag: tags[0] });
      tracks = await jamendoRequest<JamendoTrack[]>('/tracks/', {
        tags: tags[0],
        limit: String(limit),
        order: 'popularity_week',
        audioformat: 'mp32',
      });
    }

    // Final fallback: try generic "electronic" or "pop" tag
    if (!tracks || tracks.length === 0) {
      const genericTag = ['workout', 'running'].includes(category) ? 'electronic' : 'ambient';
      logger.debug('[Jamendo] Trying generic tag fallback', { category, genericTag });
      tracks = await jamendoRequest<JamendoTrack[]>('/tracks/', {
        tags: genericTag,
        limit: String(limit),
        order: 'popularity_week',
        audioformat: 'mp32',
      });
    }

    logger.info('[Jamendo] Fetched tracks', { category, count: tracks?.length || 0, tag: tags[0] });
    return (tracks || []).map(toSpotifyTrack);
  } catch (error) {
    logger.warn('[Jamendo] Tracks fetch failed', {
      category,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Get curated playlists for an activity — returns tracks grouped as virtual playlists
 * Fetches sample tracks per tag to get album cover images
 */
export async function getJamendoCuratedPlaylists(
  category: SpotifyActivityCategory
): Promise<SpotifyPlaylist[]> {
  if (!isConfigured()) return [];

  const tags = ACTIVITY_TAGS[category] || ['music'];

  // Fetch sample tracks per tag in parallel to get cover art
  // Don't use speed filter here — it's too restrictive and returns 0 results for many tags
  const results = await Promise.allSettled(
    tags.map(tag =>
      jamendoRequest<JamendoTrack[]>('/tracks/', {
        tags: tag,
        limit: '5',
        order: 'popularity_week',
        audioformat: 'mp32',
      })
    )
  );

  const fulfilled = results.filter(r => r.status === 'fulfilled').length;
  const rejected = results.filter(r => r.status === 'rejected').length;
  logger.info('[Jamendo] Curated playlists fetch', { category, tags: tags.length, fulfilled, rejected });

  const playlists: SpotifyPlaylist[] = tags.map((tag, i) => {
    const result = results[i];
    const sampleTracks = result.status === 'fulfilled' ? result.value : [];
    const coverImages = sampleTracks
      .map(t => t.album_image || t.image)
      .filter((url): url is string => !!url);

    return {
      id: `jamendo-${category}-${tag}`,
      name: `${tag.charAt(0).toUpperCase() + tag.slice(1)} ${category.charAt(0).toUpperCase() + category.slice(1)}`,
      description: `Free ${tag} music for ${category}`,
      images: coverImages.length > 0
        ? [{ url: coverImages[0], width: 300, height: 300 }]
        : [],
      tracks: { total: 20 },
      owner: { id: 'jamendo', display_name: 'Jamendo' },
      uri: `jamendo:collection:${category}-${tag}`,
      external_urls: { spotify: `https://www.jamendo.com/search?q=${tag}` },
    };
  });

  return playlists;
}

/**
 * Get tracks for a Jamendo virtual playlist (tag-based)
 */
export async function getJamendoPlaylistTracks(
  playlistId: string,
  limit = 50,
  offset = 0
): Promise<{ tracks: SpotifyTrack[]; total: number }> {
  if (!isConfigured()) return { tracks: [], total: 0 };

  // Parse virtual playlist ID: "jamendo-{category}-{tag}"
  const parts = playlistId.replace('jamendo-', '').split('-');
  const tag = parts.slice(1).join('-') || parts[0];
  const category = parts[0] as SpotifyActivityCategory;
  const speed = ACTIVITY_SPEED[category] || 'medium';

  try {
    const tracks = await jamendoRequest<JamendoTrack[]>('/tracks/', {
      tags: tag,
      speed,
      limit: String(limit),
      offset: String(offset),
      order: 'popularity_week',
      audioformat: 'mp32',
    });

    return {
      tracks: tracks.map(toSpotifyTrack),
      total: tracks.length + offset, // Jamendo doesn't give exact total
    };
  } catch (error) {
    logger.warn('Jamendo playlist tracks fetch failed', { playlistId, error: error instanceof Error ? error.message : String(error) });
    return { tracks: [], total: 0 };
  }
}

/**
 * Search Jamendo catalog
 */
export async function searchJamendo(
  queryStr: string,
  limit = 20
): Promise<{ tracks?: SpotifyTrack[]; playlists?: SpotifyPlaylist[] }> {
  if (!isConfigured()) return {};

  try {
    const tracks = await jamendoRequest<JamendoTrack[]>('/tracks/', {
      search: queryStr,
      limit: String(limit),
      order: 'relevance',
      audioformat: 'mp32',
    });

    return {
      tracks: tracks.map(toSpotifyTrack),
    };
  } catch (error) {
    logger.warn('Jamendo search failed', { query: queryStr, error: error instanceof Error ? error.message : String(error) });
    return {};
  }
}

/**
 * Get Jamendo recommendations (popular tracks by tag)
 */
export async function getJamendoRecommendations(
  activityType: SpotifyActivityCategory,
  limit = 30
): Promise<SpotifyTrack[]> {
  return getJamendoTracks(activityType, limit);
}

/**
 * Check if Jamendo is configured
 */
export function isJamendoConfigured(): boolean {
  return isConfigured();
}

export default {
  getJamendoTracks,
  getJamendoCuratedPlaylists,
  getJamendoPlaylistTracks,
  searchJamendo,
  getJamendoRecommendations,
  isJamendoConfigured,
};
