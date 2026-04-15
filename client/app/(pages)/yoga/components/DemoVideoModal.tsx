"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Loader2, ExternalLink, Youtube } from "lucide-react";
import { youtubeService } from "@/src/shared/services/yoga.service";
import type { YouTubeVideo } from "@shared/types/domain/yoga";

interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionName: string;
  accentColor: string;
}

export default function DemoVideoModal({
  isOpen,
  onClose,
  sessionName,
  accentColor,
}: DemoVideoModalProps) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await youtubeService.searchPoseVideo(
        `${sessionName} yoga flow tutorial`
      );
      if (res.success && res.data?.videos?.length) {
        setVideos(res.data.videos);
        setActiveVideoId(res.data.videos[0].videoId);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [sessionName]);

  useEffect(() => {
    if (isOpen && videos.length === 0) {
      fetchVideos();
    }
  }, [isOpen, videos.length, fetchVideos]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15">
                  <Youtube className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {sessionName} — Tutorial
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Watch how to perform this flow correctly
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Video player */}
            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="aspect-video w-full rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                    <p className="text-sm text-zinc-400">
                      Finding tutorial videos...
                    </p>
                  </div>
                </div>
              ) : activeVideoId ? (
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?rel=0&modestbranding=1&autoplay=1`}
                    title={`${sessionName} tutorial`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <div className="aspect-video w-full rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-zinc-500">
                    <Play className="h-10 w-10" />
                    <p className="text-sm">No tutorial videos found</p>
                  </div>
                </div>
              )}

              {/* Video list */}
              {videos.length > 1 && (
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    More tutorials
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {videos.map((video) => (
                      <button
                        key={video.videoId}
                        onClick={() => setActiveVideoId(video.videoId)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-all ${
                          activeVideoId === video.videoId
                            ? "bg-emerald-500/10 border border-emerald-500/20"
                            : "bg-white/5 border border-white/5 hover:bg-white/8"
                        }`}
                      >
                        <div className="relative shrink-0 w-20 aspect-video rounded-lg overflow-hidden bg-black">
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-white line-clamp-2 leading-snug">
                            {video.title}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            {video.channelTitle}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
