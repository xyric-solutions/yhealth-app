"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";

interface GSAPParallaxProps {
  children: ReactNode;
  className?: string;
  /** Parallax speed multiplier. Positive = moves slower than scroll (default: 0.5) */
  speed?: number;
  /** Direction of parallax movement (default: "up") */
  direction?: "up" | "down";
  /** Scrub smoothness (default: 1) */
  scrub?: number;
}

export function GSAPParallax({
  children,
  className = "",
  speed = 0.5,
  direction = "up",
  scrub = 1,
}: GSAPParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;

      const distance = speed * 200;
      const yFrom = direction === "up" ? distance : -distance;
      const yTo = direction === "up" ? -distance : distance;

      gsap.fromTo(
        ref.current,
        { y: yFrom },
        {
          y: yTo,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top bottom",
            end: "bottom top",
            scrub,
          },
        }
      );
    },
    ref,
    []
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
