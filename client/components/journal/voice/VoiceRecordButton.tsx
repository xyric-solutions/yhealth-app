/**
 * @file VoiceRecordButton Component
 * @description Large circular record button with pulsing animation
 */

"use client";

import { motion } from "framer-motion";
import { Mic, Square, Loader2 } from "lucide-react";
import type { RecorderState } from "./useVoiceRecorder";

interface VoiceRecordButtonProps {
  state: RecorderState;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function VoiceRecordButton({ state, onStart, onStop, disabled }: VoiceRecordButtonProps) {
  const isRecording = state === "recording";
  const isRequesting = state === "requesting";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {/* Pulsing ring when recording */}
        {isRecording && (
          <motion.div
            className="absolute inset-0 rounded-full bg-red-500/20"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        <motion.button
          onClick={isRecording ? onStop : onStart}
          disabled={disabled || isRequesting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording
              ? "bg-red-500 shadow-lg shadow-red-500/40"
              : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isRequesting ? (
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          ) : isRecording ? (
            <Square className="w-7 h-7 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </motion.button>
      </div>

      <span className="text-xs text-slate-500">
        {isRecording
          ? "Tap to stop"
          : isRequesting
          ? "Requesting mic..."
          : "Tap to speak"}
      </span>
    </div>
  );
}
