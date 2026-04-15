"use client";

/**
 * @file JournalEntryModal Component
 * @description Observatory-styled date-grouped entry view modal. Shows all
 * journal entries for a given date with individual times, mood badges, and actions.
 */

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pencil, Trash2, Sparkles, ChevronDown, ChevronUp, Clock } from "lucide-react";
import type { JournalEntry, JournalingMode } from "@shared/types/domain/wellbeing";
import { formatStarLabel, formatTime, getMoodEmoji, getMoodLabel } from "./constellation-math";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JournalEntryModalProps {
  entries: JournalEntry[];
  onClose: () => void;
  onEdit?: (entry: JournalEntry) => void;
  onDelete?: (entryId: string) => void;
}

// ---------------------------------------------------------------------------
// Journaling mode labels
// ---------------------------------------------------------------------------

const JOURNALING_MODE_LABELS: Record<JournalingMode, string> = {
  quick_reflection: "Quick Reflection",
  deep_dive: "Deep Dive",
  gratitude: "Gratitude",
  life_perspective: "Life Perspective",
  free_write: "Free Write",
  voice_conversation: "Voice Journal",
};

// ---------------------------------------------------------------------------
// Sentiment pill color
// ---------------------------------------------------------------------------

function getSentimentColor(score?: number | null): string {
  if (score == null) return "#94a3b8";
  if (score > 0.3) return "#fbbf24";
  if (score > -0.3) return "#60a5fa";
  if (score > -0.6) return "#a78bfa";
  return "#f87171";
}

// ---------------------------------------------------------------------------
// Single Entry Card
// ---------------------------------------------------------------------------

function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: JournalEntry;
  onEdit?: (entry: JournalEntry) => void;
  onDelete?: (entryId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReflection, setShowReflection] = useState(false);

  const time = formatTime(entry.loggedAt);
  const moodEmoji = getMoodEmoji(entry.sentimentScore);
  const moodLabel = getMoodLabel(entry.sentimentScore);
  const sentimentColor = getSentimentColor(entry.sentimentScore);
  const modeLabel = entry.journalingMode
    ? JOURNALING_MODE_LABELS[entry.journalingMode]
    : null;

  const isLong = entry.entryText.length > 150;
  const displayText = expanded || !isLong
    ? entry.entryText
    : entry.entryText.slice(0, 150) + "...";

  return (
    <div
      className="relative rounded-xl border border-purple-500/10 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(14, 10, 34, 0.6) 0%, rgba(7, 5, 22, 0.8) 100%)",
      }}
    >
      {/* Left accent line */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ backgroundColor: `${sentimentColor}40` }}
      />

      <div className="p-4 pl-5 space-y-3">
        {/* Time + mood + mode row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* Time badge */}
            <span
              className="inline-flex items-center gap-1.5 observatory-font-display text-white/70"
              style={{ fontSize: 13, letterSpacing: "0.05em" }}
            >
              <Clock className="w-3.5 h-3.5 text-purple-400/60" />
              {time}
            </span>

            {/* Mood pill */}
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border observatory-font-display"
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                color: sentimentColor,
                borderColor: `${sentimentColor}25`,
                background: `${sentimentColor}08`,
              }}
            >
              <span aria-hidden="true">{moodEmoji}</span>
              {moodLabel.toUpperCase()}
            </span>

            {/* Mode tag */}
            {modeLabel && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/8 observatory-font-display text-white/25"
                style={{ fontSize: 8, letterSpacing: "0.1em" }}
              >
                {modeLabel.toUpperCase()}
              </span>
            )}
          </div>

          {/* Word count */}
          <span
            className="observatory-font-display text-white/15"
            style={{ fontSize: 8, letterSpacing: "0.1em" }}
          >
            {entry.wordCount} WORDS
          </span>
        </div>

        {/* Prompt */}
        {entry.prompt && (
          <div
            className="pl-3 py-1"
            style={{ borderLeft: `2px solid ${sentimentColor}20` }}
          >
            <p
              className="observatory-font-body text-white/30 italic leading-relaxed"
              style={{ fontSize: 11 }}
            >
              {entry.prompt}
            </p>
          </div>
        )}

        {/* Entry text */}
        <p
          className="observatory-font-body whitespace-pre-wrap leading-relaxed text-white/65"
          style={{ fontSize: 13 }}
        >
          {displayText}
        </p>

        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-purple-400/50 hover:text-purple-300/70 transition-colors observatory-font-display"
            style={{ fontSize: 9, letterSpacing: "0.1em" }}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" /> SHOW LESS
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> READ MORE
              </>
            )}
          </button>
        )}

        {/* AI Reflection (collapsible) */}
        {entry.coachReflection && (
          <div>
            <button
              onClick={() => setShowReflection(!showReflection)}
              className="inline-flex items-center gap-1.5 text-purple-400/40 hover:text-purple-300/60 transition-colors observatory-font-display"
              style={{ fontSize: 9, letterSpacing: "0.12em" }}
            >
              <Sparkles className="w-3 h-3" />
              AI REFLECTION
              {showReflection ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            <AnimatePresence>
              {showReflection && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-2 rounded-lg border border-purple-500/10 p-3"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(88, 28, 135, 0.03) 100%)",
                    }}
                  >
                    <p
                      className="observatory-font-body text-white/45 italic leading-relaxed"
                      style={{ fontSize: 11 }}
                    >
                      {entry.coachReflection}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {onEdit && (
            <button
              onClick={() => onEdit(entry)}
              className="inline-flex items-center gap-1 text-white/25 hover:text-white/50 transition-colors observatory-font-display"
              style={{ fontSize: 9, letterSpacing: "0.08em" }}
            >
              <Pencil className="w-3 h-3" />
              EDIT
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(entry.id)}
              className="inline-flex items-center gap-1 text-red-400/30 hover:text-red-300/60 transition-colors observatory-font-display"
              style={{ fontSize: 9, letterSpacing: "0.08em" }}
            >
              <Trash2 className="w-3 h-3" />
              DELETE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal Component
// ---------------------------------------------------------------------------

export function JournalEntryModal({
  entries,
  onClose,
  onEdit,
  onDelete,
}: JournalEntryModalProps) {
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (entries.length === 0) return null;

  const dateLabel = formatStarLabel(entries[0].loggedAt);
  const entryCount = entries.length;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(2, 2, 10, 0.75)", backdropFilter: "blur(8px)" }}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-label={`Journal entries from ${dateLabel}`}
      >
        {/* Panel */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 24 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          onClick={handlePanelClick}
          className="relative max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-2xl border border-purple-500/15 shadow-2xl observatory-scroll"
          style={{
            background:
              "linear-gradient(135deg, rgba(14, 10, 34, 0.95) 0%, rgba(7, 5, 22, 0.98) 50%, rgba(14, 10, 34, 0.95) 100%)",
            boxShadow:
              "0 0 60px rgba(139, 92, 246, 0.08), 0 16px 64px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Top glow */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent)",
            }}
          />

          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 p-6 pb-4">
              <div className="space-y-2">
                {/* Date */}
                <p
                  className="observatory-font-display text-purple-300/60"
                  style={{ fontSize: 10, letterSpacing: "0.2em" }}
                >
                  {dateLabel}
                </p>

                {/* Entry count badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-purple-500/20 observatory-font-display text-purple-300/50"
                  style={{ fontSize: 10, letterSpacing: "0.1em", background: "rgba(139, 92, 246, 0.06)" }}
                >
                  {entryCount} {entryCount === 1 ? "REFLECTION" : "REFLECTIONS"}
                </span>
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Entry cards */}
            <div className="px-6 pb-6 space-y-3">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
