"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { spotifyService } from "@/src/shared/services/spotify.service";
import type {
  SpotifyTrack,
} from "@/app/(pages)/dashboard/components/tabs/music/types";

// ── Types ─────────────────────────────────────────────────────────

interface MusicPlayerContextValue {
  // State
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  isPremium: boolean;
  playlist: SpotifyTrack[];
  currentIndex: number;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: "off" | "track" | "context";
  isExpanded: boolean;
  isFullscreen: boolean;
  liked: boolean;
  showQueue: boolean;

  // Actions
  playTrack: (
    track: SpotifyTrack,
    index: number,
    trackList: SpotifyTrack[]
  ) => void;
  togglePlayPause: () => void;
  setIsPlaying: (playing: boolean) => void;
  next: () => void;
  prev: () => void;
  seek: (e: React.MouseEvent<HTMLDivElement>) => void;
  setVolume: (vol: number) => void;
  setIsMuted: (muted: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setIsExpanded: (expanded: boolean) => void;
  setIsFullscreen: (fs: boolean) => void;
  setLiked: (liked: boolean) => void;
  setShowQueue: (show: boolean) => void;
  setPremium: (premium: boolean) => void;
  closePlayer: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx)
    throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  return ctx;
}

export function useMusicPlayerOptional() {
  return useContext(MusicPlayerContext);
}

// ── Spotify Web Playback SDK types ────────────────────────────────

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  getCurrentState: () => Promise<{
    paused: boolean;
    position: number;
    duration: number;
    track_window: {
      current_track: { duration_ms: number };
    };
  } | null>;
  addListener: (event: string, callback: (data: unknown) => void) => void;
  removeListener: (event: string) => void;
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (config: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

// ── Provider ──────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export { formatTime };

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  // Player state
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [playlist, setPlaylist] = useState<SpotifyTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "track" | "context">("off");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isDragging, _setIsDragging] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sdkPlayerRef = useRef<SpotifyPlayerInstance | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const useSDK = isPremium && sdkReady;

  // ── SDK init ──────────────────────────────────────────────────
  const initSDKPlayer = useCallback(async () => {
    if (!window.Spotify) return;

    const player = new window.Spotify.Player({
      name: "Balencia Player",
      getOAuthToken: async (cb) => {
        try {
          const res = await spotifyService.getPlaybackToken();
          if (res.success && res.data?.accessToken) {
            cb(res.data.accessToken);
          }
        } catch {
          console.error("Failed to get playback token");
        }
      },
      volume: volume / 100,
    });

    player.addListener("ready", () => setSdkReady(true));
    player.addListener("player_state_changed", (state: unknown) => {
      if (!state) return;
      const s = state as {
        paused: boolean;
        position: number;
        duration: number;
        track_window: { current_track: { duration_ms: number } };
      };
      setIsPlaying(!s.paused);
      setProgress(s.position);
      setDuration(
        s.duration || s.track_window?.current_track?.duration_ms || 0
      );
    });

    sdkPlayerRef.current = player;
    await player.connect();
  }, [volume]);

  useEffect(() => {
    if (!isPremium) return;
    if (window.Spotify) {
      initSDKPlayer();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => initSDKPlayer();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      sdkPlayerRef.current?.disconnect();
      if (progressIntervalRef.current)
        clearInterval(progressIntervalRef.current);
    };
  }, [isPremium, initSDKPlayer]);

  // ── Next track ────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (useSDK && sdkPlayerRef.current) {
      sdkPlayerRef.current.nextTrack();
      return;
    }
    let nextIndex: number;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= playlist.length) {
        if (repeat === "context") nextIndex = 0;
        else return;
      }
    }
    if (playlist[nextIndex]) {
      setCurrentTrack(playlist[nextIndex]);
      setCurrentIndex(nextIndex);
    }
  }, [useSDK, shuffle, playlist, currentIndex, repeat]);

  // ── Audio element for non-Premium ─────────────────────────────
  useEffect(() => {
    if (useSDK || !audioRef.current || !currentTrack) return;
    const audio = audioRef.current;
    if (currentTrack.preview_url) {
      audio.src = currentTrack.preview_url;
      const isFullTrack = currentTrack.duration_ms > 31000;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync init when track changes
      setDuration(isFullTrack ? currentTrack.duration_ms : 30000);
      if (isPlaying) audio.play().catch(() => {});
    }
    const handleTimeUpdate = () => {
      if (!isDragging) setProgress(audio.currentTime * 1000);
    };
    const handleEnded = () => {
      if (repeat === "track") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
        handleNext();
      }
    };
    const handleLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setDuration(audio.duration * 1000);
      }
    };
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [currentTrack, useSDK, isDragging, isPlaying, handleNext, repeat]);

  useEffect(() => {
    if (useSDK || !audioRef.current) return;
    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying, useSDK]);

  // ── SDK progress polling ──────────────────────────────────────
  useEffect(() => {
    if (!useSDK || !isPlaying) {
      if (progressIntervalRef.current)
        clearInterval(progressIntervalRef.current);
      return;
    }
    progressIntervalRef.current = setInterval(async () => {
      const state = await sdkPlayerRef.current?.getCurrentState();
      if (state && !isDragging) {
        setProgress(state.position);
        setDuration(state.duration);
      }
    }, 500);
    return () => {
      if (progressIntervalRef.current)
        clearInterval(progressIntervalRef.current);
    };
  }, [useSDK, isPlaying, isDragging]);

  // ── Volume sync ───────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current)
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    if (sdkPlayerRef.current)
      sdkPlayerRef.current.setVolume(isMuted ? 0 : volume / 100);
  }, [volume, isMuted]);

  // ── Actions ───────────────────────────────────────────────────
  const playTrack = useCallback(
    (track: SpotifyTrack, index: number, trackList: SpotifyTrack[]) => {
      setCurrentTrack(track);
      setCurrentIndex(index);
      setIsPlaying(true);
      setPlaylist(trackList);
      setProgress(0);

      if (isPremium && track.uri) {
        spotifyService
          .controlPlayback("play", {
            uris: trackList.map((t) => t.uri),
            offset: { position: index },
          })
          .catch(() => {});
      }
    },
    [isPremium]
  );

  const togglePlayPause = useCallback(async () => {
    if (useSDK && sdkPlayerRef.current) await sdkPlayerRef.current.togglePlay();
    else setIsPlaying((prev) => !prev);
  }, [useSDK]);

  const handlePrev = useCallback(() => {
    if (useSDK && sdkPlayerRef.current) {
      sdkPlayerRef.current.previousTrack();
      return;
    }
    if (progress > 3000) {
      setProgress(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0 && playlist[prevIndex]) {
      setCurrentTrack(playlist[prevIndex]);
      setCurrentIndex(prevIndex);
    }
  }, [useSDK, progress, currentIndex, playlist]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      const newPos = fraction * duration;
      setProgress(newPos);
      if (useSDK && sdkPlayerRef.current) sdkPlayerRef.current.seek(newPos);
      else if (audioRef.current) audioRef.current.currentTime = newPos / 1000;
    },
    [duration, useSDK]
  );

  const cycleRepeat = useCallback(() => {
    const modes: ("off" | "track" | "context")[] = ["off", "context", "track"];
    setRepeat((prev) => {
      const next = modes[(modes.indexOf(prev) + 1) % modes.length];
      if (useSDK)
        spotifyService
          .controlPlayback("repeat", { value: next })
          .catch(() => {});
      return next;
    });
  }, [useSDK]);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      if (useSDK)
        spotifyService
          .controlPlayback("shuffle", { value: !prev })
          .catch(() => {});
      return !prev;
    });
  }, [useSDK]);

  // ── AI Music Command Listener ──────────────────────────────────
  // Listens for music:command CustomEvents dispatched by the action handler
  // when the AI coach returns music_control actions
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const { command, tracks, trackIndex } = detail;
      switch (command) {
        case 'play':
          if (tracks?.length > 0) {
            playTrack(tracks[trackIndex || 0], trackIndex || 0, tracks);
          } else if (currentTrack && !isPlaying) {
            togglePlayPause();
          }
          break;
        case 'pause':
          if (isPlaying) togglePlayPause();
          break;
        case 'resume':
          if (!isPlaying && currentTrack) togglePlayPause();
          break;
        case 'stop':
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
          }
          setCurrentTrack(null);
          setIsPlaying(false);
          setPlaylist([]);
          setCurrentIndex(0);
          setProgress(0);
          break;
        case 'next':
          handleNext();
          break;
        case 'previous':
          handlePrev();
          break;
        case 'volume_up':
          setVolumeState(Math.min(100, volume + 20));
          break;
        case 'volume_down':
          setVolumeState(Math.max(0, volume - 20));
          break;
      }
    };
    window.addEventListener('music:command', handler);
    return () => window.removeEventListener('music:command', handler);
  }, [playTrack, togglePlayPause, handleNext, handlePrev, currentTrack, isPlaying, volume]);

  const value: MusicPlayerContextValue = {
    currentTrack,
    isPlaying,
    isPremium,
    playlist,
    currentIndex,
    progress,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
    isExpanded,
    isFullscreen,
    liked,
    showQueue,

    playTrack,
    togglePlayPause,
    setIsPlaying,
    next: handleNext,
    prev: handlePrev,
    seek: handleSeek,
    setVolume: setVolumeState,
    setIsMuted,
    toggleShuffle,
    cycleRepeat,
    setIsExpanded,
    setIsFullscreen,
    setLiked,
    setShowQueue,
    setPremium: setIsPremium,
    closePlayer: useCallback(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      sdkPlayerRef.current?.disconnect?.();
      setCurrentTrack(null);
      setIsPlaying(false);
      setPlaylist([]);
      setCurrentIndex(0);
      setProgress(0);
      setDuration(0);
      setIsExpanded(false);
      setIsFullscreen(false);
      setShowQueue(false);
    }, []),
  };

  return (
    <MusicPlayerContext.Provider value={value}>
      {/* Persistent audio element — never unmounts */}
      <audio ref={audioRef} preload="auto" />
      {children}
    </MusicPlayerContext.Provider>
  );
}
