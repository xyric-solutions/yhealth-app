"use client";

/**
 * @file StarTooltip Component
 * @description Observatory-styled hover tooltip for date-grouped stars.
 * Shows date, entry count, times, and first entry snippet.
 */

import { useRef, useLayoutEffect, useState } from "react";
import { motion } from "framer-motion";
import type { JournalEntry } from "@shared/types/domain/wellbeing";
import { formatTime, getMoodEmoji, getMoodLabel } from "./constellation-math";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StarTooltipProps {
  entries: JournalEntry[];
  position: { x: number; y: number };
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOOLTIP_MAX_WIDTH = 280;
const TOOLTIP_GAP = 16;
const VIEWPORT_PADDING = 12;
const SNIPPET_LENGTH = 80;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StarTooltip({ entries, position, label }: StarTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{
    top: number;
    left: number;
    caretLeft: number;
    flipBelow: boolean;
  }>({ top: 0, left: 0, caretLeft: TOOLTIP_MAX_WIDTH / 2, flipBelow: false });

  // Measure and clamp to viewport
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const tooltipWidth = rect.width;
    const tooltipHeight = rect.height;

    let left = position.x - tooltipWidth / 2;
    let top = position.y - tooltipHeight - TOOLTIP_GAP;
    let flipBelow = false;

    if (left < VIEWPORT_PADDING) {
      left = VIEWPORT_PADDING;
    } else if (left + tooltipWidth > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - VIEWPORT_PADDING - tooltipWidth;
    }

    if (top < VIEWPORT_PADDING) {
      top = position.y + TOOLTIP_GAP;
      flipBelow = true;
    }

    const caretLeft = Math.max(
      16,
      Math.min(position.x - left, tooltipWidth - 16)
    );

    setAdjustedPosition({ top, left, caretLeft, flipBelow });
  }, [position]);

  if (entries.length === 0) return null;

  const firstEntry = entries[0];
  const entryCount = entries.length;
  const moodEmoji = getMoodEmoji(firstEntry.sentimentScore);
  const moodLabel = getMoodLabel(firstEntry.sentimentScore);

  const snippet =
    firstEntry.entryText.length > SNIPPET_LENGTH
      ? firstEntry.entryText.slice(0, SNIPPET_LENGTH).trimEnd() + "..."
      : firstEntry.entryText;

  // Time list: "9:30 AM · 2:15 PM · 8:00 PM"
  const timeList = entries.map((e) => formatTime(e.loggedAt)).join(" · ");

  return (
    <motion.div
      ref={tooltipRef}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute z-40 pointer-events-none"
      style={{
        top: adjustedPosition.top,
        left: adjustedPosition.left,
        maxWidth: TOOLTIP_MAX_WIDTH,
      }}
    >
      {/* Tooltip Card — deep glass observatory style */}
      <div
        className="relative rounded-xl shadow-2xl px-4 py-3 space-y-2 border border-purple-500/15"
        style={{
          background: "rgba(10, 8, 28, 0.88)",
          backdropFilter: "blur(24px)",
          boxShadow:
            "0 0 30px rgba(139, 92, 246, 0.1), 0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Date label + count */}
        <div className="flex items-center justify-between gap-2">
          <p
            className="observatory-font-display text-purple-300/70"
            style={{ fontSize: 9, letterSpacing: "0.15em" }}
          >
            {label}
          </p>
          {entryCount > 1 && (
            <span
              className="observatory-font-display text-purple-300/40 shrink-0"
              style={{ fontSize: 9, letterSpacing: "0.08em" }}
            >
              {entryCount} ENTRIES
            </span>
          )}
        </div>

        {/* Times */}
        <p
          className="observatory-font-display text-white/50"
          style={{ fontSize: 10, letterSpacing: "0.06em" }}
        >
          {timeList}
        </p>

        {/* Mood indicator (from first entry) */}
        <div className="flex items-center gap-2">
          <span className="text-base leading-none" aria-hidden="true">
            {moodEmoji}
          </span>
          <span
            className="observatory-font-display text-white/80"
            style={{ fontSize: 12, letterSpacing: "0.06em" }}
          >
            {moodLabel}
          </span>
        </div>

        {/* Entry snippet */}
        <p
          className="observatory-font-body text-white/40 leading-relaxed line-clamp-3"
          style={{ fontSize: 11 }}
        >
          {snippet}
        </p>

        {/* Caret / arrow */}
        <div
          className="absolute w-2.5 h-2.5 rotate-45 border-purple-500/15"
          style={{
            background: "rgba(10, 8, 28, 0.88)",
            left: adjustedPosition.caretLeft - 5,
            ...(adjustedPosition.flipBelow
              ? { top: -5, borderLeft: "1px solid", borderTop: "1px solid" }
              : {
                  bottom: -5,
                  borderRight: "1px solid",
                  borderBottom: "1px solid",
                }),
          }}
        />
      </div>
    </motion.div>
  );
}
