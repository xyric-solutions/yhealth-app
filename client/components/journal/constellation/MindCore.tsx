"use client";

interface Props {
  cx: number;
  cy: number;
}

export function MindCore({ cx, cy }: Props) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: cx,
        top: cy,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
      }}
    >
      {/* Central orb — refined with tighter glow */}
      <div
        className="core-pulse rounded-full"
        style={{
          width: 140,
          height: 140,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(200,180,255,0.6) 25%, rgba(168,85,247,0.35) 50%, rgba(88,28,135,0.1) 75%, transparent 100%)",
          boxShadow:
            "0 0 60px 20px rgba(168,85,247,0.3), 0 0 140px 60px rgba(139,92,246,0.12), 0 0 20px 8px rgba(255,255,255,0.15)",
          animation: "core-breathe 4s ease-in-out infinite",
        }}
      />

      {/* Subtle ripple rings (3) */}
      {[0, 1, 2].map((i) => (
        <div
          key={`ripple-${i}`}
          className="core-ripple absolute rounded-full"
          style={{
            width: 140,
            height: 140,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            border: "1px solid rgba(168, 85, 247, 0.12)",
            animationDelay: `${i * 1}s`,
          }}
        />
      ))}

      {/* Inner orbit ring */}
      <div
        className="core-orbit-ring absolute rounded-full"
        style={{
          width: 280,
          height: 280,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          border: "1px solid rgba(168, 85, 247, 0.06)",
          animationDuration: "14s",
        }}
      />

      {/* Outer orbit ring */}
      <div
        className="core-orbit-ring absolute rounded-full"
        style={{
          width: 420,
          height: 420,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          border: "1px solid rgba(99, 102, 241, 0.04)",
          animationDuration: "20s",
          animationDirection: "reverse",
        }}
      />

      {/* Orbital particles (6 — cleaner) */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const orbitRadius = i < 3 ? 140 : 210;
        const size = 4 + (i % 3) * 1.5;
        const duration = 8 + i * 0.6;
        const colors = [
          "rgba(168, 85, 247, 0.5)",
          "rgba(99, 102, 241, 0.4)",
          "rgba(96, 165, 250, 0.4)",
          "rgba(139, 92, 246, 0.45)",
          "rgba(129, 140, 248, 0.35)",
          "rgba(56, 189, 248, 0.35)",
        ];
        return (
          <div
            key={`particle-${i}`}
            className="core-particle absolute"
            style={{
              left: "50%",
              top: "50%",
              width: orbitRadius * 2,
              height: orbitRadius * 2,
              marginLeft: -orbitRadius,
              marginTop: -orbitRadius,
              animationDuration: `${duration}s`,
              animationDelay: `${i * -1.2}s`,
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                width: size,
                height: size,
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: colors[i],
                boxShadow: `0 0 ${size * 3}px ${size}px ${colors[i]}`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
