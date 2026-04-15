"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface VoiceAssistantControlsProps {
  userName: string | null;
}

export function VoiceAssistantControls({
  userName,
}: VoiceAssistantControlsProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 pb-6 sm:pb-8 text-center backdrop-blur-xl z-10"
      style={{
        background: "linear-gradient(to top, rgba(11, 15, 20, 0.9), rgba(11, 15, 20, 0.5), transparent)",
      }}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-4 h-4" style={{ color: "#00E5FF" }} />
        </motion.div>
        <span
          className="font-bold text-sm sm:text-base"
          style={{
            background: "linear-gradient(135deg, #00E5FF, #1DE9B6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Balencia AI
        </span>
      </div>
      <p className="text-xs sm:text-sm font-medium" style={{ color: "#888" }}>
        Speak naturally • Auto-responds • {userName ? `Personalized for ${userName}` : "Always here to help"}
      </p>
    </motion.div>
  );
}

