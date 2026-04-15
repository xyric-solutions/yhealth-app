"use client";

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";

interface BackgroundNetworkProps {
  active: boolean;
  voiceState: "idle" | "listening" | "processing" | "speaking";
}

interface Node {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export function BackgroundNetwork({
  active,
  voiceState,
}: BackgroundNetworkProps) {
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

  // Generate nodes across the entire viewport
  const nodes = useMemo(() => {
    const nodeList: Node[] = [];
    const { width: viewportWidth, height: viewportHeight } = dimensions;
    
    // Create a grid of nodes with some randomness
    const gridCols = Math.ceil(viewportWidth / 120);
    const gridRows = Math.ceil(viewportHeight / 120);
    
    // Use a seeded random function for deterministic results
    let seed = 44444;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const baseX = (col / gridCols) * viewportWidth;
        const baseY = (row / gridRows) * viewportHeight;
        
        // Add some randomness to make it more organic
        const x = baseX + (seededRandom() - 0.5) * 60;
        const y = baseY + (seededRandom() - 0.5) * 60;
        
        // Calculate angle and radius from center
        const centerX = viewportWidth / 2;
        const centerY = viewportHeight / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const radius = Math.sqrt(dx * dx + dy * dy);
        
        nodeList.push({ x, y, angle, radius });
      }
    }
    
    return nodeList;
  }, [dimensions]);

  // Generate connections between nearby nodes
  const connections = useMemo(() => {
    const connectionList: Array<{ from: Node; to: Node }> = [];
    const maxConnectionDistance = 200;
    
    // Use a seeded random function for deterministic results
    let seed = 55555;
    const seededRandom = () => {
      // eslint-disable-next-line react-hooks/immutability
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        const distance = Math.sqrt(
          Math.pow(node1.x - node2.x, 2) + Math.pow(node1.y - node2.y, 2)
        );
        
        // Connect nodes that are close enough
        if (distance < maxConnectionDistance) {
          // Add some randomness to connections (not all nearby nodes connect)
          if (seededRandom() > 0.7) {
            connectionList.push({ from: node1, to: node2 });
          }
        }
      }
    }
    
    return connectionList;
  }, [nodes]);

  // Get color based on position (green to yellow gradient from left to right)
  const getColorForNode = (node: Node): string => {
    const { width: viewportWidth } = dimensions;
    const normalizedX = node.x / viewportWidth;
    
    // Map from green (left) to yellow (right)
    // Green: hsl(120, 85%, 55%)
    // Yellow: hsl(60, 85%, 55%)
    const hue = 120 - normalizedX * 60; // 120 (green) to 60 (yellow)
    const saturation = active ? 85 : 60;
    const lightness = active ? 55 : 45;
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // Determine animation properties based on state
  const isAnimated = active && (voiceState === "listening" || voiceState === "speaking");
  const connectionOpacity = active ? 0.2 : 0.05;
  const nodeOpacity = active ? 0.6 : 0.2;

  return (
    <motion.svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{
        top: 0,
        left: 0,
        width: dimensions.width,
        height: dimensions.height,
        zIndex: 0,
      }}
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      preserveAspectRatio="none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <defs>
        <filter id="bg-glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="bg-network-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(120, 85%, 55%)" />
          <stop offset="100%" stopColor="hsl(60, 85%, 55%)" />
        </linearGradient>
      </defs>

      {/* Connections */}
      {connections.map((conn, index) => {
        const midX = (conn.from.x + conn.to.x) / 2;
        const { width: viewportWidth } = dimensions;
        const normalizedX = midX / viewportWidth;
        const hue = 120 - normalizedX * 60;
        const color = `hsl(${hue}, ${active ? 85 : 60}%, ${active ? 55 : 45}%)`;
        
        return (
          <motion.line
            key={`conn-${index}`}
            x1={conn.from.x}
            y1={conn.from.y}
            x2={conn.to.x}
            y2={conn.to.y}
            stroke={color}
            strokeWidth={0.5}
            opacity={connectionOpacity}
            filter="url(#bg-glow)"
            animate={
              isAnimated
                ? {
                    opacity: [connectionOpacity, connectionOpacity * 1.8, connectionOpacity],
                    pathLength: [0.5, 1, 0.5],
                  }
                : {}
            }
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (index % 20) * 0.1,
            }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node, index) => {
        const color = getColorForNode(node);
        const nodeSize = active ? 2.5 : 1.5;
        
        return (
          <motion.circle
            key={`node-${index}`}
            cx={node.x}
            cy={node.y}
            r={nodeSize}
            fill={color}
            filter="url(#bg-glow)"
            opacity={nodeOpacity}
            animate={
              isAnimated
                ? {
                    scale: [1, 1.5, 1],
                    opacity: [nodeOpacity, nodeOpacity * 1.5, nodeOpacity],
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
        );
      })}
    </motion.svg>
  );
}

