'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { FileText, Download, Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { motion } from 'framer-motion';

interface MessageMediaProps {
  mediaUrl: string;
  mediaThumbnail?: string | null;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  fileName?: string;
  fileSize?: number;
  className?: string;
  isOwn?: boolean;
}

export function MessageMedia({
  mediaUrl,
  mediaThumbnail,
  mediaType,
  fileName,
  fileSize,
  className,
  isOwn = false,
}: MessageMediaProps) {
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [_isVideoOpen, _setIsVideoOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [_isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Image display with WhatsApp-like design
  if (mediaType === 'image') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'relative rounded-2xl overflow-hidden cursor-pointer group',
            'shadow-lg border border-border/20',
            'max-w-[400px]',
            className
          )}
          onClick={() => setIsImageOpen(true)}
        >
          {imageError ? (
            <div className="flex items-center justify-center w-full h-48 bg-muted">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="relative w-full aspect-auto">
                <Image
                  src={mediaUrl}
                  alt={fileName || 'Image'}
                  width={400}
                  height={400}
                  className="object-cover w-full h-auto max-h-[500px]"
                  onError={() => setImageError(true)}
                  unoptimized
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileHover={{ scale: 1 }}
                    className="bg-black/50 rounded-full p-2 backdrop-blur-sm"
                  >
                    <Maximize2 className="h-5 w-5 text-white" />
                  </motion.div>
                </div>
              </div>
              {fileName && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-sm font-medium truncate">{fileName}</p>
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Fullscreen Image Dialog */}
        <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
          <DialogContent
            className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0"
            showCloseButton={false}
          >
            <VisuallyHidden>
              <DialogTitle>{fileName || 'Image preview'}</DialogTitle>
            </VisuallyHidden>
            <div className="relative w-full h-[95vh] flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setIsImageOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
              <Image
                src={mediaUrl}
                alt={fileName || 'Image'}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Video display with modern controls
  if (mediaType === 'video') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'relative rounded-2xl overflow-hidden group',
            'shadow-lg border border-border/20',
            'max-w-[400px]',
            className
          )}
        >
          <div className="relative">
            <video
              ref={videoRef}
              src={mediaUrl}
              poster={mediaThumbnail || undefined}
              className="w-full h-auto max-h-[500px] object-cover"
              controls
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
            >
              Your browser does not support the video tag.
            </video>
            
            {/* Video overlay info */}
            {fileName && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-white text-sm font-medium truncate">{fileName}</p>
                {fileSize && (
                  <p className="text-white/80 text-xs">{formatFileSize(fileSize)}</p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </>
    );
  }

  // Document display with modern design
  if (mediaType === 'document') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex items-center gap-3 p-4 rounded-2xl border',
          'bg-muted/50 hover:bg-muted/70 transition-colors',
          'shadow-sm max-w-[400px]',
          className
        )}
      >
        <div className={cn(
          'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
          isOwn 
            ? 'bg-primary/20 text-primary' 
            : 'bg-muted-foreground/10 text-muted-foreground'
        )}>
          <FileText className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName || 'Document'}</p>
          {fileSize && (
            <p className="text-xs text-muted-foreground mt-0.5">{formatFileSize(fileSize)}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 hover:bg-muted"
          onClick={() => window.open(mediaUrl, '_blank')}
        >
          <Download className="h-4 w-4" />
        </Button>
      </motion.div>
    );
  }

  return null;
}
