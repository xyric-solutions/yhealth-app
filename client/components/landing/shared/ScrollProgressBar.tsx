"use client";

import { useRef } from "react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";

export function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!barRef.current) return;

    gsap.fromTo(
      barRef.current,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          start: 0,
          end: "max",
          scrub: 0.3,
        },
      }
    );
  }, undefined, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none">
      <div
        ref={barRef}
        className="h-full origin-left"
        style={{
          background: "linear-gradient(90deg, hsl(38 92% 55%), hsl(187 100% 42%), hsl(263 70% 58%))",
          boxShadow: "0 1px 8px hsl(187 100% 42% / 0.4), 0 0 20px hsl(263 70% 58% / 0.2)",
          transform: "scaleX(0)",
        }}
      />
    </div>
  );
}
