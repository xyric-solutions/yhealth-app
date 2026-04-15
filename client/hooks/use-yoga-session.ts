"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type {
  YogaSession,
  SessionPhase,
  SessionPlayerState,
} from "@shared/types/domain/yoga";

interface UseYogaSessionReturn {
  state: SessionPlayerState;
  session: YogaSession | null;
  currentPhaseIndex: number;
  currentPhase: SessionPhase | null;
  elapsedSeconds: number;
  phaseElapsedSeconds: number;
  totalDurationSeconds: number;
  play: (session: YogaSession) => void;
  pause: () => void;
  resume: () => void;
  skipPhase: () => void;
  prevPhase: () => void;
  complete: () => void;
  reset: () => void;
}

export function useYogaSession(): UseYogaSessionReturn {
  const [state, setState] = useState<SessionPlayerState>("idle");
  const [session, setSession] = useState<YogaSession | null>(null);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phaseElapsedSeconds, setPhaseElapsedSeconds] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<YogaSession | null>(null);
  const phaseIndexRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    phaseIndexRef.current = currentPhaseIndex;
  }, [currentPhaseIndex]);

  const currentPhase: SessionPhase | null =
    session && session.phases[currentPhaseIndex]
      ? session.phases[currentPhaseIndex]
      : null;

  const totalDurationSeconds = session
    ? session.phases.reduce((sum, p) => sum + p.durationSeconds, 0)
    : 0;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      setPhaseElapsedSeconds((prev) => {
        const nextPhaseElapsed = prev + 1;
        const s = sessionRef.current;
        const idx = phaseIndexRef.current;
        if (s && s.phases[idx]) {
          const phaseDuration = s.phases[idx].durationSeconds;
          if (nextPhaseElapsed >= phaseDuration) {
            // Move to next phase
            const nextIndex = idx + 1;
            if (nextIndex >= s.phases.length) {
              // Session complete
              setState("complete");
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              return phaseDuration;
            }
            setCurrentPhaseIndex(nextIndex);
            phaseIndexRef.current = nextIndex;
            return 0;
          }
        }
        return nextPhaseElapsed;
      });
    }, 1000);
  }, [clearTimer]);

  const play = useCallback(
    (newSession: YogaSession) => {
      setSession(newSession);
      sessionRef.current = newSession;
      setCurrentPhaseIndex(0);
      phaseIndexRef.current = 0;
      setElapsedSeconds(0);
      setPhaseElapsedSeconds(0);
      setState("playing");
      // Timer starts after state is set
      setTimeout(() => startTimer(), 0);
    },
    [startTimer]
  );

  const pause = useCallback(() => {
    clearTimer();
    setState("paused");
  }, [clearTimer]);

  const resume = useCallback(() => {
    setState("playing");
    startTimer();
  }, [startTimer]);

  const skipPhase = useCallback(() => {
    if (!session) return;
    const nextIndex = currentPhaseIndex + 1;
    if (nextIndex >= session.phases.length) {
      clearTimer();
      setState("complete");
      return;
    }
    // Add remaining phase time to elapsed
    const remaining = currentPhase
      ? currentPhase.durationSeconds - phaseElapsedSeconds
      : 0;
    setElapsedSeconds((prev) => prev + remaining);
    setCurrentPhaseIndex(nextIndex);
    phaseIndexRef.current = nextIndex;
    setPhaseElapsedSeconds(0);
  }, [session, currentPhaseIndex, currentPhase, phaseElapsedSeconds, clearTimer]);

  const prevPhase = useCallback(() => {
    if (!session || currentPhaseIndex === 0) return;
    const prevIndex = currentPhaseIndex - 1;
    // Subtract current phase elapsed and previous phase duration
    const prevPhaseDuration = session.phases[prevIndex].durationSeconds;
    setElapsedSeconds((prev) =>
      Math.max(0, prev - phaseElapsedSeconds - prevPhaseDuration)
    );
    setCurrentPhaseIndex(prevIndex);
    phaseIndexRef.current = prevIndex;
    setPhaseElapsedSeconds(0);
  }, [session, currentPhaseIndex, phaseElapsedSeconds]);

  const complete = useCallback(() => {
    clearTimer();
    setState("complete");
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setState("idle");
    setSession(null);
    sessionRef.current = null;
    setCurrentPhaseIndex(0);
    phaseIndexRef.current = 0;
    setElapsedSeconds(0);
    setPhaseElapsedSeconds(0);
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    state,
    session,
    currentPhaseIndex,
    currentPhase,
    elapsedSeconds,
    phaseElapsedSeconds,
    totalDurationSeconds,
    play,
    pause,
    resume,
    skipPhase,
    prevPhase,
    complete,
    reset,
  };
}
