export type { SpotifyTrack, SpotifyPlaylist, SpotifyPlaybackState, SpotifyConnectionStatus, SpotifyActivityCategory } from '@/src/shared/services/spotify.service';

export interface PlayerState {
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: 'off' | 'track' | 'context';
  isPremium: boolean;
  usePreview: boolean;
}

// Re-export the SpotifyTrack type for convenience
import type { SpotifyTrack } from '@/src/shared/services/spotify.service';
export type TrackWithPlayback = SpotifyTrack & {
  isCurrentlyPlaying?: boolean;
};
