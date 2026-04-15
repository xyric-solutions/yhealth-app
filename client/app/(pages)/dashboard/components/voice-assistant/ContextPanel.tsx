"use client";

import { motion, AnimatePresence } from "framer-motion";
import { SkipForward } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface ContextPanelProps {
  transcript?: string;
  interimTranscript?: string;
  aiResponse?: string;
  voiceState: VoiceState;
  isVisible: boolean;
  onSkipSpeaking?: () => void;
}

const STATE_LABELS = {
  idle: "Ready",
  listening: "Listening",
  processing: "Processing",
  speaking: "Speaking",
};

export function ContextPanel({
  transcript,
  interimTranscript,
  aiResponse,
  voiceState,
  isVisible,
  onSkipSpeaking,
}: ContextPanelProps) {
  const shouldReduceMotion = useReducedMotion();

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {(transcript || interimTranscript || aiResponse) && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute bottom-4 sm:bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl max-h-[10rem] overflow-y-auto px-3 sm:px-4 z-20"
        >
          <div
            className="relative backdrop-blur-xl rounded-lg border p-3 "
            style={{
              background: "rgba(11, 15, 20, 0.7)",
              borderColor: "rgba(0, 229, 255, 0.15)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 229, 255, 0.1)",
            }}
          >
            {/* Status indicator - minimal */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: voiceState === "listening" ? "#00E5FF" : voiceState === "processing" ? "#7C4DFF" : "#1DE9B6" }}
                  animate={
                    shouldReduceMotion
                      ? {}
                      : {
                          opacity: [1, 0.4, 1],
                          scale: [1, 1.2, 1],
                        }
                  }
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="font-medium tracking-wider uppercase" style={{ color: "#00E5FF", fontSize: "12px" }}>
                  {STATE_LABELS[voiceState]}
                </span>
              </div>
              
              {/* Skip button - only show when speaking */}
              {voiceState === "speaking" && onSkipSpeaking && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onSkipSpeaking}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#F87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                  }}
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Skip</span>
                </motion.button>
              )}
            </div>

            {/* User transcript - simplified */}
            {(transcript || interimTranscript) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="leading-relaxed max-h-[10rem] overflow-y-auto" style={{ color: "#E0E0E0", fontSize: "12px" }}>
                  {transcript}
                  {interimTranscript && (
                    <>
                      <span style={{ color: "#888" }}>{interimTranscript}</span>
                      {!shouldReduceMotion && (
                        <motion.span
                          className="inline-block w-0.5 h-3 ml-1 align-middle"
                          style={{ backgroundColor: "#00E5FF" }}
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      )}
                    </>
                  )}
                </p>
              </motion.div>
            )}

            {/* AI response - rendered as markdown */}
            {aiResponse && voiceState !== "listening" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 pt-2 border-t"
                style={{ borderColor: "rgba(0, 229, 255, 0.1)" }}
              >
                <div className="prose prose-invert prose-sm max-w-none leading-relaxed" style={{ color: "#E0E0E0", fontSize: "12px" }}>
                  <ReactMarkdown>{aiResponse}</ReactMarkdown>
                  {voiceState === "speaking" && !shouldReduceMotion && (
                    <motion.span
                      className="inline-block w-0.5 h-3 ml-1 align-middle"
                      style={{ backgroundColor: "#1DE9B6" }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </div>
              </motion.div>
            )}

            {/* HUD-style corner accents */}
            <div
              className="absolute top-2 left-2 w-3 h-3 border-t border-l"
              style={{ borderColor: "rgba(0, 229, 255, 0.3)" }}
            />
            <div
              className="absolute top-2 right-2 w-3 h-3 border-t border-r"
              style={{ borderColor: "rgba(0, 229, 255, 0.3)" }}
            />
            <div
              className="absolute bottom-2 left-2 w-3 h-3 border-b border-l"
              style={{ borderColor: "rgba(0, 229, 255, 0.3)" }}
            />
            <div
              className="absolute bottom-2 right-2 w-3 h-3 border-b border-r"
              style={{ borderColor: "rgba(0, 229, 255, 0.3)" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

