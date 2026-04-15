/* eslint-disable @next/next/no-img-element */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Music, Play, Disc3 } from "lucide-react";
import type { SpotifyPlaylist } from "./types";

interface PlaylistBrowserProps {
  playlists: SpotifyPlaylist[];
  isLoading: boolean;
  selectedPlaylistId: string | null;
  onSelectPlaylist: (playlist: SpotifyPlaylist) => void;
}

function getPlaylistGradient(name: string): string {
  const gradients = [
    "from-violet-600/80 via-purple-700/60 to-fuchsia-800/80",
    "from-emerald-600/80 via-teal-700/60 to-cyan-800/80",
    "from-orange-600/80 via-red-700/60 to-rose-800/80",
    "from-blue-600/80 via-indigo-700/60 to-violet-800/80",
    "from-pink-600/80 via-rose-700/60 to-red-800/80",
    "from-cyan-600/80 via-blue-700/60 to-indigo-800/80",
    "from-amber-600/80 via-orange-700/60 to-red-800/80",
    "from-teal-600/80 via-emerald-700/60 to-green-800/80",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return gradients[Math.abs(hash) % gradients.length];
}

function PlaylistSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square rounded-2xl bg-white/[0.04]" />
          <div className="mt-3 space-y-2 px-1">
            <div className="h-3.5 bg-white/[0.06] rounded-lg w-3/4" />
            <div className="h-2.5 bg-white/[0.04] rounded-lg w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlaylistBrowser({
  playlists,
  isLoading,
  selectedPlaylistId,
  onSelectPlaylist,
}: PlaylistBrowserProps) {
  if (isLoading) {
    return <PlaylistSkeleton />;
  }

  if (playlists.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center py-16 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4 border border-white/[0.06]">
          <Disc3 className="w-8 h-8 text-slate-500" />
        </div>
        <p className="text-sm text-slate-400 font-medium">No playlists found</p>
        <p className="text-xs text-slate-600 mt-1">Try selecting a different activity</p>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      <AnimatePresence mode="popLayout">
        {playlists.map((playlist, i) => {
          const isSelected = selectedPlaylistId === playlist.id;
          const imageUrl = playlist.images?.[0]?.url;
          const gradient = getPlaylistGradient(playlist.name);

          return (
            <motion.button
              key={playlist.id}
              layout
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ delay: i * 0.06, type: "spring", bounce: 0.3 }}
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelectPlaylist(playlist)}
              className={`relative group rounded-2xl overflow-hidden text-left transition-all ${
                isSelected
                  ? "ring-2 ring-green-400/80 ring-offset-2 ring-offset-slate-950 shadow-xl shadow-green-500/20"
                  : "hover:shadow-xl hover:shadow-black/40"
              }`}
            >
              <div className="relative aspect-square overflow-hidden">
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt={playlist.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </>
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                      <Music className="w-10 h-10 text-white/40" />
                    </motion.div>
                    <div className="absolute top-3 right-3 w-12 h-12 rounded-full bg-white/[0.06] blur-sm" />
                    <div className="absolute bottom-4 left-4 w-8 h-8 rounded-full bg-white/[0.04] blur-sm" />
                  </div>
                )}

                {/* Hover play overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileHover={{ scale: 1.15 }}
                    animate={{ scale: 1 }}
                    className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center shadow-2xl shadow-green-500/40"
                  >
                    <Play className="w-6 h-6 text-black ml-0.5" fill="currentColor" />
                  </motion.div>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-lg z-10"
                  >
                    <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </motion.div>
                )}

                <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white/80 z-10">
                  {playlist.tracks?.total || 0} tracks
                </div>
              </div>

              <div className="p-3 bg-white/[0.02]">
                <p className="text-sm font-semibold text-white truncate">{playlist.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {playlist.owner?.display_name || "Curated"}
                </p>
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
