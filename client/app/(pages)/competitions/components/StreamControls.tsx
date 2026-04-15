'use client';

import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreamControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  className?: string;
}

export function StreamControls({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  className,
}: StreamControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-gray-900/80 backdrop-blur-md border border-white/10',
        className,
      )}
    >
      {/* Mic toggle */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={onToggleAudio}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
          audioEnabled
            ? 'bg-white/10 hover:bg-white/20 text-white'
            : 'bg-red-600/80 hover:bg-red-600 text-white',
        )}
        title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {audioEnabled ? (
          <Mic className="w-4.5 h-4.5" />
        ) : (
          <MicOff className="w-4.5 h-4.5" />
        )}
      </motion.button>

      {/* Camera toggle */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={onToggleVideo}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
          videoEnabled
            ? 'bg-white/10 hover:bg-white/20 text-white'
            : 'bg-red-600/80 hover:bg-red-600 text-white',
        )}
        title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {videoEnabled ? (
          <Video className="w-4.5 h-4.5" />
        ) : (
          <VideoOff className="w-4.5 h-4.5" />
        )}
      </motion.button>

      {/* Leave room */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={onLeave}
        className="w-12 h-10 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-colors"
        title="Leave room"
      >
        <PhoneOff className="w-4.5 h-4.5" />
      </motion.button>
    </motion.div>
  );
}
