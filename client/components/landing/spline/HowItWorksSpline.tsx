"use client";

import { SplineWrapper } from "./SplineWrapper";

const HOW_IT_WORKS_SCENE_URL =
  "https://prod.spline.design/PLACEHOLDER_PROCESS/scene.splinecode";

/**
 * How It Works 3D scene — flowing energy stream connecting 4 process nodes.
 * Positioned behind the step cards as a connecting visual.
 */
export function HowItWorksSpline() {
  return (
    <SplineWrapper
      sceneUrl={HOW_IT_WORKS_SCENE_URL}
      className="w-full h-full min-h-[400px]"
      fallback={<ProcessFallback />}
    />
  );
}

function ProcessFallback() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(6,182,212,0.06)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_70%,rgba(168,85,247,0.06)_0%,transparent_50%)]" />

      {/* Connecting line */}
      <div className="absolute top-1/2 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent" />

      {/* Node dots */}
      {[15, 38, 62, 85].map((left, i) => (
        <div
          key={left}
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
          style={{
            left: `${left}%`,
            background: `radial-gradient(circle, ${
              ["#06b6d4", "#8b5cf6", "#ec4899", "#f97316"][i]
            }40, transparent 70%)`,
            boxShadow: `0 0 20px ${["#06b6d4", "#8b5cf6", "#ec4899", "#f97316"][i]}20`,
            animation: `pulse 2s ease-in-out infinite`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}
