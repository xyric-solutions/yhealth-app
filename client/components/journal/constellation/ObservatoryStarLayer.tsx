"use client";

import { memo } from "react";
import { formatShortDate, getMoodEmoji } from "./constellation-math";

export interface ScreenStar {
  id: string;
  x: number;
  y: number;
  domSize: number;
  color: string;
  glowColor: string;
  brightness: number;
  twinkleSpeed: number;
  twinklePhase: number;
  loggedAt: string;
  sentimentScore?: number | null;
  entryCount?: number;
  dateKey?: string;
}

interface Props {
  stars: ScreenStar[];
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
  onClick: (index: number) => void;
}

export const ObservatoryStarLayer = memo(function ObservatoryStarLayer({
  stars,
  hoveredIndex,
  onHover,
  onClick,
}: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
      {stars.map((star, i) => {
        const isHovered = hoveredIndex === i;
        const scale = isHovered ? 1.25 : 1;
        const coreSize = Math.max(10, star.domSize * 0.35);
        const isNewest = i === stars.length - 1;

        return (
          <div
            key={star.id}
            className="absolute pointer-events-auto cursor-pointer group"
            style={{
              left: star.x,
              top: star.y,
              transform: `translate(-50%, -50%) scale(${scale})`,
              transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onClick(i)}
          >
            {/* Outer pulse ring — newest star gets a persistent pulse */}
            {isNewest && (
              <div
                className="absolute rounded-full"
                style={{
                  inset: -12,
                  border: `1px solid ${star.color}`,
                  opacity: 0.3,
                  animation: "observatory-ring-pulse 3s ease-in-out infinite",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Hover orbit ring */}
            <div
              className="absolute rounded-full"
              style={{
                inset: -8,
                border: `1px solid ${star.color}`,
                opacity: isHovered ? 0.6 : 0,
                transition: "opacity 0.3s ease",
                pointerEvents: "none",
              }}
            />

            {/* Ambient glow layer */}
            <div
              className="star-twinkle absolute rounded-full"
              style={{
                inset: -star.domSize * 0.4,
                background: `radial-gradient(circle, ${star.glowColor}18 0%, transparent 70%)`,
                opacity: 0.5 + star.brightness * 0.5,
                animationDuration: `${star.twinkleSpeed * 1.5}s`,
                animationDelay: `${star.twinklePhase}s`,
                pointerEvents: "none",
              }}
            />

            {/* Glass body — frosted sphere with inner gradient */}
            <div
              className="star-twinkle rounded-full relative overflow-hidden"
              style={{
                width: star.domSize,
                height: star.domSize,
                background: `radial-gradient(circle at 35% 35%, ${star.glowColor}90 0%, ${star.color}70 40%, ${star.color}30 80%, transparent 100%)`,
                boxShadow: [
                  `0 0 ${star.domSize}px ${star.domSize * 0.3}px ${star.glowColor}40`,
                  `inset 0 -${star.domSize * 0.15}px ${star.domSize * 0.3}px ${star.color}20`,
                  `0 0 ${star.domSize * 0.5}px ${star.glowColor}20`,
                ].join(", "),
                opacity: 0.7 + star.brightness * 0.3,
                animationDuration: `${star.twinkleSpeed}s`,
                animationDelay: `${star.twinklePhase}s`,
                backdropFilter: "blur(2px)",
              }}
            >
              {/* Inner bright core */}
              <div
                className="absolute rounded-full"
                style={{
                  width: coreSize,
                  height: coreSize,
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${star.glowColor} 50%, transparent 100%)`,
                  boxShadow: `0 0 ${coreSize}px ${coreSize * 0.5}px ${star.glowColor}60`,
                }}
              />

              {/* Glass highlight (specular) */}
              <div
                className="absolute rounded-full"
                style={{
                  width: star.domSize * 0.35,
                  height: star.domSize * 0.2,
                  top: star.domSize * 0.15,
                  left: star.domSize * 0.2,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)",
                  borderRadius: "50%",
                  filter: "blur(1px)",
                }}
              />
            </div>

            {/* Date label */}
            <div
              className="absolute whitespace-nowrap observatory-font-display text-center"
              style={{
                top: star.domSize + 8,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: isNewest ? 11 : 10,
                letterSpacing: "0.1em",
                color: isHovered ? "#fff" : star.glowColor,
                textShadow: `0 0 10px ${star.glowColor}, 0 1px 6px rgba(0,0,0,0.9)`,
                opacity: isHovered ? 1 : 0.7,
                transition: "all 0.3s ease",
                pointerEvents: "none",
                fontWeight: isNewest ? 600 : 400,
              }}
            >
              {isHovered
                ? `${getMoodEmoji(star.sentimentScore)} ${formatShortDate(star.loggedAt)}`
                : formatShortDate(star.loggedAt)}
            </div>

            {/* Entry count badge — frosted pill */}
            {(star.entryCount ?? 1) > 1 && (
              <div
                className="absolute observatory-font-display"
                style={{
                  top: -6,
                  right: -10,
                  fontSize: 9,
                  lineHeight: "16px",
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${star.color}dd, ${star.glowColor}aa)`,
                  color: "#0a081c",
                  textAlign: "center",
                  fontWeight: 700,
                  pointerEvents: "none",
                  boxShadow: `0 0 8px ${star.glowColor}80, 0 2px 4px rgba(0,0,0,0.5)`,
                  border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(4px)",
                }}
              >
                {star.entryCount}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
