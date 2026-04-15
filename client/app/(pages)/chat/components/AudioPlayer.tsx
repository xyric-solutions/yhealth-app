'use client';

import { useRef, useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface AudioPlayerProps {
  src: string;
  isOwn?: boolean;
  className?: string;
  duration?: number;
}

const formatDuration = (seconds: number) => {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function AudioPlayer({ src, isOwn = false, className, duration: initialDuration }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isDragging] = useState(false);
  const [volume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Set volume using the audio element property
    audio.volume = volume;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime || 0);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src, isDragging, volume]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        await audio.pause();
      } else {
        await audio.play();
      }
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressRef.current;
    if (!audio || !progressBar || !duration) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progressPercent = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  // WhatsApp-like styling
  const containerBg = isOwn
    ? 'bg-gradient-to-br from-emerald-500/90 to-teal-600/90 backdrop-blur-sm'
    : 'bg-muted/80 backdrop-blur-sm border border-border/50';

  const buttonBg = isOwn
    ? 'bg-white/20 hover:bg-white/30 text-white'
    : 'bg-background/80 hover:bg-background text-foreground';

  const progressBg = isOwn
    ? 'bg-white/30'
    : 'bg-muted-foreground/20';

  const progressFill = isOwn
    ? 'bg-white'
    : 'bg-primary';

  const textColor = isOwn ? 'text-white' : 'text-foreground';

  return (
    <div className={cn(
      'relative rounded-2xl px-4 py-3 shadow-lg',
      'min-w-[280px] max-w-[320px]',
      containerBg,
      className
    )}>
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={togglePlay}
          className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center',
            'transition-all duration-200 shadow-md',
            buttonBg
          )}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 ml-0.5" />
          ) : (
            <Play className="w-5 h-5 ml-1" />
          )}
        </motion.button>

        {/* Progress Bar and Time */}
        <div className="flex-1 min-w-0">
          {/* Progress Bar */}
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className={cn(
              'h-1.5 rounded-full cursor-pointer relative overflow-hidden',
              progressBg
            )}
          >
            <motion.div
              className={cn('h-full rounded-full', progressFill)}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          {/* Time Display */}
          <div className={cn('mt-1.5 flex items-center justify-between text-[11px] font-medium', textColor)}>
            <span className="opacity-90">{formatDuration(currentTime)}</span>
            <span className="opacity-70">/ {formatDuration(duration)}</span>
          </div>
        </div>
      </div>

      {/* Audio Element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
      />
    </div>
  );
}
