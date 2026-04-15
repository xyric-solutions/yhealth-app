"use client";

import { type ReactNode, useRef } from "react";
import { motion, type MotionValue } from "framer-motion";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface DepthLayerProps {
  children: ReactNode;
  className?: string;
  /** translateZ value in px (negative = further away) */
  z?: number;
  /** Scroll-linked vertical parallax speed (0 = static, 1 = full scroll) */
  parallaxSpeed?: number;
  /** Whether to react to mouse movement via MotionValues */
  mouseX?: MotionValue<number>;
  mouseY?: MotionValue<number>;
  /** Mouse displacement multiplier (default: 1) */
  mouseStrength?: number;
  /** aria-hidden for decorative layers */
  decorative?: boolean;
}

export function DepthLayer({
  children,
  className = "",
  z = 0,
  parallaxSpeed = 0,
  mouseX,
  mouseY,
  mouseStrength: _mouseStrength = 1,
  decorative = true,
}: DepthLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();
  const { isMobile } = useIsMobile();

  const disabled = prefersReducedMotion || isMobile;

  // Scroll-linked parallax
  useGSAP(
    () => {
      if (!ref.current || disabled || parallaxSpeed === 0) return;

      gsap.to(ref.current, {
        yPercent: parallaxSpeed * -30,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    },
    ref,
    []
  );

  if (disabled) {
    return (
      <div className={className} aria-hidden={decorative || undefined}>
        {children}
      </div>
    );
  }

  const hasMouseReactivity = mouseX && mouseY;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        transform: `translateZ(${z}px)`,
        willChange: "transform",
        ...(hasMouseReactivity
          ? { x: mouseX, y: mouseY }
          : {}),
      }}
      aria-hidden={decorative || undefined}
    >
      {children}
    </motion.div>
  );
}
