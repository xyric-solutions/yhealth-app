"use client";

/**
 * @file DistractionFreeEditor Component
 * @description Full-screen, Observatory-styled writing surface for journal entries.
 * Deep space aesthetic with Cinzel headings, Nunito body, ambient glow,
 * serif textarea, word/character counts, elapsed timer, and keyboard shortcuts.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Check, CloudOff, Feather, CalendarDays } from "lucide-react";
import type { JournalingMode } from "@shared/types/domain/wellbeing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistractionFreeEditorProps {
  prompt?: string | null;
  mode: JournalingMode;
  value: string;
  onChange: (text: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  autoSaveStatus?: "idle" | "saving" | "saved";
  /** Selected date for the entry (YYYY-MM-DD). Defaults to today. */
  entryDate?: string;
  onDateChange?: (date: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<JournalingMode, { label: string; accent: string }> = {
  quick_reflection: { label: "QUICK REFLECTION", accent: "rgba(96, 165, 250, 0.5)" },
  deep_dive: { label: "DEEP DIVE", accent: "rgba(168, 85, 247, 0.5)" },
  gratitude: { label: "GRATITUDE", accent: "rgba(251, 191, 36, 0.5)" },
  life_perspective: { label: "LIFE PERSPECTIVE", accent: "rgba(139, 92, 246, 0.5)" },
  free_write: { label: "FREE WRITE", accent: "rgba(148, 163, 184, 0.5)" },
  voice_conversation: { label: "VOICE JOURNAL", accent: "rgba(45, 212, 191, 0.5)" },
};

const PLACEHOLDER_BY_MODE: Record<JournalingMode, string> = {
  quick_reflection:
    "Take a moment to reflect on your day so far. What stands out?",
  deep_dive:
    "Let your thoughts flow freely. Explore what is on your mind without judgement...",
  gratitude:
    "Name three things you are grateful for today. Why do they matter to you?",
  life_perspective:
    "Consider your values and the person you are becoming. What do you notice?",
  free_write:
    "Start writing. There are no rules here -- just let the words come...",
  voice_conversation:
    "Speak your thoughts aloud. Your voice will be transcribed and guided by AI...",
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AutoSaveBadge({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null;

  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-1.5 observatory-font-display text-white/25"
      style={{ fontSize: 8, letterSpacing: "0.12em" }}
    >
      {status === "saving" ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          SAVING
        </>
      ) : (
        <>
          <Check className="w-3 h-3 text-emerald-400/60" />
          SAVED
        </>
      )}
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DistractionFreeEditor({
  prompt = null,
  mode,
  value,
  onChange,
  onClose,
  onSubmit,
  isSubmitting = false,
  autoSaveStatus = "idle",
  entryDate,
  onDateChange,
}: DistractionFreeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // Focus textarea on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (value.trim().length > 0 && !isSubmitting) {
          onSubmit();
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [value, isSubmitting, onSubmit, onClose]
  );

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;
  const modeInfo = MODE_LABELS[mode];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 40%, #0e0a22 0%, #070516 40%, #02020a 100%)",
      }}
    >
      {/* Ambient nebula glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: "60vw",
          height: "40vh",
          background: `radial-gradient(ellipse, ${modeInfo.accent.replace("0.5", "0.04")} 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex items-center justify-between px-6 py-4"
        style={{ zIndex: 10 }}
      >
        {/* Left: auto-save + date picker + mode badge */}
        <div className="flex items-center gap-4">
          <AutoSaveBadge status={autoSaveStatus} />
          {/* Date picker */}
          {onDateChange && (
            <label className="relative flex items-center gap-1.5 cursor-pointer group">
              <CalendarDays className="w-3 h-3 text-white/20 group-hover:text-white/40 transition-colors" />
              <input
                type="date"
                value={entryDate || new Date().toISOString().split("T")[0]}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => onDateChange(e.target.value)}
                className="observatory-font-display bg-transparent border border-white/8 rounded-full px-2.5 py-0.5 text-white/30 hover:text-white/50 hover:border-white/15 focus:text-white/60 focus:border-purple-500/30 outline-none transition-all cursor-pointer"
                style={{ fontSize: 9, letterSpacing: "0.1em", colorScheme: "dark" }}
              />
            </label>
          )}
          <span
            className="observatory-font-display text-white/20 border border-white/8 rounded-full px-2.5 py-0.5"
            style={{ fontSize: 8, letterSpacing: "0.12em" }}
          >
            {modeInfo.label}
          </span>
        </div>

        {/* Right: submit + close */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSubmit}
            disabled={isSubmitting || value.trim().length === 0}
            className="observatory-font-display flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/50 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ fontSize: 10, letterSpacing: "0.15em" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                SAVING...
              </>
            ) : (
              <>
                <Feather className="w-3.5 h-3.5" />
                SAVE REFLECTION
              </>
            )}
          </button>

          <button
            onClick={onClose}
            aria-label="Close editor"
            className="p-2 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* Centered writing area */}
      <div className="flex-1 flex flex-col items-center overflow-y-auto px-4 sm:px-6 observatory-scroll">
        <div className="w-full max-w-2xl flex flex-col flex-1 py-4 sm:py-8">
          {/* AI prompt */}
          {prompt && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="relative mb-10"
            >
              {/* Ambient glow behind prompt */}
              <div
                className="absolute -inset-4 rounded-2xl pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse, ${modeInfo.accent.replace("0.5", "0.06")} 0%, transparent 70%)`,
                  filter: "blur(20px)",
                }}
              />

              {/* Prompt card */}
              <div
                className="relative px-6 py-5 rounded-xl border border-white/5"
                style={{
                  background: "rgba(255, 255, 255, 0.015)",
                }}
              >
                {/* Top accent line */}
                <div
                  className="absolute top-0 left-6 right-6 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${modeInfo.accent.replace("0.5", "0.2")}, transparent)`,
                  }}
                />

                <p
                  className="observatory-font-body text-white/50 italic leading-relaxed text-center"
                  style={{ fontSize: 16 }}
                >
                  {prompt}
                </p>
              </div>
            </motion.div>
          )}

          {/* Textarea */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex-1 flex flex-col"
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={PLACEHOLDER_BY_MODE[mode]}
              aria-label="Journal entry text"
              className="
                flex-1 w-full resize-none bg-transparent border-none outline-none
                observatory-font-body
                text-white/70 placeholder:text-white/15
                selection:bg-purple-500/20
                min-h-[300px]
              "
              style={{ fontSize: 16, lineHeight: 1.9, letterSpacing: "0.01em" }}
              spellCheck
            />
          </motion.div>
        </div>
      </div>

      {/* Bottom status bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-between px-6 py-3"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}
      >
        <div
          className="flex items-center gap-4 observatory-font-display text-white/15"
          style={{ fontSize: 9, letterSpacing: "0.1em" }}
        >
          <span>{wordCount} WORDS</span>
          <span>{charCount} CHARACTERS</span>
        </div>

        <div
          className="flex items-center gap-4 observatory-font-display text-white/15"
          style={{ fontSize: 9, letterSpacing: "0.1em" }}
        >
          {autoSaveStatus === "idle" && value.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <CloudOff className="w-3 h-3" />
              NOT SAVED
            </span>
          )}
          <span>{formatElapsed(elapsed)}</span>
          <span className="hidden sm:inline text-white/10">
            CTRL+ENTER TO SAVE
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
