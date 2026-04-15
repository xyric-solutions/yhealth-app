'use client';

/**
 * @file MediaPipe PoseLandmarker hook
 * @description Lazy-loads @mediapipe/tasks-vision to avoid SSR issues and runs
 *              a requestAnimationFrame detection loop that provides normalised
 *              pose landmarks on every frame.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * CDN base for MediaPipe WASM files.
 * IMPORTANT: This version MUST match the installed @mediapipe/tasks-vision
 * package version in package-lock.json (currently 0.10.17).
 */
const MEDIAPIPE_WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';

/** CDN path for the lite pose landmarker model */
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export function useMediaPipe(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isActive: boolean,
) {
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Using `any` here is intentional: @mediapipe/tasks-vision is dynamically
  // imported and its PoseLandmarker type is not available at compile time.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poseLandmarkerRef = useRef<any>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(-1);

  const initMediaPipe = useCallback(async () => {
    if (poseLandmarkerRef.current || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const { PoseLandmarker, FilesetResolver } = await import(
        '@mediapipe/tasks-vision'
      );
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);

      // Try GPU first, fall back to CPU if unavailable
      try {
        poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: POSE_MODEL_URL,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          },
        );
      } catch (gpuErr) {
        console.warn('[MediaPipe] GPU delegate failed, falling back to CPU:', gpuErr);
        poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: POSE_MODEL_URL,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          },
        );
      }

      setIsLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading pose detection';
      console.error('[MediaPipe] Failed to initialize:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = poseLandmarkerRef.current;

    if (!video || !landmarker || video.readyState < 2) {
      rafIdRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const now = performance.now();
    // MediaPipe requires monotonically increasing timestamps
    if (now <= lastTimestampRef.current) {
      rafIdRef.current = requestAnimationFrame(detectLoop);
      return;
    }
    lastTimestampRef.current = now;

    try {
      const results = landmarker.detectForVideo(video, now);
      if (results?.landmarks?.[0]) {
        setLandmarks(results.landmarks[0] as NormalizedLandmark[]);
      } else {
        setLandmarks(null);
      }
    } catch {
      // Skip frame on detection error — MediaPipe occasionally throws
      // on dropped frames or GPU context switches
    }

    rafIdRef.current = requestAnimationFrame(detectLoop);
  }, [videoRef]);

  // Start/stop detection loop based on isActive and model readiness
  useEffect(() => {
    if (isActive && isLoaded) {
      lastTimestampRef.current = -1;
      rafIdRef.current = requestAnimationFrame(detectLoop);
    }
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isActive, isLoaded, detectLoop]);

  // Auto-initialize when camera becomes active
  useEffect(() => {
    if (isActive && !isLoaded && !isLoading) {
      initMediaPipe();
    }
  }, [isActive, isLoaded, isLoading, initMediaPipe]);

  // Cleanup on unmount — close the landmarker and cancel RAF
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
    };
  }, []);

  const retry = useCallback(() => {
    if (poseLandmarkerRef.current) {
      poseLandmarkerRef.current.close();
      poseLandmarkerRef.current = null;
    }
    setIsLoaded(false);
    setError(null);
    // Will re-trigger via the auto-init useEffect
  }, []);

  return { landmarks, isLoaded, isLoading, error, retry };
}
