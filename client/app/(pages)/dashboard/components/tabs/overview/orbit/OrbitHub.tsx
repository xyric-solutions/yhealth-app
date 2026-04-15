'use client';

import { motion } from 'framer-motion';
import type { Point } from './orbit-types';

interface OrbitHubProps {
  center: Point;
  size?: number;
  label?: string;
  subLabel?: string;
}

/**
 * Central energy core — the glowing orb at the heart of the orbit.
 *
 * Multi-layer construction:
 *  1. Outer halo (large blurred circle)
 *  2. Mid glow ring
 *  3. Core gradient sphere
 *  4. Specular highlight dot
 *  5. Inner bright center
 */
export function OrbitHub({ center, size = 80, label = 'You', subLabel }: OrbitHubProps) {
  const r = size / 2;

  return (
    <g>
      {/* ── layer 1: outer halo ── */}
      <motion.circle
        cx={center.x}
        cy={center.y}
        r={r * 2.2}
        fill="url(#hub-halo)"
        filter="url(#glow-xl)"
        animate={{ r: [r * 2.2, r * 2.5, r * 2.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── layer 2: mid glow ring ── */}
      <motion.circle
        cx={center.x}
        cy={center.y}
        r={r * 1.4}
        fill="none"
        stroke="rgba(34,211,238,0.2)"
        strokeWidth={1.5}
        animate={{
          r: [r * 1.4, r * 1.55, r * 1.4],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── layer 3: core sphere ── */}
      <motion.circle
        cx={center.x}
        cy={center.y}
        r={r}
        fill="url(#hub-core)"
        filter="url(#glow-md)"
        animate={{
          r: [r, r * 1.06, r],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── layer 4: inner bright center ── */}
      <circle
        cx={center.x}
        cy={center.y}
        r={r * 0.35}
        fill="rgba(224,255,255,0.45)"
      />

      {/* ── layer 5: specular highlight ── */}
      <ellipse
        cx={center.x - r * 0.22}
        cy={center.y - r * 0.26}
        rx={r * 0.22}
        ry={r * 0.15}
        fill="rgba(255,255,255,0.55)"
      />

      {/* ── label ── */}
      <text
        x={center.x}
        y={center.y + 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white font-bold text-sm select-none pointer-events-none"
        style={{
          paintOrder: 'stroke',
          stroke: 'rgba(0,0,0,0.6)',
          strokeWidth: 2,
          fontSize: size * 0.18,
        }}
      >
        {label}
      </text>

      {subLabel && (
        <text
          x={center.x}
          y={center.y + size * 0.22}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-cyan-200/80 font-medium select-none pointer-events-none"
          style={{
            paintOrder: 'stroke',
            stroke: 'rgba(0,0,0,0.5)',
            strokeWidth: 1.5,
            fontSize: size * 0.11,
          }}
        >
          {subLabel}
        </text>
      )}
    </g>
  );
}
