import { api } from '@/lib/api-client';
import type {
  SpotifyTrack,
  SpotifyPlaylist,
  SpotifyPlaybackState,
  SpotifyConnectionStatus,
  SpotifyActivityCategory,
  SpotifyPlaybackAction,
} from '@shared/types/domain/spotify';

export const spotifyService = {
  // ─── OAuth ──────────────────────────────────────────────
  connect: (redirectUri?: string) =>
    api.post<{ authUrl: string; state: string }>('/spotify/auth/connect', { redirectUri }),

  callback: (code: string, state: string) =>
    api.post<SpotifyConnectionStatus>('/spotify/auth/callback', { code, state }),

  disconnect: () =>
    api.delete<{ isConnected: false }>('/spotify/auth/disconnect'),

  getStatus: () =>
    api.get<SpotifyConnectionStatus & {
      isConfigured: boolean;
      hasCredentials: boolean;
      clientIdMasked?: string;
      credentialSource?: 'user' | 'env';
      hasJamendoFallback?: boolean;
    }>('/spotify/auth/status'),

  // ─── Credentials ──────────────────────────────────────────
  saveCredentials: (clientId: string, clientSecret: string) =>
    api.post<{ id: string; status: string; requiresReauth?: boolean }>('/spotify/credentials', { clientId, clientSecret }),

  getCredentials: () =>
    api.get<{ hasCredentials: boolean; clientIdMasked?: string; source?: 'user' | 'env' }>('/spotify/credentials'),

  deleteCredentials: () =>
    api.delete<{ deleted: boolean }>('/spotify/credentials'),

  // ─── Playlists ──────────────────────────────────────────
  getPlaylists: (category: SpotifyActivityCategory) =>
    api.get<{ playlists: SpotifyPlaylist[]; category: string }>(`/spotify/playlists/${category}`),

  getPlaylistTracks: (playlistId: string, limit = 50, offset = 0) =>
    api.get<{ tracks: SpotifyTrack[]; total: number }>(
      `/spotify/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`
    ),

  // ─── Search ─────────────────────────────────────────────
  search: (q: string, type: 'track' | 'playlist' | 'artist' = 'track', limit = 20) =>
    api.get<{ tracks?: SpotifyTrack[]; playlists?: SpotifyPlaylist[] }>(
      `/spotify/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`
    ),

  // ─── Recommendations ───────────────────────────────────
  getRecommendations: (activityType: SpotifyActivityCategory, seedTracks?: string[]) =>
    api.get<{ tracks: SpotifyTrack[]; activityType: string }>(
      `/spotify/recommendations?activityType=${activityType}${seedTracks ? `&seedTracks=${seedTracks.join(',')}` : ''}`
    ),

  // ─── User Library ──────────────────────────────────────
  getLibrary: (limit = 50, offset = 0) =>
    api.get<{
      savedTracks: { tracks: SpotifyTrack[]; total: number };
      playlists: { playlists: SpotifyPlaylist[]; total: number };
      recentlyPlayed: SpotifyTrack[];
    }>(`/spotify/me/library?limit=${limit}&offset=${offset}`),

  // ─── Playback ───────────────────────────────────────────
  getPlaybackToken: () =>
    api.get<{ accessToken: string; isPremium: boolean; expiresIn: number }>('/spotify/playback/token'),

  getPlaybackState: () =>
    api.get<SpotifyPlaybackState>('/spotify/playback/state'),

  controlPlayback: (action: SpotifyPlaybackAction, options?: {
    value?: number | boolean | string;
    uris?: string[];
    context_uri?: string;
    offset?: { position: number };
  }) =>
    api.put<{ action: string; success: boolean }>('/spotify/playback/control', {
      action,
      ...options,
    }),
};

export type { SpotifyTrack, SpotifyPlaylist, SpotifyPlaybackState, SpotifyConnectionStatus, SpotifyActivityCategory };
