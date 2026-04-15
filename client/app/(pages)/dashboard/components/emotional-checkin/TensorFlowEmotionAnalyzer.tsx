"use client";

/**
 * TensorFlow.js Real-Time Emotion Analyzer
 * Uses BlazeFace for face detection (better browser/Turbopack compatibility)
 * Processes entirely on-device for privacy and speed
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Eye,
  Activity,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// ============================================
// TYPES
// ============================================

// TensorFlow.js module type - matches the dynamically imported module structure
interface TensorFlowModule {
  setBackend: (backend: string) => Promise<boolean>;
  ready: () => Promise<void>;
  loadLayersModel: (pathOrIOHandler: string) => Promise<LayersModel>;
  tensor4d: (values: Float32Array, shape: number[]) => TensorLike & { dispose: () => void };
  [key: string]: unknown;
}

// BlazeFace model type - matches the actual model interface
interface BlazeFaceModel {
  estimateFaces: (
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    returnTensors?: boolean
  ) => Promise<Array<{
    topLeft: [number, number] | unknown;
    bottomRight: [number, number] | unknown;
    landmarks: Array<[number, number]> | unknown;
    probability: number;
    [key: string]: unknown;
  }>>;
  [key: string]: unknown;
}

// TensorFlow LayersModel type - matches the actual model interface
interface LayersModel {
  predict: (...args: unknown[]) => TensorLike;
  dispose?: () => void;
  [key: string]: unknown;
}

// TensorFlow Tensor-like type - matches what predict() returns
interface TensorLike {
  data: () => Promise<Float32Array | Int32Array | Uint8Array>;
  dispose: () => void;
  [key: string]: unknown;
}

// BlazeFace detection result type
interface BlazeFaceDetection {
  topLeft: [number, number] | unknown;
  bottomRight: [number, number] | unknown;
  landmarks: Array<[number, number]> | unknown;
  probability: number;
  [key: string]: unknown;
}

const EMOTION_LABELS = [
  "angry",
  "disgust",
  "fear",
  "happy",
  "sad",
  "surprise",
  "neutral",
] as const;
type EmotionLabel = (typeof EMOTION_LABELS)[number];

interface EmotionSample {
  emotion: EmotionLabel;
  confidence: number;
  timestamp: number;
  stressIndicators: StressIndicators;
}

interface StressIndicators {
  browFurrow: number; // 0-1
  jawTension: number; // 0-1
  eyeStrain: number; // 0-1
}

interface AggregatedEmotions {
  dominant: EmotionLabel;
  distribution: Record<EmotionLabel, number>;
  engagement: number;
  stressIndicators: StressIndicators;
  averageConfidence: number;
  sampleCount: number;
}

interface TensorFlowEmotionAnalyzerProps {
  sessionId: string;
  onAnalysisComplete: (results: AggregatedEmotions) => void;
  onCancel: () => void;
  analysisWindow?: number; // ms, default 20000 (20s)
  samplingRate?: number; // ms between samples, default 500
}

// ============================================
// EMOTION TO MOOD MAPPING
// ============================================

const EMOTION_MOOD_SCORES: Record<EmotionLabel, number> = {
  happy: 9,
  surprise: 7,
  neutral: 5,
  sad: 2,
  fear: 2,
  angry: 2,
  disgust: 1,
};

const EMOTION_COLORS: Record<EmotionLabel, string> = {
  happy: "bg-emerald-500",
  surprise: "bg-yellow-500",
  neutral: "bg-slate-400",
  sad: "bg-blue-500",
  fear: "bg-purple-500",
  angry: "bg-red-500",
  disgust: "bg-orange-500",
};

const EMOTION_ICONS: Record<EmotionLabel, string> = {
  happy: "😊",
  surprise: "😮",
  neutral: "😐",
  sad: "😢",
  fear: "😨",
  angry: "😠",
  disgust: "🤢",
};

// ============================================
// COMPONENT
// ============================================

export function TensorFlowEmotionAnalyzer({
  sessionId: _sessionId,
  onAnalysisComplete,
  onCancel,
  analysisWindow = 20000,
  samplingRate = 500,
}: TensorFlowEmotionAnalyzerProps) {
  // State
  const [status, setStatus] = useState<
    "loading" | "ready" | "analyzing" | "complete" | "error"
  >("loading");
  const [loadingMessage, setLoadingMessage] = useState("Initializing camera...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionSample | null>(
    null
  );
  const [results, setResults] = useState<AggregatedEmotions | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const emotionHistoryRef = useRef<EmotionSample[]>([]);
  const startTimeRef = useRef<number | undefined>(undefined);
  const modelLoadedRef = useRef(false);

  // TensorFlow refs
  const tfRef = useRef<TensorFlowModule | null>(null);
  const blazeFaceRef = useRef<BlazeFaceModel | null>(null);
  const emotionModelRef = useRef<LayersModel | null>(null);

  // ============================================
  // MODEL LOADING
  // ============================================

  const loadModels = useCallback(async () => {
    try {
      setLoadingMessage("Loading TensorFlow.js...");

      // Dynamically import TensorFlow.js
      const tf = await import("@tensorflow/tfjs");
      tfRef.current = tf as unknown as TensorFlowModule;

      // Set WebGL backend for GPU acceleration
      await tf.setBackend("webgl");
      await tf.ready();

      setLoadingMessage("Loading face detection model...");

      // Load BlazeFace - lightweight face detector with better compatibility
      const blazeface = await import("@tensorflow-models/blazeface");
      blazeFaceRef.current = (await blazeface.load()) as unknown as BlazeFaceModel;

      setLoadingMessage("Loading emotion recognition model...");

      // Try to load custom emotion model, fallback to heuristic-based
      try {
        emotionModelRef.current = (await tf.loadLayersModel(
          "/models/emotion/model.json"
        )) as unknown as LayersModel;
      } catch (_modelError) {
        console.warn(
          "Custom emotion model not found, using heuristic-based detection"
        );
        emotionModelRef.current = null;
      }

      modelLoadedRef.current = true;
      setLoadingMessage("Models loaded successfully!");
    } catch (error) {
      console.error("Model loading error:", error);
      throw new Error("Failed to load emotion detection models");
    }
  }, []);

  // ============================================
  // CAMERA SETUP
  // ============================================

  const startCamera = useCallback(async () => {
    try {
      setLoadingMessage("Accessing camera...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      // Store the stream - it will be attached to video in useEffect
      streamRef.current = stream;
      console.log("[Camera] Stream obtained:", stream.getVideoTracks()[0]?.label);

    } catch (error: unknown) {
      console.error("[Camera] Error:", error);
      const errorMessage = error instanceof Error
        ? (error.name === "NotAllowedError"
          ? "Camera access denied. Please enable camera permissions."
          : "Failed to access camera: " + error.message)
        : "Failed to access camera";
      throw new Error(errorMessage);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  // ============================================
  // EMOTION DETECTION
  // ============================================

  const detectEmotion = useCallback(async (): Promise<EmotionSample | null> => {
    if (
      !videoRef.current ||
      !blazeFaceRef.current ||
      !tfRef.current
    ) {
      return null;
    }

    const video = videoRef.current;
    const tf = tfRef.current;

    try {
      // Detect faces using BlazeFace
      const faces = await blazeFaceRef.current.estimateFaces(video, false);

      if (faces.length === 0) {
        setFaceDetected(false);
        return null;
      }

      setFaceDetected(true);
      const face = faces[0];

      // BlazeFace provides: topLeft, bottomRight, landmarks (6 points), probability
      // landmarks: [rightEye, leftEye, nose, mouth, rightEar, leftEar]
      const landmarks = face.landmarks as number[][];

      // Calculate stress indicators from BlazeFace landmarks
      const stressIndicators = calculateStressIndicatorsFromBlazeFace(face, landmarks);

      // Determine emotion
      let emotion: EmotionLabel;
      let confidence: number;

      if (emotionModelRef.current) {
        // Use ML model for emotion classification
        const result = await classifyEmotionWithModel(
          video,
          face,
          tf,
          emotionModelRef.current
        );
        emotion = result.emotion;
        confidence = result.confidence;
      } else {
        // Use heuristic-based emotion detection
        const result = classifyEmotionFromBlazeFace(face, landmarks, stressIndicators);
        emotion = result.emotion;
        confidence = result.confidence;
      }

      // Draw face overlay
      drawFaceOverlay(face, emotion);

      return {
        emotion,
        confidence,
        timestamp: Date.now(),
        stressIndicators,
      };
    } catch (error) {
      console.error("Emotion detection error:", error);
      return null;
    }
  }, []);

  // ============================================
  // ANALYSIS LOOP
  // ============================================

  const startAnalysis = useCallback(() => {
    startTimeRef.current = Date.now();
    emotionHistoryRef.current = [];
    setStatus("analyzing");

    let lastSampleTime = 0;

    const analyze = async () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current!;

      setProgress(Math.min(100, (elapsed / analysisWindow) * 100));

      // Sample at specified rate
      if (now - lastSampleTime >= samplingRate) {
        const result = await detectEmotion();
        if (result) {
          emotionHistoryRef.current.push(result);
          setCurrentEmotion(result);
        }
        lastSampleTime = now;
      }

      // Check if analysis window complete
      if (elapsed >= analysisWindow) {
        const aggregated = aggregateResults(emotionHistoryRef.current);
        setResults(aggregated);
        setStatus("complete");
        // Show success page with emotion distribution and stress indicators.
        // User must click "Use This Analysis" to submit and close - do not auto-call onAnalysisComplete.
        return;
      }

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  }, [analysisWindow, samplingRate, detectEmotion]);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  function calculateStressIndicatorsFromBlazeFace(
    face: BlazeFaceDetection,
    landmarks: number[][]
  ): StressIndicators {
    // BlazeFace landmarks: [rightEye, leftEye, nose, mouth, rightEar, leftEar]
    // Estimate stress indicators from face geometry

    const topLeft = face.topLeft as [number, number];
    const bottomRight = face.bottomRight as [number, number];
    const faceWidth = bottomRight[0] - topLeft[0];
    const faceHeight = bottomRight[1] - topLeft[1];

    // Eye positions
    const rightEye = landmarks[0];
    const leftEye = landmarks[1];
    const mouth = landmarks[3];

    // Brow furrow: estimated from how close eyes are to top of face
    // When brows furrow, eyes appear lower relative to face top
    const eyeY = (rightEye[1] + leftEye[1]) / 2;
    const eyeToTopRatio = (eyeY - topLeft[1]) / faceHeight;
    // Normal ratio is ~0.3-0.35, higher indicates furrow
    const browFurrow = Math.max(0, Math.min(1, (eyeToTopRatio - 0.28) * 4));

    // Jaw tension: estimated from mouth-to-chin distance and face compression
    // Tense jaw = mouth closer to chin, face appears more compressed
    const mouthY = mouth[1];
    const mouthToBottomRatio = (bottomRight[1] - mouthY) / faceHeight;
    // Normal ratio is ~0.25-0.3, smaller indicates tension
    const jawTension = Math.max(0, Math.min(1, (0.32 - mouthToBottomRatio) * 5));

    // Eye strain: estimated from eye distance deviation and vertical eye position variance
    const eyeDistance = Math.sqrt(
      Math.pow(leftEye[0] - rightEye[0], 2) +
      Math.pow(leftEye[1] - rightEye[1], 2)
    );
    const normalizedEyeDistance = eyeDistance / faceWidth;
    // Normal is ~0.38-0.42, deviation indicates squinting or strain
    const eyeDistanceDeviation = Math.abs(normalizedEyeDistance - 0.4);

    // Also check eye vertical alignment (asymmetry indicates strain)
    const eyeVerticalDiff = Math.abs(rightEye[1] - leftEye[1]) / faceHeight;

    const eyeStrain = Math.max(0, Math.min(1, eyeDistanceDeviation * 3 + eyeVerticalDiff * 5));

    return { browFurrow, jawTension, eyeStrain };
  }

  async function classifyEmotionWithModel(
    video: HTMLVideoElement,
    face: BlazeFaceDetection,
    tf: TensorFlowModule,
    model: LayersModel
  ): Promise<{ emotion: EmotionLabel; confidence: number }> {
    const canvas = canvasRef.current;
    if (!canvas) return { emotion: "neutral", confidence: 0.5 };

    const ctx = canvas.getContext("2d");
    if (!ctx) return { emotion: "neutral", confidence: 0.5 };

    const topLeft = face.topLeft as [number, number];
    const bottomRight = face.bottomRight as [number, number];
    const width = bottomRight[0] - topLeft[0];
    const height = bottomRight[1] - topLeft[1];

    // Draw face region to canvas (48x48 for FER-2013 models)
    canvas.width = 48;
    canvas.height = 48;

    ctx.drawImage(
      video,
      topLeft[0],
      topLeft[1],
      width,
      height,
      0,
      0,
      48,
      48
    );

    // Convert to grayscale tensor
    const imageData = ctx.getImageData(0, 0, 48, 48);
    const grayscale = new Float32Array(48 * 48);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const idx = i / 4;
      grayscale[idx] =
        (0.299 * imageData.data[i] +
          0.587 * imageData.data[i + 1] +
          0.114 * imageData.data[i + 2]) /
        255;
    }

    // Run model
    const tensor = tf.tensor4d(grayscale, [1, 48, 48, 1]);
    const predictions = model.predict(tensor) as TensorLike;
    const scores = await predictions.data();

    tensor.dispose();
    predictions.dispose();

    // Find max
    let maxIdx = 0;
    let maxScore = scores[0];
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > maxScore) {
        maxScore = scores[i];
        maxIdx = i;
      }
    }

    return {
      emotion: EMOTION_LABELS[maxIdx],
      confidence: maxScore,
    };
  }

  function classifyEmotionFromBlazeFace(
    face: BlazeFaceDetection,
    landmarks: number[][],
    stress: StressIndicators
  ): { emotion: EmotionLabel; confidence: number } {
    // Heuristic-based emotion detection from BlazeFace landmarks
    // landmarks: [rightEye, leftEye, nose, mouth, rightEar, leftEar]
    // NOTE: BlazeFace has limited landmarks, so this is approximate

    const { browFurrow, jawTension, eyeStrain } = stress;

    const topLeft = face.topLeft as [number, number];
    const bottomRight = face.bottomRight as [number, number];
    const faceWidth = bottomRight[0] - topLeft[0];
    const faceHeight = bottomRight[1] - topLeft[1];

    // Face aspect ratio (width/height)
    const aspectRatio = faceWidth / faceHeight;

    // Mouth and eye positions
    const mouth = landmarks[3];
    const rightEye = landmarks[0];
    const leftEye = landmarks[1];
    const nose = landmarks[2];

    // Calculate key metrics
    const eyeY = (rightEye[1] + leftEye[1]) / 2;
    const eyeToMouth = mouth[1] - eyeY;
    const eyeToMouthRatio = eyeToMouth / faceHeight;

    // Mouth position relative to nose (vertical offset)
    const noseToMouth = mouth[1] - nose[1];
    const noseToMouthRatio = noseToMouth / faceHeight;

    // Eye distance (can indicate squinting or wide eyes)
    const eyeDistance = Math.sqrt(
      Math.pow(leftEye[0] - rightEye[0], 2) +
      Math.pow(leftEye[1] - rightEye[1], 2)
    );
    const normalizedEyeDistance = eyeDistance / faceWidth;

    // Mouth width approximation (BlazeFace doesn't give mouth corners)
    // Using face aspect ratio as proxy for smile (face appears wider when smiling)

    // Score each emotion (0-1 scale)
    const scores: Record<EmotionLabel, number> = {
      neutral: 0.4, // Base score - most common state
      happy: 0,
      sad: 0,
      angry: 0,
      surprise: 0,
      fear: 0,
      disgust: 0,
    };

    // HAPPY: Wider face (smile stretches face), low stress indicators
    // Smiling typically increases face width ratio and reduces eye-to-mouth ratio
    if (aspectRatio > 0.85 && browFurrow < 0.25 && jawTension < 0.3) {
      scores.happy = 0.3 + (aspectRatio - 0.85) * 2;
    }
    // Boost if face is notably wide (strong smile)
    if (aspectRatio > 0.95) {
      scores.happy += 0.2;
    }

    // SAD: Longer face, higher stress, mouth lower
    if (aspectRatio < 0.75 && noseToMouthRatio > 0.18) {
      scores.sad = 0.3 + (0.75 - aspectRatio) * 1.5;
    }
    if (browFurrow > 0.35) {
      scores.sad += browFurrow * 0.3;
    }

    // ANGRY: Furrowed brow + tense jaw, compressed face
    if (browFurrow > 0.4 && jawTension > 0.35) {
      scores.angry = 0.4 + browFurrow * 0.3 + jawTension * 0.2;
    }
    // Squinted eyes (smaller eye distance ratio)
    if (normalizedEyeDistance < 0.35 && browFurrow > 0.3) {
      scores.angry += 0.2;
    }

    // SURPRISE: Taller face (open mouth), raised brows (low furrow), wide eyes
    if (aspectRatio < 0.72 && browFurrow < 0.2 && eyeToMouthRatio > 0.42) {
      scores.surprise = 0.4 + (0.72 - aspectRatio) * 2;
    }
    // Wide eyes indicator
    if (normalizedEyeDistance > 0.42 && browFurrow < 0.25) {
      scores.surprise += 0.2;
    }

    // FEAR: Wide eyes + raised brows + tension
    if (eyeStrain > 0.35 && normalizedEyeDistance > 0.4 && browFurrow > 0.2 && browFurrow < 0.5) {
      scores.fear = 0.3 + eyeStrain * 0.3 + (normalizedEyeDistance - 0.4) * 2;
    }

    // DISGUST: Asymmetric face, nose wrinkle (estimated from stress)
    if (browFurrow > 0.3 && jawTension > 0.25 && aspectRatio > 0.78 && aspectRatio < 0.88) {
      scores.disgust = 0.2 + browFurrow * 0.2 + jawTension * 0.2;
    }

    // Find dominant emotion
    let maxEmotion: EmotionLabel = "neutral";
    let maxScore = scores.neutral;

    for (const [emotion, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion as EmotionLabel;
      }
    }

    // If no strong signal, default to neutral
    if (maxScore < 0.45) {
      maxEmotion = "neutral";
      maxScore = 0.5 + (0.45 - maxScore);
    }

    // Confidence based on how much the winner exceeds others
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const confidenceBoost = sortedScores[0] - sortedScores[1];
    const confidence = Math.min(0.85, Math.max(0.4, maxScore + confidenceBoost * 0.5));

    return { emotion: maxEmotion, confidence };
  }

  function drawFaceOverlay(face: BlazeFaceDetection, emotion: EmotionLabel) {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const topLeft = face.topLeft as [number, number];
    const bottomRight = face.bottomRight as [number, number];
    const width = bottomRight[0] - topLeft[0];
    const height = bottomRight[1] - topLeft[1];

    // Draw face bounding box
    const colorMap: Record<EmotionLabel, string> = {
      happy: "rgba(16, 185, 129, 0.6)",
      surprise: "rgba(234, 179, 8, 0.6)",
      neutral: "rgba(148, 163, 184, 0.6)",
      sad: "rgba(59, 130, 246, 0.6)",
      fear: "rgba(168, 85, 247, 0.6)",
      angry: "rgba(239, 68, 68, 0.6)",
      disgust: "rgba(249, 115, 22, 0.6)",
    };

    ctx.strokeStyle = colorMap[emotion];
    ctx.lineWidth = 3;
    ctx.strokeRect(topLeft[0], topLeft[1], width, height);

    // Draw corner accents
    const cornerSize = 20;
    ctx.fillStyle = colorMap[emotion];

    // Top-left corner
    ctx.fillRect(topLeft[0], topLeft[1], cornerSize, 3);
    ctx.fillRect(topLeft[0], topLeft[1], 3, cornerSize);

    // Top-right corner
    ctx.fillRect(bottomRight[0] - cornerSize, topLeft[1], cornerSize, 3);
    ctx.fillRect(bottomRight[0] - 3, topLeft[1], 3, cornerSize);

    // Bottom-left corner
    ctx.fillRect(topLeft[0], bottomRight[1] - 3, cornerSize, 3);
    ctx.fillRect(topLeft[0], bottomRight[1] - cornerSize, 3, cornerSize);

    // Bottom-right corner
    ctx.fillRect(bottomRight[0] - cornerSize, bottomRight[1] - 3, cornerSize, 3);
    ctx.fillRect(bottomRight[0] - 3, bottomRight[1] - cornerSize, 3, cornerSize);

    // Draw emotion label
    ctx.fillStyle = "white";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(
      `${EMOTION_ICONS[emotion]} ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}`,
      10,
      30
    );
  }

  function aggregateResults(history: EmotionSample[]): AggregatedEmotions {
    if (history.length === 0) {
      return {
        dominant: "neutral",
        distribution: Object.fromEntries(
          EMOTION_LABELS.map((e) => [e, e === "neutral" ? 1 : 0])
        ) as Record<EmotionLabel, number>,
        engagement: 0,
        stressIndicators: { browFurrow: 0, jawTension: 0, eyeStrain: 0 },
        averageConfidence: 0,
        sampleCount: 0,
      };
    }

    // Count emotions
    const counts = EMOTION_LABELS.reduce((acc, label) => {
      acc[label] = 0;
      return acc;
    }, {} as Record<EmotionLabel, number>);
    history.forEach((s) => counts[s.emotion]++);

    // Find dominant
    let dominant: EmotionLabel = "neutral";
    let maxCount = 0;
    EMOTION_LABELS.forEach((e) => {
      if (counts[e] > maxCount) {
        maxCount = counts[e];
        dominant = e;
      }
    });

    // Distribution
    const total = history.length;
    const distribution = {} as Record<EmotionLabel, number>;
    EMOTION_LABELS.forEach((e) => (distribution[e] = counts[e] / total));

    // Engagement (variance in emotions)
    const nonNeutralRatio = 1 - counts.neutral / total;
    const emotionVariance = EMOTION_LABELS.reduce((sum, e) => {
      const diff = distribution[e] - 1 / EMOTION_LABELS.length;
      return sum + diff * diff;
    }, 0);
    const engagement = Math.min(
      1,
      nonNeutralRatio * 0.7 + emotionVariance * 10 * 0.3
    );

    // Average stress indicators
    const avgStress = history.reduce(
      (acc, s) => ({
        browFurrow: acc.browFurrow + s.stressIndicators.browFurrow,
        jawTension: acc.jawTension + s.stressIndicators.jawTension,
        eyeStrain: acc.eyeStrain + s.stressIndicators.eyeStrain,
      }),
      { browFurrow: 0, jawTension: 0, eyeStrain: 0 }
    );

    return {
      dominant,
      distribution,
      engagement,
      stressIndicators: {
        browFurrow: avgStress.browFurrow / total,
        jawTension: avgStress.jawTension / total,
        eyeStrain: avgStress.eyeStrain / total,
      },
      averageConfidence:
        history.reduce((sum, s) => sum + s.confidence, 0) / total,
      sampleCount: total,
    };
  }

  // ============================================
  // EFFECTS
  // ============================================

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        await loadModels();
        await startCamera();
        setStatus("ready");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to initialize camera";
        setErrorMessage(message);
        setStatus("error");
      }
    };

    init();

    return () => {
      stopCamera();
      // Cleanup TensorFlow models
      if (emotionModelRef.current) {
        emotionModelRef.current.dispose?.();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach stream to video element when both are available
  useEffect(() => {
    const attachStream = async () => {
      if ((status === "ready" || status === "analyzing") &&
          videoRef.current &&
          streamRef.current &&
          videoRef.current.srcObject !== streamRef.current) {

        console.log("[Camera] Attaching stream to video element");
        videoRef.current.srcObject = streamRef.current;

        try {
          await videoRef.current.play();
          console.log("[Camera] Video playing");

          // Setup overlay canvas after video starts playing
          if (overlayCanvasRef.current && videoRef.current.videoWidth > 0) {
            overlayCanvasRef.current.width = videoRef.current.videoWidth;
            overlayCanvasRef.current.height = videoRef.current.videoHeight;
          }
        } catch (playError) {
          console.error("[Camera] Play error:", playError);
        }
      }
    };

    attachStream();
  }, [status]);

  // Preview face detection loop during ready state
  useEffect(() => {
    if (status !== "ready" || !blazeFaceRef.current || !videoRef.current) {
      return;
    }

    let previewActive = true;
    let frameId: number;

    const previewLoop = async () => {
      if (!previewActive || !videoRef.current || !blazeFaceRef.current) return;

      try {
        const faces = await blazeFaceRef.current.estimateFaces(videoRef.current, false);
        setFaceDetected(faces.length > 0);
      } catch (_e) {
        // Ignore errors during preview
      }

      if (previewActive) {
        frameId = requestAnimationFrame(() => {
          setTimeout(previewLoop, 200); // Check every 200ms
        });
      }
    };

    previewLoop();

    return () => {
      previewActive = false;
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [status]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm overflow-y-auto py-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-3xl mx-4 my-auto bg-[#0f0f18] rounded-2xl border border-white/[0.06] shadow-2xl max-h-[95vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
              <Brain className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                AI Emotion Analysis
              </h3>
              <p className="text-[11px] text-slate-500">
                Real-time facial expression detection
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {/* Loading State */}
            {status === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 space-y-8"
              >
                {/* Neural network animation */}
                <div className="relative w-32 h-32">
                  {/* Outer pulsing ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full border border-violet-500/20"
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  {/* Mid ring */}
                  <motion.div
                    className="absolute inset-3 rounded-full border border-pink-500/25"
                    animate={{
                      scale: [1, 1.1, 1],
                      opacity: [0.4, 0.7, 0.4],
                    }}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.3,
                    }}
                  />
                  {/* Inner ring */}
                  <motion.div
                    className="absolute inset-6 rounded-full border border-violet-400/30"
                    animate={{
                      scale: [1, 1.08, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.6,
                    }}
                  />
                  {/* Rotating arc */}
                  <motion.div
                    className="absolute inset-1 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent 0%, transparent 60%, rgba(139, 92, 246, 0.3) 80%, rgba(236, 72, 153, 0.4) 90%, transparent 100%)",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  {/* Center brain icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-white/[0.06]"
                      animate={{
                        boxShadow: [
                          "0 0 20px rgba(139, 92, 246, 0.15)",
                          "0 0 40px rgba(139, 92, 246, 0.3)",
                          "0 0 20px rgba(139, 92, 246, 0.15)",
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Brain className="w-6 h-6 text-violet-400" />
                    </motion.div>
                  </div>

                  {/* Floating particles */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 h-1.5 rounded-full"
                      style={{
                        background:
                          i % 2 === 0
                            ? "rgba(139, 92, 246, 0.6)"
                            : "rgba(236, 72, 153, 0.6)",
                        top: "50%",
                        left: "50%",
                      }}
                      animate={{
                        x: [0, Math.cos((i * Math.PI) / 3) * 52, 0],
                        y: [0, Math.sin((i * Math.PI) / 3) * 52, 0],
                        opacity: [0, 0.8, 0],
                        scale: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        delay: i * 0.4,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>

                {/* Text */}
                <div className="text-center space-y-2">
                  <motion.p
                    className="text-sm font-medium text-white"
                    key={loadingMessage}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {loadingMessage}
                  </motion.p>
                  <p className="text-[11px] text-slate-500">
                    Loading AI models for on-device emotion detection
                  </p>
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-6">
                  {[
                    { label: "TensorFlow", icon: "tf" },
                    { label: "BlazeFace", icon: "face" },
                    { label: "Camera", icon: "cam" },
                  ].map((step, i) => (
                    <motion.div
                      key={step.label}
                      className="flex items-center gap-2"
                      initial={{ opacity: 0.3 }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.7,
                      }}
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      <span className="text-[10px] font-medium text-slate-400">
                        {step.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Error State */}
            {status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 space-y-4"
              >
                <AlertCircle className="w-12 h-12 text-red-500" />
                <p className="text-slate-300">{errorMessage}</p>
                <Button
                  onClick={() => {
                    stopCamera();
                    onCancel();
                  }}
                  variant="outline"
                >
                  Close
                </Button>
              </motion.div>
            )}

            {/* Ready State */}
            {status === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden">
                  <video
                    ref={(el) => {
                      videoRef.current = el;
                      // Attach stream when video element becomes available
                      if (el && streamRef.current && el.srcObject !== streamRef.current) {
                        console.log("[Camera] Video ref callback - attaching stream");
                        el.srcObject = streamRef.current;
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      console.log("[Camera] Video metadata loaded");
                      const video = e.currentTarget;
                      video.play().catch(err => console.error("[Camera] Play failed:", err));
                      // Setup canvas dimensions
                      if (overlayCanvasRef.current && video.videoWidth > 0) {
                        overlayCanvasRef.current.width = video.videoWidth;
                        overlayCanvasRef.current.height = video.videoHeight;
                      }
                    }}
                    className="w-full h-full object-cover mirror-video"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {!faceDetected && (
                    <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <Eye className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <p className="text-slate-300 text-sm">
                          Position your face in the frame for detection
                        </p>
                      </div>
                    </div>
                  )}
                  {faceDetected && (
                    <div className="absolute bottom-4 left-4 right-4 bg-emerald-500/20 backdrop-blur border border-emerald-500/50 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <p className="text-emerald-300 text-sm">
                          Face detected! Ready to start analysis
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-sm text-slate-300 mb-2">
                    Ready to analyze your emotional state through facial
                    expressions.
                  </p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      All processing happens on your device (private)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Analysis takes ~20 seconds
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Keep your face visible and stay still
                    </li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={startAnalysis}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start Analysis
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
            )}

            {/* Analyzing State */}
            {status === "analyzing" && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden">
                  <video
                    ref={(el) => {
                      videoRef.current = el;
                      if (el && streamRef.current && el.srcObject !== streamRef.current) {
                        el.srcObject = streamRef.current;
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      video.play().catch(err => console.error("[Camera] Play failed:", err));
                      if (overlayCanvasRef.current && video.videoWidth > 0) {
                        overlayCanvasRef.current.width = video.videoWidth;
                        overlayCanvasRef.current.height = video.videoHeight;
                      }
                    }}
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ transform: "scaleX(-1)" }}
                  />

                  {/* Live emotion indicator */}
                  {currentEmotion && (
                    <div className="absolute top-4 right-4 bg-black/70 backdrop-blur rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {EMOTION_ICONS[currentEmotion.emotion]}
                        </span>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {currentEmotion.emotion.charAt(0).toUpperCase() +
                              currentEmotion.emotion.slice(1)}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {Math.round(currentEmotion.confidence * 100)}%
                            confidence
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Face not detected warning */}
                  {!faceDetected && (
                    <div className="absolute bottom-4 left-4 right-4 bg-amber-500/20 backdrop-blur border border-amber-500/50 rounded-lg p-3">
                      <p className="text-amber-200 text-sm text-center">
                        Face not detected - please stay in frame
                      </p>
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Analyzing emotions...</span>
                    <span className="text-slate-300">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {/* Live stats */}
                {currentEmotion && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                      <p className="text-xs text-slate-400 mb-1">Brow Tension</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${currentEmotion.stressIndicators.browFurrow * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-300">
                          {Math.round(
                            currentEmotion.stressIndicators.browFurrow * 100
                          )}
                          %
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                      <p className="text-xs text-slate-400 mb-1">Jaw Tension</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-pink-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${currentEmotion.stressIndicators.jawTension * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-300">
                          {Math.round(
                            currentEmotion.stressIndicators.jawTension * 100
                          )}
                          %
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                      <p className="text-xs text-slate-400 mb-1">Eye Strain</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-cyan-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${currentEmotion.stressIndicators.eyeStrain * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-300">
                          {Math.round(
                            currentEmotion.stressIndicators.eyeStrain * 100
                          )}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Complete State */}
            {status === "complete" && results && (
              <motion.div
                key="complete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Main result */}
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mb-4">
                    <span className="text-4xl">
                      {EMOTION_ICONS[results.dominant]}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {results.dominant.charAt(0).toUpperCase() +
                      results.dominant.slice(1)}
                  </h3>
                  <p className="text-slate-400">
                    Detected as your dominant emotion
                  </p>
                </div>

                {/* Emotion distribution */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">
                    Emotion Distribution
                  </h4>
                  <div className="space-y-2">
                    {EMOTION_LABELS.map((emotion) => (
                      <div key={emotion} className="flex items-center gap-3">
                        <span className="w-6 text-center">
                          {EMOTION_ICONS[emotion]}
                        </span>
                        <span className="w-20 text-xs text-slate-400 capitalize">
                          {emotion}
                        </span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                          <div
                            className={`${EMOTION_COLORS[emotion]} h-2 rounded-full transition-all`}
                            style={{
                              width: `${results.distribution[emotion] * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-10 text-xs text-slate-300 text-right">
                          {Math.round(results.distribution[emotion] * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-slate-300">Engagement</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {Math.round(results.engagement * 100)}%
                    </div>
                    <p className="text-xs text-slate-500">
                      Emotional expressiveness
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-slate-300">
                        Estimated Mood
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {EMOTION_MOOD_SCORES[results.dominant]}/10
                    </div>
                    <p className="text-xs text-slate-500">
                      Based on expressions
                    </p>
                  </div>
                </div>

                {/* Stress indicators */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">
                    Stress Indicators
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Brow Tension</p>
                      <p className="text-lg font-semibold text-white">
                        {Math.round(results.stressIndicators.browFurrow * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Jaw Tension</p>
                      <p className="text-lg font-semibold text-white">
                        {Math.round(results.stressIndicators.jawTension * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Eye Strain</p>
                      <p className="text-lg font-semibold text-white">
                        {Math.round(results.stressIndicators.eyeStrain * 100)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      stopCamera();
                      onAnalysisComplete(results);
                    }}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Use This Analysis
                  </Button>
                  <Button
                    onClick={() => {
                      setStatus("ready");
                      setResults(null);
                      setProgress(0);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Disclaimer */}
        <div className="px-6 pb-4">
          <p className="text-[10px] text-slate-500 text-center">
            This is a wellbeing check-in tool, not a clinical diagnosis. All
            analysis is performed locally on your device.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default TensorFlowEmotionAnalyzer;
