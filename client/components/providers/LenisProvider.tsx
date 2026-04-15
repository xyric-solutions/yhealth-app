"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

const LenisContext = createContext<Lenis | null>(null);

export function useLenis() {
  return useContext(LenisContext);
}

interface LenisProviderProps {
  children: ReactNode;
}

export function LenisProvider({ children }: LenisProviderProps) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const prefersReducedMotion = useReducedMotionSafe();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const lenisInstance = new Lenis({
      autoRaf: false, // We drive RAF via gsap.ticker for perfect GSAP sync
      lerp: 0.1, // Direct interpolation — tighter than duration
      smoothWheel: true,
      syncTouch: true, // Smooth touch scrolling
      touchMultiplier: 2.0,
      wheelMultiplier: 1.2,
      infinite: false,
    });

    setLenis(lenisInstance); // eslint-disable-line react-hooks/set-state-in-effect -- initialization pattern

    // Sync Lenis scroll position with GSAP ScrollTrigger
    lenisInstance.on("scroll", ScrollTrigger.update);

    // Use GSAP ticker for RAF loop — ticker time is in SECONDS, * 1000 → ms for Lenis
    const tickerCallback = (time: number) => {
      lenisInstance.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCallback);
      lenisInstance.destroy();
      setLenis(null);
    };
  }, [prefersReducedMotion]);

  return (
    <LenisContext.Provider value={lenis}>
      {children}
    </LenisContext.Provider>
  );
}
