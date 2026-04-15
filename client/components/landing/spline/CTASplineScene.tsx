"use client";

import { SplineWrapper } from "./SplineWrapper";

const CTA_SCENE_URL =
  "https://prod.spline.design/PLACEHOLDER_CTA/scene.splinecode";

/**
 * CTA section 3D scene — abstract energy field / celebration particle environment.
 * Full-section background behind the CTA button and floating metric cards.
 */
export function CTASplineScene() {
  return (
    <SplineWrapper
      sceneUrl={CTA_SCENE_URL}
      className="w-full h-full min-h-[400px]"
      fallback={<CTAFallback />}
    />
  );
}

function CTAFallback() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08)_0%,transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_60%,rgba(139,92,246,0.06)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(52,211,153,0.06)_0%,transparent_50%)]" />

      {/* Floating particle dots */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-amber-400/20"
          style={{
            top: `${20 + Math.random() * 60}%`,
            left: `${10 + Math.random() * 80}%`,
            animation: `float ${3 + Math.random() * 2}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
