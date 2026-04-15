"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface AnimatedEyesAvatarProps {
  voiceState?: VoiceState;
}

export function AnimatedEyesAvatar({ voiceState = "idle" }: AnimatedEyesAvatarProps) {
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const avatarRef = useRef<HTMLDivElement>(null);
  const isSpeaking = voiceState === "speaking";

  // Track mouse position relative to avatar
  useEffect(() => {
    let lastMouseUpdate = Date.now();
    let mouseTimeout: NodeJS.Timeout;

    const handleMouseMove = (e: MouseEvent) => {
      if (!avatarRef.current) return;
      
      lastMouseUpdate = Date.now();
      
      const rect = avatarRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate relative position from center (-1 to 1)
      const relX = (e.clientX - centerX) / (rect.width / 2);
      const relY = (e.clientY - centerY) / (rect.height / 2);
      
      // Limit eye movement to stay within eye bounds (max 6px)
      const maxDistance = 6;
      const distance = Math.min(Math.sqrt(relX * relX + relY * relY), 1);
      const angle = Math.atan2(relY, relX);
      
      setMousePosition({
        x: Math.cos(angle) * distance * maxDistance,
        y: Math.sin(angle) * distance * maxDistance,
      });

      // Clear any pending timeout
      if (mouseTimeout) clearTimeout(mouseTimeout);
      
      // Reset to center if mouse stops moving for 2 seconds
      mouseTimeout = setTimeout(() => {
        setMousePosition({ x: 0, y: 0 });
      }, 2000);
    };

    // Fallback to random movement if mouse not moving
    const randomInterval = setInterval(() => {
      const timeSinceMouseMove = Date.now() - lastMouseUpdate;
      if (timeSinceMouseMove > 3000) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 4;
        setEyePosition({
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
        });
      }
    }, 3000);

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearInterval(randomInterval);
      if (mouseTimeout) clearTimeout(mouseTimeout);
    };
  }, []);

  // Use mouse position if available, otherwise use random position
  const currentEyePosition = mousePosition.x !== 0 || mousePosition.y !== 0 ? mousePosition : eyePosition;

  return (
    <div 
      ref={avatarRef}
      className="relative w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-pink-500 via-purple-500 to-pink-600 flex flex-col items-center justify-center"
    >
      {/* Eyes container */}
      <div className="relative flex items-center gap-6 mb-2">
        {/* Left eye */}
        <div className="relative w-8 h-8 bg-white rounded-full overflow-hidden">
          <motion.div
            className="absolute top-1/2 left-1/2 w-4 h-4 bg-slate-900 rounded-full -translate-x-1/2 -translate-y-1/2"
            animate={{
              x: currentEyePosition.x,
              y: currentEyePosition.y,
            }}
            transition={{
              duration: 0.3,
              ease: "easeOut",
            }}
          />
        </div>
        {/* Right eye */}
        <div className="relative w-8 h-8 bg-white rounded-full overflow-hidden">
          <motion.div
            className="absolute top-1/2 left-1/2 w-4 h-4 bg-slate-900 rounded-full -translate-x-1/2 -translate-y-1/2"
            animate={{
              x: currentEyePosition.x,
              y: currentEyePosition.y,
            }}
            transition={{
              duration: 0.3,
              ease: "easeOut",
            }}
          />
        </div>
      </div>
      
      {/* Mouth - animates when speaking */}
      <div className="relative mt-1 flex items-center justify-center">
        {isSpeaking ? (
          <motion.div
            className="w-10 h-8 rounded-full bg-slate-900 relative overflow-hidden"
            animate={{
              scaleY: [1, 0.4, 1, 0.6, 1, 0.5, 1, 0.7, 1],
              scaleX: [1, 1.3, 1, 1.2, 1, 1.25, 1, 1.15, 1],
            }}
            transition={{
              duration: 0.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Inner mouth opening */}
            <motion.div
              className="absolute inset-2 rounded-full bg-pink-600"
              animate={{
                scaleY: [0.3, 0.9, 0.4, 0.8, 0.5, 0.85, 0.4, 0.75, 0.3],
                scaleX: [0.8, 1, 0.85, 1, 0.9, 1, 0.85, 1, 0.8],
              }}
              transition={{
                duration: 0.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        ) : (
          <div className="w-8 h-2 rounded-full bg-slate-900" />
        )}
      </div>
    </div>
  );
}

