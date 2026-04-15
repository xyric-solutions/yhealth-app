"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface GlowingOrbWavesProps {
  size: number;
  active: boolean;
  voiceState: "idle" | "listening" | "processing" | "speaking";
}

export function GlowingOrbWaves({
  size,
  active,
  voiceState,
}: GlowingOrbWavesProps) {
  // Generate wave paths that flow from left to right - more organic shapes
  const wavePaths = useMemo(() => {
    const paths = [];
    const waveCount = 5;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.42; // Slightly smaller than the orb
    
    for (let i = 0; i < waveCount; i++) {
      const amplitude = 20 + i * 10; // Increasing amplitude
      const frequency = 0.015 + i * 0.008; // Varying frequency
      const yOffset = (i - waveCount / 2) * (size * 0.12); // Vertical spacing
      const segments = 80;
      const width = radius * 1.6; // Wave width
      
      const topPoints: Array<{ x: number; y: number }> = [];
      const bottomPoints: Array<{ x: number; y: number }> = [];
      
      for (let j = 0; j <= segments; j++) {
        const progress = j / segments;
        const x = centerX + (progress - 0.5) * width;
        
        // Create flowing wave pattern
        const waveY = centerY + yOffset + amplitude * Math.sin(progress * Math.PI * 3 * frequency + i * Math.PI * 0.7);
        const waveThickness = 12 + i * 3; // Varying thickness
        
        const topY = waveY - waveThickness / 2;
        const bottomY = waveY + waveThickness / 2;
        
        // Constrain to circle
        const constrainPoint = (px: number, py: number) => {
          const distFromCenter = Math.sqrt(Math.pow(px - centerX, 2) + Math.pow(py - centerY, 2));
          if (distFromCenter > radius) {
            const scale = radius / distFromCenter;
            return {
              x: centerX + (px - centerX) * scale,
              y: centerY + (py - centerY) * scale,
            };
          }
          return { x: px, y: py };
        };
        
        topPoints.push(constrainPoint(x, topY));
        bottomPoints.push(constrainPoint(x, bottomY));
      }
      
      // Create closed path (top edge, right edge, bottom edge reversed, left edge)
      let path = `M ${topPoints[0].x} ${topPoints[0].y}`;
      
      // Top edge with smooth curves
      for (let j = 1; j < topPoints.length; j++) {
        const prev = topPoints[j - 1];
        const curr = topPoints[j];
        const next = topPoints[Math.min(j + 1, topPoints.length - 1)];
        
        const cp1x = prev.x + (curr.x - prev.x) / 3;
        const cp1y = prev.y;
        const cp2x = curr.x - (next.x - curr.x) / 3;
        const cp2y = curr.y;
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
      
      // Right edge
      path += ` L ${bottomPoints[bottomPoints.length - 1].x} ${bottomPoints[bottomPoints.length - 1].y}`;
      
      // Bottom edge reversed with smooth curves
      for (let j = bottomPoints.length - 2; j >= 0; j--) {
        const prev = bottomPoints[j + 1];
        const curr = bottomPoints[j];
        const next = bottomPoints[Math.max(j - 1, 0)];
        
        const cp1x = prev.x - (prev.x - curr.x) / 3;
        const cp1y = prev.y;
        const cp2x = curr.x + (curr.x - next.x) / 3;
        const cp2y = curr.y;
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
      
      // Close path
      path += " Z";
      
      paths.push({
        path,
        index: i,
        opacity: 0.5 - i * 0.08, // Decreasing opacity for depth
      });
    }
    
    return paths;
  }, [size]);

  const isAnimated = active && (voiceState === "listening" || voiceState === "speaking");

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 pointer-events-none"
      style={{
        filter: "blur(0.5px)",
      }}
    >
      <defs>
        {/* Gradient for waves: cyan/blue (left) to purple/pink (right) */}
        <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(180, 100%, 70%)" stopOpacity="0.8" /> {/* Cyan */}
          <stop offset="25%" stopColor="hsl(200, 100%, 65%)" stopOpacity="0.75" /> {/* Light Blue */}
          <stop offset="50%" stopColor="hsl(240, 80%, 70%)" stopOpacity="0.7" /> {/* Blue */}
          <stop offset="75%" stopColor="hsl(280, 70%, 70%)" stopOpacity="0.75" /> {/* Purple */}
          <stop offset="100%" stopColor="hsl(320, 75%, 75%)" stopOpacity="0.8" /> {/* Magenta/Pink */}
        </linearGradient>
        
        {/* Glow filter */}
        <filter id="wave-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Wave paths - filled shapes for more visual impact */}
      {wavePaths.map((wave, index) => {
        // Create a closed path for filling
        const closedPath = wave.path + " Z";
        
        return (
          <motion.path
            key={`wave-${index}`}
            d={closedPath}
            fill="url(#wave-gradient)"
            opacity={wave.opacity * 0.4} // More translucent
            filter="url(#wave-glow)"
            style={{
              mixBlendMode: "screen", // Additive blending for glow effect
            }}
            animate={
              isAnimated
                ? {
                    opacity: [wave.opacity * 0.2, wave.opacity * 0.5, wave.opacity * 0.2],
                    x: [0, 5, 0], // Subtle horizontal movement
                  }
                : {}
            }
            transition={{
              duration: 4 + index * 0.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.4,
            }}
          />
        );
      })}
    </svg>
  );
}

