"use client";

import { motion } from "framer-motion";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface AudioVisualizerProps {
  active: boolean;
  state: VoiceState;
}

export function AudioVisualizer({ active, state }: AudioVisualizerProps) {
  const bars = Array.from({ length: 7 }, (_, i) => i);

  if (!active || state !== "speaking") return null;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1">
      {bars.map((i) => {
        const maxHeight = 20 + (i % 3) * 6;
        const duration = 0.4 + (i % 3) * 0.1;
        return (
          <motion.div
            key={i}
            className="w-1.5 bg-white rounded-full shadow-lg"
            animate={{
              height: [6, maxHeight, 6],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration,
              repeat: Infinity,
              delay: i * 0.05,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}

