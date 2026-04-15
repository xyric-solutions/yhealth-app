"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  Upload,
  X,
  Loader2,
  Check,
  AlertCircle,
  Image as ImageIcon,
  VideoOff,
} from "lucide-react";
import { aiCoachService } from "@/src/shared/services/ai-coach.service";
import toast from "react-hot-toast";
import Image from "next/image";

interface ImageAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete?: (analysis: string, imageUrl?: string) => void;
  mode?: "camera" | "upload"; // Initial mode
  conversationId?: string; // Optional conversation ID for RAG chat
}

export function ImageAnalysisModal({
  isOpen,
  onClose,
  onAnalysisComplete,
  mode = "upload",
  conversationId,
}: ImageAnalysisModalProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<"camera" | "upload">(mode);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializedRef = useRef(false);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Handle camera mode
  const startCamera = useCallback(async () => {
    // Prevent multiple simultaneous starts
    if (streamRef.current || isCameraActive) {
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = mediaStream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      const error = err as Error;
      console.error("[ImageAnalysisModal] Camera error:", error);
      toast.error("Could not access camera. Please check permissions.");
      setError(error.message || "Camera access denied");
      setCurrentMode("upload"); // Fallback to upload mode
    }
  }, [isCameraActive]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsCameraActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);

        setImageFile(file);
        setCapturedImage(url);
        stopCamera();
      },
      "image/jpeg",
      0.95
    );
  }, [stopCamera]);

  // Handle file upload
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (!file.type.startsWith("image/")) {
          toast.error("Please select an image file");
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error("Image too large. Maximum size is 10MB");
          return;
        }

        setImageFile(file);
        const url = URL.createObjectURL(file);
        setCapturedImage(url);
        setError(null);
      }
      if (e.target) {
        e.target.value = "";
      }
    },
    []
  );

  // Analyze image
  const handleAnalyze = useCallback(async () => {
    if (!imageFile) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      console.log("[ImageAnalysisModal] Starting image analysis...", { 
        fileName: imageFile.name, 
        fileSize: imageFile.size,
        conversationId 
      });
      
      // Use AI coach service for analysis
      const result = await aiCoachService.analyzeImage(imageFile);
      
      console.log("[ImageAnalysisModal] Image analysis result:", result);
      
      // result.analysis is an ImageAnalysisResult object with an 'analysis' string property
      // result.response is a string response
      let analysisText: string;
      if (typeof result.analysis === 'string') {
        analysisText = result.analysis;
      } else if (result.analysis && typeof result.analysis === 'object' && 'analysis' in result.analysis) {
        analysisText = result.analysis.analysis || result.response || "Analysis completed";
      } else {
        analysisText = result.response || "Analysis completed";
      }
      
      if (!analysisText || analysisText === "Analysis completed") {
        console.warn("[ImageAnalysisModal] No analysis text found in result:", result);
        throw new Error("Analysis completed but no analysis text was returned");
      }
      
      console.log("[ImageAnalysisModal] Extracted analysis text:", analysisText.substring(0, 100) + "...");
      setAnalysisResult(analysisText);

      if (onAnalysisComplete) {
        onAnalysisComplete(analysisText, result.imageUrl);
      }
    } catch (err: unknown) {
      console.error("[ImageAnalysisModal] Image analysis error:", err);
      
      let errorMessage = "Unable to analyze this image";
      
      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();
        
        // Provide more specific error messages
        if (errMsg.includes('not related to health') || 
            errMsg.includes('not health-related') || 
            errMsg.includes('invalid health image') ||
            errMsg.includes('image not related') ||
            errMsg.includes('rejected')) {
          errorMessage = "This image doesn't appear to be health-related. Please upload:\n• Body/physique photos\n• Food/meal photos\n• Fitness progress images\n• Medical documents (lab results, etc.)";
        } else if (errMsg.includes('human person') || errMsg.includes('does not contain a human')) {
          errorMessage = "Please upload a photo that contains a person for body/fitness analysis, or a food photo for nutrition analysis.";
        } else if (errMsg.includes('vision api not available') || errMsg.includes('vision api')) {
          errorMessage = "Image analysis service is temporarily unavailable. Please try again later.";
        } else if (errMsg.includes('file too large') || errMsg.includes('size')) {
          errorMessage = "Image file is too large. Maximum size is 10MB.";
        } else if (errMsg.includes('invalid file type') || errMsg.includes('file type')) {
          errorMessage = "Invalid file type. Please upload JPEG, PNG, WebP, or HEIC images.";
        } else if (errMsg.includes('failed to validate') || errMsg.includes('could not classify')) {
          errorMessage = "Could not process this image. Please try a different image or check if the image is clear and health-related.";
        } else {
          errorMessage = err.message || "Unable to analyze this image. Please try again.";
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageFile, conversationId, onAnalysisComplete]);

  // Reset state
  const handleReset = useCallback(() => {
    setCapturedImage(null);
    setImageFile(null);
    setAnalysisResult(null);
    setError(null);
    // Stop camera directly without dependency
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsCameraActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    stopCamera();
    handleReset();
    onClose();
  }, [stopCamera, handleReset, onClose]);

  // Initialize modal when opened
  useEffect(() => {
    if (isOpen && !isInitializedRef.current) {
      setCurrentMode(mode);
      isInitializedRef.current = true;
      if (mode === "camera") {
        startCamera();
      }
    } else if (!isOpen && isInitializedRef.current) {
      stopCamera();
      handleReset();
      isInitializedRef.current = false;
    }
  }, [isOpen, mode, startCamera, stopCamera, handleReset]);

  // Handle mode changes when modal is already open
  useEffect(() => {
    if (!isOpen || !isInitializedRef.current) return;

    if (currentMode === "camera" && !isCameraActive && !streamRef.current && !capturedImage) {
      startCamera();
    } else if (currentMode === "upload" && streamRef.current) {
      stopCamera();
    }
  }, [currentMode, isOpen, isCameraActive, startCamera, stopCamera, capturedImage]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Camera className="w-6 h-6" />
            Image Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg">
            <button
              onClick={() => {
                setCurrentMode("upload");
                stopCamera();
                handleReset();
              }}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentMode === "upload"
                  ? "bg-violet-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Upload
            </button>
            <button
              onClick={() => {
                setCurrentMode("camera");
                handleReset();
                startCamera();
              }}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentMode === "camera"
                  ? "bg-violet-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Camera className="w-4 h-4 inline mr-2" />
              Camera
            </button>
          </div>

          {/* Camera View */}
          {currentMode === "camera" && (
            <div className="space-y-4">
              {!capturedImage ? (
                <div className="relative aspect-[4/3] bg-slate-800 rounded-xl overflow-hidden">
                  {isCameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 flex items-end justify-center p-6">
                        <button
                          onClick={capturePhoto}
                          disabled={!isCameraActive}
                          className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 shadow-lg hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Camera className="w-8 h-8 mx-auto text-slate-800" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <VideoOff className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                        <p className="text-slate-400 mb-4">Camera not active</p>
                        <button
                          onClick={startCamera}
                          className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors"
                        >
                          Start Camera
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-[4/3] bg-slate-800 rounded-xl overflow-hidden">
                  <Image
                    src={capturedImage}
                    alt="Captured image"
                    fill
                    className="object-contain"
                  />
                  <button
                    onClick={handleReset}
                    className="absolute top-4 right-4 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upload View */}
          {currentMode === "upload" && (
            <div className="space-y-4">
              {!capturedImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative aspect-[4/3] bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-violet-500/50 hover:bg-slate-800 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-12 h-12 mb-4 text-slate-400" />
                  <p className="text-slate-400 mb-1">Click to upload or drag and drop</p>
                  <p className="text-slate-500 text-sm">
                    JPEG, PNG, WebP, or HEIC (max 10MB)
                  </p>
                </div>
              ) : (
                <div className="relative aspect-[4/3] bg-slate-800 rounded-xl overflow-hidden">
                  <Image
                    src={capturedImage}
                    alt="Uploaded image"
                    fill
                    className="object-contain"
                  />
                  <button
                    onClick={handleReset}
                    className="absolute top-4 right-4 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 font-medium">Analysis Error</p>
                <p className="text-red-300 text-sm mt-1 whitespace-pre-line">{error}</p>
              </div>
            </div>
          )}

          {/* Analysis Result */}
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-400 font-medium mb-2">Analysis Complete</p>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">
                    {analysisResult}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              {analysisResult ? "Close" : "Cancel"}
            </button>
            {capturedImage && !analysisResult && (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex-1 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    Analyze Image
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

