"use client";

import { SplineWrapper } from "./SplineWrapper";

// Replace this URL with your actual Spline hero scene
const HERO_SCENE_URL =
  "https://prod.spline.design/PLACEHOLDER_HERO/scene.splinecode";

/**
 * Hero section 3D scene — glowing brain/orb with orbiting life domain icons.
 * Falls back to a radial violet-cyan gradient when Spline isn't available.
 */
export function HeroSplineScene() {
  return (
    <SplineWrapper
      sceneUrl={HERO_SCENE_URL}
      className="w-full h-full min-h-[400px] lg:min-h-[520px]"
      interactive
      fallback={<HeroFallback />}
    />
  );
}

function HeroFallback() {
  return (
    <div className="absolute inset-0">
      {/* Layered radial glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.12)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(6,182,212,0.1)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_60%,rgba(245,158,11,0.06)_0%,transparent_50%)]" />

      {/* Central orb glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-violet-500/8 blur-[80px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-cyan-400/10 blur-[60px] animate-pulse" />

      {/* Decorative orbit ring */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-white/[0.04]"
        style={{ animation: "spin 40s linear infinite" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22rem] h-[22rem] rounded-full border border-white/[0.03]"
        style={{ animation: "spin 60s linear infinite reverse" }}
      />
    </div>
  );
}
