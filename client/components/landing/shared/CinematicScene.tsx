"use client";

import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { useIsMobile } from "@/hooks/use-is-mobile";

// ─── Types ──────────────────────────────────────────────────────────
type DepthLevel = "none" | "shallow" | "medium" | "deep";
type TransitionType = "none" | "blur-fade" | "scale-fade";

interface CinematicSceneProps {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Pin the section during scroll (default: false) */
  pin?: boolean;
  /** How long to pin — px or "100%" of viewport (default: "100%") */
  pinDuration?: string;
  /** 3D depth level (default: "none") */
  depth?: DepthLevel;
  /** Entrance transition effect (default: "blur-fade") */
  transition?: TransitionType;
  /** ScrollTrigger start (default: "top 85%") */
  start?: string;
  /** ScrollTrigger end (default: "top 20%") */
  end?: string;
}

// ─── Depth Config ───────────────────────────────────────────────────
const PERSPECTIVE: Record<DepthLevel, number> = {
  none: 0,
  shallow: 2000,
  medium: 1200,
  deep: 800,
};

// ─── Layer sub-components via context ───────────────────────────────
const SceneContext = createContext<{ depth: DepthLevel; disabled: boolean }>({
  depth: "none",
  disabled: false,
});

function Background({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { depth, disabled } = useContext(SceneContext);
  if (disabled || depth === "none") {
    return <div className={`absolute inset-0 ${className}`} aria-hidden="true">{children}</div>;
  }
  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={{
        transform: "translateZ(-200px) scale(1.2)",
        willChange: "transform",
      }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function Midground({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { depth, disabled } = useContext(SceneContext);
  if (disabled || depth === "none") {
    return <div className={`relative ${className}`}>{children}</div>;
  }
  return (
    <div
      className={`relative ${className}`}
      style={{
        transform: "translateZ(-100px) scale(1.1)",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}

function Foreground({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative z-10 ${className}`} style={{ transform: "translateZ(0)" }}>
      {children}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export function CinematicScene({
  children,
  className = "",
  id,
  pin = false,
  pinDuration: _pinDuration = "100%",
  depth = "none",
  transition = "blur-fade",
  start = "top 85%",
  end = "top 20%",
}: CinematicSceneProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();
  const { isMobile } = useIsMobile();

  const disabled = prefersReducedMotion;
  const shouldPin = pin && !isMobile && !prefersReducedMotion;
  const perspective = !disabled && !isMobile ? PERSPECTIVE[depth] : 0;

  // Entrance transition animation
  useGSAP(
    () => {
      if (!sectionRef.current || transition === "none" || disabled) return;

      const fromVars: gsap.TweenVars = { opacity: 0 };
      const toVars: gsap.TweenVars = { opacity: 1 };

      if (transition === "blur-fade") {
        fromVars.filter = "blur(8px)";
        toVars.filter = "blur(0px)";
        fromVars.y = 30;
        toVars.y = 0;
      } else if (transition === "scale-fade") {
        fromVars.scale = 0.95;
        toVars.scale = 1;
        fromVars.y = 40;
        toVars.y = 0;
      }

      // Mobile: simplify to opacity only
      if (isMobile) {
        delete fromVars.filter;
        delete toVars.filter;
        delete fromVars.scale;
        delete toVars.scale;
        fromVars.y = 20;
        toVars.y = 0;
      }

      gsap.fromTo(sectionRef.current, fromVars, {
        ...toVars,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start,
          end,
          pin: shouldPin,
          pinSpacing: shouldPin,
          scrub: shouldPin ? 1 : false,
          once: !shouldPin,
          toggleActions: shouldPin ? undefined : "play none none none",
        },
      });
    },
    sectionRef,
    []
  );

  return (
    <SceneContext.Provider value={{ depth, disabled }}>
      <section
        ref={sectionRef}
        id={id}
        className={`relative overflow-hidden ${className}`}
        style={{
          perspective: perspective || undefined,
          transformStyle: perspective ? "preserve-3d" : undefined,
          contain: "layout style paint",
        }}
      >
        {children}
      </section>
    </SceneContext.Provider>
  );
}

// Attach sub-components
CinematicScene.Background = Background;
CinematicScene.Midground = Midground;
CinematicScene.Foreground = Foreground;
