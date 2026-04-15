"use client";

/**
 * @file MindConstellation Component
 * @description Orchestrator for the Mind Observatory — hybrid Canvas + DOM + SVG
 * constellation visualization. Manages data fetching, filter state, and composes
 * all sub-layers: background, SVG lines, mind core, star layer, and UI chrome.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Stars, Sun } from "lucide-react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { journalService } from "@/src/shared/services/wellbeing.service";
import type { JournalEntry } from "@shared/types/domain/wellbeing";

import {
  computeStarVisuals,
  findConsecutivePairs,
  formatStarLabel,
  polarToXY,
  seededRandom,
} from "./constellation-math";
import type { ScreenStar } from "./ObservatoryStarLayer";
import { useObservatoryEngine } from "./useObservatoryEngine";
import { ConstellationBackground } from "./ConstellationBackground";
import { ConstellationSVGLines } from "./ConstellationSVGLines";
import { MindCore } from "./MindCore";
import { ObservatoryStarLayer } from "./ObservatoryStarLayer";
import { ObservatoryHeader } from "./ObservatoryHeader";
import { ObservatoryFilterBar } from "./ObservatoryFilterBar";
import type { FilterPeriod } from "./ObservatoryFilterBar";
import { ObservatoryMoodLegend } from "./ObservatoryMoodLegend";
import { StarTooltip } from "./StarTooltip";
import { JournalEntryModal } from "./JournalEntryModal";
import { ConstellationEmptyState } from "./ConstellationEmptyState";

// ============================================
// TYPES
// ============================================

interface MindConstellationProps {
  onOpenNewEntry: () => void;
  onStartCheckin: () => void;
  hasCheckedInToday: boolean;
  checkinLoading: boolean;
  onSwitchToList: () => void;
  onEditEntry?: (entry: JournalEntry) => void;
}

// ============================================
// CONSTANTS
// ============================================

const INNER_RADIUS = 0.15;
const OUTER_RADIUS = 0.42;
const TILT_Y = 0.52;

// ============================================
// HELPERS
// ============================================

function getDateRange(filter: FilterPeriod): { startDate?: string; endDate?: string } {
  if (filter.mode === "all_time") return {};
  if (filter.mode === "year") {
    return {
      startDate: `${filter.year}-01-01`,
      endDate: `${filter.year}-12-31`,
    };
  }
  // month
  const _start = new Date(filter.year, filter.month, 1);
  const end = new Date(filter.year, filter.month + 1, 0); // last day of month
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    startDate: `${filter.year}-${pad(filter.month + 1)}-01`,
    endDate: `${filter.year}-${pad(filter.month + 1)}-${pad(end.getDate())}`,
  };
}

// ============================================
// COMPONENT
// ============================================

export function MindConstellation({
  onOpenNewEntry,
  onStartCheckin,
  hasCheckedInToday,
  checkinLoading,
  onSwitchToList,
  onEditEntry,
}: MindConstellationProps) {
  const prefersReducedMotion = useReducedMotionSafe();

  // --- Container size ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // --- Filter ---
  const now = new Date();
  const [filter, setFilter] = useState<FilterPeriod>({
    mode: "month",
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  // --- Data ---
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      const range = getDateRange(filter);
      const result = await journalService.getEntries({
        limit: 100,
        page: 1,
        ...range,
      });
      if (result.success && result.data) {
        setEntries(result.data.entries || []);
      }
    } catch {
      // Silently handle — constellation shows empty
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Refresh on journal-logged event
  useEffect(() => {
    const handler = () => fetchEntries();
    window.addEventListener("journal-logged", handler);
    return () => window.removeEventListener("journal-logged", handler);
  }, [fetchEntries]);

  // --- Group entries by date ---
  const dateGroups = useMemo(() => {
    const groups = new Map<string, JournalEntry[]>();
    for (const entry of entries) {
      const dateKey = entry.loggedAt.split("T")[0];
      const existing = groups.get(dateKey);
      if (existing) {
        existing.push(entry);
      } else {
        groups.set(dateKey, [entry]);
      }
    }
    // Sort entries within each group by time (newest first)
    for (const group of groups.values()) {
      group.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    }
    return groups;
  }, [entries]);

  // --- Interaction state ---
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [clickedEntries, setClickedEntries] = useState<JournalEntry[] | null>(null);

  const clearClickedEntries = useCallback(() => setClickedEntries(null), []);

  // --- Engine ---
  const { rotationAngle, parallaxX, parallaxY } = useObservatoryEngine({
    pauseRotation: hoveredIndex !== null,
    width: size.width,
    height: size.height,
    disabled: prefersReducedMotion,
  });

  // --- Sorted date keys (oldest first → innermost orbit, newest → outermost) ---
  const sortedDateKeys = useMemo(
    () =>
      [...dateGroups.keys()].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      ),
    [dateGroups]
  );

  // --- Representative entries (one per date, for star visuals) ---
  const sortedRepEntries = useMemo(
    () => sortedDateKeys.map((dk) => dateGroups.get(dk)![0]),
    [sortedDateKeys, dateGroups]
  );

  // --- Compute screen positions (1 star per date) ---
  const cx = size.width / 2;
  const cy = size.height / 2;
  const minDim = Math.min(size.width, size.height);

  const screenStars: ScreenStar[] = useMemo(() => {
    if (sortedDateKeys.length === 0 || minDim === 0) return [];

    return sortedDateKeys.map((dateKey, i) => {
      const groupEntries = dateGroups.get(dateKey)!;
      const repEntry = groupEntries[0]; // latest entry for the day
      const count = groupEntries.length;

      const t = sortedDateKeys.length === 1 ? 0 : i / (sortedDateKeys.length - 1);
      const radiusFrac = INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * t;
      const angle = seededRandom(repEntry.id) * Math.PI * 2;
      const radiusPx = radiusFrac * minDim;

      const { x: dx, y: dy } = polarToXY(angle + rotationAngle, radiusPx, TILT_Y);
      const visuals = computeStarVisuals(repEntry);

      // Scale star size with entry count
      const sizeBoost = Math.min((count - 1) * 5, 20);

      return {
        id: repEntry.id,
        x: cx + dx + parallaxX,
        y: cy + dy + parallaxY,
        domSize: visuals.domSize + sizeBoost,
        color: visuals.color,
        glowColor: visuals.glowColor,
        brightness: visuals.brightness,
        twinkleSpeed: visuals.twinkleSpeed,
        twinklePhase: visuals.twinklePhase,
        loggedAt: repEntry.loggedAt,
        sentimentScore: repEntry.sentimentScore,
        entryCount: count,
        dateKey,
      };
    });
  }, [sortedDateKeys, dateGroups, rotationAngle, parallaxX, parallaxY, cx, cy, minDim]);

  // --- Consecutive-day pairs ---
  const consecutivePairs = useMemo(
    () => findConsecutivePairs(sortedRepEntries),
    [sortedRepEntries]
  );

  // --- Line points for SVG ---
  const linePoints = useMemo(
    () => screenStars.map((s) => ({ x: s.x, y: s.y, color: s.color })),
    [screenStars]
  );

  // --- Handlers ---
  const handleStarClick = useCallback(
    (index: number) => {
      const dateKey = sortedDateKeys[index];
      const group = dateKey ? dateGroups.get(dateKey) : null;
      if (group) setClickedEntries(group);
    },
    [sortedDateKeys, dateGroups]
  );

  const handleDeleteEntry = useCallback(
    async (entryId: string) => {
      try {
        const result = await journalService.deleteEntry(entryId);
        if (result.success) {
          clearClickedEntries();
          fetchEntries();
        }
      } catch {
        // Error handling
      }
    },
    [clearClickedEntries, fetchEntries]
  );

  // --- Hovered tooltip data ---
  const hoveredDateKey = hoveredIndex !== null ? sortedDateKeys[hoveredIndex] : null;
  const hoveredEntries = hoveredDateKey ? dateGroups.get(hoveredDateKey) ?? null : null;
  const hoveredPosition =
    hoveredIndex !== null && screenStars[hoveredIndex]
      ? { x: screenStars[hoveredIndex].x, y: screenStars[hoveredIndex].y }
      : null;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100dvh-5rem)] md:h-[calc(100dvh)] overflow-hidden"
      style={{ background: "#02020a" }}
    >
      {/* Layer 0: Canvas background (nebula + micro-stars) */}
      <ConstellationBackground width={size.width} height={size.height} />

      {/* Layer 5: SVG constellation lines */}
      <ConstellationSVGLines
        width={size.width}
        height={size.height}
        cx={cx + parallaxX}
        cy={cy + parallaxY}
        stars={linePoints}
        consecutivePairs={consecutivePairs}
      />

      {/* Layer 10: Mind Core (CSS-animated orb) */}
      <MindCore cx={cx + parallaxX} cy={cy + parallaxY} />

      {/* Layer 15: DOM Stars */}
      <ObservatoryStarLayer
        stars={screenStars}
        hoveredIndex={hoveredIndex}
        onHover={setHoveredIndex}
        onClick={handleStarClick}
      />

      {/* Layer 30: UI chrome */}
      <ObservatoryHeader
        entryCount={entries.length}
        onNewEntry={onOpenNewEntry}
      />

      <ObservatoryFilterBar filter={filter} onFilterChange={setFilter} />

      {/* Check-in banner */}
      {!checkinLoading && !hasCheckedInToday && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex justify-center"
          style={{ top: 112, zIndex: 30 }}
        >
          <button
            onClick={onStartCheckin}
            className="flex items-center gap-3 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm hover:bg-amber-500/20 transition-all observatory-font-display"
            style={{ fontSize: 10, letterSpacing: "0.12em" }}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300">DAILY CHECK-IN</span>
          </button>
        </div>
      )}

      <ObservatoryMoodLegend
        starCount={screenStars.length}
        onSwitchToList={onSwitchToList}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-3 text-white/40">
            <Stars className="w-5 h-5 animate-pulse" />
            <span
              className="observatory-font-display"
              style={{ fontSize: 10, letterSpacing: "0.15em" }}
            >
              MAPPING REFLECTIONS...
            </span>
          </div>
        </div>
      )}

      {/* Layer 40: Tooltip */}
      <AnimatePresence>
        {hoveredEntries && hoveredPosition && (
          <StarTooltip
            entries={hoveredEntries}
            position={hoveredPosition}
            label={formatStarLabel(hoveredEntries[0].loggedAt)}
          />
        )}
      </AnimatePresence>

      {/* Layer 40: Entry modal */}
      <AnimatePresence>
        {clickedEntries && (
          <JournalEntryModal
            entries={clickedEntries}
            onClose={clearClickedEntries}
            onEdit={onEditEntry ? (entry) => { clearClickedEntries(); onEditEntry(entry); } : undefined}
            onDelete={handleDeleteEntry}
          />
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!isLoading && entries.length === 0 && (
        <ConstellationEmptyState onCreateEntry={onOpenNewEntry} />
      )}
    </div>
  );
}
