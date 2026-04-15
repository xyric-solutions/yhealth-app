"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "@/lib/gsap-init";
import { ScrollProgressBar } from "./shared/ScrollProgressBar";
import { ScrollParticles } from "./shared/ScrollParticles";

export function CinematicOverlays() {
  // Refresh all ScrollTriggers after all sections mount
  useEffect(() => {
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <ScrollProgressBar />
      <ScrollParticles />
    </>
  );
}
