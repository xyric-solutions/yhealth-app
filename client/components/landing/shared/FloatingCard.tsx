"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useRef, useCallback, ReactNode } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface FloatingCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
  perspective?: number;
  enableHover?: boolean;
  enableFloat?: boolean;
  floatDuration?: number;
  floatDistance?: number;
}

export function FloatingCard({
  children,
  className = "",
  intensity = 15,
  perspective = 1000,
  enableHover = true,
  enableFloat = true,
  floatDuration = 6,
  floatDistance = 20,
}: FloatingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 300, damping: 30 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!enableHover || prefersReducedMotion || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) / (rect.width / 2);
      const deltaY = (e.clientY - centerY) / (rect.height / 2);

      rotateY.set(deltaX * intensity);
      rotateX.set(-deltaY * intensity);
      x.set(deltaX * intensity * 0.5);
      y.set(deltaY * intensity * 0.5);
    },
    [enableHover, prefersReducedMotion, intensity, rotateX, rotateY, x, y]
  );

  const handleMouseLeave = useCallback(() => {
    if (prefersReducedMotion) return;
    rotateX.set(0);
    rotateY.set(0);
    x.set(0);
    y.set(0);
  }, [prefersReducedMotion, rotateX, rotateY, x, y]);

  return (
    <div
      ref={cardRef}
      style={{ perspective }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      <motion.div
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          x: springX,
          y: springY,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
        animate={
          enableFloat && !prefersReducedMotion
            ? {
                y: [0, -floatDistance, 0],
                rotateZ: [0, 2, 0],
              }
            : {}
        }
        transition={
          enableFloat && !prefersReducedMotion
            ? {
                duration: floatDuration,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : {}
        }
      >
        {children}
      </motion.div>
    </div>
  );
}

