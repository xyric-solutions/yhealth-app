"use client";

import { useMemo, useEffect, useState } from "react";
import { motion } from "framer-motion";

export function HorizontalWaves() {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const { width, height } = dimensions;
  // Generate wave paths with different amplitudes and frequencies
  const waveLayers = useMemo(() => {
    const layers = [];
    const layerCount = 4;
    
    for (let i = 0; i < layerCount; i++) {
      const amplitude = 30 + i * 15; // Increasing amplitude
      const frequency = 0.01 + i * 0.005; // Varying frequency
      const yOffset = height * 0.3 + (i * height * 0.15); // Vertical spacing
      const opacity = 0.15 - i * 0.03; // Decreasing opacity for depth
      const speed = 0.5 + i * 0.2; // Varying animation speed
      
      // Generate wave path using cubic Bezier curves
      const points: Array<{ x: number; y: number }> = [];
      const segments = 50;
      
      for (let j = 0; j <= segments; j++) {
        const x = (j / segments) * width;
        const y =
          yOffset +
          amplitude *
            Math.sin(
              (j / segments) * Math.PI * 2 * frequency * segments + i * Math.PI
            );
        points.push({ x, y });
      }
      
      // Convert points to SVG path
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let j = 1; j < points.length; j++) {
        const prev = points[j - 1];
        const curr = points[j];
        const next = points[Math.min(j + 1, points.length - 1)];
        
        // Use cubic Bezier for smooth curves
        const cp1x = prev.x + (curr.x - prev.x) / 3;
        const cp1y = prev.y;
        const cp2x = curr.x - (next.x - curr.x) / 3;
        const cp2y = curr.y;
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
      
      // Close the path to create a fillable shape
      path += ` L ${width} ${height} L 0 ${height} Z`;
      
      layers.push({
        path,
        opacity,
        speed,
        yOffset,
      });
    }
    
    return layers;
  }, [width, height]);

  // Color gradient stops: blue/teal (left) → purple (center) → pink (right)
  const gradientId = "wave-gradient";
  const gradientColors = [
    { offset: "0%", color: "hsl(187, 100%, 50%)" }, // Teal
    { offset: "30%", color: "hsl(217, 91%, 60%)" }, // Blue
    { offset: "50%", color: "hsl(262, 83%, 58%)" }, // Purple
    { offset: "70%", color: "hsl(300, 70%, 60%)" }, // Magenta
    { offset: "100%", color: "hsl(330, 75%, 65%)" }, // Pink
  ];

  return (
    <motion.svg
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{
        width: "100%",
        height: "100%",
        zIndex: 0,
      }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {gradientColors.map((stop, index) => (
            <stop
              key={index}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity="0.4"
            />
          ))}
        </linearGradient>
        <filter id="wave-blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {waveLayers.map((layer, index) => (
        <motion.path
          key={`wave-${index}`}
          d={layer.path}
          fill={`url(#${gradientId})`}
          opacity={layer.opacity}
          filter="url(#wave-blur)"
          animate={{
            x: [0, -width * 0.1, 0],
          }}
          transition={{
            duration: 20 / layer.speed,
            repeat: Infinity,
            ease: "linear",
            delay: index * 2,
          }}
        />
      ))}
    </motion.svg>
  );
}

