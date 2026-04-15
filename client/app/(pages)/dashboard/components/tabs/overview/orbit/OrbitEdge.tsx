'use client';

import { useState, useId } from 'react';
import { motion } from 'framer-motion';
import type { Point } from './orbit-types';

interface OrbitEdgeProps {
  from: Point;
  to: Point;
  color?: string;
  label?: string;
  strength?: number;
  /** index for staggered animation */
  index?: number;
}

/**
 * A glowing connection line between two nodes.
 *
 * Features:
 * - Gradient stroke with node accent color
 * - Animated "flowing light" dash offset
 * - Hover-reveal label at midpoint, rotated to match line angle
 */
export function OrbitEdge({
  from,
  to,
  color = '#22d3ee',
  label,
  strength = 0.6,
  index = 0,
}: OrbitEdgeProps) {
  const uid = useId();
  const [hovered, setHovered] = useState(false);

  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;

  // angle in degrees for label rotation
  let angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  // keep text readable (never upside-down)
  if (angle > 90 || angle < -90) angle += 180;

  const baseWidth = 1 + strength * 2; // 1–3px

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: label ? 'pointer' : 'default' }}
    >
      {/* ── glow layer (wider, blurred) ── */}
      <motion.line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={baseWidth * 3}
        strokeOpacity={hovered ? 0.25 : 0.1}
        strokeLinecap="round"
        filter="url(#glow-sm)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: index * 0.06, ease: 'easeOut' }}
      />

      {/* ── main line ── */}
      <motion.line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={`url(#edge-grad-${uid})`}
        strokeWidth={baseWidth}
        strokeLinecap="round"
        strokeOpacity={hovered ? 0.9 : 0.5}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: index * 0.06, ease: 'easeOut' }}
      />

      {/* ── flowing light dash ── */}
      <motion.line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={baseWidth * 0.8}
        strokeLinecap="round"
        strokeDasharray="6 18"
        animate={{ strokeDashoffset: [0, -48] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        style={{ opacity: hovered ? 0.6 : 0.2 }}
      />

      {/* ── gradient for this edge ── */}
      <defs>
        <linearGradient id={`edge-grad-${uid}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="50%" stopColor={color} stopOpacity={0.7} />
          <stop offset="100%" stopColor={color} stopOpacity={0.3} />
        </linearGradient>
      </defs>

      {/* ── hover label ── */}
      {label && (
        <motion.g
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: hovered ? 1 : 0,
            scale: hovered ? 1 : 0.8,
          }}
          transition={{ duration: 0.2 }}
        >
          <g transform={`translate(${mx},${my}) rotate(${angle})`}>
            {/* background pill */}
            <rect
              x={-label.length * 3.5 - 8}
              y={-11}
              width={label.length * 7 + 16}
              height={22}
              rx={11}
              fill="rgba(10,11,26,0.85)"
              stroke={color}
              strokeWidth={0.5}
              strokeOpacity={0.5}
            />
            <text
              x={0}
              y={1}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white font-medium select-none pointer-events-none"
              style={{
                fontSize: 10,
                paintOrder: 'stroke',
                stroke: 'rgba(0,0,0,0.8)',
                strokeWidth: 2,
                letterSpacing: '0.02em',
              }}
            >
              {label}
            </text>
          </g>
        </motion.g>
      )}
    </g>
  );
}
