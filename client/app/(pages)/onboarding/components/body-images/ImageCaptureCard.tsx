'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, Check, Loader2, User, PersonStanding, Scan, Move3D } from 'lucide-react';
import Image from 'next/image';
import type { ImageCaptureCardProps } from './types';
import { BODY_IMAGE_CONFIG } from './types';

const ICON_MAP = {
  user: User,
  'person-standing': PersonStanding,
  scan: Scan,
  'move-3d': Move3D,
};

/**
 * ImageCaptureCard - Individual image capture/upload card
 */
export function ImageCaptureCard({
  type,
  image,
  onCapture,
  onRemove,
  disabled = false,
}: ImageCaptureCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const config = BODY_IMAGE_CONFIG[type];
  const IconComponent = ICON_MAP[config.icon as keyof typeof ICON_MAP] || User;

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        onCapture(file);
      }
    },
    [onCapture]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        onCapture(file);
      }
    },
    [onCapture]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const isUploading = image.uploadStatus === 'uploading';
  const isCompleted = image.uploadStatus === 'completed' || image.previewUrl;
  const isFailed = image.uploadStatus === 'failed';

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {image.previewUrl ? (
          // Image Preview State
          <motion.div
            key="preview"
            className="relative aspect-[3/4] bg-slate-800"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Image
              src={image.previewUrl}
              alt={`${config.label} photo`}
              fill
              className="object-cover"
            />

            {/* Status Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Status Badge */}
            <div className="absolute top-3 right-3">
              {isUploading ? (
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                </div>
              ) : isCompleted ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"
                >
                  <Check className="w-4 h-4 text-white" />
                </motion.div>
              ) : isFailed ? (
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-4 h-4 text-red-400" />
                </div>
              ) : null}
            </div>

            {/* Remove Button */}
            <button
              onClick={onRemove}
              className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 hover:bg-red-500/80 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Label */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white font-semibold">{config.label}</p>
              <p className="text-white/70 text-sm">{config.description}</p>
            </div>
          </motion.div>
        ) : (
          // Upload State
          <motion.div
            key="upload"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`aspect-[3/4] cursor-pointer transition-all ${
              isDragging
                ? 'bg-cyan-500/10 border-2 border-dashed border-cyan-500'
                : 'bg-slate-800/50 border-2 border-dashed border-slate-600 hover:border-cyan-500/50 hover:bg-slate-800'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="h-full flex flex-col items-center justify-center p-4 text-center">
              {/* Icon */}
              <div
                className={`w-16 h-16 rounded-2xl mb-4 flex items-center justify-center transition-colors ${
                  isDragging ? 'bg-cyan-500/20' : 'bg-slate-700/50'
                }`}
              >
                <IconComponent
                  className={`w-8 h-8 ${isDragging ? 'text-cyan-400' : 'text-slate-400'}`}
                />
              </div>

              {/* Label */}
              <p className="text-white font-semibold mb-1">{config.label}</p>
              <p className="text-slate-400 text-sm mb-4">{config.description}</p>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Capture
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Remove capture attribute to allow file picker
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                      // Restore capture attribute
                      setTimeout(() => {
                        fileInputRef.current?.setAttribute('capture', 'environment');
                      }, 100);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              </div>

              {/* Guidance */}
              <p className="text-slate-500 text-xs mt-4 max-w-[200px]">{config.guidance}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
