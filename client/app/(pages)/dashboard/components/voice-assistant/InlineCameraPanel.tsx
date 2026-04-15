"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, Loader2, Check, AlertCircle, Image as ImageIcon } from "lucide-react";
import type { RefObject } from "react";

interface InlineCameraPanelProps {
  showInlineCamera: boolean;
  setShowInlineCamera: (show: boolean) => void;
  inlineCameraMode: "camera" | "upload";
  setInlineCameraMode: (mode: "camera" | "upload") => void;
  capturedImage: string | null;
  setCapturedImage: (image: string | null) => void;
  setImageFile: (file: File | null) => void;
  imageDescription: string;
  setImageDescription: (description: string) => void;
  analysisResult: string | null;
  isAnalyzing: boolean;
  cameraError: string | null;
  setCameraError: (error: string | null) => void;
  isCameraActive: boolean;
  setIsCameraActive: (active: boolean) => void;
  countdown: number | null;
  setShouldAutoCapture: (should: boolean) => void;
  setCountdown: (count: number | null) => void;
  inlineVideoRef: RefObject<HTMLVideoElement | null>;
  inlineCanvasRef: RefObject<HTMLCanvasElement | null>;
  inlineStreamRef: RefObject<MediaStream | null>;
  inlineFileInputRef: RefObject<HTMLInputElement | null>;
  startInlineCamera: () => Promise<void>;
  stopInlineCamera: () => void;
  captureInlinePhoto: () => void;
  analyzeInlineImage: () => Promise<void>;
  handleInlineFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function InlineCameraPanel({
  showInlineCamera,
  setShowInlineCamera,
  inlineCameraMode,
  setInlineCameraMode,
  capturedImage,
  setCapturedImage,
  setImageFile,
  imageDescription,
  setImageDescription,
  analysisResult,
  isAnalyzing,
  cameraError,
  setCameraError,
  isCameraActive,
  setIsCameraActive,
  countdown,
  setShouldAutoCapture,
  setCountdown,
  inlineVideoRef,
  inlineCanvasRef,
  inlineStreamRef,
  inlineFileInputRef,
  startInlineCamera,
  stopInlineCamera,
  captureInlinePhoto,
  analyzeInlineImage,
  handleInlineFileChange,
}: InlineCameraPanelProps) {
  if (!showInlineCamera) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 100, scale: 0.9 }}
        className="fixed top-20 right-4 sm:right-6 z-50 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <span className="text-white font-medium text-sm">
                {inlineCameraMode === "camera" ? "Camera" : "Image Upload"}
              </span>
            </div>
            <button
              onClick={() => {
                setShowInlineCamera(false);
                stopInlineCamera();
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg">
            <button
              onClick={() => {
                if (inlineCameraMode !== "camera") {
                  stopInlineCamera();
                  setCapturedImage(null);
                  setImageFile(null);
                  setInlineCameraMode("camera");
                  setTimeout(() => startInlineCamera(), 100);
                }
              }}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                inlineCameraMode === "camera"
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Camera className="w-3.5 h-3.5 inline mr-1.5" />
              Camera
            </button>
            <button
              onClick={() => {
                if (inlineCameraMode !== "upload") {
                  stopInlineCamera();
                  setCapturedImage(null);
                  setImageFile(null);
                  setInlineCameraMode("upload");
                }
              }}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                inlineCameraMode === "upload"
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Upload className="w-3.5 h-3.5 inline mr-1.5" />
              Upload
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Camera View */}
          {inlineCameraMode === "camera" && (
            <div className="space-y-3">
              {!capturedImage ? (
                <div className="relative aspect-[4/3] bg-slate-800 rounded-lg overflow-hidden">
                  {isCameraActive ? (
                    <>
                      <video
                        ref={(el) => {
                          // Assign to ref directly - refs passed as props can be assigned to
                          const ref = inlineVideoRef as React.MutableRefObject<HTMLVideoElement | null>;
                          if (ref) {
                            ref.current = el;
                          }
                          // When video element mounts and we have a stored stream, attach it immediately
                          if (el && inlineStreamRef.current && !el.srcObject) {
                            console.log("[VoiceAssistant] Video element mounted via callback ref, attaching stored stream");
                            el.srcObject = inlineStreamRef.current;
                            el.autoplay = true;
                            el.playsInline = true;
                            el.muted = true;
                            el.setAttribute('playsinline', 'true');
                            el.setAttribute('webkit-playsinline', 'true');
                            el.play().then(() => {
                              console.log("[VoiceAssistant] Video playing after callback ref attachment");
                              setIsCameraActive(true);
                            }).catch((err) => {
                              console.warn("[VoiceAssistant] Play failed in callback ref:", err);
                            });
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        onLoadedMetadata={(e) => {
                          const video = e.currentTarget;
                          console.log("[VoiceAssistant] Video metadata loaded in render");
                          if (video.paused) {
                            video.play().catch((err) => {
                              console.warn("[VoiceAssistant] Play failed in onLoadedMetadata:", err);
                            });
                          }
                        }}
                        onCanPlay={(e) => {
                          const video = e.currentTarget;
                          console.log("[VoiceAssistant] Video can play in render");
                          if (video.paused) {
                            video.play().catch((err) => {
                              console.warn("[VoiceAssistant] Play failed in onCanPlay:", err);
                            });
                          }
                        }}
                        onPlay={() => {
                          console.log("[VoiceAssistant] Video playing in render");
                        }}
                        onError={(e) => {
                          console.error("[VoiceAssistant] Video error in render:", e);
                          setCameraError("Video playback error. Please try again.");
                        }}
                      />
                      <canvas ref={inlineCanvasRef} className="hidden" />
                      
                      {/* Countdown overlay */}
                      {countdown !== null && countdown > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <div className="text-center">
                            <div className="text-6xl font-bold text-white mb-2">{countdown}</div>
                            <div className="text-white/80 text-sm">Taking picture...</div>
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute inset-0 flex items-end justify-center p-4">
                        <button
                          onClick={() => {
                            setShouldAutoCapture(false);
                            setCountdown(null);
                            captureInlinePhoto();
                          }}
                          disabled={!isCameraActive}
                          className="w-14 h-14 rounded-full bg-white border-4 border-slate-300 shadow-lg hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          <Camera className="w-6 h-6 text-slate-800" />
                        </button>
                      </div>
                    </>
                  ) : cameraError ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center p-4">
                        <Camera className="w-12 h-12 mx-auto mb-4 text-red-400" />
                        <p className="text-red-400 text-sm mb-4">{cameraError}</p>
                        <button
                          onClick={() => {
                            setCameraError(null);
                            startInlineCamera();
                          }}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-2" />
                        <p className="text-slate-400 text-sm mb-4">Starting camera...</p>
                        <button
                          onClick={() => {
                            console.log("[VoiceAssistant] Manual camera start triggered");
                            startInlineCamera();
                          }}
                          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition-colors"
                        >
                          Start Camera
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-[4/3] bg-slate-800 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      setImageFile(null);
                      if (inlineCameraMode === "camera") {
                        startInlineCamera();
                      }
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upload View */}
          {inlineCameraMode === "upload" && (
            <div className="space-y-3">
              {!capturedImage ? (
                <div
                  onClick={() => inlineFileInputRef.current?.click()}
                  className="relative aspect-[4/3] bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 hover:bg-slate-800 transition-colors"
                >
                  <input
                    ref={inlineFileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleInlineFileChange}
                    className="hidden"
                  />
                  <Upload className="w-12 h-12 mb-4 text-slate-400" />
                  <p className="text-slate-400 mb-1 text-sm">Click to upload</p>
                  <p className="text-slate-500 text-xs">JPEG, PNG, WebP (max 10MB)</p>
                </div>
              ) : (
                <div className="relative aspect-[4/3] bg-slate-800 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedImage}
                    alt="Uploaded"
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      setImageFile(null);
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {cameraError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs">{cameraError}</p>
            </div>
          )}

          {/* Optional Description Input */}
          {capturedImage && !analysisResult && (
            <div className="space-y-2">
              <label className="text-xs text-white/70 font-medium">
                What would you like me to analyze? (Optional)
              </label>
              <textarea
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value)}
                placeholder="e.g., Check my posture, analyze my form, what's in this food, body progress..."
                className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                rows={2}
                maxLength={200}
              />
              <p className="text-xs text-white/40 text-right">
                {imageDescription.length}/200
              </p>
            </div>
          )}

          {/* Analysis Result */}
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-slate-300 text-xs whitespace-pre-wrap">{analysisResult}</p>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowInlineCamera(false);
                stopInlineCamera();
              }}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
            >
              {analysisResult ? "Close" : "Cancel"}
            </button>
            {capturedImage && !analysisResult && (
              <button
                onClick={analyzeInlineImage}
                disabled={isAnalyzing}
                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    Analyze
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

