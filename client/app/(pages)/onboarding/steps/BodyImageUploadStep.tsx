'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  SkipForward,
  ArrowRight,
  ArrowLeft,
  Upload,
  X,
  Check,
  User,
  PersonStanding,
  Scan,
  Move3D,
  Shield,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';
import { useOnboarding } from '@/src/features/onboarding/context/OnboardingContext';
import type { BodyImageType } from '@/src/features/onboarding/types';
import { useOnboardingApi } from '../hooks/useOnboardingApi';

// Photo type configuration
const PHOTO_TYPES: {
  id: BodyImageType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  guidance: string;
}[] = [
  {
    id: 'face',
    label: 'Face',
    description: 'Front-facing headshot',
    icon: User,
    guidance: 'Look directly at the camera with a neutral expression',
  },
  {
    id: 'front',
    label: 'Front',
    description: 'Full body front view',
    icon: PersonStanding,
    guidance: 'Stand straight, arms relaxed at your sides',
  },
  {
    id: 'side',
    label: 'Side',
    description: 'Full body profile',
    icon: Scan,
    guidance: 'Turn 90 degrees, arms naturally at your sides',
  },
  {
    id: 'back',
    label: 'Back',
    description: 'Full body rear view',
    icon: Move3D,
    guidance: 'Face away from camera, stand naturally',
  },
];

/**
 * BodyImageUploadStep - Modern step-by-step photo upload
 */
export function BodyImageUploadStep() {
  const {
    bodyImages,
    updateBodyImage,
    setBodyImagesConsent,
    skipBodyImages,
    nextStep,
  } = useOnboarding();
  const { uploadBodyImage, isLoading: isUploading } = useOnboardingApi();

  const [selectedType, setSelectedType] = useState<BodyImageType | null>(null);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Set<BodyImageType>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image capture and upload
  const handleCapture = useCallback(
    async (file: File) => {
      if (!selectedType) return;
      const previewUrl = URL.createObjectURL(file);
      
      // Update local state immediately
      updateBodyImage(selectedType, {
        file,
        previewUrl,
        uploadStatus: 'uploading',
      });
      
      setUploadingImages(prev => new Set(prev).add(selectedType));
      setSelectedType(null);

      try {
        // Upload to server
        const result = await uploadBodyImage(file, selectedType, 'onboarding');
        
        // Update with server response
        updateBodyImage(selectedType, {
          uploadKey: result.imageKey,
          uploadStatus: 'completed',
        });
      } catch (error) {
        console.error('Failed to upload image:', error);
        updateBodyImage(selectedType, {
          uploadStatus: 'failed',
        });
      } finally {
        setUploadingImages(prev => {
          const next = new Set(prev);
          next.delete(selectedType);
          return next;
        });
      }
    },
    [selectedType, updateBodyImage, uploadBodyImage]
  );

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleCapture(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleCapture]
  );

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleCapture(file);
      }
    },
    [handleCapture]
  );

  // Handle image removal
  const handleRemove = useCallback(
    (type: BodyImageType) => {
      if (bodyImages[type].previewUrl) {
        URL.revokeObjectURL(bodyImages[type].previewUrl!);
      }
      updateBodyImage(type, {
        file: null,
        previewUrl: null,
        uploadKey: null,
        uploadStatus: 'idle',
      });
    },
    [bodyImages, updateBodyImage]
  );

  // Handle skip
  const handleSkip = useCallback(() => {
    skipBodyImages();
    nextStep();
  }, [skipBodyImages, nextStep]);

  // Handle continue - ensure all images are uploaded
  const handleContinue = useCallback(async () => {
    // Upload any images that haven't been uploaded yet
    const imagesToUpload = PHOTO_TYPES.filter(
      (type) => {
        const img = bodyImages[type.id];
        return img.file && img.uploadStatus !== 'completed' && img.uploadStatus !== 'uploading';
      }
    );

    if (imagesToUpload.length > 0) {
      setUploadingImages(new Set(imagesToUpload.map(t => t.id)));
      
      try {
        await Promise.all(
          imagesToUpload.map(async (type) => {
            const img = bodyImages[type.id];
            if (img.file) {
              try {
                const result = await uploadBodyImage(img.file, type.id, 'onboarding');
                updateBodyImage(type.id, {
                  uploadKey: result.imageKey,
                  uploadStatus: 'completed',
                });
              } catch (error) {
                console.error(`Failed to upload ${type.id} image:`, error);
                updateBodyImage(type.id, {
                  uploadStatus: 'failed',
                });
              }
            }
          })
        );
      } finally {
        setUploadingImages(new Set());
      }
    }

    // Proceed to next step
    nextStep();
  }, [bodyImages, uploadBodyImage, updateBodyImage, nextStep]);

  // Count uploaded images
  const uploadedCount = PHOTO_TYPES.filter(
    (type) => bodyImages[type.id].previewUrl !== null
  ).length;
  const canProceed = bodyImages.privacyConsent && uploadedCount > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-600/20"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
        >
          <Camera className="w-7 h-7 text-white" />
        </motion.div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          Progress Photos
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto">
          Add photos to track your transformation journey
        </p>
      </motion.div>

      {/* Progress Bar */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">Progress</span>
          <span className="text-xs text-slate-400">{uploadedCount}/4 photos</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-teal-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(uploadedCount / 4) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {selectedType ? (
          // Upload View - Show selected type uploader
          <motion.div
            key="upload-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Back button */}
            <button
              onClick={() => setSelectedType(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to selection
            </button>

            {/* Selected type info */}
            {(() => {
              const photoType = PHOTO_TYPES.find((t) => t.id === selectedType)!;
              const Icon = photoType.icon;
              return (
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800 flex items-center justify-center">
                    <Icon className="w-8 h-8 text-sky-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    {photoType.label} Photo
                  </h2>
                  <p className="text-slate-400 text-sm">{photoType.guidance}</p>
                </div>
              );
            })()}

            {/* Upload area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              className={`
                relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
                ${isDragging
                  ? 'border-emerald-600 bg-emerald-600/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
                }
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="space-y-4">
                <div
                  className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center transition-colors ${
                    isDragging ? 'bg-emerald-600/20' : 'bg-slate-800'
                  }`}
                >
                  <ImagePlus className={`w-7 h-7 ${isDragging ? 'text-emerald-400' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className="text-white font-medium mb-1">
                    {isDragging ? 'Drop your photo here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-slate-500 text-sm">PNG, JPG up to 10MB</p>
                </div>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute('capture', 'environment');
                        fileInputRef.current.click();
                        setTimeout(() => fileInputRef.current?.removeAttribute('capture'), 100);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Browse Files
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          // Selection View - Show photo types and thumbnails
          <motion.div
            key="selection-view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {PHOTO_TYPES.map((photoType, index) => {
              const Icon = photoType.icon;
              const hasImage = bodyImages[photoType.id].previewUrl !== null;

              return (
                <motion.div
                  key={photoType.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group
                    ${hasImage
                      ? 'bg-slate-800/50 border-slate-700'
                      : 'bg-slate-900/50 border-slate-800 hover:border-emerald-600/50 hover:bg-slate-800/30'
                    }
                  `}
                  onClick={() => !hasImage && setSelectedType(photoType.id)}
                >
                  {/* Thumbnail or Icon */}
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    {hasImage ? (
                      <>
                        <Image
                          src={bodyImages[photoType.id].previewUrl!}
                          alt={photoType.label}
                          fill
                          className="object-cover"
                        />
                        {/* Remove button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(photoType.id);
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-slate-500" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium">{photoType.label}</h3>
                      {hasImage && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Added
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm truncate">{photoType.description}</p>
                  </div>

                  {/* Action */}
                  {!hasImage && (
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 group-hover:bg-sky-600 flex items-center justify-center transition-colors">
                        <Camera className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Consent */}
      {!selectedType && (
        <motion.div
          className="mt-8 p-4 rounded-xl bg-slate-900/50 border border-slate-800"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={bodyImages.privacyConsent}
                onChange={(e) => setBodyImagesConsent(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-md border-2 border-slate-600 peer-checked:border-emerald-600 peer-checked:bg-emerald-600 transition-colors flex items-center justify-center">
                {bodyImages.privacyConsent && <Check className="w-3 h-3 text-white" />}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-white">Privacy Agreement</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                I consent to my photos being securely stored and analyzed to track progress.
                Photos are encrypted and never shared publicly.
              </p>
            </div>
          </label>
        </motion.div>
      )}

      {/* Action Buttons */}
      {!selectedType && (
        <motion.div
          className="mt-8 space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!canProceed || uploadingImages.size > 0 || isUploading}
            className={`
              w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-3
              ${canProceed && uploadingImages.size === 0 && !isUploading
                ? 'bg-sky-600 text-white border border-white/20 hover:shadow-lg hover:shadow-sky-600/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            {uploadingImages.size > 0 || isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading {uploadingImages.size} image{uploadingImages.size > 1 ? 's' : ''}...
              </>
            ) : (
              <>
            Continue
            <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {/* Skip Button */}
          {!showSkipConfirm ? (
            <button
              onClick={() => setShowSkipConfirm(true)}
              className="w-full py-3 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              Skip for now
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
            >
              <p className="text-amber-200 text-sm mb-3">
                Skip photos? You&apos;ll miss out on visual progress tracking.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSkip}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  Skip anyway
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Consent Warning */}
      {!bodyImages.privacyConsent && uploadedCount > 0 && !selectedType && (
        <motion.p
          className="text-center text-amber-400 text-xs mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Please accept the privacy agreement to continue
        </motion.p>
      )}
    </div>
  );
}
