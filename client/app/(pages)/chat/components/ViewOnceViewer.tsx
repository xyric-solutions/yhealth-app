'use client';

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface ViewOnceViewerProps {
  isOpen: boolean;
  mediaUrl: string;
  mediaThumbnail?: string;
  mediaType: 'image' | 'video' | 'audio';
  onClose: () => void;
}

export function ViewOnceViewer({
  isOpen,
  mediaUrl,
  mediaThumbnail,
  mediaType,
  onClose,
}: ViewOnceViewerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent right-click (best-effort)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={onClose}
          onContextMenu={handleContextMenu}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* "View Once" label */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5 text-white text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="12" fontWeight="bold">1</text>
            </svg>
            View Once
          </div>

          {/* Media content */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={handleContextMenu}
          >
            {mediaType === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt="View once media"
                className="max-w-full max-h-[85vh] object-contain rounded-lg select-none pointer-events-none"
                draggable={false}
                onContextMenu={handleContextMenu}
              />
            )}

            {mediaType === 'video' && (
              <video
                src={mediaUrl}
                poster={mediaThumbnail}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-lg"
                controlsList="nodownload"
                onContextMenu={handleContextMenu}
              />
            )}

            {mediaType === 'audio' && (
              <div className="bg-slate-800 rounded-2xl p-8 flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <p className="text-white/70 text-sm">View once audio</p>
                <audio
                  src={mediaUrl}
                  controls
                  autoPlay
                  controlsList="nodownload"
                  className="w-72"
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
