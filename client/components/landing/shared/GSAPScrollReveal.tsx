"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

type Direction = "up" | "down" | "left" | "right" | "scale" | "fade";

interface GSAPScrollRevealProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  id?: string;
  /** Animation direction (default: "up") */
  direction?: Direction;
  /** Movement distance in px (default: 60) */
  distance?: number;
  /** Animation duration in seconds (default: 0.8) */
  duration?: number;
  /** Delay before animation starts (default: 0) */
  delay?: number;
  /** false = play once on enter, number = scrub smoothness (default: false) */
  scrub?: boolean | number;
  /** ScrollTrigger start position (default: "top 85%") */
  start?: string;
  /** ScrollTrigger end position (default: "top 20%") */
  end?: string;
  /** Stagger delay between children (default: 0) */
  stagger?: number;
  /** CSS selector for children to stagger (e.g. ".card") */
  staggerSelector?: string;
  /** Pin the section during scroll (default: false) */
  pin?: boolean;
  /** GSAP easing (default: "power3.out") */
  ease?: string;
  /** Additional style */
  style?: React.CSSProperties;
}

function getFromVars(direction: Direction, distance: number): gsap.TweenVars {
  switch (direction) {
    case "up":
      return { opacity: 0, y: distance };
    case "down":
      return { opacity: 0, y: -distance };
    case "left":
      return { opacity: 0, x: distance };
    case "right":
      return { opacity: 0, x: -distance };
    case "scale":
      return { opacity: 0, scale: 0.9 };
    case "fade":
      return { opacity: 0 };
  }
}

function getToVars(direction: Direction): gsap.TweenVars {
  switch (direction) {
    case "up":
    case "down":
      return { opacity: 1, y: 0 };
    case "left":
    case "right":
      return { opacity: 1, x: 0 };
    case "scale":
      return { opacity: 1, scale: 1 };
    case "fade":
      return { opacity: 1 };
  }
}

export function GSAPScrollReveal({
  children,
  className = "",
  as: Component = "div",
  id,
  direction = "up",
  distance = 60,
  duration = 0.8,
  delay = 0,
  scrub = false,
  start = "top 85%",
  end = "top 20%",
  stagger = 0,
  staggerSelector,
  pin = false,
  ease = "power3.out",
  style,
}: GSAPScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();

  useGSAP(
    () => {
      if (!ref.current) return;

      const targets =
        stagger && staggerSelector
          ? ref.current.querySelectorAll(staggerSelector)
          : ref.current;

      const fromVars = getFromVars(direction, distance);
      const toVars = getToVars(direction);

      gsap.fromTo(targets, fromVars, {
        ...toVars,
        duration: scrub ? undefined : duration,
        ease: scrub ? "none" : ease,
        delay: scrub ? undefined : delay,
        stagger: stagger || undefined,
        scrollTrigger: {
          trigger: ref.current,
          start,
          end,
          scrub: scrub,
          pin,
          once: !scrub,
          toggleActions: scrub ? undefined : "play none none none",
        },
      });
    },
    ref,
    []
  );

  // Render without GSAP styles when reduced motion is preferred
  const props = {
    ref,
    id,
    className,
    style: {
      ...style,
      // Set initial hidden state to prevent flash (GSAP will animate from these)
      ...(prefersReducedMotion ? {} : { visibility: "inherit" as const }),
    },
  };

  if (Component === "section") return <section {...props}>{children}</section>;
  if (Component === "article") return <article {...props}>{children}</article>;
  return <div {...props}>{children}</div>;
}
