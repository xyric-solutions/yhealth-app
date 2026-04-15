"use client";

import { SplineWrapper } from "./SplineWrapper";

const HEALTH_ORBIT_SCENE_URL =
  "https://prod.spline.design/PLACEHOLDER_HEALTH/scene.splinecode";

/**
 * Health Orbit 3D scene — concentric rings with floating health metric nodes.
 * Background layer behind the metric cards.
 */
export function HealthOrbitSpline() {
  return (
    <SplineWrapper
      sceneUrl={HEALTH_ORBIT_SCENE_URL}
      className="w-full h-full min-h-[500px]"
      fallback={<HealthFallback />}
    />
  );
}

function HealthFallback() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_30%,rgba(59,130,246,0.06)_0%,transparent_50%)]" />

      {/* Orbit rings */}
      {[200, 280, 360].map((size, i) => (
        <div
          key={size}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/[0.06]"
          style={{
            width: size,
            height: size,
            animation: `spin ${30 + i * 15}s linear infinite ${i % 2 === 0 ? "" : "reverse"}`,
          }}
        />
      ))}

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-emerald-500/10 blur-[40px]" />
    </div>
  );
}
