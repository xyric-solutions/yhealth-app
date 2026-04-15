'use client';

import { useState, useEffect } from 'react';
import { useSpring } from 'framer-motion';
import { useMotionValueEvent } from 'framer-motion';

/**
 * Returns a number that animates from 0 to `value` when `value` or `isVisible` changes.
 * Use for KPI count-up effects.
 */
export function useCountUp(value: number, isVisible = true) {
  const [display, setDisplay] = useState(0);
  const spring = useSpring(0);

  useEffect(() => {
    if (!isVisible) return;
    spring.set(value);
  }, [value, isVisible, spring]);

  useMotionValueEvent(spring, 'change', (v) => {
    // Support decimal values for revenue
    setDisplay(parseFloat(v.toFixed(2)));
  });

  return display;
}
