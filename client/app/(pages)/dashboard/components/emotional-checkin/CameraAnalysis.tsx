"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emotionalCheckInService } from "@/src/shared/services/emotional-checkin.service";
import toast from "react-hot-toast";

interface CameraAnalysisResult {
  moodIndicators: {
    facialExpression: string;
    energyLevel: string;
    stressIndicators: string[];
    overallAssessment: string;
  };
  scores: {
    mood: number;
    energy: number;
    stress: number;
  };
}

interface CameraAnalysisProps {
  sessionId: string;
  onAnalysisComplete: (analysis: CameraAnalysisResult) => void;
  onCancel: () => void;
}

export function CameraAnalysis({ sessionId, onAnalysisComplete, onCancel }: CameraAnalysisProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<CameraAnalysisResult | null>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCapturing(true);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to access camera";
      toast.error(message);
      onCancel();
    }
  }, [onCancel]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  }, []);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    stopCamera();
  }, [stopCamera]);

  // Analyze captured image
  const analyzeImage = useCallback(async () => {
    if (!capturedImage) return;

    setIsAnalyzing(true);
    try {
      // Convert data URL to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'emotional-checkin.jpg', { type: 'image/jpeg' });

      // Analyze using emotional check-in service
      const result = await emotionalCheckInService.analyzeCameraImage(sessionId, file);

      setAnalysisResult(result);
      onAnalysisComplete(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to analyze image";
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [capturedImage, sessionId, onAnalysisComplete]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setAnalysisResult(null);
    startCamera();
  }, [startCamera]);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl mx-4 bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Camera Analysis</h3>
          <button
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {!capturedImage ? (
              // Camera View
              <motion.div
                key="camera"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {!isCapturing && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-400 text-center">
                  Position your face in the frame. We&apos;ll analyze facial expressions and mood indicators.
                </p>

                <div className="flex gap-3">
                  <Button
                    onClick={capturePhoto}
                    disabled={!isCapturing}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                  <Button
                    onClick={() => {
                      stopCamera();
                      onCancel();
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            ) : !analysisResult ? (
              // Preview & Analysis
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                </div>

                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    <p className="text-slate-400">Analyzing facial expressions and mood indicators...</p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      onClick={analyzeImage}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                    >
                      Analyze Image
                    </Button>
                    <Button
                      onClick={retakePhoto}
                      variant="outline"
                      className="flex-1"
                    >
                      Retake
                    </Button>
                  </div>
                )}
              </motion.div>
            ) : (
              // Analysis Results
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">Analysis Complete</span>
                </div>

                <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Facial Expression</p>
                    <p className="text-white">{analysisResult.moodIndicators.facialExpression}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Energy Level</p>
                    <p className="text-white">{analysisResult.moodIndicators.energyLevel}</p>
                  </div>
                  {analysisResult.moodIndicators.stressIndicators.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Stress Indicators</p>
                      <ul className="list-disc list-inside text-white text-sm space-y-1">
                        {analysisResult.moodIndicators.stressIndicators.map((indicator: string, idx: number) => (
                          <li key={idx}>{indicator}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      stopCamera();
                      onCancel();
                    }}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                  >
                    Use This Analysis
                  </Button>
                  <Button
                    onClick={retakePhoto}
                    variant="outline"
                    className="flex-1"
                  >
                    Retake
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </div>
  );
}

