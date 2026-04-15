"use client";

import { Sparkles } from "lucide-react";

interface Props {
  entryCount: number;
  onNewEntry: () => void;
}

export function ObservatoryHeader({ entryCount, onNewEntry }: Props) {
  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4"
      style={{
        zIndex: 30,
        background: "linear-gradient(180deg, rgba(2, 2, 10, 0.8) 0%, rgba(2, 2, 10, 0.4) 70%, transparent 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Title */}
      <div>
        <h2
          className="observatory-font-display bg-gradient-to-r from-white via-purple-200 to-indigo-300 bg-clip-text text-transparent"
          style={{ fontSize: 22, letterSpacing: "0.2em" }}
        >
          MIND OBSERVATORY
        </h2>
        <div className="flex items-center gap-3 mt-1">
          <p
            className="observatory-font-body text-white/50"
            style={{ fontSize: 12, letterSpacing: "0.06em" }}
          >
            {entryCount} {entryCount === 1 ? "reflection" : "reflections"} mapped
          </p>
          {/* Pulsing indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full bg-purple-400"
              style={{
                animation: "pulse 2s ease-in-out infinite",
                boxShadow: "0 0 6px rgba(168, 85, 247, 0.6)",
              }}
            />
            <span
              className="observatory-font-display text-purple-400/60"
              style={{ fontSize: 9, letterSpacing: "0.15em" }}
            >
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* New Reflection button */}
      <button
        onClick={onNewEntry}
        className="observatory-font-display flex items-center gap-2 px-5 py-2.5 rounded-full border border-purple-400/40 text-purple-100 hover:border-purple-300/60 transition-all duration-300 group"
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 0 20px rgba(139, 92, 246, 0.1)",
        }}
      >
        <Sparkles className="w-3.5 h-3.5 text-purple-300 group-hover:text-purple-200 transition-colors" />
        NEW REFLECTION
      </button>
    </div>
  );
}
