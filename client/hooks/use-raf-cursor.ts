"use client";

import { useEffect, useRef, useState } from "react";

interface CursorPosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Hook to track cursor position and velocity using requestAnimationFrame
 * Avoids setState on every mousemove for better performance
 */
export function useRafCursor() {
  const [position, setPosition] = useState<CursorPosition>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  });

  const rafRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ x: number; y: number; time: number }>({
    x: 0,
    y: 0,
    time: 0,
  });

  useEffect(() => {
    lastPosRef.current.time = Date.now();

    const updatePosition = () => {
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const timeDelta = now - lastPosRef.current.time;

      if (timeDelta > 0) {
        const vx = (e.clientX - lastPosRef.current.x) / timeDelta;
        const vy = (e.clientY - lastPosRef.current.y) / timeDelta;

        setPosition({
          x: e.clientX,
          y: e.clientY,
          vx: vx * 1000, // Scale velocity
          vy: vy * 1000,
        });

        lastPosRef.current = {
          x: e.clientX,
          y: e.clientY,
          time: now,
        };
      }
    };

    // Start RAF loop
    rafRef.current = requestAnimationFrame(updatePosition);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return position;
}

