/**
 * @file ConversationTranscript Component
 * @description Chat-bubble display for voice journal conversation
 */

"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Bot, Loader2 } from "lucide-react";
import type { VoiceJournalTranscriptEntry } from "@shared/types/domain/wellbeing";

interface ConversationTranscriptProps {
  transcript: VoiceJournalTranscriptEntry[];
  isProcessing?: boolean;
}

export function ConversationTranscript({ transcript, isProcessing }: ConversationTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript.length, isProcessing]);

  if (transcript.length === 0 && !isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Bot className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-sm text-slate-400 max-w-[250px]">
          Start speaking to begin your journaling conversation
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10"
    >
      {transcript.map((entry, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`flex gap-3 ${entry.role === "user" ? "flex-row-reverse" : "flex-row"}`}
        >
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              entry.role === "user" ? "bg-emerald-500/20" : "bg-indigo-500/20"
            }`}
          >
            {entry.role === "user" ? (
              <User className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
            )}
          </div>
          <div
            className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              entry.role === "user"
                ? "bg-emerald-500/15 text-slate-200 rounded-tr-sm"
                : "bg-white/5 text-slate-300 rounded-tl-sm border border-white/10"
            }`}
          >
            {entry.text}
          </div>
        </motion.div>
      ))}

      {/* Typing indicator */}
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-3"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/5 border border-white/10">
            <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
          </div>
        </motion.div>
      )}
    </div>
  );
}
