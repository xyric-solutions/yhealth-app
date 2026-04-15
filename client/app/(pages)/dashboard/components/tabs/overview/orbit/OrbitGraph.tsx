'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OrbitSVGFilters } from './OrbitSVGFilters';
import { OrbitHub } from './OrbitHub';
import { OrbitNode } from './OrbitNode';
import { OrbitEdge } from './OrbitEdge';
import type { OrbitNodeData, OrbitEdgeData, Point } from './orbit-types';

interface OrbitGraphProps {
  nodes: OrbitNodeData[];
  edges: OrbitEdgeData[];
  hubLabel?: string;
  hubSubLabel?: string;
  onNodeClick?: (id: string) => void;
}

/**
 * The full "Wellness Orbit" SVG scene.
 *
 * Layout: circular placement of nodes around a central hub.
 * All nodes are evenly distributed on an elliptical orbit.
 * The graph is responsive — it measures its container and scales.
 */
export function OrbitGraph({
  nodes,
  edges,
  hubLabel = 'You',
  hubSubLabel,
  onNodeClick,
}: OrbitGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 700, h: 700 });

  // ── measure container ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      // keep aspect ratio squarish, slightly shorter on desktop
      const h = Math.min(width, 680);
      setDims({ w: width, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMobile = dims.w < 500;
  const cx = dims.w / 2;
  const cy = dims.h / 2;
  const hubSize = isMobile ? 56 : 80;
  const nodeSize = isMobile ? 44 : 56;
  const radiusX = (dims.w / 2) * (isMobile ? 0.6 : 0.72);
  const radiusY = (dims.h / 2) * (isMobile ? 0.55 : 0.65);

  // ── compute node positions on ellipse ──
  const nodePositions = useMemo<Map<string, Point>>(() => {
    const map = new Map<string, Point>();
    const count = nodes.length;
    const startAngle = -Math.PI / 2; // top
    nodes.forEach((n, i) => {
      const angle = startAngle + (2 * Math.PI * i) / count;
      map.set(n.id, {
        x: cx + radiusX * Math.cos(angle),
        y: cy + radiusY * Math.sin(angle),
      });
    });
    return map;
  }, [nodes, cx, cy, radiusX, radiusY]);

  const center: Point = { x: cx, y: cy };

  return (
    <div ref={containerRef} className="w-full relative overflow-hidden select-none">
      {/* ── deep-space background ── */}
      <div
        className="absolute inset-0 rounded-3xl"
        style={{
          background: `
            radial-gradient(ellipse at center, #141632 0%, #0a0b1a 50%, #06060f 100%)
          `,
        }}
      />
      {/* vignette */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* ── animated ambient gradient shift ── */}
      <motion.div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        animate={{
          background: [
            'radial-gradient(ellipse at 45% 45%, rgba(34,211,238,0.04) 0%, transparent 60%)',
            'radial-gradient(ellipse at 55% 55%, rgba(139,92,246,0.04) 0%, transparent 60%)',
            'radial-gradient(ellipse at 45% 45%, rgba(34,211,238,0.04) 0%, transparent 60%)',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── SVG canvas ── */}
      <svg
        width={dims.w}
        height={dims.h}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        className="relative z-10"
        style={{ minHeight: isMobile ? 360 : 500 }}
      >
        <OrbitSVGFilters />

        {/* ── noise overlay ── */}
        <rect width={dims.w} height={dims.h} filter="url(#noise)" opacity={0.3} />

        {/* ── orbit track ── */}
        <motion.ellipse
          cx={cx}
          cy={cy}
          rx={radiusX}
          ry={radiusY}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={1}
          strokeDasharray="4 8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />

        {/* ── edges (hub→node + node→node) ── */}
        {/* hub to every node */}
        {nodes.map((n, i) => {
          const pos = nodePositions.get(n.id);
          if (!pos) return null;
          return (
            <OrbitEdge
              key={`hub-${n.id}`}
              from={center}
              to={pos}
              color={n.color}
              strength={0.4}
              index={i}
            />
          );
        })}

        {/* custom edges */}
        {edges.map((e, i) => {
          const fromPos = nodePositions.get(e.from);
          const toPos = nodePositions.get(e.to);
          if (!fromPos || !toPos) return null;
          // pick color from "from" node
          const fromNode = nodes.find((n) => n.id === e.from);
          return (
            <OrbitEdge
              key={`${e.from}-${e.to}`}
              from={fromPos}
              to={toPos}
              color={fromNode?.color || '#8b5cf6'}
              label={e.label}
              strength={e.strength ?? 0.5}
              index={nodes.length + i}
            />
          );
        })}

        {/* ── nodes ── */}
        {nodes.map((n, i) => {
          const pos = nodePositions.get(n.id);
          if (!pos) return null;
          return (
            <OrbitNode
              key={n.id}
              data={n}
              position={pos}
              size={nodeSize}
              index={i}
              onClick={onNodeClick}
            />
          );
        })}

        {/* ── central hub (rendered last = on top) ── */}
        <OrbitHub center={center} size={hubSize} label={hubLabel} subLabel={hubSubLabel} />
      </svg>
    </div>
  );
}
