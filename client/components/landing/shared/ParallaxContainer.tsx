"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, ReactNode } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface ParallaxContainerProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  direction?: "up" | "down";
  offset?: [string, string];
}

export function ParallaxContainer({
  children,
  className = "",
  speed = 0.5,
  direction = "up",
  offset = ["start end", "end start"],
}: ParallaxContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as any });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion
      ? [0, 0]
      : direction === "up"
      ? [100 * speed, -100 * speed]
      : [-100 * speed, 100 * speed]
  );

  const opacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    prefersReducedMotion ? [1, 1, 1, 1] : [0.3, 1, 1, 0.3]
  );

  return (
    <motion.div
      ref={ref}
      style={{
        y,
        opacity,
        willChange: "transform, opacity",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

