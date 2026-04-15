'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { VideoOff, MicOff, Wifi } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface CameraStreamPlaceholderProps {
  userId?: string;
  userName?: string;
  userAvatar?: string;
  isLive?: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  className?: string;
  /** When provided, renders actual video instead of the avatar placeholder */
  mediaStream?: MediaStream | null;
  /** If true, mute the video element (use for local preview) */
  muted?: boolean;
}

export function CameraStreamPlaceholder({
  userName,
  userAvatar,
  isLive = false,
  audioEnabled = true,
  videoEnabled = true,
  className,
  mediaStream,
  muted = false,
}: CameraStreamPlaceholderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach / detach the MediaStream to the <video> element
  useEffect(() => {
    if (videoRef.current) {
      if (mediaStream) {
        videoRef.current.srcObject = mediaStream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [mediaStream]);

  const hasVideo = isLive && videoEnabled && !!mediaStream;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'group relative aspect-video rounded-2xl overflow-hidden',
        isLive
          ? 'ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10'
          : 'ring-1 ring-white/10',
        className
      )}
    >
      {/* Background — hidden when actual video is playing */}
      {!hasVideo && (
        <div className={cn(
          'absolute inset-0',
          isLive
            ? 'bg-linear-to-br from-gray-900 via-emerald-950/30 to-gray-900'
            : 'bg-linear-to-br from-gray-900 to-gray-950'
        )} />
      )}

      {/* Actual video element */}
      {hasVideo && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Hidden video ref for non-playing state (so ref stays mounted) */}
      {!hasVideo && <video ref={videoRef} className="hidden" />}

      {/* Animated grid pattern — only when no video */}
      {!hasVideo && (
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(16, 185, 129, 0.4) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }} />
      )}

      {/* Live Badge */}
      {isLive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-red-600 rounded-lg shadow-lg shadow-red-600/30"
        >
          <motion.div
            className="w-1.5 h-1.5 bg-white rounded-full"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-white text-[10px] font-bold tracking-wider">LIVE</span>
        </motion.div>
      )}

      {/* Mic muted indicator */}
      {isLive && !audioEnabled && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center bg-red-600/80 rounded-full"
        >
          <MicOff className="w-3.5 h-3.5 text-white" />
        </motion.div>
      )}

      {/* Connection indicator */}
      {isLive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          </motion.div>
        </div>
      )}

      {/* Center Content — shown when there is no actual video */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
          {isLive ? (
            <>
              {/* User avatar when camera is off */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="relative"
              >
                <Avatar className="w-16 h-16 border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/20">
                  <AvatarImage src={userAvatar} />
                  <AvatarFallback className="bg-linear-to-br from-emerald-600 to-cyan-600 text-white text-xl font-bold">
                    {(userName || 'U').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {/* Pulse rings */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-emerald-500/30"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
              <div className="text-center">
                <p className="text-white font-semibold text-sm">
                  {userName || 'User'}
                </p>
                <p className="text-emerald-400/80 text-xs mt-0.5">
                  {!videoEnabled ? 'Camera off' : 'Connecting...'}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                <VideoOff className="w-7 h-7 text-gray-600" />
              </div>
              <div className="text-center">
                <p className="text-gray-500 font-medium text-sm">
                  {userName || 'Participant'}
                </p>
                <p className="text-gray-600 text-xs mt-0.5">Offline</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom gradient for text readability */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-linear-to-t from-black/50 to-transparent" />

      {/* Bottom bar with user info */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center gap-2">
        <Avatar className="w-5 h-5 border border-white/20">
          <AvatarImage src={userAvatar} />
          <AvatarFallback className="text-[8px] bg-gray-800 text-gray-400">
            {(userName || 'U').charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="text-white/80 text-[11px] font-medium truncate">
          {userName || 'Participant'}
        </span>
        {isLive && !audioEnabled && (
          <MicOff className="w-3 h-3 text-red-400 ml-auto" />
        )}
      </div>
    </motion.div>
  );
}
