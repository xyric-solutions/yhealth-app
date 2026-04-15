'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoLiveButtonProps {
  isInRoom: boolean;
  onJoinRoom: () => Promise<void>;
  className?: string;
}

export function GoLiveButton({
  isInRoom,
  onJoinRoom,
  className,
}: GoLiveButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't render if already in room (controls shown via StreamControls)
  if (isInRoom) return null;

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      await onJoinRoom();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Camera permission denied');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No camera found');
      } else {
        setError('Failed to join stream');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleJoin}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
          'bg-emerald-600/80 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-600/20',
          loading && 'opacity-60 cursor-not-allowed',
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Video className="w-4 h-4" />
        )}
        {loading ? 'Joining...' : 'Join Stream'}
      </motion.button>
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
    </div>
  );
}
