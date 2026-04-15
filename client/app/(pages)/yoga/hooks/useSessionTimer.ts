'use client';

/**
 * @file Session timer hook
 * @description Simple elapsed-time counter with start/pause/reset controls
 *              and a formatting utility for displaying mm:ss.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export function useSessionTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setElapsedSeconds(0);
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  /**
   * Format seconds as mm:ss.
   *
   * @param seconds - Override value; defaults to the current elapsed time
   * @returns Formatted time string (e.g. "03:42")
   */
  const formatTime = useCallback(
    (seconds?: number) => {
      const s = seconds ?? elapsedSeconds;
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    [elapsedSeconds],
  );

  return { elapsedSeconds, isRunning, start, pause, reset, formatTime };
}
