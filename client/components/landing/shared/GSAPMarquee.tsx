"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface GSAPMarqueeProps {
  children: ReactNode;
  className?: string;
  /** Base speed in pixels per second (default: 75) */
  speed?: number;
  /** Reverse direction (default: false, scrolls left) */
  reverse?: boolean;
  /** Pause on hover (default: true) */
  pauseOnHover?: boolean;
  /** React to scroll direction — speed up on scroll, reverse on scroll-up (default: true) */
  scrollSensitive?: boolean;
}

export function GSAPMarquee({
  children,
  className = "",
  speed = 75,
  reverse = false,
  pauseOnHover = true,
  scrollSensitive = true,
}: GSAPMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();

  useGSAP(
    () => {
      if (!trackRef.current || !containerRef.current) return;

      const track = trackRef.current;
      const items = track.children;
      if (items.length === 0) return;

      // Measure single set width
      const singleSetWidth = Array.from(items)
        .slice(0, items.length / 2)
        .reduce((w, el) => w + (el as HTMLElement).offsetWidth, 0);

      if (singleSetWidth === 0) return;

      const duration = singleSetWidth / speed;
      const direction = reverse ? 1 : -1;

      // Infinite scroll tween
      const tween = gsap.to(track, {
        x: direction * singleSetWidth,
        duration,
        ease: "none",
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize((x: number) => {
            return parseFloat(x as unknown as string) % singleSetWidth;
          }),
        },
      });

      // Scroll-direction sensitivity
      if (scrollSensitive) {
        ScrollTrigger.create({
          trigger: containerRef.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const velocity = self.getVelocity();
            const speedFactor = 1 + Math.abs(velocity) / 2000;
            tween.timeScale(
              velocity < 0 ? speedFactor : -speedFactor
            );
          },
          onLeave: () => tween.timeScale(reverse ? -1 : 1),
          onEnterBack: () => tween.timeScale(reverse ? -1 : 1),
        });
      }

      // Pause on hover
      if (pauseOnHover) {
        containerRef.current.addEventListener("mouseenter", () =>
          gsap.to(tween, { timeScale: 0, duration: 0.5 })
        );
        containerRef.current.addEventListener("mouseleave", () =>
          gsap.to(tween, { timeScale: reverse ? -1 : 1, duration: 0.5 })
        );
      }
    },
    containerRef,
    []
  );

  if (prefersReducedMotion) {
    return (
      <div className={className}>
        <div className="flex gap-8">{children}</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <div ref={trackRef} className="flex gap-8 w-max will-change-transform">
        {/* Original + duplicate for seamless loop */}
        {children}
        {children}
      </div>
    </div>
  );
}
