/**
 * @file Constellation Math Utilities
 * @description Pure functions for star positioning, hit detection, color mapping.
 * Zero React, zero side effects — all deterministic calculations.
 */

import type { JournalEntry } from "@shared/types/domain/wellbeing";

// ============================================
// TYPES
// ============================================

export interface StarPosition {
  x: number;
  y: number;
  baseRadius: number;
  angle: number;
}

export interface StarVisuals {
  radius: number;
  domSize: number;
  brightness: number;
  color: string;
  glowColor: string;
  twinklePhase: number;
  twinkleSpeed: number;
}

export interface Star {
  entry: JournalEntry;
  position: StarPosition;
  visuals: StarVisuals;
  label: string;
}

// ============================================
// CONSTANTS
// ============================================

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const INNER_RADIUS_FACTOR = 0.15;
const OUTER_RADIUS_FACTOR = 0.45;
const MIN_STAR_RADIUS = 5;
const MAX_STAR_RADIUS = 18;

const _SENTIMENT_COLORS = {
  positive: { color: "#fbbf24", glow: "#fde68a" },
  neutral: { color: "#60a5fa", glow: "#93c5fd" },
  reflective: { color: "#a78bfa", glow: "#c4b5fd" },
  stressed: { color: "#f87171", glow: "#fca5a5" },
  unknown: { color: "#94a3b8", glow: "#cbd5e1" },
} as const;

/** Date-based color palette — each day of the month gets a distinct hue */
const DATE_COLORS = [
  { color: "#60a5fa", glow: "#93c5fd" },  // Blue
  { color: "#34d399", glow: "#6ee7b7" },  // Emerald
  { color: "#fbbf24", glow: "#fde68a" },  // Amber
  { color: "#f472b6", glow: "#f9a8d4" },  // Pink
  { color: "#a78bfa", glow: "#c4b5fd" },  // Violet
  { color: "#fb923c", glow: "#fdba74" },  // Orange
  { color: "#2dd4bf", glow: "#5eead4" },  // Teal
  { color: "#e879f9", glow: "#f0abfc" },  // Fuchsia
  { color: "#38bdf8", glow: "#7dd3fc" },  // Sky
  { color: "#facc15", glow: "#fef08a" },  // Yellow
  { color: "#4ade80", glow: "#86efac" },  // Green
  { color: "#f87171", glow: "#fca5a5" },  // Red
  { color: "#818cf8", glow: "#a5b4fc" },  // Indigo
  { color: "#fb7185", glow: "#fda4af" },  // Rose
  { color: "#22d3ee", glow: "#67e8f9" },  // Cyan
] as const;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ============================================
// SEEDED RANDOM
// ============================================

/** Simple hash-based PRNG using entry ID as seed. Returns 0-1. */
export function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  // Normalize to 0-1
  return ((hash & 0x7fffffff) % 10000) / 10000;
}

/** Second independent seeded random for a different dimension */
function seededRandom2(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return ((hash & 0x7fffffff) % 10000) / 10000;
}

// ============================================
// POLAR COORDINATE HELPERS
// ============================================

export interface PolarStarData {
  angle: number;       // radians — seeded from entry ID
  radiusFrac: number;  // 0-1 fraction of min(w,h), index-based
}

/**
 * Convert polar coordinates to screen XY with elliptical tilt.
 * tiltY < 1 compresses the Y axis → orbital ellipse look.
 */
export function polarToXY(
  angle: number,
  radiusPx: number,
  tiltY = 0.52
): { x: number; y: number } {
  return {
    x: Math.cos(angle) * radiusPx,
    y: Math.sin(angle) * radiusPx * tiltY,
  };
}

// ============================================
// STAR POSITIONING
// ============================================

/**
 * Compute star positions using golden angle spiral.
 * Entries should be sorted oldest-first (index 0 = innermost).
 */
export function computeStarPositions(
  entryCount: number,
  canvasWidth: number,
  canvasHeight: number,
  entryIds: string[]
): StarPosition[] {
  if (entryCount === 0) return [];

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const minDim = Math.min(canvasWidth, canvasHeight);
  const innerRadius = INNER_RADIUS_FACTOR * minDim;
  const outerRadius = OUTER_RADIUS_FACTOR * minDim;

  const positions: StarPosition[] = [];

  for (let i = 0; i < entryCount; i++) {
    const t = entryCount === 1 ? 0 : i / (entryCount - 1);
    const baseRadius = innerRadius + (outerRadius - innerRadius) * t;
    const angle = i * GOLDEN_ANGLE;

    // Seeded jitter for organic feel
    const id = entryIds[i] || String(i);
    const jitterX = (seededRandom(id) - 0.5) * 12;
    const jitterY = (seededRandom2(id) - 0.5) * 12;

    positions.push({
      x: centerX + Math.cos(angle) * baseRadius + jitterX,
      y: centerY + Math.sin(angle) * baseRadius + jitterY,
      baseRadius,
      angle,
    });
  }

  return positions;
}

// ============================================
// STAR VISUALS
// ============================================

function clamp(min: number, val: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Compute visual properties for a star based on entry data */
export function computeStarVisuals(entry: JournalEntry): StarVisuals {
  // Size from word count
  const wordCount = entry.wordCount || 1;
  const radius = clamp(
    MIN_STAR_RADIUS,
    Math.log2(wordCount + 1) * 2,
    MAX_STAR_RADIUS
  );

  // Color from entry date — each day gets a unique color from the palette
  const entryDate = new Date(entry.loggedAt);
  const dayOfMonth = entryDate.getDate(); // 1-31
  const dateColorIndex = (dayOfMonth - 1) % DATE_COLORS.length;
  const { color, glow } = DATE_COLORS[dateColorIndex];

  // Brightness from sentiment intensity
  const brightness = 0.3 + Math.abs(entry.sentimentScore ?? 0) * 0.7;

  // Twinkle from seeded random
  const twinklePhase = seededRandom(entry.id) * Math.PI * 2;
  const twinkleSpeed = 0.5 + seededRandom2(entry.id) * 1.5;

  // DOM element size (px) — used by ObservatoryStarLayer
  const domSize = clamp(28, 28 + Math.floor(wordCount / 2), 64);

  return { radius, domSize, brightness, color, glowColor: glow, twinklePhase, twinkleSpeed };
}

// ============================================
// DATE LABEL
// ============================================

/** Format entry date as "Monday · 12 Feb 2026" */
export function formatStarLabel(loggedAt: string): string {
  const date = new Date(loggedAt);
  const dayName = DAY_NAMES[date.getDay()];
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName} \u00B7 ${day} ${month} ${year}`;
}

/** Short label for floating star labels: "12 Feb" */
export function formatShortDate(loggedAt: string): string {
  const date = new Date(loggedAt);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

/** Format time as "9:30 AM" */
export function formatTime(loggedAt: string): string {
  const d = new Date(loggedAt);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ============================================
// HIT DETECTION
// ============================================

/**
 * Find the star closest to the mouse position, within hit radius.
 * Returns index or null.
 */
export function findHoveredStar(
  mouseX: number,
  mouseY: number,
  stars: Array<{ x: number; y: number; radius: number }>,
  hitRadiusMultiplier = 2.5
): number | null {
  let closest: number | null = null;
  let closestDist = Infinity;

  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const dx = mouseX - star.x;
    const dy = mouseY - star.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = star.radius * hitRadiusMultiplier;

    if (dist < hitRadius && dist < closestDist) {
      closest = i;
      closestDist = dist;
    }
  }

  return closest;
}

// ============================================
// CONSTELLATION LINES
// ============================================

/**
 * Find pairs of entries logged on consecutive calendar days.
 * Returns array of [indexA, indexB] pairs.
 * Entries must be sorted by loggedAt (any order — we check both directions).
 */
export function findConsecutivePairs(
  entries: JournalEntry[]
): Array<[number, number]> {
  if (entries.length < 2) return [];

  // Build date→index map
  const dateToIndices = new Map<string, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const dateStr = entries[i].loggedAt.split("T")[0];
    const existing = dateToIndices.get(dateStr);
    if (existing) {
      existing.push(i);
    } else {
      dateToIndices.set(dateStr, [i]);
    }
  }

  const pairs: Array<[number, number]> = [];
  const seen = new Set<string>();

  for (const [dateStr, indices] of dateToIndices) {
    // Check if next day exists
    const date = new Date(dateStr + "T00:00:00");
    date.setDate(date.getDate() + 1);
    const nextDateStr = date.toISOString().split("T")[0];
    const nextIndices = dateToIndices.get(nextDateStr);

    if (nextIndices) {
      // Connect first entry of each day
      const a = indices[0];
      const b = nextIndices[0];
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (!seen.has(key)) {
        pairs.push([a, b]);
        seen.add(key);
      }
    }
  }

  return pairs;
}

// ============================================
// BUILD STARS
// ============================================

/** Build complete star array from journal entries */
export function buildStars(
  entries: JournalEntry[],
  canvasWidth: number,
  canvasHeight: number
): Star[] {
  // Sort oldest first (index 0 = closest to center, newest = outermost)
  const sorted = [...entries].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  );

  const positions = computeStarPositions(
    sorted.length,
    canvasWidth,
    canvasHeight,
    sorted.map((e) => e.id)
  );

  return sorted.map((entry, i) => ({
    entry,
    position: positions[i],
    visuals: computeStarVisuals(entry),
    label: formatStarLabel(entry.loggedAt),
  }));
}

// ============================================
// MOOD EMOJI
// ============================================

/** Get mood emoji from sentiment score */
export function getMoodEmoji(sentimentScore?: number | null): string {
  if (sentimentScore == null) return "\u2728"; // sparkles
  if (sentimentScore > 0.3) return "\uD83D\uDE0A"; // smiling
  if (sentimentScore > 0) return "\uD83D\uDE42"; // slightly smiling
  if (sentimentScore > -0.3) return "\uD83D\uDE10"; // neutral
  if (sentimentScore > -0.6) return "\uD83D\uDE14"; // pensive
  return "\uD83D\uDE1F"; // worried
}

/** Get mood label from sentiment score */
export function getMoodLabel(sentimentScore?: number | null): string {
  if (sentimentScore == null) return "Not analyzed";
  if (sentimentScore > 0.3) return "Positive";
  if (sentimentScore > 0) return "Slightly positive";
  if (sentimentScore > -0.3) return "Neutral";
  if (sentimentScore > -0.6) return "Reflective";
  return "Stressed";
}
