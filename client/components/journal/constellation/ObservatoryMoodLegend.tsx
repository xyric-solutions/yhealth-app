"use client";

import { List } from "lucide-react";

interface Props {
  starCount: number;
  onSwitchToList: () => void;
}

const MOODS = [
  { label: "Calm", color: "#60a5fa" },
  { label: "Happy", color: "#fbbf24" },
  { label: "Reflective", color: "#a78bfa" },
  { label: "Stressed", color: "#f87171" },
];

export function ObservatoryMoodLegend({ starCount, onSwitchToList }: Props) {
  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4"
      style={{ zIndex: 30 }}
    >
      <div
        className="flex items-center gap-5 px-5 py-2.5 rounded-full"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Mood dots */}
        {MOODS.map((mood) => (
          <div key={mood.label} className="flex items-center gap-2">
            <div
              className="rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: mood.color,
                boxShadow: `0 0 8px 2px ${mood.color}50`,
              }}
            />
            <span
              className="observatory-font-display text-white/50"
              style={{ fontSize: 10, letterSpacing: "0.08em" }}
            >
              {mood.label}
            </span>
          </div>
        ))}

        {/* Divider */}
        <div className="w-px h-4 bg-white/10" />

        {/* Star count badge */}
        <span
          className="observatory-font-display text-white/40"
          style={{ fontSize: 10, letterSpacing: "0.1em" }}
        >
          {starCount} stars
        </span>

        {/* List View toggle */}
        <button
          onClick={onSwitchToList}
          className="observatory-font-display flex items-center gap-1.5 px-3 py-1 rounded-full text-white/40 hover:text-white/60 hover:bg-white/5 transition-all duration-200"
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <List className="w-3 h-3" />
          List
        </button>
      </div>
    </div>
  );
}
