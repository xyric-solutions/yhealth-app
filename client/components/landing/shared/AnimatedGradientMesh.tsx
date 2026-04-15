"use client";

import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface AnimatedGradientMeshProps {
  className?: string;
  intensity?: number;
  speed?: number;
  colors?: string[];
  blur?: number;
}

export function AnimatedGradientMesh({
  className = "",
  intensity = 0.3,
  speed = 1,
  colors = [
    "hsl(var(--primary))",
    "hsl(280 80% 60%)",
    "hsl(190 90% 50%)",
    "hsl(330 80% 60%)",
  ],
  blur = 80,
}: AnimatedGradientMeshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePosition({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [prefersReducedMotion]);

  const baseDuration = 20 / speed;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Base gradient layer */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, ${colors[0]} 0%, transparent 50%)`,
          filter: `blur(${blur}px)`,
          opacity: intensity,
        }}
        animate={
          prefersReducedMotion
            ? {}
            : {
                x: [0, 50, 0],
                y: [0, 30, 0],
                scale: [1, 1.1, 1],
              }
        }
        transition={{
          duration: baseDuration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary gradient layer */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 70% 60%, ${colors[1]} 0%, transparent 50%)`,
          filter: `blur(${blur}px)`,
          opacity: intensity * 0.8,
        }}
        animate={
          prefersReducedMotion
            ? {}
            : {
                x: [0, -40, 0],
                y: [0, -50, 0],
                scale: [1, 1.15, 1],
              }
        }
        transition={{
          duration: baseDuration * 1.3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Tertiary gradient layer */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 80%, ${colors[2]} 0%, transparent 50%)`,
          filter: `blur(${blur}px)`,
          opacity: intensity * 0.6,
        }}
        animate={
          prefersReducedMotion
            ? {}
            : {
                x: [0, 30, 0],
                y: [0, 40, 0],
                scale: [1, 1.2, 1],
              }
        }
        transition={{
          duration: baseDuration * 1.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4,
        }}
      />

      {/* Interactive mouse-following gradient */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 400px 400px at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, ${colors[3]} 0%, transparent 70%)`,
            filter: `blur(${blur * 0.8}px)`,
            opacity: intensity * 0.4,
          }}
          animate={{
            opacity: [intensity * 0.4, intensity * 0.6, intensity * 0.4],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Animated scan lines */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${colors[0]} 50%, transparent 100%)`,
              opacity: 0.3,
            }}
            animate={{
              x: ["-100%", "100%"],
              opacity: [0, 0.3, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          <motion.div
            className="absolute top-0 bottom-0 left-0 w-px"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${colors[1]} 50%, transparent 100%)`,
              opacity: 0.3,
            }}
            animate={{
              y: ["-100%", "100%"],
              opacity: [0, 0.3, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear",
              delay: 2,
            }}
          />
        </>
      )}
    </div>
  );
}

