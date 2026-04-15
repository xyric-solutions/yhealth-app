'use client';

import { useEffect, useState } from 'react';
import { useSpring, motion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
}

export function AnimatedNumber({ value, decimals = 0 }: AnimatedNumberProps) {
  const spring = useSpring(0, { stiffness: 50, damping: 30 });
  const [displayText, setDisplayText] = useState<string>('0');

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      if (decimals === 0) {
        setDisplayText(Math.round(latest).toString());
      } else {
        setDisplayText(latest.toFixed(decimals));
      }
    });
    return () => unsubscribe();
  }, [spring, decimals]);

  return <motion.span>{displayText}</motion.span>;
}
