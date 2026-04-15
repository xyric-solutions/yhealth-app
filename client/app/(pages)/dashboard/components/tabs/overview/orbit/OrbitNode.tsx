'use client';

import { useState, useId } from 'react';
import { motion } from 'framer-motion';
import {
  Dumbbell,
  Salad,
  Brain,
  Heart,
  Flame,
  Moon,
  Footprints,
  Droplets,
  Activity,
  Target,
  Sparkles,
  Music,
  type LucideIcon,
} from 'lucide-react';
import type { OrbitNodeData, Point } from './orbit-types';

const ICON_MAP: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  salad: Salad,
  brain: Brain,
  heart: Heart,
  flame: Flame,
  moon: Moon,
  footprints: Footprints,
  droplets: Droplets,
  activity: Activity,
  target: Target,
  sparkles: Sparkles,
  music: Music,
};

interface OrbitNodeProps {
  data: OrbitNodeData;
  position: Point;
  size?: number;
  index?: number;
  onClick?: (id: string) => void;
}

/**
 * A single orbit node — glassmorphism circle with glow halo, progress ring,
 * specular highlight, icon, value, and label.
 */
export function OrbitNode({ data, position, size = 56, index = 0, onClick }: OrbitNodeProps) {
  const uid = useId();
  const [hovered, setHovered] = useState(false);
  const r = size / 2;
  const Icon = ICON_MAP[data.icon] || Sparkles;
  const progress = data.progress ?? 0;

  // progress ring
  const ringR = r + 4;
  const circumference = 2 * Math.PI * ringR;
  const dashOffset = circumference * (1 - progress);

  return (
    <motion.g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick?.(data.id)}
      style={{ cursor: 'pointer' }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.15 + index * 0.07 }}
    >
      {/* ── gradient defs scoped to this node ── */}
      <defs>
        <radialGradient id={`node-bg-${uid}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={data.color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={data.colorEnd || data.color} stopOpacity={0.08} />
        </radialGradient>
        <radialGradient id={`node-glow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={data.color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={data.color} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* ── outer halo ── */}
      <motion.circle
        cx={position.x}
        cy={position.y}
        r={r * 1.8}
        fill={`url(#node-glow-${uid})`}
        animate={{
          r: hovered ? r * 2.2 : r * 1.8,
          opacity: hovered ? 0.7 : 0.35,
        }}
        transition={{ duration: 0.3 }}
        filter="url(#glow-md)"
      />

      {/* ── progress ring ── */}
      {progress > 0 && (
        <>
          {/* track */}
          <circle
            cx={position.x}
            cy={position.y}
            r={ringR}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={2.5}
          />
          {/* fill */}
          <motion.circle
            cx={position.x}
            cy={position.y}
            r={ringR}
            fill="none"
            stroke={data.color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${position.x} ${position.y})`}
            filter="url(#glow-sm)"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, delay: 0.3 + index * 0.07, ease: 'easeOut' }}
          />
        </>
      )}

      {/* ── glassmorphism body ── */}
      <motion.circle
        cx={position.x}
        cy={position.y}
        r={r}
        fill={`url(#node-bg-${uid})`}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
        animate={{
          r: hovered ? r * 1.08 : r,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{ backdropFilter: 'blur(12px)' }}
      />

      {/* ── specular highlight ── */}
      <ellipse
        cx={position.x - r * 0.2}
        cy={position.y - r * 0.24}
        rx={r * 0.28}
        ry={r * 0.16}
        fill="rgba(255,255,255,0.35)"
        style={{ pointerEvents: 'none' }}
      />

      {/* ── icon ── */}
      <foreignObject
        x={position.x - 10}
        y={position.y - (size > 50 ? 18 : 12)}
        width={20}
        height={20}
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex items-center justify-center w-5 h-5">
          <Icon className="w-4 h-4" style={{ color: data.color }} />
        </div>
      </foreignObject>

      {/* ── value ── */}
      <text
        x={position.x}
        y={position.y + (size > 50 ? 6 : 4)}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white font-bold select-none pointer-events-none"
        style={{
          fontSize: size > 50 ? 11 : 9,
          paintOrder: 'stroke',
          stroke: 'rgba(0,0,0,0.5)',
          strokeWidth: 1.5,
        }}
      >
        {data.value}
        {data.unit && (
          <tspan className="fill-white/60 font-normal" style={{ fontSize: size > 50 ? 8 : 7 }}>
            {' '}{data.unit}
          </tspan>
        )}
      </text>

      {/* ── label below node ── */}
      <text
        x={position.x}
        y={position.y + r + 16}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white/70 font-medium select-none pointer-events-none"
        style={{
          fontSize: 10,
          paintOrder: 'stroke',
          stroke: 'rgba(0,0,0,0.7)',
          strokeWidth: 2,
          letterSpacing: '0.03em',
        }}
      >
        {data.label}
      </text>

      {/* ── subtitle ── */}
      {data.subtitle && (
        <text
          x={position.x}
          y={position.y + r + 28}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-white/40 font-normal select-none pointer-events-none"
          style={{
            fontSize: 8,
            paintOrder: 'stroke',
            stroke: 'rgba(0,0,0,0.5)',
            strokeWidth: 1,
          }}
        >
          {data.subtitle}
        </text>
      )}
    </motion.g>
  );
}
