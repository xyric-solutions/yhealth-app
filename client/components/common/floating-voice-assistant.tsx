"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Mic, Sparkles } from "lucide-react";
import { useVoiceAssistant } from "@/app/context/VoiceAssistantContext";

export function FloatingVoiceAssistant() {
  const { openVoiceAssistant, userMood } = useVoiceAssistant();
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Motion values for eye positions
  const leftEyeX = useMotionValue(0);
  const leftEyeY = useMotionValue(0);
  const rightEyeX = useMotionValue(0);
  const rightEyeY = useMotionValue(0);
  
  // Smooth spring animations for eyes
  const leftEyeXSpring = useSpring(leftEyeX, { stiffness: 300, damping: 30 });
  const leftEyeYSpring = useSpring(leftEyeY, { stiffness: 300, damping: 30 });
  const rightEyeXSpring = useSpring(rightEyeX, { stiffness: 300, damping: 30 });
  const rightEyeYSpring = useSpring(rightEyeY, { stiffness: 300, damping: 30 });

  // Track mouse position relative to button
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate relative position from center
      const relativeX = (e.clientX - centerX) / (rect.width / 2);
      const relativeY = (e.clientY - centerY) / (rect.height / 2);
      
      // Limit eye movement to stay within eye bounds (max 4px movement)
      // Eye is 16px (w-4), so max movement is about 4px from center
      const maxMovementPixels = 4;
      const eyeX = Math.max(-maxMovementPixels, Math.min(maxMovementPixels, relativeX * maxMovementPixels * 0.6));
      const eyeY = Math.max(-maxMovementPixels, Math.min(maxMovementPixels, relativeY * maxMovementPixels * 0.6));
      
      leftEyeX.set(eyeX);
      leftEyeY.set(eyeY);
      rightEyeX.set(eyeX);
      rightEyeY.set(eyeY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [leftEyeX, leftEyeY, rightEyeX, rightEyeY]);

  const handleClick = () => {
    openVoiceAssistant();
  };

  // Get mood-based colors and expressions
  const getMoodConfig = () => {
    switch (userMood) {
      case "happy":
        return {
          gradient: "from-yellow-500 via-orange-500 to-pink-500",
          glow: "from-yellow-400/50 to-pink-500/50",
          expression: "😊",
        };
      case "excited":
        return {
          gradient: "from-purple-500 via-pink-500 to-red-500",
          glow: "from-purple-400/50 to-red-500/50",
          expression: "🤩",
        };
      case "calm":
        return {
          gradient: "from-blue-500 via-cyan-500 to-teal-500",
          glow: "from-blue-400/50 to-teal-500/50",
          expression: "😌",
        };
      case "stressed":
        return {
          gradient: "from-red-500 via-orange-500 to-yellow-500",
          glow: "from-red-400/50 to-yellow-500/50",
          expression: "😰",
        };
      case "motivated":
        return {
          gradient: "from-green-500 via-emerald-500 to-cyan-500",
          glow: "from-green-400/50 to-cyan-500/50",
          expression: "💪",
        };
      case "sad":
        return {
          gradient: "from-slate-500 via-gray-500 to-blue-500",
          glow: "from-slate-400/50 to-blue-500/50",
          expression: "😔",
        };
      default:
        return {
          gradient: "from-rose-500 via-pink-500 to-purple-600",
          glow: "from-rose-400/50 to-purple-500/50",
          expression: "😐",
        };
    }
  };

  const moodConfig = getMoodConfig();

  return (
    <motion.button
      ref={buttonRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed bottom-6 right-6 z-50 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br ${moodConfig.gradient} shadow-2xl cursor-pointer group overflow-hidden`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        y: isHovered ? 0 : [0, -3, 0],
      }}
      transition={{ 
        type: "spring", 
        stiffness: 200, 
        damping: 20, 
        delay: 0.5,
        y: { duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 0 }
      }}
      whileHover={{ scale: 1.1, y: 0 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Animated background glow */}
      <motion.div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${moodConfig.glow}`}
        animate={{
          scale: isHovered ? [1, 1.2, 1] : 1,
          opacity: isHovered ? [0.5, 0.8, 0.5] : 0.5,
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Pulsing ring effect */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-white/30"
        animate={{
          scale: isHovered ? [1, 1.3, 1] : [1, 1.1, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />


      {/* Face container */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Eyes container */}
        <div className="absolute top-4 sm:top-6 left-0 right-0 flex items-center justify-center gap-4 sm:gap-6">
          {/* Left Eye */}
          <div className="relative w-4 h-4">
            <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm" />
            <div className="absolute inset-0 rounded-full bg-white overflow-hidden">
              <motion.div
                className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900"
                style={{
                  x: leftEyeXSpring,
                  y: leftEyeYSpring,
                }}
              />
            </div>
          </div>

          {/* Right Eye */}
          <div className="relative w-4 h-4">
            <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm" />
            <div className="absolute inset-0 rounded-full bg-white overflow-hidden">
              <motion.div
                className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900"
                style={{
                  x: rightEyeXSpring,
                  y: rightEyeYSpring,
                }}
              />
            </div>
          </div>
        </div>

        {/* Mouth/Smile */}
        <motion.div
          className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-5 sm:w-6 h-2.5 sm:h-3 border-b-2 border-white/60 rounded-full"
          animate={{
            scaleX: isHovered ? 1.2 : 1,
            opacity: isHovered ? 0.8 : 0.6,
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Mic icon in center (visible on hover) */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: isHovered ? 1 : 0,
            scale: isHovered ? 1 : 0.8,
          }}
          transition={{ duration: 0.2 }}
        >
          <Mic className="w-8 h-8 text-white drop-shadow-lg" />
        </motion.div>

        {/* Sparkle effect on hover */}
        {isHovered && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Sparkles className="w-6 h-6 text-white/80 animate-pulse" />
          </motion.div>
        )}
      </div>

      {/* Tooltip */}
      <motion.div
        className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-xl pointer-events-none"
        initial={{ opacity: 0, y: 5 }}
        animate={{
          opacity: isHovered ? 1 : 0,
          y: isHovered ? 0 : 5,
        }}
        transition={{ duration: 0.2 }}
      >
        Voice Assistant
        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
      </motion.div>
    </motion.button>
  );
}

