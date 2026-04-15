"use client";

import { motion, useInView, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef, ReactNode } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale" | "fade";
  distance?: number;
  duration?: number;
  once?: boolean;
  margin?: string;
  stagger?: number;
  staggerChildren?: boolean;
}

const directionVariants: Record<string, (distance: number) => Variants> = {
  up: (distance) => ({
    hidden: { opacity: 0, y: distance },
    visible: { opacity: 1, y: 0 },
  }),
  down: (distance) => ({
    hidden: { opacity: 0, y: -distance },
    visible: { opacity: 1, y: 0 },
  }),
  left: (distance) => ({
    hidden: { opacity: 0, x: distance },
    visible: { opacity: 1, x: 0 },
  }),
  right: (distance) => ({
    hidden: { opacity: 0, x: -distance },
    visible: { opacity: 1, x: 0 },
  }),
  scale: () => ({
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
  }),
  fade: () => ({
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  }),
};

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  distance = 50,
  duration = 0.6,
  once = true,
  margin = "-100px",
  stagger,
  staggerChildren = false,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: margin as `${number}px` });
  const prefersReducedMotion = useReducedMotionSafe();

  const variants = directionVariants[direction](distance);

  const transition = {
    duration: prefersReducedMotion ? 0 : duration,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    ...(staggerChildren && stagger !== undefined && { staggerChildren: stagger }),
  };

  if (prefersReducedMotion) {
    return <div ref={ref} className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerChildren ? { visible: { transition } } : variants}
      transition={transition}
      className={className}
      style={{ willChange: "transform, opacity" }}
    >
      {staggerChildren ? (
        <motion.div variants={variants}>{children}</motion.div>
      ) : (
        children
      )}
    </motion.div>
  );
}

interface ScrollProgressRevealProps {
  children: ReactNode;
  className?: string;
  offset?: [string, string];
}

export function ScrollProgressReveal({
  children,
  className = "",
  offset = ["start end", "end start"],
}: ScrollProgressRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as any });
  const prefersReducedMotion = useReducedMotionSafe();

  const opacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    prefersReducedMotion ? [1, 1, 1, 1] : [0, 1, 1, 0]
  );
  const scale = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    prefersReducedMotion ? [1, 1, 1, 1] : [0.8, 1, 1, 0.9]
  );
  const y = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    prefersReducedMotion ? [0, 0, 0] : [50, 0, -50]
  );

  return (
    <motion.div
      ref={ref}
      style={{ opacity, scale, y, willChange: "transform, opacity" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

