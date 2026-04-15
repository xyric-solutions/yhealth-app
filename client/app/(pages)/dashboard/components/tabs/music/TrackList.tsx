"use client";

import { motion } from "framer-motion";
import { Play, Pause, Music, Clock } from "lucide-react";
import type { SpotifyTrack } from "./types";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface TrackListProps {
  tracks: SpotifyTrack[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isPremium: boolean;
  onPlayTrack: (track: SpotifyTrack, index: number) => void;
  onPauseTrack: () => void;
}

export function TrackList({
  tracks,
  currentTrackId,
  isPlaying,
  isPremium,
  onPlayTrack,
  onPauseTrack,
}: TrackListProps) {
  if (tracks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center py-12 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3 border border-white/[0.06]">
          <Music className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-sm text-slate-400 font-medium">No tracks available</p>
        <p className="text-xs text-slate-600 mt-1">Select a playlist to see tracks</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2 text-[11px] uppercase tracking-wider text-slate-600 font-semibold border-b border-white/[0.04] mb-1">
        <div className="w-8 text-center">#</div>
        <div className="w-11" />
        <div className="flex-1">Title</div>
        <div className="w-16 text-right hidden sm:block">
          <Clock className="w-3 h-3 inline" />
        </div>
      </div>

      {tracks.map((track, index) => {
        const isCurrent = currentTrackId === track.id;
        const hasPreview = !!track.preview_url;
        const canPlay = isPremium || hasPreview;
        const albumArt = track.album?.images?.[0]?.url || track.album?.images?.[track.album.images.length - 1]?.url;

        return (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.025, 0.5) }}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
              isCurrent
                ? "bg-green-500/[0.08] border border-green-500/20"
                : "hover:bg-white/[0.04] border border-transparent"
            } ${!canPlay ? "opacity-50" : ""}`}
            onClick={() => {
              if (!canPlay) return;
              if (isCurrent && isPlaying) {
                onPauseTrack();
              } else {
                onPlayTrack(track, index);
              }
            }}
          >
            {/* Track number / Play button */}
            <div className="w-8 flex-shrink-0 flex items-center justify-center">
              {isCurrent && isPlaying ? (
                <motion.div className="flex items-end gap-[2px] h-4">
                  {[0, 1, 2, 3].map((bar) => (
                    <motion.div
                      key={bar}
                      className="w-[3px] bg-green-400 rounded-full"
                      animate={{
                        height: ["3px", "14px", "6px", "12px", "3px"],
                      }}
                      transition={{
                        duration: 0.7 + bar * 0.1,
                        repeat: Infinity,
                        delay: bar * 0.12,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </motion.div>
              ) : (
                <>
                  <span className={`text-xs tabular-nums group-hover:hidden ${isCurrent ? "text-green-400 font-bold" : "text-slate-600"}`}>
                    {index + 1}
                  </span>
                  <div className="hidden group-hover:flex">
                    {canPlay ? (
                      isCurrent ? (
                        <Pause className="w-4 h-4 text-green-400" />
                      ) : (
                        <Play className="w-4 h-4 text-white fill-white" />
                      )
                    ) : (
                      <Play className="w-4 h-4 text-slate-700" />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Album art */}
            <div className="w-11 h-11 rounded-lg flex-shrink-0 overflow-hidden bg-slate-800/60 shadow-sm">
              {albumArt ? (
                <motion.img
                  src={albumArt}
                  alt=""
                  className={`w-full h-full object-cover ${isCurrent ? "brightness-110" : ""}`}
                  loading="lazy"
                  whileHover={{ scale: 1.08 }}
                  transition={{ duration: 0.2 }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700/50 to-slate-800/50">
                  <Music className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate transition-colors ${
                isCurrent ? "text-green-400" : "text-white group-hover:text-green-300/80"
              }`}>
                {track.name}
              </p>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {track.artists?.map((a: { name: string }) => a.name).join(", ")}
                {track.album?.name ? ` \u00B7 ${track.album.name}` : ""}
              </p>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isPremium && hasPreview && (
                <span className="text-[10px] text-emerald-400/70 bg-emerald-500/[0.08] px-2 py-0.5 rounded-full font-medium border border-emerald-500/10">
                  Free
                </span>
              )}
              {!isPremium && !hasPreview && (
                <span className="text-[10px] text-slate-600">
                  No audio
                </span>
              )}
            </div>

            {/* Duration */}
            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 tabular-nums flex-shrink-0 w-12 justify-end">
              {formatDuration(track.duration_ms)}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
