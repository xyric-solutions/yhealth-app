'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Youtube,
  Sparkles,
  X,
  Plus,
  Edit3,
  Trash2,
  User,
  Heart,
  Check,
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface MotivationalVideo {
  id: string;
  youtubeVideoId: string;
  title: string;
  channelName: string | null;
  thumbnailUrl: string | null;
  goalCategory: string;
  contentType: 'motivation' | 'workout' | 'nutrition' | 'tips';
  tags: string[];
  isFeatured: boolean;
  isPrivate?: boolean;
  isFavorite?: boolean;
  notes?: string | null;
  interaction?: {
    watched: boolean;
    liked: boolean;
    saved: boolean;
    watchCount: number;
  };
}

interface UserPrivateVideo {
  id: string;
  youtubeVideoId: string;
  title: string;
  channelName: string | null;
  thumbnailUrl: string | null;
  goalCategory: string;
  contentType: 'motivation' | 'workout' | 'nutrition' | 'tips';
  tags: string[];
  notes: string | null;
  isFavorite: boolean;
}

interface MotivationalVideosWidgetProps {
  goalCategory?: string;
  title?: string;
  maxVideos?: number;
}

const CONTENT_TYPE_COLORS: Record<string, string> = {
  motivation: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  workout: 'bg-green-500/20 text-green-400 border-green-500/30',
  nutrition: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  tips: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const CONTENT_TYPES = [
  { id: 'motivation', label: 'Motivation' },
  { id: 'workout', label: 'Workout' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'tips', label: 'Tips' },
];

// Helper to extract YouTube video ID from various URL formats
function extractYouTubeId(input: string): string | null {
  // Already just an ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // Various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function MotivationalVideosWidget({
  goalCategory = 'overall_optimization',
  title = 'Get Motivated',
  maxVideos = 5,
}: MotivationalVideosWidgetProps) {
  // Video states
  const [videos, setVideos] = useState<MotivationalVideo[]>([]);
  const [privateVideos, setPrivateVideos] = useState<UserPrivateVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedVideos, setSavedVideos] = useState<Set<string>>(new Set());
  const [playingVideo, setPlayingVideo] = useState<MotivationalVideo | null>(null);

  // View mode: 'recommended' or 'private'
  const [viewMode, setViewMode] = useState<'recommended' | 'private'>('recommended');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<UserPrivateVideo | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    youtubeUrl: '',
    title: '',
    channelName: '',
    contentType: 'motivation' as 'motivation' | 'workout' | 'nutrition' | 'tips',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Combined videos for display
  const displayVideos = viewMode === 'recommended'
    ? videos
    : privateVideos.map(v => ({
        ...v,
        isPrivate: true,
        isFeatured: false,
        tags: v.tags || [],
      } as MotivationalVideo));

  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch both recommended and private videos in parallel
      const [recommendedResponse, privateResponse] = await Promise.all([
        api.get<{ videos: MotivationalVideo[] }>(
          `/videos/recommended?goal=${goalCategory}&limit=${maxVideos}`
        ),
        api.get<{ videos: UserPrivateVideo[] }>('/videos/private'),
      ]);

      if (recommendedResponse.success && recommendedResponse.data) {
        setVideos(recommendedResponse.data.videos);
        // Track saved videos
        const saved = new Set<string>();
        recommendedResponse.data.videos.forEach((v) => {
          if (v.interaction?.saved) saved.add(v.id);
        });
        setSavedVideos(saved);
      }

      if (privateResponse.success && privateResponse.data) {
        setPrivateVideos(privateResponse.data.videos);
      }
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [goalCategory, maxVideos]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Reset index when switching view modes
  useEffect(() => {
    setCurrentIndex(0);
  }, [viewMode]);

  const handleWatch = async (video: MotivationalVideo) => {
    // Record watch for recommended videos only
    if (!video.isPrivate) {
      try {
        await api.post(`/videos/${video.id}/watch`);
      } catch (err) {
        console.error('Failed to record watch:', err);
      }
    }
    setPlayingVideo(video);
  };

  const handleClosePlayer = () => {
    setPlayingVideo(null);
  };

  const handleSave = async (video: MotivationalVideo) => {
    if (video.isPrivate) return;

    const isSaved = savedVideos.has(video.id);
    try {
      await api.post(`/videos/${video.id}/save`, { saved: !isSaved });
      setSavedVideos((prev) => {
        const updated = new Set(prev);
        if (isSaved) {
          updated.delete(video.id);
        } else {
          updated.add(video.id);
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to save video:', err);
    }
  };

  const handleToggleFavorite = async (videoId: string) => {
    try {
      const response = await api.post<{ video: UserPrivateVideo }>(`/videos/private/${videoId}/favorite`);
      if (response.success && response.data) {
        setPrivateVideos(prev =>
          prev.map(v => v.id === videoId ? response.data!.video : v)
        );
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const nextVideo = () => {
    if (displayVideos.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % displayVideos.length);
    }
  };

  const prevVideo = () => {
    if (displayVideos.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + displayVideos.length) % displayVideos.length);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      youtubeUrl: '',
      title: '',
      channelName: '',
      contentType: 'motivation',
      notes: '',
    });
    setFormError('');
    setEditingVideo(null);
  };

  // Open add modal
  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  // Open edit modal
  const handleOpenEditModal = (video: UserPrivateVideo) => {
    setEditingVideo(video);
    setFormData({
      youtubeUrl: video.youtubeVideoId,
      title: video.title,
      channelName: video.channelName || '',
      contentType: video.contentType,
      notes: video.notes || '',
    });
    setShowAddModal(true);
  };

  // Save video (create or update)
  const handleSaveVideo = async () => {
    const youtubeId = extractYouTubeId(formData.youtubeUrl);

    if (!youtubeId) {
      setFormError('Please enter a valid YouTube URL or video ID');
      return;
    }

    if (!formData.title.trim()) {
      setFormError('Please enter a title');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      if (editingVideo) {
        // Update existing video
        const response = await api.patch<{ video: UserPrivateVideo }>(
          `/videos/private/${editingVideo.id}`,
          {
            title: formData.title.trim(),
            channelName: formData.channelName.trim() || null,
            contentType: formData.contentType,
            notes: formData.notes.trim() || null,
          }
        );

        if (response.success && response.data) {
          setPrivateVideos(prev =>
            prev.map(v => v.id === editingVideo.id ? response.data!.video : v)
          );
        }
      } else {
        // Create new video
        const response = await api.post<{ video: UserPrivateVideo }>('/videos/private', {
          youtubeVideoId: youtubeId,
          title: formData.title.trim(),
          channelName: formData.channelName.trim() || null,
          goalCategory,
          contentType: formData.contentType,
          notes: formData.notes.trim() || null,
        });

        if (response.success && response.data) {
          setPrivateVideos(prev => [response.data!.video, ...prev]);
          // Switch to private view to show the new video
          setViewMode('private');
          setCurrentIndex(0);
        }
      }

      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save video:', err);
      setFormError('Failed to save video. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete video
  const handleDeleteVideo = async (videoId: string) => {
    try {
      await api.delete(`/videos/private/${videoId}`);
      setPrivateVideos(prev => prev.filter(v => v.id !== videoId));
      setShowDeleteConfirm(null);

      // Adjust index if needed
      if (currentIndex >= privateVideos.length - 1) {
        setCurrentIndex(Math.max(0, privateVideos.length - 2));
      }
    } catch (err) {
      console.error('Failed to delete video:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  const currentVideo = displayVideos[currentIndex];
  const hasVideos = displayVideos.length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <Youtube className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-xs text-slate-400">
                  {viewMode === 'recommended' ? 'Goal-based recommendations' : 'Your private videos'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasVideos && (
                <span className="text-xs text-slate-400">
                  {currentIndex + 1} / {displayVideos.length}
                </span>
              )}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setViewMode('recommended')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'recommended'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Recommended
            </button>
            <button
              onClick={() => setViewMode('private')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'private'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              My Videos ({privateVideos.length})
            </button>
          </div>
        </div>

        {/* Video Card or Empty State */}
        {!hasVideos ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
              {viewMode === 'private' ? (
                <User className="w-6 h-6 text-slate-400" />
              ) : (
                <Youtube className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <p className="text-slate-400 text-sm mb-4">
              {viewMode === 'private'
                ? 'Add your favorite YouTube videos'
                : 'No recommendations available'}
            </p>
            {viewMode === 'private' && (
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Video
              </button>
            )}
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentVideo.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentVideo.thumbnailUrl || `https://img.youtube.com/vi/${currentVideo.youtubeVideoId}/mqdefault.jpg`}
                    alt={currentVideo.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Play Button */}
                  <button
                    onClick={() => handleWatch(currentVideo)}
                    className="absolute inset-0 flex items-center justify-center group"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-lg">
                      <Play className="w-8 h-8 text-white ml-1" fill="white" />
                    </div>
                  </button>

                  {/* Content Type Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${CONTENT_TYPE_COLORS[currentVideo.contentType]}`}>
                      {currentVideo.contentType.charAt(0).toUpperCase() + currentVideo.contentType.slice(1)}
                    </span>
                  </div>

                  {/* Featured or Private Badge */}
                  <div className="absolute top-3 right-3">
                    {currentVideo.isPrivate ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Private
                      </span>
                    ) : currentVideo.isFeatured && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Featured
                      </span>
                    )}
                  </div>

                  {/* Video Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h4 className="font-semibold text-white text-sm line-clamp-2 mb-1">
                      {currentVideo.title}
                    </h4>
                    {currentVideo.channelName && (
                      <p className="text-xs text-slate-300">{currentVideo.channelName}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="p-3 flex items-center justify-between border-t border-white/10">
              {/* Navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={prevVideo}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  disabled={displayVideos.length <= 1}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextVideo}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  disabled={displayVideos.length <= 1}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {viewMode === 'private' && currentVideo.isPrivate ? (
                  // Private video actions
                  <>
                    <button
                      onClick={() => handleToggleFavorite(currentVideo.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        currentVideo.isFavorite
                          ? 'bg-pink-500/20 text-pink-400'
                          : 'hover:bg-white/10 text-slate-400 hover:text-white'
                      }`}
                      title={currentVideo.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {currentVideo.isFavorite ? (
                        <Heart className="w-5 h-5" fill="currentColor" />
                      ) : (
                        <Heart className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        const privateVideo = privateVideos.find(v => v.id === currentVideo.id);
                        if (privateVideo) handleOpenEditModal(privateVideo);
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Edit video"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(currentVideo.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete video"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  // Recommended video actions
                  <button
                    onClick={() => handleSave(currentVideo)}
                    className={`p-2 rounded-lg transition-colors ${
                      savedVideos.has(currentVideo.id)
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'hover:bg-white/10 text-slate-400 hover:text-white'
                    }`}
                    title={savedVideos.has(currentVideo.id) ? 'Remove from saved' : 'Save video'}
                  >
                    {savedVideos.has(currentVideo.id) ? (
                      <BookmarkCheck className="w-5 h-5" />
                    ) : (
                      <Bookmark className="w-5 h-5" />
                    )}
                  </button>
                )}

                {viewMode === 'private' && (
                  <button
                    onClick={handleOpenAddModal}
                    className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Add video"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                )}

                <button
                  onClick={() => handleWatch(currentVideo)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Watch
                </button>
              </div>
            </div>

            {/* Video Indicators */}
            {displayVideos.length > 1 && (
              <div className="px-4 pb-3 flex justify-center gap-1">
                {displayVideos.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentIndex ? 'bg-purple-500' : 'bg-white/20 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Video Player Modal */}
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={handleClosePlayer}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-4xl bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shrink-0">
                    <Youtube className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm sm:text-base truncate">
                      {playingVideo.title}
                    </h3>
                    {playingVideo.channelName && (
                      <p className="text-xs text-slate-400 truncate">{playingVideo.channelName}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleClosePlayer}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0 ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* YouTube Embed */}
              <div className="relative w-full aspect-video bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${playingVideo.youtubeVideoId}?autoplay=1&rel=0&modestbranding=1`}
                  title={playingVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${CONTENT_TYPE_COLORS[playingVideo.contentType]}`}>
                    {playingVideo.contentType.charAt(0).toUpperCase() + playingVideo.contentType.slice(1)}
                  </span>
                  {playingVideo.isPrivate ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Private
                    </span>
                  ) : playingVideo.isFeatured && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Featured
                    </span>
                  )}
                </div>
                {!playingVideo.isPrivate && (
                  <button
                    onClick={() => {
                      handleSave(playingVideo);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      savedVideos.has(playingVideo.id)
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    {savedVideos.has(playingVideo.id) ? (
                      <>
                        <BookmarkCheck className="w-4 h-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Video Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => {
              setShowAddModal(false);
              resetForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="font-semibold text-white">
                  {editingVideo ? 'Edit Video' : 'Add YouTube Video'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="p-4 space-y-4">
                {/* YouTube URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    YouTube URL or Video ID
                  </label>
                  <input
                    type="text"
                    value={formData.youtubeUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                    placeholder="https://youtube.com/watch?v=... or video ID"
                    disabled={!!editingVideo}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Video title"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Channel Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Channel Name (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.channelName}
                    onChange={(e) => setFormData(prev => ({ ...prev, channelName: e.target.value }))}
                    placeholder="Channel name"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Content Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Content Type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {CONTENT_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          contentType: type.id as typeof formData.contentType
                        }))}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          formData.contentType === type.id
                            ? CONTENT_TYPE_COLORS[type.id]
                            : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Why you love this video..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Error */}
                {formError && (
                  <p className="text-red-400 text-sm">{formError}</p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveVideo}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {editingVideo ? 'Save Changes' : 'Add Video'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Delete Video?</h3>
                <p className="text-slate-400 text-sm mb-6">
                  This video will be removed from your private collection. This action cannot be undone.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteVideo(showDeleteConfirm)}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
