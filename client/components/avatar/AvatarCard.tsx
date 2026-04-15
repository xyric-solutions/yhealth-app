"use client";

/**
 * @file AvatarCard Component
 * @description Transparent container for the 3D avatar with status badge
 * and speaking glow. No card background — avatar floats on page.
 */

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AvatarExpression, AvatarState } from "@/lib/avatar/vrmMappings";

// ============================================
// TYPES
// ============================================

interface AvatarCardProps {
  children: ReactNode;
  currentState: AvatarState;
  currentExpression: AvatarExpression;
  assistantName: string;
  isSpeaking: boolean;
  className?: string;
}

// ============================================
// STATE DISPLAY LABELS
// ============================================

const STATE_LABELS: Record<AvatarState, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

// ============================================
// COMPONENT
// ============================================

export function AvatarCard({
  children,
  currentState,
  currentExpression,
  assistantName,
  isSpeaking,
  className,
}: AvatarCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        className
      )}
    >
      {/* Speaking pulse — bottom radial glow */}
      {isSpeaking && (
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-16 animate-avatar-pulse pointer-events-none z-10 rounded-full blur-xl"
          style={{ background: "rgba(29, 233, 182, 0.15)" }}
        />
      )}

      {/* Canvas container */}
      <div className="relative w-full h-full">{children}</div>

      {/* Bottom overlay UI */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              currentState === "idle"
                ? "bg-emerald-400"
                : "bg-cyan-400 animate-pulse"
            )}
          />
          <span className="text-xs font-medium text-white/80 tracking-wide">
            {assistantName || "AI Coach"}
          </span>
        </div>

        {/* State text + expression badge */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-white/50 capitalize">
            {STATE_LABELS[currentState]}
          </span>
          {currentExpression !== "neutral" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 capitalize">
              {currentExpression}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
