"use client";

import { useLayoutEffect, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import { useReducedMotionSafe } from "./use-reduced-motion-safe";

/**
 * Core GSAP hook with automatic cleanup via gsap.context().
 * Skips all animations when prefers-reduced-motion is set.
 *
 * @param callback - receives gsap.Context, define tweens/timelines inside
 * @param scope - container ref to scope selector queries (e.g. ".card" → only inside scope)
 * @param deps - dependency array (empty = run once on mount)
 */
export function useGSAP(
  callback: (ctx: gsap.Context) => void,
  scope?: RefObject<HTMLElement | null>,
  deps: React.DependencyList = []
) {
  const prefersReducedMotion = useReducedMotionSafe();

  useLayoutEffect(() => {
    if (prefersReducedMotion) return;
    if (scope && !scope.current) return;

    const ctx = gsap.context((self) => {
      callback(self);
    }, scope?.current || undefined);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, ...deps]);
}

/**
 * Creates a GSAP ScrollTrigger-based entrance animation.
 * Convenience wrapper for the most common pattern.
 */
export function useGSAPReveal(
  ref: RefObject<HTMLElement | null>,
  options: {
    from?: gsap.TweenVars;
    to?: gsap.TweenVars;
    start?: string;
    end?: string;
    scrub?: boolean | number;
    stagger?: number;
    childSelector?: string;
    delay?: number;
    once?: boolean;
  } = {}
) {
  const {
    from = { opacity: 0, y: 40 },
    to = { opacity: 1, y: 0 },
    start = "top 85%",
    end = "top 20%",
    scrub = false,
    stagger = 0,
    childSelector,
    delay = 0,
    once = true,
  } = options;

  useGSAP(
    (_ctx) => {
      if (!ref.current) return;

      const targets = childSelector
        ? ref.current.querySelectorAll(childSelector)
        : ref.current;

      gsap.fromTo(targets, from, {
        ...to,
        duration: scrub ? undefined : 0.8,
        ease: scrub ? "none" : "power3.out",
        delay,
        stagger: stagger || undefined,
        scrollTrigger: {
          trigger: ref.current,
          start,
          end,
          scrub: scrub,
          once: once && !scrub,
          toggleActions: scrub ? undefined : "play none none reverse",
        },
      });
    },
    ref,
    []
  );
}

export { gsap, ScrollTrigger };
