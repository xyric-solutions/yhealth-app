'use client';

/**
 * @file Gemini AI Coach hook
 * @description Periodically sends video frames and joint angles to the
 *              server-side Gemini Vision coach for real-time pose feedback.
 *              Runs on an 8-second interval with an initial 3-second delay.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { CoachingResult, JointAngles } from '@shared/types/domain/yoga';
import { api } from '@/lib/api-client';
import { captureFrame } from '../utils/captureFrame';

/** Interval between coach analysis requests in milliseconds (15s for balanced coaching pace) */
const COACH_INTERVAL_MS = 15_000;

/** Initial delay before the first analysis request */
const INITIAL_DELAY_MS = 3000;

interface UseGeminiCoachParams {
  poseSlug: string;
  currentAngles: JointAngles;
  elapsedSeconds: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
}

interface CoachApiResponseData {
  coaching: CoachingResult;
  ttsText?: string;
}

export function useGeminiCoach({
  poseSlug,
  currentAngles,
  elapsedSeconds,
  videoRef,
  isActive,
}: UseGeminiCoachParams) {
  const [coaching, setCoaching] = useState<CoachingResult | null>(null);
  const [ttsText, setTtsText] = useState<string | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store latest values in refs to avoid stale closures in the interval callback
  const anglesRef = useRef(currentAngles);
  const elapsedRef = useRef(elapsedSeconds);
  anglesRef.current = currentAngles;
  elapsedRef.current = elapsedSeconds;

  const triggerAnalysis = useCallback(async () => {
    if (inFlightRef.current || !poseSlug || !videoRef.current) return;

    const frame = captureFrame(videoRef.current);
    if (!frame) return;

    inFlightRef.current = true;
    setIsAnalysing(true);
    setError(null);

    try {
      const response = await api.post<CoachApiResponseData>(
        '/v1/wellbeing/yoga/coach',
        {
          poseSlug,
          frameBase64: frame,
          currentAngles: anglesRef.current,
          elapsedSeconds: elapsedRef.current,
        },
      );

      if (response.success && response.data) {
        setCoaching(response.data.coaching);
        if (response.data.ttsText) setTtsText(response.data.ttsText);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setError(msg);
    } finally {
      inFlightRef.current = false;
      setIsAnalysing(false);
    }
  }, [poseSlug, videoRef]);

  // Start/stop interval based on isActive
  useEffect(() => {
    if (isActive && poseSlug) {
      // Initial analysis after a short delay to let the user settle
      const initialTimeout = setTimeout(triggerAnalysis, INITIAL_DELAY_MS);
      intervalRef.current = setInterval(triggerAnalysis, COACH_INTERVAL_MS);

      return () => {
        clearTimeout(initialTimeout);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isActive, poseSlug, triggerAnalysis]);

  const reset = useCallback(() => {
    setCoaching(null);
    setTtsText(null);
    setError(null);
  }, []);

  return { coaching, ttsText, isAnalysing, error, triggerAnalysis, reset };
}
