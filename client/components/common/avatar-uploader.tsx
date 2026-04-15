"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  X,
  Loader2,
  Check,
  AlertCircle,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface AvatarUploaderProps {
  currentAvatar?: string | null;
  fallback: string;
  onUpload: (file: File) => Promise<string>;
  onRemove?: () => Promise<void>;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  disabled?: boolean;
}

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
  xl: "h-40 w-40",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

const buttonSizes = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

export function AvatarUploader({
  currentAvatar,
  fallback,
  onUpload,
  onRemove,
  size = "lg",
  className,
  disabled = false,
}: AvatarUploaderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    setUploadProgress(0);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 100);

    try {
      await onUpload(selectedFile);
      setUploadProgress(100);

      setTimeout(() => {
        setIsDialogOpen(false);
        resetState();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
    }
  }, [selectedFile, onUpload, resetState]);

  const handleRemove = useCallback(async () => {
    if (!onRemove) return;

    setIsUploading(true);
    setError(null);

    try {
      await onRemove();
      setIsDialogOpen(false);
      resetState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove avatar");
    } finally {
      setIsUploading(false);
    }
  }, [onRemove, resetState]);

  const handleDialogClose = useCallback(
    (open: boolean) => {
      if (!isUploading) {
        setIsDialogOpen(open);
        if (!open) {
          resetState();
        }
      }
    },
    [isUploading, resetState]
  );

  return (
    <>
      {/* Avatar Display with Edit Button */}
      <div className={cn("relative group", className)}>
        <Avatar
          className={cn(
            sizeClasses[size],
            "ring-4 ring-background shadow-xl transition-all duration-300",
            !disabled && "group-hover:ring-primary/20"
          )}
        >
          <AvatarImage src={currentAvatar || undefined} alt="Profile" />
          <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white font-bold text-xl">
            {fallback}
          </AvatarFallback>
        </Avatar>

        {/* Edit Button Overlay */}
        {!disabled && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsDialogOpen(true)}
            className={cn(
              "absolute -bottom-1 -right-1 rounded-full bg-primary text-white shadow-lg",
              "flex items-center justify-center transition-all duration-300",
              "hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              buttonSizes[size]
            )}
          >
            <Camera className={iconSizes[size]} />
          </motion.button>
        )}

        {/* Hover overlay */}
        {!disabled && (
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100",
              "transition-opacity duration-300 flex items-center justify-center cursor-pointer"
            )}
            onClick={() => setIsDialogOpen(true)}
          >
            <Camera className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Update Profile Photo
            </DialogTitle>
            <DialogDescription>
              Upload a new profile photo or remove the current one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview or Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
                "flex flex-col items-center justify-center gap-4"
              )}
            >
              <AnimatePresence mode="wait">
                {previewUrl ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative"
                  >
                    <Avatar className="h-32 w-32 ring-4 ring-primary/20">
                      <AvatarImage src={previewUrl} alt="Preview" />
                      <AvatarFallback>
                        <ImageIcon className="w-12 h-12 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    {!isUploading && (
                      <button
                        onClick={() => {
                          setPreviewUrl(null);
                          setSelectedFile(null);
                        }}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-white hover:bg-destructive/90 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="dropzone"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="p-4 rounded-full bg-primary/10">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        Drag and drop your image here
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or click to browse
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, GIF up to 5MB
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
            </div>

            {/* Upload Progress */}
            <AnimatePresence>
              {isUploading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uploading...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {currentAvatar && onRemove && (
                <Button
                  variant="outline"
                  onClick={handleRemove}
                  disabled={isUploading}
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              )}
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex-1 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : uploadProgress === 100 ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Done
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
