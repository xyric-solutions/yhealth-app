"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  X,
} from "lucide-react";
import {
  useMusicPlayerOptional,
  formatTime,
} from "@/components/providers/music-player-provider";

export function PersistentPlayer() {
  const player = useMusicPlayerOptional();

  if (!player || !player.currentTrack) return null;

  const {
    currentTrack,
    isPlaying,
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
    togglePlayPause,
    next,
    prev,
    seek,
    setVolume,
    setIsMuted,
    toggleShuffle,
    cycleRepeat,
    setIsExpanded,
    setIsFullscreen,
    setLiked,
    setShowQueue,
    playTrack,
    closePlayer,
  } = player;

  const albumArt = currentTrack.album?.images?.[0]?.url;
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const isJamendo = currentTrack.id.startsWith("jamendo-");

  return (
    <>
      {/* ── FULLSCREEN VIEW ─────────────────────────────────── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950 overflow-hidden"
          >
            {albumArt && (
              <motion.div
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.3 }}
                className="absolute inset-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={albumArt}
                  alt=""
                  className="w-full h-full object-cover blur-[80px] saturate-150"
                />
                <div className="absolute inset-0 bg-slate-950/60" />
              </motion.div>
            )}

            <div className="relative z-10 flex flex-col items-center justify-center h-full max-w-lg mx-auto px-8">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsFullscreen(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
              >
                <Minimize2 className="w-5 h-5" />
              </motion.button>

              {/* Spinning vinyl */}
              <div className="relative mb-10">
                <motion.div
                  animate={isPlaying ? { rotate: 360 } : {}}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="w-72 h-72 sm:w-80 sm:h-80 rounded-full shadow-2xl shadow-black/60 relative"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.06]">
                    <div className="absolute inset-4 rounded-full border border-white/[0.03]" />
                    <div className="absolute inset-8 rounded-full border border-white/[0.03]" />
                    <div className="absolute inset-12 rounded-full border border-white/[0.03]" />
                    <div className="absolute inset-16 rounded-full border border-white/[0.04]" />
                    <div className="absolute inset-20 rounded-full border border-white/[0.03]" />
                  </div>
                  <div className="absolute inset-[25%] rounded-full overflow-hidden shadow-inner border-2 border-white/[0.08]">
                    {albumArt ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={albumArt}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-600 to-emerald-800 flex items-center justify-center">
                        <Music className="w-10 h-10 text-white/60" />
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-[48%] rounded-full bg-slate-950 border border-white/[0.05]" />
                </motion.div>

                {isPlaying && (
                  <motion.div
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                      scale: [1, 1.02, 1],
                    }}
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
                  {currentTrack.artists
                    ?.map((a: { name: string }) => a.name)
                    .join(", ")}
                </motion.p>
                <p className="text-xs text-slate-600 mt-1">
                  {currentTrack.album?.name}
                </p>
              </div>

              {/* Progress */}
              <div className="w-full mb-6">
                <div
                  className="h-1.5 bg-white/[0.08] rounded-full cursor-pointer group relative"
                  onClick={seek}
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

              {/* Controls */}
              <div className="flex items-center gap-6">
                <button
                  onClick={toggleShuffle}
                  className={`p-2 rounded-full transition-all ${
                    shuffle
                      ? "text-green-400 bg-green-500/10"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Shuffle className="w-5 h-5" />
                </button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={prev}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                >
                  <SkipBack className="w-6 h-6" fill="currentColor" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={togglePlayPause}
                  className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl shadow-white/20"
                >
                  {isPlaying ? (
                    <Pause
                      className="w-7 h-7 text-black"
                      fill="currentColor"
                    />
                  ) : (
                    <Play
                      className="w-7 h-7 text-black ml-1"
                      fill="currentColor"
                    />
                  )}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={next}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                >
                  <SkipForward className="w-6 h-6" fill="currentColor" />
                </motion.button>
                <button
                  onClick={cycleRepeat}
                  className={`p-2 rounded-full transition-all ${
                    repeat !== "off"
                      ? "text-green-400 bg-green-500/10"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {repeat === "track" ? (
                    <Repeat1 className="w-5 h-5" />
                  ) : (
                    <Repeat className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : volume < 50 ? (
                    <Volume1 className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
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
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-28 h-28 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl shadow-black/50 border border-white/[0.06]"
                  >
                    {albumArt ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={albumArt}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-600 to-emerald-800 flex items-center justify-center">
                        <Music className="w-10 h-10 text-white/50" />
                      </div>
                    )}
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-white truncate">
                      {currentTrack.name}
                    </p>
                    <p className="text-sm text-slate-400 truncate">
                      {currentTrack.artists
                        ?.map((a: { name: string }) => a.name)
                        .join(", ")}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {currentTrack.album?.name}
                    </p>

                    <div className="flex items-center gap-3 mt-3">
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setLiked(!liked)}
                        className={`p-1.5 rounded-full transition-all ${
                          liked
                            ? "text-pink-400"
                            : "text-slate-500 hover:text-white"
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${liked ? "fill-current" : ""}`}
                        />
                      </motion.button>
                      <button
                        onClick={() => setShowQueue(!showQueue)}
                        className={`p-1.5 rounded-full transition-all ${
                          showQueue
                            ? "text-green-400"
                            : "text-slate-500 hover:text-white"
                        }`}
                      >
                        <ListMusic className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setIsFullscreen(true);
                          setIsExpanded(false);
                        }}
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
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
                        Up Next
                      </p>
                      {playlist
                        .slice(currentIndex + 1, currentIndex + 6)
                        .map((track, i) => (
                          <div
                            key={track.id}
                            className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors"
                            onClick={() =>
                              playTrack(
                                track,
                                currentIndex + 1 + i,
                                playlist
                              )
                            }
                          >
                            <span className="text-[10px] text-slate-600 w-4 text-center">
                              {i + 1}
                            </span>
                            <div className="w-8 h-8 rounded overflow-hidden bg-slate-800 flex-shrink-0">
                              {track.album?.images?.[0]?.url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={track.album.images[0].url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Music className="w-3 h-3 text-slate-600" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-white truncate">
                                {track.name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {track.artists
                                  ?.map((a: { name: string }) => a.name)
                                  .join(", ")}
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
            onClick={seek}
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
                onClick={() => setIsFullscreen(true)}
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
                <p className="text-sm font-semibold text-white truncate">
                  {currentTrack.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {currentTrack.artists
                    ?.map((a: { name: string }) => a.name)
                    .join(", ")}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setLiked(!liked)}
                className={`p-1 rounded-full transition-all hidden sm:block ${
                  liked
                    ? "text-pink-400"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${liked ? "fill-current" : ""}`}
                />
              </motion.button>
            </div>

            {/* Controls (center) */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleShuffle}
                className={`p-1.5 rounded-full transition-all hidden sm:block ${
                  shuffle
                    ? "text-green-400"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.85 }}
                onClick={prev}
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <SkipBack className="w-5 h-5" fill="currentColor" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.88 }}
                onClick={togglePlayPause}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/10"
              >
                {isPlaying ? (
                  <Pause
                    className="w-5 h-5 text-black"
                    fill="currentColor"
                  />
                ) : (
                  <Play
                    className="w-5 h-5 text-black ml-0.5"
                    fill="currentColor"
                  />
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.85 }}
                onClick={next}
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <SkipForward className="w-5 h-5" fill="currentColor" />
              </motion.button>

              <button
                onClick={cycleRepeat}
                className={`p-1.5 rounded-full transition-all hidden sm:block ${
                  repeat !== "off"
                    ? "text-green-400"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {repeat === "track" ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
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
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : volume < 50 ? (
                    <Volume1 className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
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
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.85 }}
                onClick={closePlayer}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                title="Close player"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
