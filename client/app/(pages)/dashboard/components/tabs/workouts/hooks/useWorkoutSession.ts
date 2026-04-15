/**
 * @file useWorkoutSession
 * Manages workout session state: timer, rest periods, pause/resume, and motivational quotes.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { WorkoutSession } from "../types";
import { MOTIVATIONAL_QUOTES } from "../constants";
import { workoutLogger } from "../logger";

const DEFAULT_SESSION: WorkoutSession = {
  isActive: false,
  isPaused: false,
  elapsedSeconds: 0,
  currentExerciseIndex: 0,
  isResting: false,
  restTimeRemaining: 0,
};

interface UseWorkoutSessionOptions {
  /** Called when the session completes (user clicks "complete") */
  onComplete?: (elapsedSeconds: number) => void;
}

export function useWorkoutSession(options: UseWorkoutSessionOptions = {}) {
  const [session, setSession] = useState<WorkoutSession>(DEFAULT_SESSION);
  const [currentQuote, setCurrentQuote] = useState(MOTIVATIONAL_QUOTES[0]);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect — increments elapsed seconds when active and not paused
  useEffect(() => {
    if (session.isActive && !session.isPaused) {
      timerRef.current = setInterval(() => {
        setSession(prev => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
        }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session.isActive, session.isPaused]);

  // Rest timer effect — decrements rest time, auto-clears when done
  useEffect(() => {
    if (session.isResting && session.restTimeRemaining > 0) {
      restTimerRef.current = setInterval(() => {
        setSession(prev => {
          if (prev.restTimeRemaining <= 1) {
            return { ...prev, isResting: false, restTimeRemaining: 0 };
          }
          return { ...prev, restTimeRemaining: prev.restTimeRemaining - 1 };
        });
      }, 1000);
    } else {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    }

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, [session.isResting, session.restTimeRemaining]);

  // Motivational quote rotation every 30 seconds during active session
  useEffect(() => {
    if (session.isActive && !session.isPaused) {
      const quoteInterval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
        setCurrentQuote(MOTIVATIONAL_QUOTES[randomIndex]);
      }, 30000);
      return () => clearInterval(quoteInterval);
    }
  }, [session.isActive, session.isPaused]);

  // Start a workout session
  const startWorkout = useCallback((planId: string, exerciseCount: number) => {
    workoutLogger.logSession('start', {
      planId,
      component: 'useWorkoutSession',
      exerciseCount,
    });

    setSession({
      isActive: true,
      isPaused: false,
      elapsedSeconds: 0,
      currentExerciseIndex: 0,
      isResting: false,
      restTimeRemaining: 0,
    });
    setCurrentQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
  }, []);

  // Toggle pause/resume
  const togglePause = useCallback((planId: string) => {
    setSession(prev => {
      const newPausedState = !prev.isPaused;
      workoutLogger.logSession(newPausedState ? 'pause' : 'resume', { planId });
      return { ...prev, isPaused: newPausedState };
    });
  }, []);

  // Stop/cancel workout
  const stopWorkout = useCallback((planId: string) => {
    workoutLogger.logSession('cancel', { planId });
    setSession({ ...DEFAULT_SESSION });
  }, []);

  // Complete workout — shows completion modal and resets session
  const completeWorkout = useCallback((planId: string) => {
    const elapsed = session.elapsedSeconds;
    workoutLogger.logSession('complete', { planId, duration: elapsed });
    setShowCompletionModal(true);
    setSession({ ...DEFAULT_SESSION });
    options.onComplete?.(elapsed);
  }, [session.elapsedSeconds, options]);

  // Skip rest timer
  const skipRest = useCallback(() => {
    setSession(prev => ({ ...prev, isResting: false, restTimeRemaining: 0 }));
  }, []);

  // Start a rest period (called externally when an exercise is completed)
  const startRest = useCallback((restSeconds: number) => {
    setSession(prev => ({
      ...prev,
      isResting: true,
      restTimeRemaining: restSeconds,
    }));
  }, []);

  return {
    session,
    currentQuote,
    showCompletionModal,
    setShowCompletionModal,
    startWorkout,
    togglePause,
    stopWorkout,
    completeWorkout,
    skipRest,
    startRest,
  };
}
