"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

interface JarvisLoaderProps {
  text?: string;
  progress?: number;
  voiceState?: "idle" | "listening" | "processing" | "speaking";
  isActive?: boolean;
}

export function JarvisLoader({ 
  text = "thinking", 
  progress = 0,
  voiceState = "idle",
  isActive = false 
}: JarvisLoaderProps) {
  const [dots, setDots] = useState("");
  const [dataStream, setDataStream] = useState<string[]>([]);
  const [internalProgress, setInternalProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInternalProgress(progress);
    } else {
      const interval = setInterval(() => {
        setInternalProgress((prev) => (prev >= 100 ? 0 : prev + 0.5));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [progress]);

  useEffect(() => {
    const chars = "01アイウエオカキクケコ■□▪▫●○◆◇";
    const interval = setInterval(() => {
      const newStream = Array.from({ length: 8 }, () =>
        Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
      );
      setDataStream(newStream);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const floatingParticles = useMemo(() => {
    // Use a seeded random function for deterministic results
    let seed = 33333;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    return [...Array(40)].map((_, i) => {
      const angle = (i / 40) * Math.PI * 2;
      const radius = 200 + seededRandom() * 150;
      return {
        id: i,
        angle,
        radius,
        duration: 3 + (i % 4),
        delay: (i * 0.15) % 3,
        size: 1 + (i % 4),
      };
    });
  }, []);

  const hexNodes = useMemo(
    () =>
      [...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 160;
        return {
          id: i,
          x: 200 + radius * Math.cos(angle),
          y: 200 + radius * Math.sin(angle),
          delay: i * 0.15,
        };
      }),
    []
  );

  // Color scheme based on voice state - JARVIS theme
  const getColorScheme = () => {
    switch (voiceState) {
      case "listening":
        return {
          primary: "#00E5FF", // electric cyan
          secondary: "#1DE9B6", // teal
          accent: "#00E5FF",
          dark: "#0B0F14",
        };
      case "processing":
        return {
          primary: "#7C4DFF", // soft violet
          secondary: "#00E5FF", // cyan
          accent: "#7C4DFF",
          dark: "#0B0F14",
        };
      case "speaking":
        return {
          primary: "#1DE9B6", // teal
          secondary: "#00E5FF", // cyan
          accent: "#1DE9B6",
          dark: "#0B0F14",
        };
      default:
        return {
          primary: "#1DE9B6", // teal
          secondary: "#00E5FF", // cyan
          accent: "#1DE9B6",
          dark: "#0B0F14",
        };
    }
  };

  const colors = getColorScheme();
  const currentProgress = progress > 0 ? progress : internalProgress;

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full">
      {/* Animated background layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[1400px] rounded-full blur-[300px]"
          style={{ backgroundColor: `${colors.dark}30` }}
          animate={{ 
            scale: isActive ? [1, 1.1, 1] : 1,
            opacity: isActive ? [0.3, 0.5, 0.3] : 0.2
          }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full blur-[200px]"
          style={{ backgroundColor: `${colors.primary}40` }}
          animate={{ 
            scale: isActive ? [1, 1.2, 1] : 1,
            opacity: isActive ? [0.4, 0.6, 0.4] : 0.3
          }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[150px]"
          style={{ backgroundColor: `${colors.secondary}30` }}
          animate={{ 
            scale: isActive ? [1, 1.15, 1] : 1,
            opacity: isActive ? [0.3, 0.5, 0.3] : 0.25
          }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fillRule='evenodd'%3E%3Cg fill='${colors.primary.replace('#', '%23')}' fillOpacity='1'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Scanning lines */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-current to-transparent"
          style={{ color: `${colors.primary}30` }}
          animate={{ y: [0, 1000, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-current to-transparent"
          style={{ 
            left: "50%",
            color: `${colors.primary}20`
          }}
          animate={{ x: [0, 100, -100, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Data streams */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-30 font-mono text-[10px] pointer-events-none hidden md:block">
        {dataStream.map((line, i) => (
          <motion.div
            key={i}
            className="text-current"
            style={{ color: colors.secondary }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
          >
            {line}
          </motion.div>
        ))}
      </div>
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-30 font-mono text-[10px] text-right pointer-events-none hidden md:block">
        {dataStream
          .slice()
          .reverse()
          .map((line, i) => (
            <motion.div
              key={i}
              className="text-current"
              style={{ color: colors.secondary }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
            >
              {line}
            </motion.div>
          ))}
      </div>

      {/* Main orb container */}
      <div className="relative w-[13rem] h-[13rem] lg:w-[15rem] lg:h-[15rem]">
        {/* SVG Layer for advanced effects */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
          <defs>
            <filter id={`glow-${voiceState}`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="8" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id={`glowStrong-${voiceState}`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="15" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id={`coreGradient-${voiceState}`} cx="35%" cy="35%">
              <stop offset="0%" stopColor={colors.accent} />
              <stop offset="20%" stopColor={colors.secondary} />
              <stop offset="40%" stopColor={colors.primary} />
              <stop offset="60%" stopColor={colors.dark} />
              <stop offset="100%" stopColor="#000000" />
            </linearGradient>

            <linearGradient id={`progressGrad-${voiceState}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.accent} />
              <stop offset="50%" stopColor={colors.primary} />
              <stop offset="100%" stopColor={colors.dark} />
            </linearGradient>
          </defs>

          {/* Rotating rings */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "200px 200px" }}
          >
            <circle
              cx="200"
              cy="200"
              r="195"
              fill="none"
              stroke={colors.primary}
              strokeWidth="0.5"
              strokeDasharray="4 8 1 8"
              opacity="0.3"
            />
          </motion.g>

          <motion.g
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "200px 200px" }}
          >
            <circle
              cx="200"
              cy="200"
              r="185"
              fill="none"
              stroke={colors.secondary}
              strokeWidth="1"
              strokeDasharray="1 15 8 15"
              opacity="0.4"
            />
          </motion.g>

          {/* Hexagon nodes */}
          {hexNodes.map((node) => (
            <g key={node.id}>
              <line
                x1="200"
                y1="200"
                x2={node.x}
                y2={node.y}
                stroke={colors.primary}
                strokeWidth="0.5"
                opacity="0.2"
                strokeDasharray="2 4"
              />
              <polygon
                points={`${node.x},${node.y - 6} ${node.x + 5},${node.y - 3} ${node.x + 5},${node.y + 3} ${node.x},${node.y + 6} ${node.x - 5},${node.y + 3} ${node.x - 5},${node.y - 3}`}
                fill="none"
                stroke={colors.secondary}
                strokeWidth="1"
                opacity="0.6"
                filter={`url(#glow-${voiceState})`}
              >
                <animate
                  attributeName="opacity"
                  values="0.3;1;0.3"
                  dur="2s"
                  begin={`${node.delay}s`}
                  repeatCount="indefinite"
                />
              </polygon>
              <circle
                cx={node.x}
                cy={node.y}
                r="2"
                fill={colors.secondary}
              >
                <animate
                  attributeName="opacity"
                  values="0.3;1;0.3"
                  dur="2s"
                  begin={`${node.delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}

          {/* Orbital ellipses */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "200px 200px" }}
          >
            <ellipse
              cx="200"
              cy="200"
              rx="130"
              ry="50"
              fill="none"
              stroke={colors.secondary}
              strokeWidth="2"
              opacity="0.7"
              filter={`url(#glowStrong-${voiceState})`}
            />
            <circle cx="330" cy="200" r="7" fill={colors.accent} filter={`url(#glowStrong-${voiceState})`} />
          </motion.g>

          {/* Progress ring */}
          <circle
            cx="200"
            cy="200"
            r="195"
            fill="none"
            stroke={`${colors.primary}15`}
            strokeWidth="0.5"
          />
          <circle
            cx="200"
            cy="200"
            r="195"
            fill="none"
            stroke={`url(#progressGrad-${voiceState})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${currentProgress * 6.12} 612`}
            transform="rotate(-90 200 200)"
            filter={`url(#glow-${voiceState})`}
            opacity={isActive ? 1 : 0.5}
          />
        </svg>

        {/* Main glowing orb */}
        <div className="absolute inset-[25%] rounded-full overflow-hidden">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${colors.accent} 0%, ${colors.secondary} 15%, ${colors.primary} 30%, ${colors.dark} 60%, #000000 100%)`,
            }}
          />

          {/* Internal energy waves */}
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <motion.div
              className="absolute w-[200%] h-[200%] -left-1/2"
              style={{
                background: `linear-gradient(180deg, transparent 30%, ${colors.primary}40 45%, ${colors.secondary}50 55%, ${colors.dark}30 70%, transparent 80%)`,
              }}
              animate={{ y: isActive ? [0, -100, 0] : 0 }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute w-[200%] h-[200%] -left-1/2"
              style={{
                background: `linear-gradient(180deg, transparent 35%, ${colors.accent}30 50%, ${colors.secondary}40 60%, transparent 75%)`,
              }}
              animate={{ y: isActive ? [0, 100, 0] : 0 }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            />
          </div>

          {/* Highlight reflection */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `
                radial-gradient(ellipse 60% 35% at 30% 25%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.3) 30%, transparent 60%),
                radial-gradient(ellipse 25% 15% at 70% 80%, rgba(255, 255, 255, 0.2) 0%, transparent 50%)
              `,
            }}
          />

          {/* Inner glow */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: `
                inset 0 0 60px ${colors.primary}60,
                inset 0 0 100px ${colors.dark}40,
                inset 0 -20px 50px #00000050
              `,
            }}
            animate={{ opacity: isActive ? [0.6, 1, 0.6] : 0.4 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>

        {/* Outer glow effect */}
        <motion.div
          className="absolute inset-[20%] rounded-full pointer-events-none"
          style={{
            boxShadow: `
              0 0 60px ${colors.accent}50,
              0 0 100px ${colors.secondary}60,
              0 0 150px ${colors.primary}50,
              0 0 200px ${colors.primary}40,
              0 0 280px ${colors.dark}30,
              0 0 350px ${colors.dark}20
            `,
          }}
          animate={{ 
            opacity: isActive ? [0.5, 1, 0.5] : 0.3,
            scale: isActive ? [1, 1.05, 1] : 1
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Corner brackets */}
        <div className={`absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2`} style={{ borderColor: `${colors.primary}40` }} />
        <div className={`absolute -top-4 -right-4 w-8 h-8 border-t-2 border-r-2`} style={{ borderColor: `${colors.primary}40` }} />
        <div className={`absolute -bottom-4 -left-4 w-8 h-8 border-b-2 border-l-2`} style={{ borderColor: `${colors.primary}40` }} />
        <div className={`absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2`} style={{ borderColor: `${colors.primary}40` }} />
      </div>

      {/* Status text */}
      {text && (
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-white/90 text-xl lg:text-2xl font-light tracking-[0.2em] lowercase" style={{ color: colors.accent }}>
            {text}
            <span className="inline-block w-8 text-left" style={{ color: colors.primary }}>
              {dots}
            </span>
          </p>
          {currentProgress > 0 && (
            <p className="mt-4 text-sm tracking-widest font-mono" style={{ color: `${colors.primary}60` }}>
              {Math.round(currentProgress)}% complete
            </p>
          )}
        </motion.div>
      )}

      {/* Floating particles */}
      {floatingParticles.map((particle) => {
        const x = 50 + (particle.radius / 10) * Math.cos(particle.angle);
        const y = 50 + (particle.radius / 10) * Math.sin(particle.angle);
        return (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: particle.size,
              height: particle.size,
              background: `radial-gradient(circle, ${colors.accent} 0%, ${colors.secondary}90 30%, ${colors.primary}50 60%, transparent 100%)`,
              boxShadow: `0 0 ${particle.size * 6}px ${colors.secondary}80, 0 0 ${particle.size * 12}px ${colors.primary}50`,
            }}
            animate={{
              x: [0, Math.cos(particle.angle) * 20, 0],
              y: [0, Math.sin(particle.angle) * 20, 0],
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        );
      })}

      {/* Scanning beam */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 5%, ${colors.accent}50 25%, ${colors.secondary}90 45%, ${colors.primary} 50%, ${colors.secondary}90 55%, ${colors.accent}50 75%, transparent 95%)`,
          boxShadow: `
            0 0 40px ${colors.primary}80,
            0 0 80px ${colors.primary}60,
            0 0 120px ${colors.primary}40
          `,
        }}
        animate={{ y: [0, 1000, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

