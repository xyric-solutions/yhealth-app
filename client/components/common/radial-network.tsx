"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface RadialNetworkProps {
  active: boolean;
  voiceState: "idle" | "listening" | "processing" | "speaking";
  size?: number; // Size of the network in pixels
}

interface Node {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export function RadialNetwork({
  active,
  voiceState,
  size = 400,
}: RadialNetworkProps) {
  // Generate nodes in concentric circles - focus on right side
  const nodes = useMemo(() => {
    const nodeList: Node[] = [];
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Create 4 concentric circles
    const circles = [0.4, 0.55, 0.7, 0.85];
    const nodesPerCircle = [12, 18, 24, 30];
    
    circles.forEach((radiusRatio, circleIndex) => {
      const radius = (size / 2) * radiusRatio;
      const nodeCount = nodesPerCircle[circleIndex];
      const angleStep = (2 * Math.PI) / nodeCount;
      
      for (let i = 0; i < nodeCount; i++) {
        const angle = i * angleStep;
        // Focus on right side: angles from -45° to 135° (270° to 45° in standard)
        const adjustedAngle = angle;
        const x = centerX + radius * Math.cos(adjustedAngle);
        const y = centerY + radius * Math.sin(adjustedAngle);
        
        nodeList.push({
          x,
          y,
          angle: (adjustedAngle * 180) / Math.PI, // Convert to degrees
          radius,
        });
      }
    });
    
    return nodeList;
  }, [size]);

  // Generate connections between nearby nodes - prefer right side connections
  const connections = useMemo(() => {
    const connectionList: Array<{ from: Node; to: Node }> = [];
    const maxConnectionDistance = size * 0.25;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        const distance = Math.sqrt(
          Math.pow(node1.x - node2.x, 2) + Math.pow(node1.y - node2.y, 2)
        );
        
        // Connect nodes that are close enough
        // Prefer connections on right side (angles 270-90 degrees)
        const avgAngle = ((node1.angle + node2.angle) / 2) % 360;
        const isRightSide = (avgAngle >= 270 || avgAngle <= 90) || (avgAngle >= 180 && avgAngle <= 270);
        
        if (distance < maxConnectionDistance && isRightSide) {
          connectionList.push({ from: node1, to: node2 });
        }
      }
    }
    
    return connectionList;
  }, [nodes, size]);

  // Get color based on angle (green on left, yellow on right) - for right side positioning
  const getColorForAngle = (angle: number): string => {
    // Normalize angle to 0-360
    let normalizedAngle = angle % 360;
    if (normalizedAngle < 0) normalizedAngle += 360;
    
    // Map angle to color: green (120°) to yellow (60°)
    // For right side: we want green on left side of network, yellow on right
    // Since network is on right side of orb, left side of network = angles 180-270, right side = angles 270-360/0-90
    let hue: number;
    if (normalizedAngle <= 90 || normalizedAngle >= 270) {
      // Right side of network (yellow)
      if (normalizedAngle <= 90) {
        hue = 60 - (normalizedAngle / 90) * 20; // 60 (yellow) to 40 (orange-yellow)
      } else {
        hue = 40 + ((normalizedAngle - 270) / 90) * 20; // 40 to 60
      }
    } else {
      // Left side of network (green)
      if (normalizedAngle <= 180) {
        hue = 120 - ((normalizedAngle - 90) / 90) * 20; // 120 (green) to 100 (yellow-green)
      } else {
        hue = 100 - ((normalizedAngle - 180) / 90) * 20; // 100 to 80 (yellow-green)
      }
    }
    
    // Use vibrant colors with high saturation
    const saturation = active ? 85 : 60;
    const lightness = active ? 55 : 45;
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // Determine animation properties based on state
  const isAnimated = active && (voiceState === "listening" || voiceState === "speaking");
  const rotationSpeed = voiceState === "listening" ? 20 : voiceState === "speaking" ? 30 : 0;

  return (
    <motion.svg
      width={size}
      height={size}
      className="absolute pointer-events-none"
      style={{
        left: "60%", // Position on right side of orb
        top: "50%",
        transform: "translate(-50%, -50%)",
        clipPath: "inset(0 0 0 30%)", // Clip to show only right side (semi-circular)
      }}
      animate={
        isAnimated
          ? {
              rotate: [0, 360],
            }
          : {}
      }
      transition={{
        rotate: {
          duration: rotationSpeed,
          repeat: Infinity,
          ease: "linear",
        },
      }}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connections */}
      {connections.map((conn, index) => {
        const midAngle = (conn.from.angle + conn.to.angle) / 2;
        const color = getColorForAngle(midAngle);
        const opacity = active ? 0.3 : 0.1;
        
        return (
          <motion.line
            key={`conn-${index}`}
            x1={conn.from.x}
            y1={conn.from.y}
            x2={conn.to.x}
            y2={conn.to.y}
            stroke={color}
            strokeWidth={1}
            opacity={opacity}
            animate={
              isAnimated
                ? {
                    opacity: [opacity, opacity * 1.5, opacity],
                  }
                : {}
            }
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (index % 10) * 0.1,
            }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node, index) => {
        const color = getColorForAngle(node.angle);
        const nodeSize = active ? 3 : 2;
        const opacity = active ? 0.8 : 0.4;
        
        return (
          <motion.circle
            key={`node-${index}`}
            cx={node.x}
            cy={node.y}
            r={nodeSize}
            fill={color}
            filter="url(#glow)"
            opacity={opacity}
            animate={
              isAnimated
                ? {
                    scale: [1, 1.3, 1],
                    opacity: [opacity, opacity * 1.2, opacity],
                  }
                : {}
            }
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (index % 20) * 0.05,
            }}
          />
        );
      })}
    </motion.svg>
  );
}

