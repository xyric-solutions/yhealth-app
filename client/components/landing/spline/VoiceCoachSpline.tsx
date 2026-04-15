"use client";

import { SplineWrapper } from "./SplineWrapper";

const VOICE_SCENE_URL =
  "https://prod.spline.design/PLACEHOLDER_VOICE/scene.splinecode";

/**
 * Voice Coach 3D scene — abstract waveform / particle field pulsing like audio.
 * Background layer behind voice stats and scenario cards.
 */
export function VoiceCoachSpline() {
  return (
    <SplineWrapper
      sceneUrl={VOICE_SCENE_URL}
      className="w-full h-full min-h-[400px]"
      fallback={<VoiceFallback />}
    />
  );
}

function VoiceFallback() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.1)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_40%_50%,rgba(139,92,246,0.08)_0%,transparent_50%)]" />

      {/* Waveform bars as CSS fallback */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 opacity-20">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-indigo-500 to-violet-400"
            style={{
              height: `${20 + Math.sin(i * 0.8) * 30}px`,
              animation: `pulse ${1.5 + Math.random()}s ease-in-out infinite`,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
