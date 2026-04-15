"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface EnhancedNetworkBackgroundProps {
  active: boolean;
  voiceState: "idle" | "listening" | "processing" | "speaking";
}

interface NetworkNode {
  x: number;
  y: number;
  id: number;
  connections: number[];
}

export function EnhancedNetworkBackground({
  active,
  voiceState,
}: EnhancedNetworkBackgroundProps) {
  const shouldReduceMotion = useReducedMotion();
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

  // Generate network nodes
  const nodes = useMemo(() => {
    const nodeList: NetworkNode[] = [];
    const { width, height } = dimensions;
    const nodeCount = Math.floor((width * height) / 15000); // Adaptive density

    // Use a seeded random function for deterministic results
    let seed = 12345;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < nodeCount; i++) {
      nodeList.push({
        x: seededRandom() * width,
        y: seededRandom() * height,
        id: i,
        connections: [],
      });
    }

    // Create connections between nearby nodes
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const node1 = nodeList[i];
        const node2 = nodeList[j];
        const distance = Math.sqrt(
          Math.pow(node1.x - node2.x, 2) + Math.pow(node1.y - node2.y, 2)
        );

        if (distance < 200 && seededRandom() > 0.7) {
          node1.connections.push(j);
          node2.connections.push(i);
        }
      }
    }

    return nodeList;
  }, [dimensions]);

  // Concentric circles around center with rotation
  const circles = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => ({
        radius: 100 + i * 80,
        opacity: 0.05 - i * 0.005,
        delay: i * 0.2,
        rotationSpeed: 30 + i * 5, // Different rotation speeds
        direction: i % 2 === 0 ? 1 : -1, // Alternate directions
      })),
    []
  );

  // Geometric shapes (rectangles)
  const shapes = useMemo(() => {
    // Use a seeded random function for deterministic results
    let seed = 54321;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    return Array.from({ length: 15 }).map((_, i) => ({
      x: seededRandom() * dimensions.width,
      y: seededRandom() * dimensions.height,
      width: 40 + seededRandom() * 60,
      height: 40 + seededRandom() * 60,
      rotation: seededRandom() * 360,
      opacity: 0.03 + seededRandom() * 0.02,
      delay: i * 0.1,
    }));
  }, [dimensions]);

  // Data stream particles
  const particles = useMemo(() => {
    // Use a seeded random function for deterministic results
    let seed = 98765;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      startX: seededRandom() * dimensions.width,
      startY: seededRandom() * dimensions.height,
      endX: seededRandom() * dimensions.width,
      endY: seededRandom() * dimensions.height,
      delay: i * 0.2,
      duration: 3 + seededRandom() * 2,
    }));
  }, [dimensions]);

  const isAnimated = active && (voiceState === "listening" || voiceState === "speaking");
  const baseColor = voiceState === "processing" ? "#7C4DFF" : voiceState === "listening" ? "#00E5FF" : "#1DE9B6";

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <svg
        className="absolute w-full h-full"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="networkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#1DE9B6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#7C4DFF" stopOpacity="0.6" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id="gridPattern"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke={baseColor}
              strokeWidth="0.5"
              opacity="0.1"
            />
          </pattern>
        </defs>

        {/* Grid pattern */}
        <rect
          width="100%"
          height="100%"
          fill="url(#gridPattern)"
          opacity={active ? 0.15 : 0.05}
        />

        {/* Rotating concentric circles with 360 rotation */}
        {!shouldReduceMotion &&
          circles.map((circle, i) => (
            <motion.g
              key={`circle-${i}`}
              animate={{
                rotate: circle.direction * 360,
              }}
              transition={{
                duration: circle.rotationSpeed,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                transformOrigin: `${dimensions.width / 2}px ${dimensions.height / 2}px`,
              }}
            >
              <circle
                cx={dimensions.width / 2}
                cy={dimensions.height / 2}
                r={circle.radius}
                fill="none"
                stroke={baseColor}
                strokeWidth="1"
                opacity={circle.opacity}
              />
              {/* Add dotted pattern for some circles */}
              {i % 3 === 0 && (
                <circle
                  cx={dimensions.width / 2}
                  cy={dimensions.height / 2}
                  r={circle.radius}
                  fill="none"
                  stroke={baseColor}
                  strokeWidth="0.5"
                  strokeDasharray="2 4"
                  opacity={circle.opacity * 0.5}
                />
              )}
            </motion.g>
          ))}

        {/* Network connections */}
        {nodes.map((node) =>
          node.connections.map((targetId) => {
            const target = nodes[targetId];
            if (!target) return null;
            return (
              <motion.line
                key={`conn-${node.id}-${targetId}`}
                x1={node.x}
                y1={node.y}
                x2={target.x}
                y2={target.y}
                stroke={baseColor}
                strokeWidth="0.5"
                opacity={active ? 0.2 : 0.05}
                filter="url(#glow)"
                animate={
                  isAnimated && !shouldReduceMotion
                    ? {
                        opacity: [0.2, 0.5, 0.2],
                        pathLength: [0.5, 1, 0.5],
                      }
                    : {}
                }
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: (node.id % 20) * 0.1,
                }}
              />
            );
          })
        )}

        {/* Network nodes */}
        {nodes.map((node, index) => (
          <motion.circle
            key={`node-${node.id}`}
            cx={node.x}
            cy={node.y}
            r={active ? 2.5 : 1.5}
            fill={baseColor}
            filter="url(#glow)"
            opacity={active ? 0.6 : 0.2}
            animate={
              isAnimated && !shouldReduceMotion
                ? {
                    scale: [1, 1.5, 1],
                    opacity: [0.6, 1, 0.6],
                  }
                : {}
            }
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (index % 30) * 0.05,
            }}
          />
        ))}

        {/* Geometric shapes */}
        {!shouldReduceMotion &&
          shapes.map((shape, i) => (
            <motion.rect
              key={`shape-${i}`}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              fill="none"
              stroke={baseColor}
              strokeWidth="1"
              opacity={shape.opacity}
              transform={`rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`}
              animate={
                isAnimated
                  ? {
                      opacity: [shape.opacity, shape.opacity * 2, shape.opacity],
                      scale: [1, 1.05, 1],
                    }
                  : {}
              }
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: shape.delay,
                ease: "easeInOut",
              }}
            />
          ))}

        {/* Data stream particles */}
        {!shouldReduceMotion &&
          particles.map((particle) => (
            <motion.circle
              key={`particle-${particle.id}`}
              r="2"
              fill={baseColor}
              opacity={0.8}
              filter="url(#glow)"
              animate={{
                cx: [particle.startX, particle.endX],
                cy: [particle.startY, particle.endY],
                opacity: [0, 0.8, 0.8, 0],
              }}
              transition={{
                duration: particle.duration,
                repeat: Infinity,
                delay: particle.delay,
                ease: "linear",
              }}
            />
          ))}

        {/* Wavy lines (data streams) */}
        {!shouldReduceMotion &&
          Array.from({ length: 5 }).map((_, i) => {
            const startY = (dimensions.height / 6) * (i + 1);
            return (
              <motion.path
                key={`wave-${i}`}
                d={`M 0 ${startY} Q ${dimensions.width / 4} ${startY + 20} ${dimensions.width / 2} ${startY} T ${dimensions.width} ${startY}`}
                fill="none"
                stroke={baseColor}
                strokeWidth="1"
                opacity={0.1}
                strokeDasharray="5 5"
                animate={
                  isAnimated
                    ? {
                        pathLength: [0, 1],
                        opacity: [0.1, 0.3, 0.1],
                      }
                    : {}
                }
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: "linear",
                }}
              />
            );
          })}
      </svg>

      {/* Floating light flares */}
      {!shouldReduceMotion && (() => {
        // Use a seeded random function for deterministic results
        let seed = 11111;
        const seededRandom = () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };

        return Array.from({ length: 8 }).map((_, i) => {
          const width = 100 + seededRandom() * 100;
          const height = 100 + seededRandom() * 100;
          const left = seededRandom() * 100;
          const top = seededRandom() * 100;
          const xOffset = (seededRandom() - 0.5) * 100;
          const yOffset = (seededRandom() - 0.5) * 100;
          const duration = 8 + seededRandom() * 4;

          return (
            <motion.div
              key={`flare-${i}`}
              className="absolute rounded-full blur-xl"
              style={{
                width,
                height,
                background: `radial-gradient(circle, ${baseColor}40, transparent 70%)`,
                left: `${left}%`,
                top: `${top}%`,
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.2, 0.4, 0.2],
                x: [0, xOffset, 0],
                y: [0, yOffset, 0],
              }}
              transition={{
                duration,
                repeat: Infinity,
                delay: i * 1,
                ease: "easeInOut",
              }}
            />
          );
        });
      })()}
    </div>
  );
}

