"use client";

import { useRef, useMemo } from "react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface GSAPTextRevealProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  /** Split into "words" or "chars" (default: "words") */
  split?: "words" | "chars";
  /** Stagger delay between elements (default: 0.03) */
  stagger?: number;
  /** Animation duration (default: 0.6) */
  duration?: number;
  /** ScrollTrigger start (default: "top 85%") */
  start?: string;
  /** Animation type (default: "up") */
  type?: "up" | "fade" | "blur";
  /** GSAP easing (default: "power3.out") */
  ease?: string;
}

export function GSAPTextReveal({
  text,
  className = "",
  as: Tag = "p",
  split = "words",
  stagger = 0.03,
  duration = 0.6,
  start = "top 85%",
  type = "up",
  ease = "power3.out",
}: GSAPTextRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();

  const elements = useMemo(() => {
    if (split === "chars") {
      return text.split("").map((char, i) => (
        <span
          key={i}
          className="gsap-text-element inline-block"
          style={{ whiteSpace: char === " " ? "pre" : undefined }}
        >
          {char}
        </span>
      ));
    }

    return text.split(" ").map((word, i) => (
      <span key={i} className="gsap-text-element inline-block mr-[0.25em]">
        {word}
      </span>
    ));
  }, [text, split]);

  useGSAP(
    () => {
      if (!ref.current) return;

      const targets = ref.current.querySelectorAll(".gsap-text-element");

      const fromVars: gsap.TweenVars = { opacity: 0 };
      const toVars: gsap.TweenVars = { opacity: 1 };

      if (type === "up") {
        fromVars.y = 20;
        toVars.y = 0;
      } else if (type === "blur") {
        fromVars.filter = "blur(8px)";
        toVars.filter = "blur(0px)";
      }

      gsap.fromTo(targets, fromVars, {
        ...toVars,
        duration,
        ease,
        stagger,
        scrollTrigger: {
          trigger: ref.current,
          start,
          once: true,
          toggleActions: "play none none none",
        },
      });
    },
    ref,
    []
  );

  if (prefersReducedMotion) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag ref={ref as React.RefObject<never>} className={className}>
      {elements}
    </Tag>
  );
}
