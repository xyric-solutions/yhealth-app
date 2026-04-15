"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  Music,
  Search,
  ArrowLeft,
  Loader2,
  Library,
  Sparkles,
  X,
  Radio,
  Headphones,
  ListMusic,
  Disc3,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";
import { spotifyService } from "@/src/shared/services/spotify.service";
import type { SpotifyTrack, SpotifyPlaylist, SpotifyActivityCategory } from "./types";
import { ActivitySelector } from "./ActivitySelector";
import { PlaylistBrowser } from "./PlaylistBrowser";
import { TrackList } from "./TrackList";
import { SpotifyConnectPrompt } from "./SpotifyConnectPrompt";
import { useMusicPlayer } from "@/components/providers/music-player-provider";

export function MusicTab() {
  const player = useMusicPlayer();

  const [isConnected, setIsConnected] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasJamendoFallback, setHasJamendoFallback] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const [selectedActivity, setSelectedActivity] = useState<SpotifyActivityCategory>("workout");
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);

  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  const [smartMixTracks, setSmartMixTracks] = useState<SpotifyTrack[]>([]);
  const [smartMixLoading, setSmartMixLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [viewMode, setViewMode] = useState<"browse" | "tracks" | "library" | "smartmix">("browse");

  useEffect(() => {
    (async () => {
      try {
        const res = await spotifyService.getStatus();
        if (res.success && res.data) {
          setIsConnected(res.data.isConnected);
          setIsConfigured(res.data.isConfigured);
          if (res.data.accountType === "premium") player.setPremium(true);
          if (res.data.hasJamendoFallback) setHasJamendoFallback(true);
        }
      } catch {
        // Not configured
      } finally {
        setStatusLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPlaylists = useCallback(async (category: SpotifyActivityCategory) => {
    setPlaylistsLoading(true);
    try {
      const res = await spotifyService.getPlaylists(category);
      if (res.success && res.data) {
        setPlaylists(res.data.playlists);
      }
    } catch {
      setPlaylists([]);
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists(selectedActivity);
  }, [selectedActivity, fetchPlaylists]);

  const fetchPlaylistTracks = useCallback(async (playlist: SpotifyPlaylist) => {
    setSelectedPlaylist(playlist);
    setViewMode("tracks");
    setTracksLoading(true);
    try {
      const res = await spotifyService.getPlaylistTracks(playlist.id);
      if (res.success && res.data) {
        setTracks(res.data.tracks);
      }
    } catch {
      setTracks([]);
    } finally {
      setTracksLoading(false);
    }
  }, []);

  const fetchSmartMix = useCallback(async () => {
    setViewMode("smartmix");
    setSmartMixLoading(true);
    try {
      const res = await spotifyService.getRecommendations(selectedActivity);
      if (res.success && res.data) {
        setSmartMixTracks(res.data.tracks);
      }
    } catch {
      setSmartMixTracks([]);
    } finally {
      setSmartMixLoading(false);
    }
  }, [selectedActivity]);

  const handleSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const res = await spotifyService.search(q, "track", 20);
      if (res.success && res.data) {
        setSearchResults(res.data.tracks || []);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!showSearch) return;
    const timer = setTimeout(() => handleSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, handleSearch]);

  const handlePlayTrack = (track: SpotifyTrack, index: number, trackList?: SpotifyTrack[]) => {
    player.playTrack(track, index, trackList || tracks);
  };

  if (statusLoading) {
    return <PulseSkeleton />;
  }

  const viewConfig = {
    browse: { icon: Headphones, color: "green", label: "Pulse", subtitle: "AI-curated music for every activity" },
    tracks: { icon: ListMusic, color: "green", label: selectedPlaylist?.name || "Playlist", subtitle: `${tracks.length} tracks` },
    library: { icon: Library, color: "violet", label: "Your Library", subtitle: "Your saved music" },
    smartmix: { icon: Sparkles, color: "purple", label: "Smart Mix", subtitle: `AI-curated for ${selectedActivity}` },
  };
  const currentView = viewConfig[viewMode];

  return (
    <div className={`space-y-0 ${player.currentTrack ? "pb-28" : ""}`}>
      {/* ── Sticky Top Bar ── */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center h-12 px-4 gap-3">
          {/* Back button */}
          {viewMode !== "browse" && (
            <motion.button
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => { setViewMode("browse"); setSelectedPlaylist(null); }}
              className="p-1.5 -ml-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </motion.button>
          )}

          {/* Icon + Title */}
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            currentView.color === "green" ? "bg-green-500/15" :
            currentView.color === "violet" ? "bg-violet-500/15" :
            "bg-purple-500/15"
          }`}>
            <currentView.icon className={`w-4 h-4 ${
              currentView.color === "green" ? "text-green-400" :
              currentView.color === "violet" ? "text-violet-400" :
              "text-purple-400"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{currentView.label}</h1>
          </div>

          {/* Nav pills */}
          <div className="hidden md:flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
            {([
              { key: "browse", label: "Browse", icon: Disc3 },
              { key: "smartmix", label: "Smart Mix", icon: Sparkles },
              ...(isConnected ? [{ key: "library", label: "Library", icon: Library }] : []),
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === "smartmix") { fetchSmartMix(); } else { setViewMode(tab.key as typeof viewMode); setSelectedPlaylist(null); }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === tab.key
                    ? "bg-white/[0.08] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-all ${
                showSearch
                  ? "bg-green-500/15 text-green-400"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>

            {/* Mobile Smart Mix */}
            <button
              onClick={fetchSmartMix}
              className="md:hidden p-2 rounded-lg text-purple-400 hover:bg-purple-500/10 transition-all"
            >
              <Radio className="w-4 h-4" />
            </button>

            {/* Mobile Library */}
            {isConnected && (
              <button
                onClick={() => setViewMode("library")}
                className={`md:hidden p-2 rounded-lg transition-all ${
                  viewMode === "library"
                    ? "bg-violet-500/15 text-violet-400"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                <Library className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Search Overlay ── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-white/[0.06]"
          >
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search songs, artists, albums..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-green-500/30 focus:bg-white/[0.06] transition-all"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 animate-spin" />
                )}
              </div>

              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3"
                >
                  <p className="text-[11px] text-slate-600 uppercase tracking-wider font-semibold mb-2 px-1">
                    Results ({searchResults.length})
                  </p>
                  <TrackList
                    tracks={searchResults}
                    currentTrackId={player.currentTrack?.id || null}
                    isPlaying={player.isPlaying}
                    isPremium={player.isPremium}
                    onPlayTrack={(track, idx) => handlePlayTrack(track, idx, searchResults)}
                    onPauseTrack={() => player.setIsPlaying(false)}
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="px-4 sm:px-5 py-5 space-y-5">

        {/* Now Playing Banner (when track is active) */}
        <AnimatePresence>
          {player.currentTrack && viewMode === "browse" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-4 p-3.5 rounded-xl bg-gradient-to-r from-green-500/[0.08] to-emerald-500/[0.04] border border-green-500/[0.12]"
            >
              <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-green-500/10">
                {player.currentTrack.album?.images?.[0]?.url ? (
                  <motion.img
                    src={player.currentTrack.album.images[0].url}
                    alt=""
                    className="w-full h-full object-cover"
                    animate={{ scale: player.isPlaying ? [1, 1.05, 1] : 1 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-5 h-5 text-green-400/60" />
                  </div>
                )}
                {player.isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="flex items-end gap-[2px] h-3">
                      {[0, 1, 2].map((bar) => (
                        <motion.div
                          key={bar}
                          className="w-[2px] bg-green-400 rounded-full"
                          animate={{ height: ["2px", "10px", "4px", "8px", "2px"] }}
                          transition={{ duration: 0.6 + bar * 0.1, repeat: Infinity, delay: bar * 0.1 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{player.currentTrack.name}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {player.currentTrack.artists?.map((a: { name: string }) => a.name).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-green-400/70 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Now Playing
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Stats Row */}
        {viewMode === "browse" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="p-3.5 rounded-xl bg-[#0f0f18] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-green-500/10 flex items-center justify-center">
                  <ListMusic className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Playlists</span>
              </div>
              <p className="text-lg font-bold text-white">{playlists.length}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0f0f18] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                  <Zap className="w-3 h-3 text-purple-400" />
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Activity</span>
              </div>
              <p className="text-lg font-bold text-white capitalize">{selectedActivity}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0f0f18] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 text-amber-400" />
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Status</span>
              </div>
              <p className="text-lg font-bold text-white">{isConnected ? "Premium" : "Free"}</p>
            </div>
          </motion.div>
        )}

        {/* Activity Selector */}
        {viewMode === "browse" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <p className="text-[11px] text-slate-600 uppercase tracking-wider font-semibold mb-2.5">Select Activity</p>
            <ActivitySelector selected={selectedActivity} onSelect={setSelectedActivity} />
          </motion.div>
        )}

        {/* Connect prompt */}
        {!isConnected && viewMode === "browse" && (
          <SpotifyConnectPrompt isConfigured={isConfigured} hasJamendoFallback={hasJamendoFallback} />
        )}

        {/* View Content */}
        <AnimatePresence mode="wait">
          {viewMode === "browse" && (
            <motion.div
              key="browse"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-slate-600 uppercase tracking-wider font-semibold">
                  {selectedActivity} Playlists
                </p>
                <span className="text-[11px] text-slate-700">{playlists.length} results</span>
              </div>
              <PlaylistBrowser
                playlists={playlists}
                isLoading={playlistsLoading}
                selectedPlaylistId={selectedPlaylist?.id || null}
                onSelectPlaylist={fetchPlaylistTracks}
              />
            </motion.div>
          )}

          {viewMode === "tracks" && (
            <motion.div
              key="tracks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Playlist header card */}
              {selectedPlaylist && (
                <div className="flex items-center gap-4 mb-4 p-4 rounded-xl bg-[#0f0f18] border border-white/[0.06]">
                  {selectedPlaylist.images?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedPlaylist.images[0].url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                      <Music className="w-6 h-6 text-slate-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-white truncate">{selectedPlaylist.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedPlaylist.owner?.display_name || "Curated"} &middot; {tracks.length} tracks
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Clock className="w-3 h-3" />
                    {tracks.length > 0 ? `${Math.round(tracks.reduce((acc, t) => acc + t.duration_ms, 0) / 60000)} min` : "\u2014"}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-[#0f0f18] border border-white/[0.06] p-3 sm:p-4">
                {tracksLoading ? (
                  <TrackListSkeleton />
                ) : (
                  <TrackList
                    tracks={tracks}
                    currentTrackId={player.currentTrack?.id || null}
                    isPlaying={player.isPlaying}
                    isPremium={player.isPremium}
                    onPlayTrack={handlePlayTrack}
                    onPauseTrack={() => player.setIsPlaying(false)}
                  />
                )}
              </div>
            </motion.div>
          )}

          {viewMode === "smartmix" && (
            <motion.div
              key="smartmix"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Smart Mix header */}
              <div className="flex items-center gap-3 mb-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/[0.06] to-pink-500/[0.04] border border-purple-500/[0.1]">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0"
                >
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </motion.div>
                <div>
                  <p className="text-sm font-bold text-white">AI Smart Mix</p>
                  <p className="text-xs text-slate-500 mt-0.5">Personalized for your {selectedActivity} sessions</p>
                </div>
              </div>

              <div className="rounded-xl bg-[#0f0f18] border border-white/[0.06] p-3 sm:p-4">
                {smartMixLoading ? (
                  <TrackListSkeleton />
                ) : (
                  <TrackList
                    tracks={smartMixTracks}
                    currentTrackId={player.currentTrack?.id || null}
                    isPlaying={player.isPlaying}
                    isPremium={player.isPremium}
                    onPlayTrack={(track, idx) => handlePlayTrack(track, idx, smartMixTracks)}
                    onPauseTrack={() => player.setIsPlaying(false)}
                  />
                )}
              </div>
            </motion.div>
          )}

          {viewMode === "library" && (
            <LibraryView />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LibraryView() {
  const player = useMusicPlayer();
  const [libraryTracks, setLibraryTracks] = useState<SpotifyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await spotifyService.getLibrary();
        if (res.success && res.data) {
          setLibraryTracks(res.data.savedTracks.tracks);
        }
      } catch {
        setLibraryTracks([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <motion.div
      key="library"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Library header */}
      <div className="flex items-center gap-3 mb-4 p-4 rounded-xl bg-[#0f0f18] border border-white/[0.06]">
        <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
          <Library className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Your Library</p>
          <p className="text-xs text-slate-500 mt-0.5">{libraryTracks.length} saved tracks</p>
        </div>
      </div>

      <div className="rounded-xl bg-[#0f0f18] border border-white/[0.06] p-3 sm:p-4">
        {isLoading ? (
          <TrackListSkeleton />
        ) : (
          <TrackList
            tracks={libraryTracks}
            currentTrackId={player.currentTrack?.id || null}
            isPlaying={player.isPlaying}
            isPremium={player.isPremium}
            onPlayTrack={(track, idx) => player.playTrack(track, idx, libraryTracks)}
            onPauseTrack={() => player.setIsPlaying(false)}
          />
        )}
      </div>
    </motion.div>
  );
}

function PulseSkeleton() {
  return (
    <div className="space-y-0">
      {/* Top bar skeleton */}
      <div className="h-12 border-b border-white/[0.06] px-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-4 w-20 rounded bg-white/[0.06] animate-pulse" />
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {[60, 72, 56].map((w, i) => (
            <div key={i} className="h-7 rounded-md bg-white/[0.04] animate-pulse" style={{ width: w, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
      </div>

      <div className="px-4 sm:px-5 py-5 space-y-5">
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-3.5 rounded-xl bg-[#0f0f18] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-white/[0.04] animate-pulse" />
                <div className="h-2.5 w-14 rounded bg-white/[0.04] animate-pulse" />
              </div>
              <div className="h-5 w-10 rounded bg-white/[0.06] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
            </div>
          ))}
        </div>

        {/* Activity pills skeleton */}
        <div>
          <div className="h-2.5 w-20 rounded bg-white/[0.04] animate-pulse mb-2.5" />
          <div className="flex gap-2 overflow-hidden">
            {[88, 78, 82, 64, 68, 80, 72, 62].map((w, i) => (
              <div
                key={i}
                className="flex-shrink-0 animate-pulse rounded-full"
                style={{ width: w, height: 36, backgroundColor: i === 0 ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.03)", animationDelay: `${i * 75}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Playlist grid skeleton */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="h-2.5 w-28 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-white/[0.04] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/[0.03]" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" style={{ animationDelay: `${i * 150}ms` }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/[0.04]" />
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 px-0.5">
                  <div className="h-3.5 rounded-md bg-white/[0.06] animate-pulse" style={{ width: `${60 + (i * 7) % 30}%`, animationDelay: `${i * 60}ms` }} />
                  <div className="h-2.5 rounded-md bg-white/[0.03] animate-pulse" style={{ width: `${40 + (i * 11) % 25}%`, animationDelay: `${i * 60 + 40}ms` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackListSkeleton() {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-white/[0.04] mb-1">
        <div className="w-8 h-3 rounded bg-white/[0.04]" />
        <div className="w-11" />
        <div className="h-3 w-12 rounded bg-white/[0.04]" />
        <div className="flex-1" />
        <div className="w-4 h-3 rounded bg-white/[0.04] hidden sm:block" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 flex justify-center">
            <div className="w-4 h-3.5 rounded bg-white/[0.04] animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
          </div>
          <div className="w-11 h-11 rounded-lg bg-white/[0.04] animate-pulse flex-shrink-0" style={{ animationDelay: `${i * 50 + 25}ms` }} />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-3.5 rounded-md bg-white/[0.06] animate-pulse" style={{ width: `${45 + (i * 13) % 40}%`, animationDelay: `${i * 50}ms` }} />
            <div className="h-2.5 rounded-md bg-white/[0.03] animate-pulse" style={{ width: `${30 + (i * 17) % 35}%`, animationDelay: `${i * 50 + 30}ms` }} />
          </div>
          <div className="w-10 h-5 rounded-full bg-white/[0.03] animate-pulse hidden sm:block" style={{ animationDelay: `${i * 50 + 40}ms` }} />
          <div className="w-10 h-3 rounded bg-white/[0.04] animate-pulse hidden sm:block" style={{ animationDelay: `${i * 50 + 50}ms` }} />
        </div>
      ))}
    </div>
  );
}
