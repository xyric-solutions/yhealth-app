"use client";

import { motion } from "framer-motion";
import { GlowingOrbWaves } from "@/components/common/glowing-orb-waves";
import { AnimatedEyesAvatar } from "./AnimatedEyesAvatar";
import { AudioVisualizer } from "./AudioVisualizer";
import type { RefObject } from "react";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface VoiceAssistantOrbProps {
  voiceState: VoiceState;
  voiceAssistantAvatarUrl: string | null;
  isConversationActive: boolean;
  orbColors: string[];
  toggleConversation: () => void;
  avatarFileInputRef: RefObject<HTMLInputElement | null>;
  handleAvatarFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function VoiceAssistantOrb({
  voiceState,
  voiceAssistantAvatarUrl,
  isConversationActive,
  orbColors,
  toggleConversation,
  avatarFileInputRef,
  handleAvatarFileSelect,
}: VoiceAssistantOrbProps) {
  return (
    <div className="relative mb-6 sm:mb-8 flex items-center justify-center group/avatar-container">
      {/* Outer Glow Layers */}
      <motion.div
        className="absolute rounded-full"
        style={{
          background: `radial-gradient(circle, ${orbColors[0]}30 0%, transparent 70%)`,
          width: 280,
          height: 280,
        }}
        animate={{
          scale: voiceState === "listening" ? [1, 1.3, 1] : voiceState === "speaking" ? [1, 1.15, 1] : 1,
          opacity: isConversationActive ? [0.6, 0.8, 0.6] : 0.2,
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Main Orb */}
      <motion.button
        onClick={toggleConversation}
        className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full flex items-center justify-center overflow-hidden cursor-pointer"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(236, 72, 153, 0.25), rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.15), transparent)",
          backdropFilter: "blur(25px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: `
            0 0 80px rgba(236, 72, 153, 0.5),
            0 0 120px rgba(139, 92, 246, 0.4),
            0 0 160px rgba(59, 130, 246, 0.3),
            inset 0 0 60px rgba(255, 255, 255, 0.08)
          `,
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        animate={
          isConversationActive && voiceState === "listening"
            ? { scale: [1, 1.05, 1] }
            : { scale: 1 }
        }
        transition={{
          scale: { duration: 0.5, repeat: isConversationActive && voiceState === "listening" ? Infinity : 0 },
        }}
      >
        <GlowingOrbWaves
          size={192}
          active={isConversationActive}
          voiceState={voiceState}
        />

        <div className="relative z-10 w-full h-full flex items-center justify-center">
          {voiceAssistantAvatarUrl ? (
            <div className="relative w-full h-full rounded-full overflow-hidden">
              {/* 3D effect container */}
              <div 
                className="relative w-full h-full rounded-full"
                style={{
                  transformStyle: "preserve-3d",
                  perspective: "1000px",
                }}
              >
                <motion.img
                  src={voiceAssistantAvatarUrl}
                  alt="Voice Assistant"
                  className="w-full h-full object-cover rounded-full"
                  style={{
                    filter: "drop-shadow(0 10px 30px rgba(0, 0, 0, 0.3))",
                    transform: "translateZ(20px)",
                  }}
                  whileHover={{
                    scale: 1.05,
                    rotateY: 5,
                    rotateX: 5,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                  onError={(e) => {
                    // Fallback to animated eyes if custom image fails
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
                {/* 3D shine effect */}
                <div 
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(0, 0, 0, 0.1) 100%)",
                    mixBlendMode: "overlay",
                  }}
                />
                {/* 3D border highlight */}
                <div 
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    border: "2px solid rgba(255, 255, 255, 0.2)",
                    boxShadow: `
                      inset 0 0 20px rgba(255, 255, 255, 0.1),
                      0 0 40px rgba(139, 92, 246, 0.3),
                      0 0 60px rgba(236, 72, 153, 0.2)
                    `,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <AnimatedEyesAvatar voiceState={voiceState} />
            </div>
          )}
        </div>

        {/* Audio Visualizer */}
        <AudioVisualizer active={isConversationActive} state={voiceState} />
      </motion.button>
      
      {/* Hidden file input for avatar upload */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleAvatarFileSelect}
        className="hidden"
      />
    </div>
  );
}

