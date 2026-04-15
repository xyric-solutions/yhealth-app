"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useRef, useCallback, ReactNode } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
  radius?: number;
  scaleOnHover?: number;
}

export function MagneticButton({
  children,
  className = "",
  strength = 12,
  radius = 60,
  scaleOnHover = 1.05,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 300, damping: 20 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (prefersReducedMotion || !ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance < radius) {
        const factor = Math.max(0, 1 - distance / radius);
        const angle = Math.atan2(deltaY, deltaX);
        x.set(Math.cos(angle) * strength * factor);
        y.set(Math.sin(angle) * strength * factor);
      } else {
        x.set(0);
        y.set(0);
      }
    },
    [prefersReducedMotion, strength, radius, x, y]
  );

  const handleMouseLeave = useCallback(() => {
    if (prefersReducedMotion) return;
    x.set(0);
    y.set(0);
  }, [prefersReducedMotion, x, y]);

  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      style={{
        x: springX,
        y: springY,
        willChange: "transform",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: scaleOnHover }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

