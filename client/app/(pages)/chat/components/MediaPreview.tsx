'use client';

import { X, Play, FileText, Music2, Eye } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MediaPreviewProps {
  file: File;
  onRemove: () => void;
  isViewOnce?: boolean;
  onToggleViewOnce?: () => void;
  className?: string;
}

export function MediaPreview({ file, onRemove, isViewOnce, onToggleViewOnce, className }: MediaPreviewProps) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  const previewUrl = URL.createObjectURL(file);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'relative rounded-xl overflow-hidden border border-border/50',
        'bg-muted/30 backdrop-blur-sm shadow-md',
        className
      )}
    >
      {isImage && (
        <div className="relative">
          <Image
            src={previewUrl}
            alt={file.name}
            width={300}
            height={200}
            className="object-cover w-full h-40"
            unoptimized
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
            <p className="text-white text-xs truncate">{file.name}</p>
          </div>
        </div>
      )}

      {isVideo && (
        <div className="relative">
          <video
            src={previewUrl}
            className="w-full h-40 object-cover"
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
            <p className="text-white text-xs truncate">{file.name}</p>
          </div>
        </div>
      )}

      {isAudio && (
        <div className="flex items-center gap-3 p-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Music2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
        </div>
      )}

      {!isImage && !isVideo && !isAudio && (
        <div className="flex items-center gap-3 p-4">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
        </div>
      )}

      {/* View Once toggle */}
      {onToggleViewOnce && (isImage || isVideo || isAudio) && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute top-2 left-2 h-7 w-7 rounded-full backdrop-blur-sm border-0 transition-colors',
            isViewOnce
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-black/60 hover:bg-black/80 text-white/80'
          )}
          onClick={onToggleViewOnce}
          title={isViewOnce ? 'View once enabled' : 'Enable view once'}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* View once badge */}
      {isViewOnce && (
        <div className="absolute bottom-1 left-2 bg-emerald-500/90 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
          View once
        </div>
      )}

      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm border-0"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
