"use client";

import { useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Loader2, AlertCircle } from "lucide-react";
import ScoreRing from "./ScoreRing";
import type { JointScore } from "../../utils/poses";

interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface CameraViewportProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  isMediaPipeLoaded: boolean;
  isMediaPipeLoading: boolean;
  mediaPipeError: string | null;
  onRetryMediaPipe: () => void;
  landmarks: NormalizedLandmark[] | null;
  jointScores: Record<string, JointScore>;
  overallScore: number;
  cameraError: string | null;
  onStartCamera: () => void;
  onStopCamera: () => void;
}

export default function CameraViewport({
  videoRef,
  isActive,
  isMediaPipeLoaded,
  isMediaPipeLoading,
  mediaPipeError,
  onRetryMediaPipe,
  landmarks,
  jointScores,
  overallScore,
  cameraError,
  onStartCamera,
  onStopCamera,
}: CameraViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw skeleton on canvas whenever landmarks change
  const drawFrame = useCallback(async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas to video dimensions
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    if (!landmarks) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Dynamically import drawSkeleton to avoid SSR issues
    const { drawSkeleton } = await import("../../utils/skeleton");
    drawSkeleton(ctx, landmarks, jointScores, canvas.width, canvas.height);
  }, [landmarks, jointScores, videoRef]);

  useEffect(() => {
    drawFrame();
  }, [drawFrame]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50 backdrop-blur-sm">
      {/* Camera feed */}
      <div className="relative aspect-[4/3] w-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        {/* Skeleton overlay canvas */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Mini score ring — top right */}
        {isActive && landmarks && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-3 top-3"
          >
            <ScoreRing score={overallScore} size={64} strokeWidth={4} />
          </motion.div>
        )}

        {/* MediaPipe loading / error indicator */}
        <AnimatePresence>
          {isMediaPipeLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60"
            >
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                <p className="text-sm font-medium text-white/80">
                  Loading AI Pose Detection...
                </p>
                <p className="text-xs text-white/40">This may take a few seconds</p>
              </div>
            </motion.div>
          )}
          {mediaPipeError && !isMediaPipeLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/70"
            >
              <div className="flex flex-col items-center gap-3 max-w-xs text-center">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="text-sm font-medium text-white/80">
                  Pose Detection Failed
                </p>
                <p className="text-xs text-white/50">{mediaPipeError}</p>
                <button
                  onClick={onRetryMediaPipe}
                  className="mt-1 rounded-xl bg-emerald-600 px-6 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500"
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera off / permission denied state */}
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900/90">
            {cameraError ? (
              <>
                <AlertCircle className="h-12 w-12 text-red-400" />
                <div className="max-w-xs text-center">
                  <p className="text-sm font-medium text-white/80">
                    Camera Access Required
                  </p>
                  <p className="mt-1 text-xs text-white/40">{cameraError}</p>
                </div>
                <button
                  onClick={onStartCamera}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-emerald-500"
                >
                  Try Again
                </button>
              </>
            ) : (
              <>
                <div className="rounded-full bg-emerald-500/10 p-6">
                  <Camera className="h-12 w-12 text-emerald-400" />
                </div>
                <div className="max-w-xs text-center">
                  <p className="text-sm font-medium text-white/80">
                    Ready for AI Pose Coaching
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Select a pose and start your session to activate the camera
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Active session indicator */}
        {isActive && isMediaPipeLoaded && !landmarks && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <span className="text-xs text-white/70">
              Position yourself in frame
            </span>
          </div>
        )}

        {isActive && landmarks && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <div className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-white/70">Pose detected</span>
          </div>
        )}
      </div>
    </div>
  );
}
