"use client";

import { memo } from "react";

interface LinePoint {
  x: number;
  y: number;
  color: string;
}

interface Props {
  width: number;
  height: number;
  cx: number;
  cy: number;
  stars: LinePoint[];
  consecutivePairs: Array<[number, number]>;
}

export const ConstellationSVGLines = memo(function ConstellationSVGLines({
  width,
  height,
  cx,
  cy,
  stars,
  consecutivePairs,
}: Props) {
  if (width === 0 || height === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    >
      <defs>
        {/* Glow filter for lines */}
        <filter id="line-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Stronger glow for constellation connectors */}
        <filter id="constellation-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Radial spokes — dashed from center to each star */}
      <g filter="url(#line-glow)" opacity={0.15}>
        {stars.map((star, i) => (
          <line
            key={`spoke-${i}`}
            x1={cx}
            y1={cy}
            x2={star.x}
            y2={star.y}
            stroke={star.color}
            strokeWidth={0.5}
            strokeDasharray="4 6"
          />
        ))}
      </g>

      {/* Constellation connectors — consecutive days */}
      <g filter="url(#constellation-glow)" opacity={0.4}>
        {consecutivePairs.map(([a, b], i) => {
          const starA = stars[a];
          const starB = stars[b];
          if (!starA || !starB) return null;
          return (
            <line
              key={`conn-${i}`}
              x1={starA.x}
              y1={starA.y}
              x2={starB.x}
              y2={starB.y}
              stroke={starA.color}
              strokeWidth={1}
              strokeLinecap="round"
            />
          );
        })}
      </g>
    </svg>
  );
});
