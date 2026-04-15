"use client";

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap-init";
import { useScrollVelocity } from "@/hooks/use-scroll-velocity";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface Particle {
  x: number;
  y: number;
  baseVx: number;
  baseVy: number;
  size: number;
  opacity: number;
  hue: number;
}

function createParticles(count: number, w: number, h: number): Particle[] {
  const hues = [187, 263, 38, 152, 350]; // brand hues
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    baseVx: (Math.random() - 0.5) * 0.3,
    baseVy: (Math.random() - 0.5) * 0.2 - 0.1,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.15 + 0.05,
    hue: hues[Math.floor(Math.random() * hues.length)],
  }));
}

export function ScrollParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const prefersReducedMotion = useReducedMotionSafe();
  const { isMobile } = useIsMobile();
  const { velocityRef, directionRef } = useScrollVelocity();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const count = isMobile ? 20 : 50;
    particlesRef.current = createParticles(count, canvas.width, canvas.height);

    const draw = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const vel = velocityRef.current;
      const dir = directionRef.current;
      const velMultiplier = 1 + vel * 4; // particles speed up with scroll

      for (const p of particlesRef.current) {
        // Move particles
        p.x += p.baseVx * velMultiplier;
        p.y += p.baseVy * velMultiplier + (dir === "down" ? -vel * 2 : dir === "up" ? vel * 2 : 0);

        // Wrap around
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw with velocity-based elongation
        const stretch = vel > 0.1 ? 1 + vel * 3 : 1;
        const dynamicOpacity = p.opacity + vel * 0.1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = Math.min(dynamicOpacity, 0.3);
        ctx.fillStyle = `hsl(${p.hue} 80% 70%)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * stretch, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    // Sync to GSAP ticker for consistency with Lenis
    gsap.ticker.add(draw);

    window.addEventListener("resize", resize);

    return () => {
      gsap.ticker.remove(draw);
      window.removeEventListener("resize", resize);
    };
  }, [prefersReducedMotion, isMobile, velocityRef, directionRef]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
      aria-hidden="true"
    />
  );
}
