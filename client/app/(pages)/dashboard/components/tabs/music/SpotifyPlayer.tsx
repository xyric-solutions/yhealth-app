/* eslint-disable @next/next/no-img-element */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  ChevronUp,
  ChevronDown,
  Music,
  Heart,
  ListMusic,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { spotifyService } from "@/src/shared/services/spotify.service";
import type { SpotifyTrack } from "./types";

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

interface SpotifyPlayerProps {
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  isPremium: boolean;
  playlist: SpotifyTrack[];
  currentIndex: number;
  onTrackChange: (track: SpotifyTrack, index: number) => void;
  onPlayStateChange: (playing: boolean) => void;
}

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SpotifyPlayer({
  currentTrack,
  isPlaying,
  isPremium,
  playlist,
  currentIndex,
  onTrackChange,
  onPlayStateChange,
}: SpotifyPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const sdkPlayerRef = useRef<SpotifyPlayerInstance | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "track" | "context">("off");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

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
      onPlayStateChange(!s.paused);
      setProgress(s.position);
      setDuration(s.duration || s.track_window?.current_track?.duration_ms || 0);
    });

    sdkPlayerRef.current = player;
    await player.connect();
  }, [volume, onPlayStateChange]);

  useEffect(() => {
    if (!isPremium) return;
    if (window.Spotify) { initSDKPlayer(); return; }
    window.onSpotifyWebPlaybackSDKReady = () => initSDKPlayer();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      sdkPlayerRef.current?.disconnect();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPremium, initSDKPlayer]);

  // ── Next track ────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (useSDK && sdkPlayerRef.current) { sdkPlayerRef.current.nextTrack(); return; }
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
    if (playlist[nextIndex]) onTrackChange(playlist[nextIndex], nextIndex);
  }, [useSDK, shuffle, playlist, currentIndex, repeat, onTrackChange]);

  // ── Audio element for non-Premium ─────────────────────────────
  useEffect(() => {
    if (useSDK || !audioRef.current || !currentTrack) return;
    const audio = audioRef.current;
    if (currentTrack.preview_url) {
      audio.src = currentTrack.preview_url;
      // Check if this is a Jamendo full track (duration > 31s means full)
      const isFullTrack = currentTrack.duration_ms > 31000;
      setDuration(isFullTrack ? currentTrack.duration_ms : 30000);
      if (isPlaying) audio.play().catch(() => {});
    }
    const handleTimeUpdate = () => { if (!isDragging) setProgress(audio.currentTime * 1000); };
    const handleEnded = () => {
      if (repeat === "track") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        onPlayStateChange(false);
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
  }, [currentTrack, useSDK, isDragging, isPlaying, onPlayStateChange, handleNext, repeat]);

  useEffect(() => {
    if (useSDK || !audioRef.current) return;
    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying, useSDK]);

  // ── SDK progress polling ──────────────────────────────────────
  useEffect(() => {
    if (!useSDK || !isPlaying) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }
    progressIntervalRef.current = setInterval(async () => {
      const state = await sdkPlayerRef.current?.getCurrentState();
      if (state && !isDragging) {
        setProgress(state.position);
        setDuration(state.duration);
      }
    }, 500);
    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, [useSDK, isPlaying, isDragging]);

  // ── Volume sync ───────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume / 100;
    if (sdkPlayerRef.current) sdkPlayerRef.current.setVolume(isMuted ? 0 : volume / 100);
  }, [volume, isMuted]);

  // ── Controls ──────────────────────────────────────────────────
  const handlePlayPause = async () => {
    if (useSDK && sdkPlayerRef.current) await sdkPlayerRef.current.togglePlay();
    else onPlayStateChange(!isPlaying);
  };

  const handlePrev = () => {
    if (useSDK && sdkPlayerRef.current) { sdkPlayerRef.current.previousTrack(); return; }
    if (progress > 3000) {
      setProgress(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0 && playlist[prevIndex]) onTrackChange(playlist[prevIndex], prevIndex);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newPos = fraction * duration;
    setProgress(newPos);
    if (useSDK && sdkPlayerRef.current) sdkPlayerRef.current.seek(newPos);
    else if (audioRef.current) audioRef.current.currentTime = newPos / 1000;
  };

  const cycleRepeat = () => {
    const modes: ("off" | "track" | "context")[] = ["off", "context", "track"];
    const next = modes[(modes.indexOf(repeat) + 1) % modes.length];
    setRepeat(next);
    if (useSDK) spotifyService.controlPlayback("repeat", { value: next }).catch(() => {});
  };

  const toggleShuffle = () => {
    setShuffle(!shuffle);
    if (useSDK) spotifyService.controlPlayback("shuffle", { value: !shuffle }).catch(() => {});
  };

  if (!currentTrack) return null;

  const albumArt = currentTrack.album?.images?.[0]?.url;
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const isJamendo = currentTrack.id.startsWith("jamendo-");

  return (
    <>
      <audio ref={audioRef} preload="auto" />

      {/* ── FULLSCREEN VIEW ─────────────────────────────────── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950 overflow-hidden"
          >
            {/* Animated background from album art */}
            {albumArt && (
              <motion.div
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.3 }}
                className="absolute inset-0"
              >
                <img src={albumArt} alt="" className="w-full h-full object-cover blur-[80px] saturate-150" />
                <div className="absolute inset-0 bg-slate-950/60" />
              </motion.div>
            )}

            <div className="relative z-10 flex flex-col items-center justify-center h-full max-w-lg mx-auto px-8">
              {/* Close button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsFullscreen(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
              >
                <Minimize2 className="w-5 h-5" />
              </motion.button>

              {/* Spinning vinyl / album art */}
              <div className="relative mb-10">
                <motion.div
                  animate={isPlaying ? { rotate: 360 } : {}}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="w-72 h-72 sm:w-80 sm:h-80 rounded-full shadow-2xl shadow-black/60 relative"
                >
                  {/* Vinyl grooves */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.06]">
                    <div className="absolute inset-4 rounded-full border border-white/[0.03]" />
                    <div className="absolute inset-8 rounded-full border border-white/[0.03]" />
                    <div className="absolute inset-12 rounded-full border border-white/[0.03]" />
                    <div className="absolute inset-16 rounded-full border border-white/[0.04]" />
                    <div className="absolute inset-20 rounded-full border border-white/[0.03]" />
                  </div>
                  {/* Center album art */}
                  <div className="absolute inset-[25%] rounded-full overflow-hidden shadow-inner border-2 border-white/[0.08]">
                    {albumArt ? (
                      <img src={albumArt} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-600 to-emerald-800 flex items-center justify-center">
                        <Music className="w-10 h-10 text-white/60" />
                      </div>
                    )}
                  </div>
                  {/* Center hole */}
                  <div className="absolute inset-[48%] rounded-full bg-slate-950 border border-white/[0.05]" />
                </motion.div>

                {/* Glow ring */}
                {isPlaying && (
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -inset-3 rounded-full bg-green-500/10 blur-xl"
                  />
                )}
              </div>

              {/* Track info */}
              <div className="text-center mb-8 w-full">
                <motion.h3
                  key={currentTrack.id + "-name"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold text-white truncate"
                >
                  {currentTrack.name}
                </motion.h3>
                <motion.p
                  key={currentTrack.id + "-artist"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="text-base text-slate-400 mt-1 truncate"
                >
                  {currentTrack.artists?.map((a: { name: string }) => a.name).join(", ")}
                </motion.p>
                <p className="text-xs text-slate-600 mt-1">{currentTrack.album?.name}</p>
              </div>

              {/* Progress bar (fullscreen) */}
              <div className="w-full mb-6">
                <div
                  ref={progressBarRef}
                  className="h-1.5 bg-white/[0.08] rounded-full cursor-pointer group relative"
                  onClick={handleSeek}
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full relative"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-green-500/30 -mr-2" />
                  </motion.div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500 tabular-nums">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls (fullscreen) */}
              <div className="flex items-center gap-6">
                <button
                  onClick={toggleShuffle}
                  className={`p-2 rounded-full transition-all ${
                    shuffle ? "text-green-400 bg-green-500/10" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={handlePrev}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                >
                  <SkipBack className="w-6 h-6" fill="currentColor" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handlePlayPause}
                  className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl shadow-white/20"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 text-black" fill="currentColor" />
                  ) : (
                    <Play className="w-7 h-7 text-black ml-1" fill="currentColor" />
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={handleNext}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                >
                  <SkipForward className="w-6 h-6" fill="currentColor" />
                </motion.button>

                <button
                  onClick={cycleRepeat}
                  className={`p-2 rounded-full transition-all ${
                    repeat !== "off" ? "text-green-400 bg-green-500/10" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {repeat === "track" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </button>
              </div>

              {/* Volume (fullscreen) */}
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 50 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseInt(e.target.value));
                    if (isMuted) setIsMuted(false);
                  }}
                  className="w-32 h-1 accent-green-500 cursor-pointer"
                />
              </div>

              {/* Source badge */}
              {isJamendo && (
                <div className="mt-4 px-3 py-1 rounded-full bg-emerald-500/[0.08] text-emerald-400/80 text-[10px] font-medium border border-emerald-500/10">
                  Free CC-Licensed Music via Jamendo
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MINI PLAYER BAR ──────────────────────────────────── */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className="fixed bottom-0 left-0 right-0 z-50"
      >
        {/* Expanded panel */}
        <AnimatePresence>
          {isExpanded && !isFullscreen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-900/95 backdrop-blur-2xl border-t border-white/[0.06]"
            >
              <div className="max-w-2xl mx-auto px-6 py-5">
                <div className="flex items-start gap-5">
                  {/* Large album art */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-28 h-28 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl shadow-black/50 border border-white/[0.06]"
                  >
                    {albumArt ? (
                      <img src={albumArt} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-600 to-emerald-800 flex items-center justify-center">
                        <Music className="w-10 h-10 text-white/50" />
                      </div>
                    )}
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-white truncate">{currentTrack.name}</p>
                    <p className="text-sm text-slate-400 truncate">
                      {currentTrack.artists?.map((a: { name: string }) => a.name).join(", ")}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{currentTrack.album?.name}</p>

                    <div className="flex items-center gap-3 mt-3">
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setLiked(!liked)}
                        className={`p-1.5 rounded-full transition-all ${liked ? "text-pink-400" : "text-slate-500 hover:text-white"}`}
                      >
                        <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
                      </motion.button>
                      <button
                        onClick={() => setShowQueue(!showQueue)}
                        className={`p-1.5 rounded-full transition-all ${showQueue ? "text-green-400" : "text-slate-500 hover:text-white"}`}
                      >
                        <ListMusic className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setIsFullscreen(true); setIsExpanded(false); }}
                        className="p-1.5 rounded-full text-slate-500 hover:text-white transition-colors"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>

                      {isJamendo && (
                        <span className="text-[10px] text-emerald-400/70 bg-emerald-500/[0.08] px-2 py-0.5 rounded-full font-medium border border-emerald-500/10 ml-auto">
                          Free
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Queue */}
                <AnimatePresence>
                  {showQueue && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 max-h-48 overflow-y-auto"
                    >
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Up Next</p>
                      {playlist.slice(currentIndex + 1, currentIndex + 6).map((track, i) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors"
                          onClick={() => onTrackChange(track, currentIndex + 1 + i)}
                        >
                          <span className="text-[10px] text-slate-600 w-4 text-center">{i + 1}</span>
                          <div className="w-8 h-8 rounded overflow-hidden bg-slate-800 flex-shrink-0">
                            {track.album?.images?.[0]?.url ? (
                              <img src={track.album.images[0].url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-3 h-3 text-slate-600" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-white truncate">{track.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {track.artists?.map((a: { name: string }) => a.name).join(", ")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main player bar */}
        <div className="bg-slate-950/95 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-4px_30px_-10px_rgba(0,0,0,0.5)]">
          {/* Progress bar */}
          <div
            className="h-1 bg-white/[0.06] cursor-pointer group relative"
            onClick={handleSeek}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 relative"
              style={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1 }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-green-500/30 -mr-1.5" />
            </motion.div>
          </div>

          <div className="flex items-center gap-4 px-4 py-2.5 max-w-screen-xl mx-auto">
            {/* Track info (left) */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <motion.div
                whileHover={{ scale: 1.05 }}
                onClick={() => { setIsFullscreen(true); }}
                className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-lg cursor-pointer border border-white/[0.06]"
              >
                {albumArt ? (
                  <motion.img
                    key={currentTrack.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={albumArt}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                    <Music className="w-5 h-5 text-slate-500" />
                  </div>
                )}
              </motion.div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{currentTrack.name}</p>
                <p className="text-xs text-slate-400 truncate">
                  {currentTrack.artists?.map((a: { name: string }) => a.name).join(", ")}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setLiked(!liked)}
                className={`p-1 rounded-full transition-all hidden sm:block ${liked ? "text-pink-400" : "text-slate-500 hover:text-white"}`}
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
              </motion.button>
            </div>

            {/* Controls (center) */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleShuffle}
                className={`p-1.5 rounded-full transition-all hidden sm:block ${
                  shuffle ? "text-green-400" : "text-slate-500 hover:text-white"
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.85 }}
                onClick={handlePrev}
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <SkipBack className="w-5 h-5" fill="currentColor" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.88 }}
                onClick={handlePlayPause}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/10"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-black" fill="currentColor" />
                ) : (
                  <Play className="w-5 h-5 text-black ml-0.5" fill="currentColor" />
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.85 }}
                onClick={handleNext}
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <SkipForward className="w-5 h-5" fill="currentColor" />
              </motion.button>

              <button
                onClick={cycleRepeat}
                className={`p-1.5 rounded-full transition-all hidden sm:block ${
                  repeat !== "off" ? "text-green-400" : "text-slate-500 hover:text-white"
                }`}
              >
                {repeat === "track" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
            </div>

            {/* Time + Volume (right) */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
              <span className="text-[11px] text-slate-500 tabular-nums hidden sm:block">
                {formatTime(progress)} / {formatTime(duration)}
              </span>

              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 50 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseInt(e.target.value));
                    if (isMuted) setIsMuted(false);
                  }}
                  className="w-20 h-1 accent-green-500 cursor-pointer"
                />
              </div>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
